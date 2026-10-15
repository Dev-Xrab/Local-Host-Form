import { Router } from "express";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import os from "node:os";
import * as cloudRepo from "./repository.js";
import { cloudFetch, isCloudConfigured } from "./client.js";
import * as formsRepo from "../forms/repository.js";
import { diffQuestions, mergeQuestions } from "../forms/questionDiff.js";
import * as responsesRepo from "../responses/repository.js";
import { requireAuth } from "../auth/middleware.js";
import * as sessionsRepo from "../sessions/repository.js";
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
    return res.status(503).json({ error: "This install has no CLOUD_SERVER_URL configured." });
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


// The cloud server only accepts a loopback callback (http://localhost:PORT/...), but the host may
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
  pendingAttempts.set(state, { codeVerifier, createdAt: Date.now() });

  let callbackHost = req.get("host");
  if (!isLoopbackHost(callbackHost)) {
    if (!isSameMachine(req)) {
      pendingAttempts.delete(state);
      return res.status(403).send("<p>Google sign-in has to be done on the computer that runs Self Host Form, using http://localhost:" + req.socket.localPort + ". Open it there and try again.</p>");
    }
    callbackHost = `localhost:${req.socket.localPort}`;
  }
  const redirectUri = `http://${callbackHost}/api/cloud/auth/callback`;
  const startUrl = new URL(`${process.env.CLOUD_SERVER_URL.replace(/\/+$/, "")}/auth/google/start`);
  startUrl.searchParams.set("state", state);
  startUrl.searchParams.set("code_challenge", codeChallenge);
  startUrl.searchParams.set("redirect_uri", redirectUri);

  res.redirect(startUrl.toString());
});

// Hit by the OS browser after the cloud server finishes the Google leg. Exchanges the one-time
// handoff code for real tokens server-to-server (see server/cloud/client.js) — those tokens
// never pass through this HTTP response or the browser at all.
cloudRouter.get("/auth/callback", async (req, res) => {
  const { handoff, state } = req.query;
  const attempt = typeof state === "string" && pendingAttempts.get(state);

  if (typeof handoff !== "string" || handoff.length > 200 || !attempt) {
    return res
      .status(400)
      .send("<p>This sign-in attempt is no longer valid. Close this tab and try again from the app.</p>");
  }
  pendingAttempts.delete(String(state));

  try {
    const exchangeRes = await fetch(`${process.env.CLOUD_SERVER_URL.replace(/\/+$/, "")}/auth/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        handoff,
        codeVerifier: attempt.codeVerifier,
        deviceId: cloudRepo.getDeviceId(),
        deviceName: process.env.COMPUTERNAME || process.env.HOSTNAME || "Self Host Form device",
      }),
    });

    if (!exchangeRes.ok) {
      const body = await exchangeRes.json().catch(() => ({}));
      return res.status(502).send(`<p>Sign-in failed: ${escapeHtml(body.error || "unexpected error")}.</p>`);
    }

    const data = await exchangeRes.json();
    cloudRepo.saveCloudAccount({
      userId: data.user.id,
      email: data.user.email,
      name: data.user.name,
      avatarUrl: data.user.avatarUrl,
      accessToken: data.accessToken,
      accessTokenExpiresAt: data.accessTokenExpiresAt,
      refreshToken: data.refreshToken,
    });

    res.send("<p>Signed in. You can close this tab and return to Self Host Form.</p>");
  } catch (err) {
    console.error("Cloud sign-in exchange failed:", err);
    res.status(502).send("<p>Sign-in failed while completing the connection. Please try again.</p>");
  }
});

cloudRouter.get("/auth/status", requireAuth, (req, res) => {
  const account = cloudRepo.getCloudAccount();
  // Only ever the derived, non-sensitive fields — accessToken/refreshToken are never sent to
  // the renderer.
  res.json({
    connected: !!account,
    email: account?.email || null,
    name: account?.name || null,
    avatarUrl: account?.avatarUrl || null,
  });
});

cloudRouter.post("/auth/logout", requireAuth, async (req, res) => {
  const account = cloudRepo.getCloudAccount();
  if (account) {
    try {
      await fetch(`${process.env.CLOUD_SERVER_URL.replace(/\/+$/, "")}/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: account.refreshToken }),
      });
    } catch {
      // Best-effort revoke — the local account is cleared either way below.
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

// Shared by both "import a form already on the cloud server" (below) and "import a real Google
// Form" (see the /google-forms/:id/import route) — the latter creates the cloud-side form first
// (see cloud-server/google-forms/routes.js) and then funnels through this exact same path, so a
// Google-sourced form is indistinguishable from any other cloud form from this point on: same
// dedup-on-re-import guard, same preserved question ids, same publish/sync behavior.
//
// The cloud copy is always fetched at its latest version — there is no version picking. If this
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

// Fetches the live Google Form's responses that neither the cloud copy nor this device holds yet and
// stores them here as 'local' — on this device, visible everywhere, but not uploaded until the host
// chooses to save them to the cloud (see POST /google-forms/:id/save-to-cloud). Dedup is by Google's
// own response id, both against the cloud's ledger (done cloud-side) and against what's already here.
async function pullGoogleResponsesLocally(form) {
  const upstream = await cloudFetch(`/api/google-forms/${encodeURIComponent(form.remoteFormId)}/responses/new`);
  const body = await upstream.json().catch(() => ({}));
  if (!upstream.ok) throw new Error(body.error || "Failed to fetch responses from Google.");

  let sessionId = null;
  let inserted = 0;
  let skipped = body.skippedExistingCount || 0;
  for (const r of body.responses || []) {
    if (responsesRepo.findResponseByGoogleId(form.id, r.googleResponseId)) {
      skipped += 1;
      continue;
    }
    sessionId ??= sessionsRepo.findOrCreateGoogleSession(form.id);
    responsesRepo.insertGoogleResponse({
      formId: form.id,
      sessionId,
      googleResponseId: r.googleResponseId,
      respondentName: r.respondentName,
      startedAt: r.startedAt,
      submittedAt: r.submittedAt,
      formVersion: form.remoteVersion,
      answers: r.answers,
    });
    inserted += 1;
  }
  return { inserted, skipped };
}

// Real Google Forms (forms.google.com) — distinct from the "/forms" routes above, which only
// ever deal with forms created in this app and published to the cloud server. Listing here
// hits the user's actual Google Drive; nothing is imported until they pick one.
cloudRouter.get("/google-forms", requireAuth, requireCloudAccount, async (req, res) => {
  try {
    const upstream = await cloudFetch("/api/google-forms");
    if (!upstream.ok) {
      const body = await upstream.json().catch(() => ({}));
      return res.status(upstream.status).json({ error: body.error || "Failed to list Google Forms." });
    }
    res.json(await upstream.json());
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Two hops: the cloud server first converts the real Google Form into a form THIS app owns
// (see cloud-server/google-forms/routes.js — it becomes an ordinary cloud-server form from that
// point on), then it's pulled down here through the exact same path as any other cloud import.
cloudRouter.post("/google-forms/:id/import", requireAuth, requireCloudAccount, async (req, res) => {
  try {
    // responses=false: the cloud copy is created from the form's structure only. The responses are
    // fetched onto this device below and only saved to the cloud if the host says so.
    const upstream = await cloudFetch(`/api/google-forms/${encodeURIComponent(req.params.id)}/import?responses=false`, {
      method: "POST",
    });
    const created = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: created.error || "Failed to import the Google Form.", skipped: created.skipped });
    }

    const imported = await importCentralFormLocally(created.id);
    formsRepo.setGoogleFormId(imported.id, req.params.id);
    // Responses the cloud copy already holds (an earlier import saved them) come down first, so the
    // fetch below only adds what's genuinely new.
    try {
      await runSync();
    } catch {
      // Best-effort — arrives on the next sync even if this immediate attempt fails (e.g. offline).
    }

    let fetched = { inserted: 0, skipped: 0 };
    let responseImportError = null;
    try {
      fetched = await pullGoogleResponsesLocally(formsRepo.getForm(imported.id));
    } catch (err) {
      responseImportError = err.message;
    }

    res.status(created.alreadyImported ? 200 : 201).json({
      ...formsRepo.getForm(imported.id),
      skipped: created.skipped || [],
      importedResponseCount: fetched.inserted,
      unsavedCount: responsesRepo.countLocalOnlyResponses(imported.id),
      responseImportError,
      alreadyImported: !!created.alreadyImported,
    });
  } catch (err) {
    res.status(err.status || 502).json({ error: err.message });
  }
});

// Read-only structural check against the live Google Form — see server/forms/questionDiff.js
// diffQuestions. Never writes anything; the frontend only shows the sync decision dialog when
// hasChanges is true, and otherwise proceeds straight to a response-only sync.
// `:id` here is THIS DEVICE'S local form id, matching every other per-form Google route below.
cloudRouter.get("/google-forms/:id/changes", requireAuth, requireCloudAccount, async (req, res) => {
  const form = formsRepo.getForm(req.params.id);
  if (!form) return res.status(404).json({ error: "Form not found." });
  if (!form.remoteFormId || !form.googleFormId) {
    return res.status(400).json({ error: "This form isn't linked to a Google Form." });
  }

  try {
    const upstream = await cloudFetch(`/api/google-forms/${encodeURIComponent(form.remoteFormId)}/live`);
    const body = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: body.error || "Failed to check the Google Form for changes." });
    }
    res.json({ ...diffQuestions(form.questions, body.questions || []), skippedUnsupported: body.skipped || [] });
  } catch (err) {
    res.status(err.status || 502).json({ error: err.message });
  }
});

// Applies the host's decision from the sync decision dialog ("Keep Local Version" vs "Sync From
// Online" — see server/forms/questionDiff.js mergeQuestions for how a removed question is kept,
// never deleted, so its historical answers stay labeled), then always pulls in new responses
// regardless of that decision — response import is independent of question structure (dedup is
// by Google's own response id, see cloud-server/google-forms/repository.js).
cloudRouter.post("/google-forms/:id/apply-changes", requireAuth, requireCloudAccount, async (req, res) => {
  const form = formsRepo.getForm(req.params.id);
  if (!form) return res.status(404).json({ error: "Form not found." });
  if (!form.remoteFormId || !form.googleFormId) {
    return res.status(400).json({ error: "This form isn't linked to a Google Form." });
  }
  const decision = req.body?.decision;
  if (decision !== "keep-local" && decision !== "sync-from-online") {
    return res.status(400).json({ error: 'decision must be "keep-local" or "sync-from-online".' });
  }

  try {
    if (decision === "sync-from-online") {
      const liveUpstream = await cloudFetch(`/api/google-forms/${encodeURIComponent(form.remoteFormId)}/live`);
      const liveBody = await liveUpstream.json().catch(() => ({}));
      if (!liveUpstream.ok) {
        return res.status(liveUpstream.status).json({ error: liveBody.error || "Failed to fetch the Google Form." });
      }
      formsRepo.updateForm(form.id, { questions: mergeQuestions(form.questions, liveBody.questions || []) });
    }

    // Keeps the cloud server's own copy of the form structure caught up (append-only), for any
    // other device on the account too. responses=false: new responses are NOT written to the cloud
    // here — they're fetched onto this device below, and the host decides whether to save them.
    const refreshUpstream = await cloudFetch(`/api/google-forms/${encodeURIComponent(form.remoteFormId)}/refresh?responses=false`, {
      method: "POST",
    });
    const refreshResult = await refreshUpstream.json().catch(() => ({}));
    if (!refreshUpstream.ok) {
      return res.status(refreshUpstream.status).json({ error: refreshResult.error || "Failed to sync responses from Google." });
    }

    const account = cloudRepo.getCloudAccount();
    formsRepo.setRemoteInfo(form.id, {
      remoteFormId: form.remoteFormId,
      remoteVersion: refreshResult.version,
      ownerUserId: account.userId,
    });

    try {
      await runSync();
    } catch {
      // Best-effort — a later manual or automatic sync still picks up anything already on the cloud.
    }

    let fetched = { inserted: 0, skipped: 0 };
    let responseImportError = null;
    try {
      fetched = await pullGoogleResponsesLocally(formsRepo.getForm(form.id));
    } catch (err) {
      responseImportError = err.message;
    }

    res.json({
      decision,
      checkedResponseCount: fetched.inserted + fetched.skipped,
      newResponseCount: fetched.inserted,
      unchangedResponseCount: fetched.skipped,
      // Everything on this device the cloud doesn't have yet — new ones plus any left from earlier
      // fetches the host didn't save.
      unsavedCount: responsesRepo.countLocalOnlyResponses(form.id),
      responseImportError,
    });
  } catch (err) {
    res.status(err.status || 502).json({ error: err.message });
  }
});

// The host answered "yes" to saving fetched Google responses to the cloud: queue them for upload and
// run the upload now. The cloud's Google ledger records each one as it arrives, so a later refresh
// won't fetch it again (cloud-server/sync/routes.js).
cloudRouter.post("/google-forms/:id/save-to-cloud", requireAuth, requireCloudAccount, async (req, res) => {
  const form = formsRepo.getForm(req.params.id);
  if (!form) return res.status(404).json({ error: "Form not found." });
  if (!form.remoteFormId) return res.status(400).json({ error: "This form isn't saved to a cloud account." });

  const queued = responsesRepo.promoteLocalResponses(form.id);
  try {
    const result = await runSync();
    res.json({ savedCount: queued, uploaded: result.uploaded, rejected: result.rejected.length });
  } catch (err) {
    // Still queued as pending — nothing is lost, the next sync retries.
    res.status(502).json({ error: err.message, queuedCount: queued });
  }
});
