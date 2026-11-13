import { randomInt, randomUUID } from "node:crypto";
import { db } from "../db/index.js";
import { REJECTION_MESSAGES, NON_RETRYABLE_REASONS } from "../cloud/rejectionReasons.js";

const NON_RETRYABLE_MESSAGES = new Set(
  [...NON_RETRYABLE_REASONS].map((reason) => REJECTION_MESSAGES[reason])
);

const now = () => new Date().toISOString();

// A response's own edit code, separate from the session's shared join code: the join code
// is public to the whole class, so it can't double as proof of ownership. This is generated
// once (at first submit) and stays stable across edits, so a respondent can note it down and
// use it — together with the session code — to reopen their own answer from another device
// without anyone else being able to guess or reuse it to touch someone else's response.
const EDIT_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const generateEditCode = () =>
  Array.from({ length: 6 }, () => EDIT_CODE_CHARS[randomInt(EDIT_CODE_CHARS.length)]).join("");

const editCodeExistsInSessionStmt = db.prepare(
  "SELECT 1 FROM responses WHERE session_id = ? AND edit_code = ?"
);

function uniqueEditCodeForSession(sessionId) {
  let code = generateEditCode();
  while (editCodeExistsInSessionStmt.get(sessionId, code)) code = generateEditCode();
  return code;
}

function rowToResponseSummary(row) {
  return {
    id: row.id,
    formId: row.form_id,
    sessionId: row.session_id,
    deviceId: row.device_id,
    respondentName: row.respondent_name,
    status: row.status,
    score: row.score,
    maxScore: row.max_score,
    startedAt: row.started_at,
    deadlineAt: row.deadline_at,
    submittedAt: row.submitted_at,
    editCode: row.edit_code,
    version: row.version,
    formVersion: row.form_version,
    formSnapshotId: row.form_snapshot_id,
    definitionProvenance: row.form_snapshot_id ? "pinned" : "legacy_current_definition",
    syncStatus: row.sync_status,
    syncedAt: row.synced_at,
    retryCount: row.retry_count,
    syncError: row.sync_error,
    googleResponseId: row.google_response_id,
    refocusLockedUntil: row.refocus_locked_until,
  };
}

const selectAnswersForResponseStmt = db.prepare(
  "SELECT question_id, value FROM response_answers WHERE response_id = ?"
);

function answersFor(responseId) {
  return Object.fromEntries(
    selectAnswersForResponseStmt.all(responseId).map((a) => [a.question_id, JSON.parse(a.value)])
  );
}

const deleteAnswersStmt = db.prepare("DELETE FROM response_answers WHERE response_id = ?");
const insertAnswerStmt = db.prepare(
  "INSERT INTO response_answers (id, response_id, question_id, value) VALUES (?, ?, ?, ?)"
);

// Replaces the full answer set for a response — used both for a respondent's own
// submit/resubmit and for applying a remote response's answers during sync (see
// applyRemoteResponse below). Must run inside the caller's transaction.
function writeAnswers(responseId, answers) {
  deleteAnswersStmt.run(responseId);
  Object.entries(answers).forEach(([questionId, value]) => {
    insertAnswerStmt.run(randomUUID(), responseId, questionId, JSON.stringify(value));
  });
}

const selectResponseStmt = db.prepare("SELECT * FROM responses WHERE id = ?");
const selectInProgressForDeviceStmt = db.prepare(
  "SELECT * FROM responses WHERE session_id = ? AND device_id = ? ORDER BY started_at DESC LIMIT 1"
);

export function getResponse(id) {
  const row = selectResponseStmt.get(id);
  return row ? { ...rowToResponseSummary(row), answers: answersFor(id) } : null;
}

// Resuming: a device that already has a response for this session gets that same
// response back (submitted -> show their result again; in_progress -> keep answering)
// instead of silently starting a second attempt.
export function findExistingResponse(sessionId, deviceId) {
  if (!deviceId) return null;
  const row = selectInProgressForDeviceStmt.get(sessionId, deviceId);
  return row ? { ...rowToResponseSummary(row), answers: answersFor(row.id) } : null;
}

const selectByEditCodeStmt = db.prepare(
  "SELECT * FROM responses WHERE session_id = ? AND edit_code = ?"
);

// Cross-device edit access: proves ownership via the response's own edit code (shown once
// after submitting) instead of the device that originally submitted it.
export function findResponseByEditCode(sessionId, editCode) {
  if (!editCode) return null;
  const row = selectByEditCodeStmt.get(sessionId, editCode);
  return row ? { ...rowToResponseSummary(row), answers: answersFor(row.id) } : null;
}

// Each respondent gets their own deadline computed the moment THEY join — not a shared
// session-wide clock — so someone who joins late still gets the full time limit, and
// nobody's countdown is affected by when anyone else started.
export function createInProgressResponse({ formId, sessionId, deviceId, respondentName, durationMinutes, formSnapshotId = null }) {
  const id = randomUUID();
  const startedAt = now();
  const deadlineAt = durationMinutes
    ? new Date(Date.now() + durationMinutes * 60 * 1000).toISOString()
    : null;
  db.prepare(
    `INSERT INTO responses (id, form_id, session_id, device_id, respondent_name, status, started_at, deadline_at, form_snapshot_id)
     VALUES (?, ?, ?, ?, ?, 'in_progress', ?, ?, ?)`
  ).run(id, formId, sessionId, deviceId || null, respondentName || "", startedAt, deadlineAt, formSnapshotId);
  return rowToResponseSummary(selectResponseStmt.get(id));
}

// Finalizes an in_progress response — this covers both a first submit and a resubmit after
// the respondent reopened an already-submitted answer to edit it (see reopenResponseForEditing),
// since both start from status 'in_progress'. Guarded by the status check inside the UPDATE so
// a double-submit race (e.g. two tabs) can't score the same attempt twice — the second call
// affects 0 rows and the caller is told it was already submitted.
export function submitResponse(id, { answers, score, maxScore, formVersion }) {
  const existing = selectResponseStmt.get(id);
  if (!existing) return "already_submitted";
  // Stable across edits: generated once at first submit, reused on every resubmit so the
  // respondent's noted-down edit code keeps working.
  const editCode = existing.edit_code || uniqueEditCodeForSession(existing.session_id);

  db.exec("BEGIN");
  try {
    // version bumps on every finalize (first submit AND resubmit-after-edit) — this is the
    // optimistic-concurrency counter the cloud server uses on upload (see server/cloud/sync.js)
    // to accept a newer edit, no-op a retried one, and flag a genuine conflict instead of
    // silently overwriting. sync_status resets to 'pending' so an edit to an already-synced
    // response gets picked up by the next sync.
    const result = db
      .prepare(
        `UPDATE responses
         SET status = 'submitted', submitted_at = ?, score = ?, max_score = ?, edit_code = ?,
             version = version + 1, form_version = COALESCE(?, form_version), sync_status = 'pending', sync_error = NULL
         WHERE id = ? AND status = 'in_progress'`
      )
      .run(now(), score, maxScore, editCode, formVersion ?? null, id);

    if (result.changes === 0) {
      db.exec("ROLLBACK");
      return "already_submitted";
    }

    writeAnswers(id, answers);
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  return getResponse(id);
}

// Reopens an already-submitted response so the respondent can change their answers, then
// resubmit via submitResponse above. Answers are left in place (untouched) so the edit form
// can prefill them. deadline_at is cleared — editing is untimed, unlike the original attempt.
// When reopened from a different device (via edit code, see findResponseByEditCode), device_id
// is rebound to that device so later ownership checks (view/submit) match whoever is now editing.
export function reopenResponseForEditing(id, deviceId) {
  const existing = selectResponseStmt.get(id);
  if (!existing) return null;
  const finalDeviceId = deviceId || existing.device_id;
  db.prepare(
    `UPDATE responses SET status = 'in_progress', submitted_at = NULL, deadline_at = NULL, device_id = ?,
         refocus_locked_until = NULL
     WHERE id = ?`
  ).run(finalDeviceId, id);
  return getResponse(id);
}

const setRefocusLockUntilStmt = db.prepare(
  "UPDATE responses SET refocus_locked_until = ? WHERE id = ? AND status = 'in_progress'"
);

// Called the moment this respondent's tab is detected going hidden (see server/public/routes.js
// POST /responses/:id/refocus-lock) — records when the countdown ends server-side, so a reload
// while away (or right after coming back, before the client's own timer would have run) can't
// skip it the way purely client-held countdown state could. Only applies to an in-progress
// response — a submitted one has nothing left to lock.
export function setRefocusLockUntil(id, lockedUntilIso) {
  setRefocusLockUntilStmt.run(lockedUntilIso, id);
  return getResponse(id);
}

const selectForSessionStmt = db.prepare(
  "SELECT * FROM responses WHERE session_id = ? ORDER BY started_at DESC"
);

export function listResponsesForSession(sessionId) {
  return selectForSessionStmt.all(sessionId).map(rowToResponseSummary);
}

// Every submitted response to this form, across every session that used it — powers the "All
// Responses" tab (server/forms/routes.js GET /:formId/responses). Only 'submitted' responses,
// matching the same visibility rule already used per-session (SessionDetailPage/sessions/routes.js
// GET /:id/respondents): a respondent's own answer is visible to the host as soon as THEY
// submit, session-ended or not — an in_progress draft is never included.
const selectSubmittedForFormWithSessionStmt = db.prepare(`
  SELECT r.*, s.name AS session_name, s.code AS session_code
  FROM responses r
  JOIN sessions s ON s.id = r.session_id
  WHERE r.form_id = ? AND r.status = 'submitted'
  ORDER BY r.submitted_at DESC
`);

export function listSubmittedResponsesForForm(formId) {
  return selectSubmittedForFormWithSessionStmt.all(formId).map((row) => ({
    ...rowToResponseSummary(row),
    sessionName: row.session_name,
    sessionCode: row.session_code,
    answers: answersFor(row.id),
  }));
}

// --- Cloud sync (see server/cloud/sync.js) -------------------------------------------------
//
// Only submitted responses under a cloud-linked form are sync-eligible — an in-progress draft
// never leaves this device, matching "responses should usually be append-only" (submit is the
// moment a response becomes a fact worth reconciling across devices).

const selectPendingSyncStmt = db.prepare(`
  SELECT r.*, f.remote_form_id AS remote_form_id
  FROM responses r
  JOIN forms f ON f.id = r.form_id
  WHERE r.status = 'submitted' AND r.sync_status IN ('pending', 'failed') AND f.remote_form_id IS NOT NULL
  ORDER BY r.submitted_at ASC
`);

export function listPendingSyncResponses() {
  return selectPendingSyncStmt.all().map((row) => ({
    ...rowToResponseSummary(row),
    remoteFormId: row.remote_form_id,
    answers: answersFor(row.id),
  }));
}

const markSyncedStmt = db.prepare(
  "UPDATE responses SET sync_status = 'synced', synced_at = ?, sync_error = NULL WHERE id = ?"
);

export function markResponseSynced(id) {
  markSyncedStmt.run(now(), id);
}

const markFailedStmt = db.prepare(
  "UPDATE responses SET sync_status = 'failed', retry_count = retry_count + 1, sync_error = ? WHERE id = ?"
);

export function markResponseFailed(id, error) {
  markFailedStmt.run(error ? String(error).slice(0, 500) : null, id);
}

const selectSyncIssuesStmt = db.prepare(`
  SELECT r.id, r.form_id, f.title AS form_title, r.respondent_name, r.submitted_at,
         r.retry_count, r.sync_error
  FROM responses r
  JOIN forms f ON f.id = r.form_id
  WHERE r.sync_status = 'failed'
  ORDER BY r.submitted_at DESC
`);

// The detail behind the aggregate failedCount shown in the sync status indicator — lets the
// host actually see which response failed, on which form, and why, instead of just a number
// that never resolves itself (see server/cloud/sync.js: a rejected upload is retried forever
// otherwise, with no path for the user to notice or act on it).
export function listSyncIssues() {
  return selectSyncIssuesStmt.all().map((row) => ({
    id: row.id,
    formId: row.form_id,
    formTitle: row.form_title,
    respondentName: row.respondent_name,
    submittedAt: row.submitted_at,
    retryCount: row.retry_count,
    syncError: row.sync_error,
    // True for a rejection whose cause isn't transient (the form was deleted upstream, or
    // ownership changed) — see server/cloud/rejectionReasons.js. The host's only real move on
    // one of these is Discard; a Retry would just fail the exact same way again.
    nonRetryable: NON_RETRYABLE_MESSAGES.has(row.sync_error),
  }));
}

const retrySyncStmt = db.prepare(
  "UPDATE responses SET sync_status = 'pending', sync_error = NULL WHERE id = ? AND sync_status = 'failed'"
);

export function retrySyncResponse(id) {
  retrySyncStmt.run(id);
}

const abandonSyncStmt = db.prepare(
  "UPDATE responses SET sync_status = 'abandoned' WHERE id = ? AND sync_status = 'failed'"
);

// Permanently gives up on syncing one response (e.g. a conflict the host decided isn't worth
// resolving) — 'abandoned' falls outside listPendingSyncResponses' ('pending','failed') filter,
// so it stops being retried and stops counting toward failedCount, without deleting the
// response itself (it's still visible locally, just never uploaded).
export function abandonSyncResponse(id) {
  abandonSyncStmt.run(id);
}

const selectResponseVersionStmt = db.prepare("SELECT version FROM responses WHERE id = ?");
const insertRemoteResponseStmt = db.prepare(`
  INSERT INTO responses (
    id, form_id, session_id, device_id, respondent_name, status, score, max_score,
    started_at, submitted_at, edit_code, version, form_version, sync_status, synced_at, google_response_id,
    form_snapshot_id
  ) VALUES (?, ?, ?, ?, ?, 'submitted', ?, ?, ?, ?, ?, ?, ?, 'synced', ?, ?, ?)
`);
const selectByGoogleResponseIdStmt = db.prepare(
  "SELECT id FROM responses WHERE form_id = ? AND google_response_id = ?"
);
const updateRemoteResponseStmt = db.prepare(`
  UPDATE responses SET
    respondent_name = ?, score = ?, max_score = ?, submitted_at = ?, edit_code = ?,
    version = ?, form_version = ?, form_snapshot_id = COALESCE(?, form_snapshot_id), sync_status = 'synced', synced_at = ?
  WHERE id = ? AND version < ?
`);

// Applies one response downloaded from the cloud server into local storage — the download-side
// mirror of the version-gated upsert the cloud server does on upload (see
// cloud-server/forms... no: cloud-server's /api/sync route). Never overwrites a local version
// that is >= the incoming one, so a response this device already has a newer edit for (still
// pending upload) can't be clobbered by an older copy coming back down.
// `localFormId`/`localSessionId` are resolved by the caller (server/cloud/sync.js) — this
// module only knows about responses, not the remote_form_id -> local form_id mapping.
export function applyRemoteResponse({
  id,
  localFormId,
  localSessionId,
  respondentName,
  score,
  maxScore,
  startedAt,
  submittedAt,
  editCode,
  version,
  formVersion,
  formSnapshotId,
  deviceId,
  googleResponseId,
  answers,
}) {
  const existing = selectResponseVersionStmt.get(id);
  const timestamp = now();

  // A Google response this device already holds (fetched locally, or saved from another device)
  // arrives here again under the cloud copy's own id — same response, so it's not inserted twice.
  if (!existing && googleResponseId && selectByGoogleResponseIdStmt.get(localFormId, googleResponseId)) {
    return "skipped_stale";
  }
  // node:sqlite refuses to bind `undefined` (only null/number/string/bigint/buffer are
  // valid) — a downloaded payload legitimately omits score/maxScore for an ungraded form, so
  // every optional field is normalized to null here rather than left as whatever the payload
  // did or didn't include.
  const safeScore = score ?? null;
  const safeMaxScore = maxScore ?? null;

  if (!existing) {
    db.exec("BEGIN");
    try {
      insertRemoteResponseStmt.run(
        id,
        localFormId,
        localSessionId,
        deviceId || null,
        respondentName || "",
        safeScore,
        safeMaxScore,
        startedAt || submittedAt || timestamp,
        submittedAt || timestamp,
        editCode || null,
        version,
        formVersion ?? null,
        timestamp,
        googleResponseId || null,
        formSnapshotId || null
      );
      writeAnswers(id, answers || {});
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
    return "inserted";
  }

  if (existing.version >= version) return "skipped_stale";

  db.exec("BEGIN");
  try {
    const result = updateRemoteResponseStmt.run(
      respondentName || "",
      safeScore,
      safeMaxScore,
      submittedAt || timestamp,
      editCode || null,
      version,
      formVersion ?? null,
      formSnapshotId || null,
      timestamp,
      id,
      version
    );
    if (result.changes > 0) writeAnswers(id, answers || {});
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
  return "updated";
}

const insertImportedResponseStmt = db.prepare(`
  INSERT INTO responses (
    id, form_id, session_id, respondent_name, status, score, max_score,
    started_at, submitted_at, edit_code, version, sync_status, form_snapshot_id
  ) VALUES (?, ?, ?, ?, 'submitted', ?, ?, ?, ?, ?, 1, 'pending', ?)
`);

// Inserts responses that came in with an imported form file. `questionIdMap` translates the
// exported form's question ids to the ids the import minted for its fresh copy of the form —
// an answer to a question with no mapping is dropped rather than stored under an id nothing reads.
// Everything is one transaction so a bad row can't leave a half-imported set behind.
export function importResponses(formId, sessionId, responses, questionIdMap, assessmentMaps = new Map()) {
  let imported = 0;
  db.exec("BEGIN");
  try {
    for (const r of responses) {
      const id = randomUUID();
      const timestamp = now();
      const assessment = r.assessmentId ? assessmentMaps.get(r.assessmentId) : null;
      insertImportedResponseStmt.run(
        id,
        formId,
        sessionId,
        typeof r.respondentName === "string" ? r.respondentName : "",
        Number.isFinite(r.score) ? r.score : null,
        Number.isFinite(r.maxScore) ? r.maxScore : null,
        r.startedAt || r.submittedAt || timestamp,
        r.submittedAt || timestamp,
        uniqueEditCodeForSession(sessionId),
        assessment?.snapshotId || null
      );
      const answers = {};
      Object.entries(r.answers && typeof r.answers === "object" ? r.answers : {}).forEach(([oldId, value]) => {
        const newId = (assessment?.idMap || questionIdMap).get(oldId);
        if (newId) answers[newId] = value;
      });
      writeAnswers(id, answers);
      imported += 1;
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
  return imported;
}

// ---- Google Forms responses fetched locally, not yet saved to the cloud ----

export function findResponseByGoogleId(formId, googleResponseId) {
  return selectByGoogleResponseIdStmt.get(formId, googleResponseId)?.id || null;
}

const insertGoogleResponseStmt = db.prepare(`
  INSERT INTO responses (
    id, form_id, session_id, respondent_name, status, score, max_score,
    started_at, submitted_at, edit_code, version, form_version, sync_status, google_response_id
  ) VALUES (?, ?, ?, ?, 'submitted', NULL, NULL, ?, ?, NULL, 1, ?, 'local', ?)
`);

// Stored as sync_status 'local': visible everywhere on this device, but never uploaded until the
// host says so (promoteLocalResponses). Google carries no grading data, so score/max_score stay null.
export function insertGoogleResponse({ formId, sessionId, googleResponseId, respondentName, startedAt, submittedAt, formVersion, answers }) {
  const id = randomUUID();
  const timestamp = now();
  db.exec("BEGIN");
  try {
    insertGoogleResponseStmt.run(
      id,
      formId,
      sessionId,
      respondentName || "",
      startedAt || submittedAt || timestamp,
      submittedAt || startedAt || timestamp,
      formVersion ?? null,
      googleResponseId
    );
    writeAnswers(id, answers || {});
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
  return id;
}

const countLocalOnlyStmt = db.prepare("SELECT COUNT(*) AS n FROM responses WHERE sync_status = 'local'");
const countLocalOnlyForFormStmt = db.prepare(
  "SELECT COUNT(*) AS n FROM responses WHERE sync_status = 'local' AND form_id = ?"
);
const countLocalOnlyByFormStmt = db.prepare(
  "SELECT form_id, COUNT(*) AS n FROM responses WHERE sync_status = 'local' GROUP BY form_id"
);
const promoteLocalStmt = db.prepare(
  "UPDATE responses SET sync_status = 'pending' WHERE sync_status = 'local' AND form_id = ?"
);

export function countLocalOnlyResponses(formId) {
  return (formId ? countLocalOnlyForFormStmt.get(formId) : countLocalOnlyStmt.get()).n;
}

export function countLocalOnlyResponsesByForm() {
  return Object.fromEntries(countLocalOnlyByFormStmt.all().map((r) => [r.form_id, r.n]));
}

// The host chose "Save to cloud": from here these are ordinary pending responses and go up with
// the next sync. Returns how many were queued.
export function promoteLocalResponses(formId) {
  return promoteLocalStmt.run(formId).changes;
}
