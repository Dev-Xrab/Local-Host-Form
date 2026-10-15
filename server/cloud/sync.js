import * as cloudRepo from "./repository.js";
import { cloudFetch, isCloudConfigured } from "./client.js";
import * as formsRepo from "../forms/repository.js";
import * as responsesRepo from "../responses/repository.js";
import * as sessionsRepo from "../sessions/repository.js";
import { describeRejection } from "./rejectionReasons.js";

const UPLOAD_BATCH_SIZE = 200;
const MAX_ROUNDS = 25; // safety valve for a very large backlog — see runSync

// Everything sync doesn't need to understand structurally lives here, opaque to both servers'
// sync plumbing — only this function and applyRemoteResponse (server/responses/repository.js)
// know its shape.
function buildPayload(response) {
  return {
    respondentName: response.respondentName,
    score: response.score,
    maxScore: response.maxScore,
    startedAt: response.startedAt,
    submittedAt: response.submittedAt,
    editCode: response.editCode,
    googleResponseId: response.googleResponseId || undefined,
    answers: response.answers,
  };
}

// A downloaded response's form may not exist on this device yet — e.g. it was published from a
// different device after this one last synced, or after this device's local data was recreated.
// Importing it here means "download relevant remote changes" actually completes instead of
// silently dropping responses whose form we can't otherwise resolve.
async function ensureLocalFormForRemote(remoteFormId) {
  const existingId = formsRepo.getFormIdByRemoteId(remoteFormId);
  if (existingId) return existingId;

  const res = await cloudFetch(`/api/forms/${encodeURIComponent(remoteFormId)}`);
  if (!res.ok) return null; // no longer accessible (deleted / ownership changed) — retried next sync, never thrown away

  const remoteForm = await res.json();
  const account = cloudRepo.getCloudAccount();
  const imported = formsRepo.importForm({
    title: remoteForm.title,
    description: remoteForm.description,
    settings: remoteForm.settings,
    questions: remoteForm.questions,
    preserveQuestionIds: true,
    remoteFormId: remoteForm.id,
    remoteVersion: remoteForm.version,
    ownerUserId: account.userId,
  });
  return imported.id;
}

async function applyDownloadedChanges(changes) {
  let applied = 0;
  const failed = [];
  // Changes arrive ordered by serverSeq ascending. The cursor must only ever advance past a
  // change that actually applied — if change #3 of 10 throws, persisting the server's
  // nextCursor anyway would silently skip it forever (it's now behind the cursor, so no future
  // sync ever asks for it again). Re-applying an already-succeeded later change on retry is
  // harmless (applyRemoteResponse's version check makes it a no-op), so stopping the cursor
  // right before the first failure and letting the next sync re-walk from there is safe.
  let firstFailedSeq = null;

  for (const change of changes) {
    try {
      const localFormId = await ensureLocalFormForRemote(change.formId);
      if (!localFormId) {
        if (firstFailedSeq === null) firstFailedSeq = change.serverSeq;
        continue;
      }

      const localSessionId = sessionsRepo.findOrCreateSyncedSession(
        localFormId,
        change.deviceId,
        change.deviceName
      );
      const payload = change.payload || {};

      const result = responsesRepo.applyRemoteResponse({
        id: change.id,
        localFormId,
        localSessionId,
        respondentName: payload.respondentName,
        score: payload.score,
        maxScore: payload.maxScore,
        startedAt: payload.startedAt,
        submittedAt: payload.submittedAt,
        editCode: payload.editCode,
        version: change.version,
        formVersion: change.formVersion,
        deviceId: change.deviceId,
        googleResponseId: payload.googleResponseId,
        answers: payload.answers,
      });
      if (result !== "skipped_stale") applied += 1;
    } catch (err) {
      failed.push({ id: change.id, error: err.message });
      if (firstFailedSeq === null) firstFailedSeq = change.serverSeq;
    }
  }

  return { applied, failed, firstFailedSeq };
}

// One round-trip to the cloud server: upload up to UPLOAD_BATCH_SIZE pending responses and
// download up to the server's own page size of remote changes. Pending responses are re-read
// fresh each round (not passed in) — the previous round's accepted ones have already flipped to
// 'synced' and drop out on their own, so this never re-sends something that just succeeded.
async function syncOneRound() {
  const pending = responsesRepo.listPendingSyncResponses().slice(0, UPLOAD_BATCH_SIZE);
  const changes = pending.map((r) => ({
    id: r.id,
    formId: r.remoteFormId,
    formVersion: r.formVersion || 1,
    version: r.version,
    createdAt: r.startedAt || r.submittedAt || new Date().toISOString(),
    payload: buildPayload(r),
  }));

  const cursor = cloudRepo.getSyncCursor();
  const res = await cloudFetch("/api/sync", {
    method: "POST",
    body: JSON.stringify({ lastCursor: cursor, changes }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Sync failed (${res.status})`);
  }

  const data = await res.json();

  for (const id of data.accepted || []) responsesRepo.markResponseSynced(id);
  for (const r of data.rejected || []) {
    responsesRepo.markResponseFailed(r.id, describeRejection(r.reason));
  }

  const { applied, failed, firstFailedSeq } = await applyDownloadedChanges(data.changes || []);
  const cursorToPersist =
    firstFailedSeq != null ? String(Number(firstFailedSeq) - 1) : data.nextCursor;
  if (cursorToPersist !== undefined) cloudRepo.setSyncCursor(cursorToPersist);

  return {
    uploadedAttempted: changes.length,
    uploadedAccepted: (data.accepted || []).length,
    rejected: data.rejected || [],
    downloadedApplied: applied,
    downloadedTotal: (data.changes || []).length,
    downloadFailed: failed,
    hasMore: !!data.hasMore,
    morePending: responsesRepo.listPendingSyncResponses().length > 0,
  };
}

// Runs sync rounds until both directions are caught up (no more pending uploads, no more pages
// to download) or MAX_ROUNDS is hit — the latter only matters for a genuinely huge backlog,
// where the UI is told to press Sync again rather than this holding the connection open
// indefinitely.
// A background-triggered sync (e.g. right after a Google Forms import) overlapping a manual
// Sync button click is the other realistic source of concurrent cloudFetch calls that could
// each trigger a token refresh (see the single-flight guard in server/cloud/client.js) — sharing
// one in-flight runSync() the same way removes that race entirely, and also means two overlapping
// callers just get the same result instead of doing redundant work.
let syncInFlight = null;

export async function runSync() {
  if (syncInFlight) return syncInFlight;
  syncInFlight = doRunSync();
  try {
    return await syncInFlight;
  } finally {
    syncInFlight = null;
  }
}

async function doRunSync() {
  if (!isCloudConfigured()) throw new Error("Google Drive sync is not set up in this build (no Google OAuth client id).");
  if (!cloudRepo.getCloudAccount()) throw new Error("Not signed in to a cloud account.");

  const totals = {
    uploaded: 0,
    downloaded: 0,
    rejected: [],
    downloadFailed: [],
    rounds: 0,
    incomplete: false,
  };

  let previousCursor = cloudRepo.getSyncCursor();

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const result = await syncOneRound();
    totals.uploaded += result.uploadedAccepted;
    totals.downloaded += result.downloadedApplied;
    totals.rejected.push(...result.rejected);
    totals.downloadFailed.push(...result.downloadFailed);
    totals.rounds += 1;

    if (!result.hasMore && !result.morePending) {
      cloudRepo.setLastSyncedAt(new Date().toISOString());
      return totals;
    }

    // A change that can't be applied (e.g. its form is no longer accessible) pins the cursor
    // in place so it keeps being retried — which would otherwise spin this loop all the way to
    // MAX_ROUNDS making zero progress. Detect "nothing moved" and stop early instead; the item
    // stays queued for the next time the user presses Sync (or once whatever's wrong upstream
    // is fixed), rather than being retried 25 times in the same click for no benefit.
    const currentCursor = cloudRepo.getSyncCursor();
    const madeProgress = result.uploadedAccepted > 0 || currentCursor !== previousCursor;
    previousCursor = currentCursor;
    if (!madeProgress) break;
  }

  totals.incomplete = true;
  cloudRepo.setLastSyncedAt(new Date().toISOString());
  return totals;
}

// Downloads every response the cloud holds for ONE form, independent of (and without touching) the
// global sync cursor. Used right after a form is imported from the cloud: a device whose cursor is
// already past that form's responses — e.g. the form was deleted here and is now being imported
// again — would otherwise never see them. Safe to repeat: applyRemoteResponse is version-gated.
export async function downloadResponsesForForm(remoteFormId) {
  let cursor = "0";
  let applied = 0;
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const res = await cloudFetch("/api/sync", {
      method: "POST",
      body: JSON.stringify({ lastCursor: cursor, changes: [], formId: remoteFormId }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Download failed (${res.status})`);
    }
    const data = await res.json();
    applied += (await applyDownloadedChanges(data.changes || [])).applied;
    if (!data.hasMore) break;
    cursor = String(data.nextCursor);
  }
  return applied;
}

// Cheap connectivity probe used by the sync status indicator. It only checks that Google is
// reachable (so "offline" can be told apart from an auth problem, which needs different messaging);
// see server/cloud/routes.js GET /sync/status.
export async function pingCloudServer(timeoutMs = 4000) {
  if (!isCloudConfigured()) return false;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(process.env.CLOUD_PING_URL || "https://www.google.com/generate_204", {
      signal: controller.signal,
    });
    clearTimeout(timer);
    return res.status === 204 || res.ok;
  } catch {
    return false;
  }
}
