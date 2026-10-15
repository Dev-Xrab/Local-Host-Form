import { Router } from "express";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import os from "node:os";
import * as cloudRepo from "./repository.js";
import { cloudFetch, isCloudConfigured } from "./client.js";
import {
  DRIVE_APPDATA_SCOPE,
  GOOGLE_SCOPES,
  googleAuthUrl,
  googleClientId,
  googleClientSecret,
  googleRevokeUrl,
  googleTokenUrl,
  googleUserinfoUrl,
} from "./googleConfig.js";
import * as formsRepo from "../forms/repository.js";
import * as responsesRepo from "../responses/repository.js";
import { requireAuth } from "../auth/middleware.js";
import { runSync, pingCloudServer, downloadResponsesForForm } from "./sync.js";

export const cloudRouter = Router();

// In-memory only, by design: the PKCE verifier must never be written to disk or handed to the
// renderer — it exists only long enough to bridge /auth/start -> /auth/callback in this same
// process. A pending attempt that's abandoned (browser closed, etc.) is swept out after 10 min.
const pendingAttempts = new Map(); // state -> { codeVerifier, createdAt }
const PENDING_TTL_MS = 10 * 60 * 1000;

// /auth/start and /auth/callback are opened in the OS's default browser, which does not carry
// this app's host-password session cookie — so they can't be gated by requireAuth like every
// other route here. Left fully open, though, anyone on the classroom LAN (this server binds
// 0.0.0.0) could hit /auth/start directly and trick the host's install into signing in as the
// attacker's own Google account — after which "Import"/"Publish" would read from and write to
// that attacker's account instead of the host's. A launch token closes this: it can only be
// minted by an authenticated request (see POST /auth/launch below), is single-use, and expires
// in 60 seconds, so /auth/start itself can safely stay unauthenticated.
const pendingLaunches = new Map(); // token -> createdAt
const LAUNCH_TTL_MS = 60 * 1000;

function sweepExpired(map, ttlMs, getCreatedAt) {
  const cutoff = Date.now() - ttlMs;
  for (const [key, value] of map) {
    if (getCreatedAt(value) < cutoff) map.delete(key);
  }
}

// The callback page is rendered on this server's own origin, so nothing from the cloud server's
// response is ever put into it unescaped.
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function base64url(buffer) {
  return buffer.toString("base64url");
}

function requireCloudConfigured(req, res, next) {
  if (!isCloudConfigured()) {
    return res.status(503).json({ error: "Google Drive sync is not set up in this build (no Google OAuth client id)." });
  }
  next();
}

cloudRouter.use(requireCloudConfigured);

// Called by the renderer (cookie-authenticated, same-origin fetch) to mint the one-time launch
// token, then opens the returned URL with window.open(...) so Electron's window-open handler
// routes it to the OS browser instead of an in-app webview (Google rejects OAuth from embedded
// webviews).
cloudRouter.post("/auth/launch", requireAuth, (req, res) => {
  sweepExpired(pendingLaunches, LAUNCH_TTL_MS, (createdAt) => createdAt);
  const token = randomUUID();
  pendingLaunches.set(token, Date.now());
  const url = new URL(`${req.protocol}://${req.get("host")}/api/cloud/auth/start`);
  url.searchParams.set("launchToken", token);
  res.json({ url: url.toString() });
});


// Google only accepts a loopback callback for a desktop client (http://localhost:PORT/...), but the host may
// have opened this app through its LAN address (http://192.168.x.x:PORT). When the browser is on
// the same machine as this server, localhost reaches the very same process, so the callback is
// pointed there. A request from another device can't complete the sign-in (the callback would land
// on that device), so it is told to sign in from the host computer instead.
function isSameMachine(req) {
  const addr = String(req.socket.remoteAddress || "").replace(/^::ffff:/, "");
  if (addr === "::1" || addr.startsWith("127.")) return true;
  return Object.values(os.networkInterfaces()).flat().some((i) => i && i.address === addr);
}

const isLoopbackHost = (host) => /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host || "");

cloudRouter.get("/auth/start", (req, res) => {
  sweepExpired(pendingAttempts, PENDING_TTL_MS, (attempt) => attempt.createdAt);

  const launchToken = req.query.launchToken;
  const launchedAt = launchToken && pendingLaunches.get(String(launchToken));
  if (!launchedAt || Date.now() - launchedAt > LAUNCH_TTL_MS) {
    return res.status(403).send("<p>This sign-in link is invalid or has expired. Start again from the app.</p>");
  }
  pendingLaunches.delete(String(launchToken));

  const state = randomUUID();
  const codeVerifier = base64url(randomBytes(32));
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");

  let callbackHost = req.get("host");
  if (!isLoopbackHost(callbackHost)) {
    if (!isSameMachine(req)) {
      return res.status(403).send("<p>Google sign-in has to be done on the computer that runs Self Host Form, using http://localhost:" + req.socket.localPort + ". Open it there and try again.</p>");
    }
    callbackHost = `localhost:${req.socket.localPort}`;
  }
  const redirectUri = `http://${callbackHost}/api/cloud/auth/callback`;
  pendingAttempts.set(state, { codeVerifier, redirectUri, createdAt: Date.now() });

  const url = new URL(googleAuthUrl());
  url.search = new URLSearchParams({
    client_id: googleClientId(),
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPES,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    // offline + consent so Google issues a refresh token: syncing happens long after sign-in.
    access_type: "offline",
    prompt: "consent",
  }).toString();
  res.redirect(url.toString());
});

// Google sends the browser back here with a one-time code. It is exchanged for tokens by this
// server directly (with the PKCE verifier that never left this process), so tokens never pass through
// the browser or any server we run.
cloudRouter.get("/auth/callback", async (req, res) => {
  const { code, state, error } = req.query;
  const attempt = typeof state === "string" && pendingAttempts.get(state);

  if (!attempt) {
    return res.status(400).send("<p>This sign-in attempt is no longer valid. Close this tab and try again from the app.</p>");
  }
  pendingAttempts.delete(String(state));

  if (typeof error === "string") {
    const message = error === "access_denied" ? "You cancelled the sign-in." : `Google returned an error: ${escapeHtml(error)}.`;
    return res.status(400).send(`<p>${message} Close this tab and try again from the app.</p>`);
  }
  if (typeof code !== "string" || code.length > 2048) {
    return res.status(400).send("<p>Google did not send a valid sign-in code. Close this tab and try again.</p>");
  }

  try {
    const params = new URLSearchParams({
      code,
      client_id: googleClientId(),
      redirect_uri: attempt.redirectUri,
      grant_type: "authorization_code",
      code_verifier: attempt.codeVerifier,
    });
    if (googleClientSecret()) params.set("client_secret", googleClientSecret());

    const tokenRes = await fetch(googleTokenUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });
    const tokens = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok) {
      return res.status(502).send(`<p>Sign-in failed: ${escapeHtml(tokens.error_description || tokens.error || "unexpected error")}.</p>`);
    }

    // The user can untick individual permissions on the consent screen. Without the app-data folder
    // there is nothing to sync to, so say so instead of failing later.
    if (!String(tokens.scope || "").split(" ").includes(DRIVE_APPDATA_SCOPE)) {
      return res
        .status(400)
        .send("<p>Sync needs permission to store the app's data in your Google Drive. Close this tab, sign in again, and leave that permission ticked.</p>");
    }
    if (!tokens.refresh_token) {
      return res.status(502).send("<p>Google did not return a long-lived sign-in. Remove this app at myaccount.google.com/permissions, then sign in again.</p>");
    }

    const infoRes = await fetch(googleUserinfoUrl(), { headers: { Authorization: `Bearer ${tokens.access_token}` } });
    if (!infoRes.ok) throw new Error(`Google profile request failed (${infoRes.status})`);
    const info = await infoRes.json();

    cloudRepo.saveCloudAccount({
      userId: info.sub,
      email: info.email,
      name: info.name || "",
      avatarUrl: info.picture || null,
      accessToken: tokens.access_token,
      accessTokenExpiresAt: new Date(Date.now() + (Number(tokens.expires_in) || 3600) * 1000).toISOString(),
      refreshToken: tokens.refresh_token,
    });

    res.send("<p>Signed in. You can close this tab and return to Self Host Form.</p>");
  } catch (err) {
    console.error("Google sign-in failed:", err);
    res.status(502).send("<p>Sign-in failed while completing the connection. Please try again.</p>");
  }
});

cloudRouter.get("/auth/status", requireAuth, (req, res) => {
  const account = cloudRepo.getCloudAccount();
  // Only ever the derived, non-sensitive fields: accessToken/refreshToken are never sent to the
  // renderer.
  res.json({
    connected: !!account,
    email: account?.email || null,
    name: account?.name || null,
    avatarUrl: account?.avatarUrl || null,
  });
});

// Signing out removes the tokens from this device and asks Google to revoke the refresh token.
// Data already in the user's Drive app folder is left alone: it is theirs, and signing back in
// (here or on another device) picks it up again.
cloudRouter.post("/auth/logout", requireAuth, async (req, res) => {
  const account = cloudRepo.getCloudAccount();
  if (account) {
    try {
      await fetch(googleRevokeUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token: account.refreshToken }),
      });
    } catch {
      // Best-effort revoke: the local account is cleared either way below.
    }
  }
  cloudRepo.clearCloudAccount();
  res.status(204).end();
});

function requireCloudAccount(req, res, next) {
  if (!cloudRepo.getCloudAccount()) {
    return res.status(401).json({ error: "Not signed in to a cloud account." });
  }
  next();
}

cloudRouter.get("/forms", requireAuth, requireCloudAccount, async (req, res) => {
  try {
    const upstream = await cloudFetch("/api/forms");
    if (!upstream.ok) {
      const body = await upstream.json().catch(() => ({}));
      return res.status(upstream.status).json({ error: body.error || "Failed to list cloud forms." });
    }
    res.json(await upstream.json());
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Keyed by the CLOUD form's own id directly (not a local form id) — "Import from Cloud" browses
// forms that may not be imported onto this device at all yet, so there's no local row to resolve
// remoteFormId from the way /forms/:id/publish below does.
// Deletes the form from the cloud account entirely (every version, every response, every
// device's access to it — see cloud-server/forms/repository.js deleteForm). Irreversible.
cloudRouter.delete("/forms/cloud/:remoteId", requireAuth, requireCloudAccount, async (req, res) => {
  try {
    const upstream = await cloudFetch(`/api/forms/${encodeURIComponent(req.params.remoteId)}`, {
      method: "DELETE",
    });
    if (!upstream.ok && upstream.status !== 204) {
      const body = await upstream.json().catch(() => ({}));
      return res.status(upstream.status).json({ error: body.error || "Failed to delete the form." });
    }
    res.status(204).end();
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Brings a form from the user's Drive down to this device: the dedup-on-re-import guard, the
// preserved question ids and the publish/sync behavior below all hang off the form's remote id.
//
// The Drive copy is always fetched at its latest version — there is no version picking. If this
// device already has a local copy (importing the same cloud form twice, including the common
// "publish it here, then also click Import for it" case, must not mint a second one: remote_form_id
// is a unique index, see server/db/index.js):
//   - `refreshExisting` false (the Google path): the local copy is returned untouched.
//   - `refreshExisting` true (Import from Cloud): the local copy is brought up to the cloud's
//     latest, unless it has local edits the cloud doesn't have yet, which are only overwritten when
//     the host confirmed (`overwrite`) — otherwise a 409 tells the UI to ask first.
async function importCentralFormLocally(remoteFormId, { refreshExisting = false, overwrite = false } = {}) {
  const existingLocalId = formsRepo.getFormIdByRemoteId(remoteFormId);

  if (existingLocalId) {
    const existing = formsRepo.getForm(existingLocalId);
    if (!refreshExisting) return { ...existing, alreadyImported: true };

    const remoteForm = await fetchRemoteForm(remoteFormId);
    if (remoteForm.version === existing.remoteVersion && !existing.hasUnsavedCloudChanges) {
      return { ...existing, alreadyImported: true };
    }
    if (existing.hasUnsavedCloudChanges && !overwrite) {
      const err = new Error("This form has changes that aren't saved to the cloud yet.");
      err.status = 409;
      err.code = "unsaved_local_changes";
      throw err;
    }

    const account = cloudRepo.getCloudAccount();
    formsRepo.updateForm(existingLocalId, {
      title: remoteForm.title,
      description: remoteForm.description,
      settings: remoteForm.settings,
      questions: remoteForm.questions,
    });
    const updated = formsRepo.setRemoteInfo(existingLocalId, {
      remoteFormId: remoteForm.id,
      remoteVersion: remoteForm.version,
      ownerUserId: account.userId,
    });
    return { ...updated, updated: true };
  }

  const remoteForm = await fetchRemoteForm(remoteFormId);
  const account = cloudRepo.getCloudAccount();

  return formsRepo.importForm({
    title: remoteForm.title,
    description: remoteForm.description,
    settings: remoteForm.settings,
    questions: remoteForm.questions,
    preserveQuestionIds: true,
    remoteFormId: remoteForm.id,
    remoteVersion: remoteForm.version,
    ownerUserId: account.userId,
  });
}

async function fetchRemoteForm(remoteFormId) {
  const upstream = await cloudFetch(`/api/forms/${encodeURIComponent(remoteFormId)}`);
  if (!upstream.ok) {
    const body = await upstream.json().catch(() => ({}));
    const err = new Error(body.error || "Failed to fetch the form.");
    err.status = upstream.status;
    throw err;
  }
  return upstream.json();
}

cloudRouter.post("/forms/:id/import", requireAuth, requireCloudAccount, async (req, res) => {
  try {
    const imported = await importCentralFormLocally(req.params.id, {
      refreshExisting: true,
      overwrite: req.body?.overwrite === true,
    });
    // Bring down the responses the cloud holds for this form (see downloadResponsesForForm).
    try {
      await downloadResponsesForForm(req.params.id);
    } catch {
      // Best-effort — the form itself imported fine, and a later sync still picks them up.
    }
    res.status(imported.alreadyImported || imported.updated ? 200 : 201).json(imported);
  } catch (err) {
    res.status(err.status || 502).json({ error: err.message, code: err.code });
  }
});

// Pushes a locally-authored (or previously-imported) form to the cloud server, so it can be
// imported on another device signed in to the same account. First publish creates it; every
// later publish bumps the version instead of overwriting the previous one (see
// cloud-server/forms/repository.js publishNewVersion) — history the app itself never exposes: an
// import always takes the latest.
cloudRouter.post("/forms/:id/publish", requireAuth, requireCloudAccount, async (req, res) => {
  const form = formsRepo.getForm(req.params.id);
  if (!form) return res.status(404).json({ error: "Form not found." });

  const payload = {
    title: form.title,
    description: form.description,
    settings: form.settings,
    questions: form.questions,
  };

  try {
    const upstream = await cloudFetch(
      form.remoteFormId ? `/api/forms/${encodeURIComponent(form.remoteFormId)}` : "/api/forms",
      { method: form.remoteFormId ? "PUT" : "POST", body: JSON.stringify(payload) }
    );
    if (!upstream.ok) {
      const body = await upstream.json().catch(() => ({}));
      return res.status(upstream.status).json({ error: body.error || "Failed to publish the form." });
    }
    const published = await upstream.json();
    const account = cloudRepo.getCloudAccount();
    const updated = formsRepo.setRemoteInfo(form.id, {
      remoteFormId: published.id,
      remoteVersion: published.version,
      ownerUserId: account.userId,
    });

    // Saving a form to the cloud carries the responses collected under it: they became eligible
    // for upload the moment remote_form_id was set. That upload can take a while (a real network
    // round-trip per batch, more if there's a backlog) and has nothing to do with whether the
    // FORM itself saved — so it's kicked off in the background, not awaited, and the host's "Save
    // to cloud" click resolves as soon as the form is saved. Uncaught here on purpose: any failure
    // just leaves those responses queued as pending for the next manual or automatic sync.
    runSync().catch(() => {});

    res.json(formsRepo.getForm(updated.id));
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Backs the sync status indicator (Online/Offline/last-synced-time) — cheap enough to poll
// regularly since it does one lightweight probe against the cloud server rather than anything
// that touches sync state itself.
cloudRouter.get("/sync/status", requireAuth, async (req, res) => {
  const account = cloudRepo.getCloudAccount();
  const reachable = await pingCloudServer();
  res.json({
    connected: !!account,
    reachable,
    pendingCount: responsesRepo.listPendingSyncResponses().length,
    // Distinct from pendingCount: these have already been tried and rejected/errored at least
    // once, so a plain "press Sync again" won't fix them without the user actually looking —
    // see GET /sync/issues below.
    failedCount: responsesRepo.listSyncIssues().length,
    lastSyncedAt: cloudRepo.getLastSyncedAt(),
    // Google responses fetched onto this device that the host hasn't chosen to save to the cloud.
    unsavedToCloudCount: responsesRepo.countLocalOnlyResponses(),
  });
});

// Individually-inspectable failed/conflicting responses — the detail behind /sync/status's
// aggregate failedCount, since "3 failed" on its own gives the user nothing to act on.
cloudRouter.get("/sync/issues", requireAuth, (req, res) => {
  res.json(responsesRepo.listSyncIssues());
});

// Resets one response back to 'pending' and immediately re-attempts sync, so the user gets a
// result right away instead of a silent state flip they'd have to press the main Sync button to
// discover.
cloudRouter.post("/sync/issues/:id/retry", requireAuth, requireCloudAccount, async (req, res) => {
  responsesRepo.retrySyncResponse(req.params.id);
  try {
    const result = await runSync();
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Gives up on one response permanently (e.g. a conflict the user has decided isn't worth
// resolving) — moves it out of 'failed' so it stops being retried and stops counting toward
// failedCount, without deleting the locally-recorded response itself.
cloudRouter.post("/sync/issues/:id/discard", requireAuth, (req, res) => {
  responsesRepo.abandonSyncResponse(req.params.id);
  res.status(204).end();
});

// Runs one full sync (upload pending responses, download remote changes, repeat until both
// sides are caught up — see server/cloud/sync.js). Never marks anything synced until the cloud
// server has positively acknowledged it, and is safe to call again immediately after a failure
// or an interruption: nothing here is a multi-step operation that could be left half-applied —
// each response is its own atomic upsert, so "resume" is just "run it again."
cloudRouter.post("/sync", requireAuth, requireCloudAccount, async (req, res) => {
  try {
    const result = await runSync();
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});
