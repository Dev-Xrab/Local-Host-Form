import { Router } from "express";
import * as authRepo from "./repository.js";
import { buildGoogleAuthUrl, exchangeGoogleCode, fetchGoogleUserInfo } from "./google.js";
import { challengeFromVerifier } from "./pkce.js";
import { requireBearer } from "./middleware.js";
import { cleanupExpiredOAuthArtifacts } from "../db.js";

export const authRouter = Router();

// Only a loopback callback on the local desktop app's own server is ever allowed to receive
// the OAuth handoff — this is the anti-open-redirect check. No other host, including https
// ones, is accepted here.
const LOCAL_REDIRECT_PATTERN = /^http:\/\/(localhost|127\.0\.0\.1):\d{2,5}\/api\/cloud\/auth\/callback$/;

// The local server sends a randomUUID state and an S256 challenge (43 base64url chars).
const STATE_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;
const CODE_CHALLENGE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

authRouter.get("/google/start", async (req, res) => {
  const { state, code_challenge: codeChallenge, redirect_uri: redirectUri } = req.query;

  if (typeof state !== "string" || !STATE_PATTERN.test(state)) {
    return res.status(400).send("Missing or invalid state.");
  }
  if (typeof codeChallenge !== "string" || !CODE_CHALLENGE_PATTERN.test(codeChallenge)) {
    return res.status(400).send("Missing or invalid code_challenge.");
  }
  if (!redirectUri || typeof redirectUri !== "string" || !LOCAL_REDIRECT_PATTERN.test(redirectUri)) {
    return res.status(400).send("Invalid redirect_uri.");
  }

  await cleanupExpiredOAuthArtifacts();
  await authRepo.createOAuthState({ state, codeChallenge, localRedirectUri: redirectUri });
  res.redirect(buildGoogleAuthUrl(state));
});

authRouter.get("/google/callback", async (req, res) => {
  const { code, state, error } = req.query;
  // `error` comes straight from the query string — escaped, or this page is a reflected-XSS sink.
  if (error) return res.status(400).send(`Google sign-in failed: ${escapeHtml(error)}`);
  if (typeof code !== "string" || typeof state !== "string" || code.length > 2048 || !STATE_PATTERN.test(state)) {
    return res.status(400).send("Missing code or state.");
  }

  const stateRow = await authRepo.consumeOAuthState(String(state));
  if (!stateRow) return res.status(400).send("This sign-in link has expired. Please try again from the app.");

  try {
    const tokens = await exchangeGoogleCode(String(code));
    const profile = await fetchGoogleUserInfo(tokens.access_token);
    if (!profile.sub || !profile.email) {
      return res.status(502).send("Google did not return a usable profile.");
    }

    const user = await authRepo.upsertUserByGoogleId({
      googleId: profile.sub,
      email: profile.email,
      name: profile.name || "",
      avatarUrl: profile.picture || null,
      googleRefreshToken: tokens.refresh_token || null,
    });

    const handoff = await authRepo.createHandoff({ userId: user.id, codeChallenge: stateRow.code_challenge });
    const redirectUrl = new URL(stateRow.local_redirect_uri);
    redirectUrl.searchParams.set("handoff", handoff);
    // Echoed back so the local server can find the matching in-memory PKCE verifier it
    // generated at /start — the verifier itself never left that process.
    redirectUrl.searchParams.set("state", String(state));
    res.redirect(redirectUrl.toString());
  } catch (err) {
    console.error("Google OAuth callback failed:", err);
    res.status(502).send("Sign-in failed while talking to Google. Please try again.");
  }
});

authRouter.post("/exchange", async (req, res) => {
  const { handoff, codeVerifier, deviceId, deviceName } = req.body || {};
  if (!handoff || !codeVerifier || !deviceId) {
    return res.status(400).json({ error: "handoff, codeVerifier, and deviceId are required." });
  }
  if (typeof deviceId !== "string" || !UUID_PATTERN.test(deviceId) || String(codeVerifier).length > 256) {
    return res.status(400).json({ error: "Invalid sign-in request." });
  }
  if (deviceName !== undefined && (typeof deviceName !== "string" || deviceName.length > 200)) {
    return res.status(400).json({ error: "Invalid device name." });
  }

  const handoffRow = await authRepo.consumeHandoff(String(handoff));
  if (!handoffRow) {
    return res.status(400).json({ error: "This sign-in attempt has expired. Please sign in again." });
  }

  if (challengeFromVerifier(String(codeVerifier)) !== handoffRow.code_challenge) {
    return res.status(400).json({ error: "PKCE verification failed." });
  }

  // A device id already registered to a different account can't be claimed (or renamed) by
  // another sign-in — device ids are client-chosen, so they're not proof of anything on their own.
  const deviceOk = await authRepo.upsertDevice({ deviceId, userId: handoffRow.user_id, name: deviceName });
  if (!deviceOk) {
    return res.status(409).json({ error: "This device is registered to a different account." });
  }
  const user = await authRepo.getUserById(handoffRow.user_id);
  const session = await authRepo.issueSession({ userId: handoffRow.user_id, deviceId: String(deviceId) });
  const refresh = await authRepo.issueRefreshToken({ userId: handoffRow.user_id, deviceId: String(deviceId) });

  res.json({
    accessToken: session.token,
    accessTokenExpiresAt: session.expiresAt,
    refreshToken: refresh.token,
    refreshTokenExpiresAt: refresh.expiresAt,
    user,
  });
});

authRouter.post("/refresh", async (req, res) => {
  const { refreshToken } = req.body || {};
  if (!refreshToken) return res.status(400).json({ error: "refreshToken is required." });

  const consumed = await authRepo.consumeRefreshToken(String(refreshToken));
  if (!consumed) return res.status(401).json({ error: "Refresh token is invalid, expired, or already used." });

  const user = await authRepo.getUserById(consumed.userId);
  if (!user) return res.status(401).json({ error: "Account no longer exists." });

  const session = await authRepo.issueSession({ userId: consumed.userId, deviceId: consumed.deviceId });
  const refresh = await authRepo.issueRefreshToken({ userId: consumed.userId, deviceId: consumed.deviceId });

  res.json({
    accessToken: session.token,
    accessTokenExpiresAt: session.expiresAt,
    refreshToken: refresh.token,
    refreshTokenExpiresAt: refresh.expiresAt,
    user,
  });
});

authRouter.post("/logout", async (req, res) => {
  const { refreshToken } = req.body || {};
  if (refreshToken) await authRepo.revokeRefreshToken(String(refreshToken));
  res.status(204).end();
});

authRouter.get("/me", requireBearer, async (req, res) => {
  const user = await authRepo.getUserById(req.userId);
  if (!user) return res.status(404).json({ error: "Account no longer exists." });
  res.json(user);
});
