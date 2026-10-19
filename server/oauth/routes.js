import { Router } from "express";
import os from "node:os";
import * as cloudRepo from "../cloud/repository.js";
import { requireAuth } from "../auth/middleware.js";
import { CALLBACK_PATH, DRIVE_APPDATA_SCOPE, hasGoogleFormsAccess, isConfigured } from "./config.js";
import { launchTokens, newLaunchToken, pendingAttempts } from "./flowStore.js";
import { OAuthError, buildAuthorizationUrl, exchangeCode, fetchUserInfo, revokeToken } from "./googleClient.js";
import { sendPage } from "./pages.js";
import { codeChallengeS256, createCodeVerifier, createState } from "./pkce.js";

export const oauthRouter = Router();

oauthRouter.use((req, res, next) => {
  if (!isConfigured()) {
    return res.status(503).json({ error: "Google Drive sync is not set up in this build (no Google OAuth client id)." });
  }
  next();
});

// Google only accepts a loopback callback for a desktop client, but the host may have opened this app
// through its LAN address. When the browser is on the same machine as this server, localhost reaches
// the very same process, so the callback is pointed there. A request from another device can't
// complete the sign-in (the callback would land on that device).
function isSameMachine(req) {
  const addr = String(req.socket.remoteAddress || "").replace(/^::ffff:/, "");
  if (addr === "::1" || addr.startsWith("127.")) return true;
  return Object.values(os.networkInterfaces()).flat().some((i) => i && i.address === addr);
}

const isLoopbackHost = (host) => /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host || "");

// Step 1 (cookie-authenticated, called by the app): mint a single-use launch token and return the
// URL to open in the OS browser. Google rejects OAuth from embedded webviews.
oauthRouter.post("/auth/launch", requireAuth, (req, res) => {
  const token = newLaunchToken();
  launchTokens.set(token, true);
  const url = new URL(`${req.protocol}://${req.get("host")}/api/cloud/auth/start`);
  url.searchParams.set("launchToken", token);
  res.json({ url: url.toString() });
});

// Step 2 (OS browser, no session cookie): validate the launch token, create the PKCE/state pair and
// redirect to Google.
oauthRouter.get("/auth/start", (req, res) => {
  const launchToken = req.query.launchToken;
  if (typeof launchToken !== "string" || !launchTokens.take(launchToken)) {
    return sendPage(res, 403, "This sign-in link is invalid or has expired. Start again from the app.");
  }

  let callbackHost = req.get("host");
  if (!isLoopbackHost(callbackHost)) {
    if (!isSameMachine(req)) {
      return sendPage(res, 403, `Google sign-in has to be done on the computer that runs Self Host Form, using http://localhost:${req.socket.localPort}. Open it there and try again.`);
    }
    callbackHost = `localhost:${req.socket.localPort}`;
  }
  const redirectUri = `http://${callbackHost}${CALLBACK_PATH}`;

  const state = createState();
  const codeVerifier = createCodeVerifier();
  pendingAttempts.set(state, { codeVerifier, redirectUri });

  res.set("Cache-Control", "no-store").redirect(buildAuthorizationUrl({ redirectUri, state, codeChallenge: codeChallengeS256(codeVerifier) }));
});

// Step 3: Google sends the browser back with a one-time code, exchanged here directly with the PKCE
// verifier that never left this process, so tokens never pass through the browser.
oauthRouter.get("/auth/callback", async (req, res) => {
  const { code, state, error } = req.query;
  const attempt = typeof state === "string" ? pendingAttempts.take(state) : null;
  if (!attempt) {
    return sendPage(res, 400, "This sign-in attempt is no longer valid. Close this tab and try again from the app.");
  }

  if (typeof error === "string") {
    const message = error === "access_denied" ? "You cancelled the sign-in." : `Google returned an error: ${error.slice(0, 80)}.`;
    return sendPage(res, 400, `${message} Close this tab and try again from the app.`);
  }
  if (typeof code !== "string" || code.length > 2048) {
    return sendPage(res, 400, "Google did not send a valid sign-in code. Close this tab and try again.");
  }

  try {
    const tokens = await exchangeCode({ code, redirectUri: attempt.redirectUri, codeVerifier: attempt.codeVerifier });

    // The user can untick individual permissions on the consent screen. Without the app-data folder
    // there is nothing to sync to, so say so instead of failing later.
    if (!tokens.scopes.includes(DRIVE_APPDATA_SCOPE)) {
      return sendPage(res, 400, "Sync needs permission to store the app's data in your Google Drive. Close this tab, sign in again, and leave that permission ticked.");
    }
    if (!tokens.refreshToken) {
      return sendPage(res, 502, "Google did not return a long-lived sign-in. Remove this app at myaccount.google.com/permissions, then sign in again.");
    }

    const profile = await fetchUserInfo(tokens.accessToken);
    cloudRepo.saveCloudAccount({ ...profile, ...tokens });
    sendPage(res, 200, "Signed in. You can close this tab and return to Self Host Form.");
  } catch (err) {
    console.error("Google sign-in failed:", err instanceof OAuthError ? `${err.code}: ${err.message}` : err);
    const detail = err instanceof OAuthError && err.code !== "network_error" ? ` (${err.message})` : "";
    sendPage(res, 502, `Sign-in failed while completing the connection${detail}. Please try again.`);
  }
});

// Only derived, non-sensitive fields are ever sent to the renderer.
oauthRouter.get("/auth/status", requireAuth, (req, res) => {
  const account = cloudRepo.getCloudAccount();
  res.json({
    connected: !!account,
    email: account?.email || null,
    name: account?.name || null,
    avatarUrl: account?.avatarUrl || null,
    // True when the user granted read access to Google Forms and their responses.
    googleFormsAccess: hasGoogleFormsAccess(account),
  });
});

// Signing out removes the tokens from this device and asks Google to revoke the grant. Data already
// in the user's Drive app folder is left alone: signing back in picks it up again.
oauthRouter.post("/auth/logout", requireAuth, async (req, res) => {
  const account = cloudRepo.getCloudAccount();
  if (account) await revokeToken(account.refreshToken);
  cloudRepo.clearCloudAccount();
  res.status(204).end();
});
