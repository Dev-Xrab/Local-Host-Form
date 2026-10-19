import { Router } from "express";
import * as cloudRepo from "./repository.js";
import { cloudFetch } from "./client.js";
import { oauthRouter } from "../oauth/routes.js";
import * as formsRepo from "../forms/repository.js";
import * as responsesRepo from "../responses/repository.js";
import { requireAuth } from "../auth/middleware.js";
import { runSync, pingCloudServer, downloadResponsesForForm } from "./sync.js";
import { publishFormToCloud } from "./publish.js";
import { getLastAutoSaveError, isAutoSaveEnabled, scheduleAutoSync } from "./autosave.js";

export const cloudRouter = Router();

// Sign-in/sign-out/status live in server/oauth. Everything below needs a configured client id.
cloudRouter.use(oauthRouter);

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
  try {
    res.json(await publishFormToCloud(req.params.id));
  } catch (err) {
    res.status(err.status || 502).json({ error: err.message });
  }
});

// Automatic saving of forms and responses to Drive (see autosave.js).
cloudRouter.get("/auto-save", requireAuth, (req, res) => {
  res.json({ enabled: isAutoSaveEnabled() });
});

cloudRouter.put("/auto-save", requireAuth, (req, res) => {
  if (typeof req.body?.enabled !== "boolean") return res.status(400).json({ error: "enabled must be true or false." });
  cloudRepo.setAutoSave(req.body.enabled);
  if (req.body.enabled) scheduleAutoSync();
  res.json({ enabled: isAutoSaveEnabled() });
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
    autoSave: isAutoSaveEnabled(),
    autoSaveError: getLastAutoSaveError()?.message || null,
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
