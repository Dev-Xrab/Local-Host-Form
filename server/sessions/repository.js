import { randomInt, randomUUID } from "node:crypto";
import { db } from "../db/index.js";

const SESSION_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const generateCode = () =>
  Array.from({ length: 6 }, () => SESSION_CODE_CHARS[randomInt(SESSION_CODE_CHARS.length)]).join("");

const now = () => new Date().toISOString();

// A session's status only ever changes via an explicit host action (start/end) — the
// time limit is per-respondent now (each response gets its own deadline_at at join
// time), so the session itself no longer auto-expires on a clock.
// Some sessions are only a home for responses that were not collected live on this device: ones
// downloaded from another device (SYNCED-…), imported with a form file (IMPORT-…) or fetched from
// Google (GOOGLE-…). Their "code" is a label, not something a respondent can join with.
export const isPlaceholderCode = (code) => /^(SYNCED|IMPORT|GOOGLE)-/i.test(code || "");

function rowToSession(row) {
  return {
    joinable: !isPlaceholderCode(row.code),
    id: row.id,
    formId: row.form_id,
    name: row.name,
    code: row.code,
    status: row.status,
    durationMinutes: row.duration_minutes,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    createdAt: row.created_at,
    respondentCount: row.respondent_count ?? 0,
    inProgressCount: row.in_progress_count ?? 0,
    submittedCount: row.submitted_count ?? 0,
    responsesEditable: !!row.responses_editable,
    refocusLockSeconds: row.refocus_lock_seconds,
    fullscreenEnabled: !!row.fullscreen_enabled,
  };
}

const COUNTS_SQL = `
  (SELECT COUNT(*) FROM responses r WHERE r.session_id = s.id) AS respondent_count,
  (SELECT COUNT(*) FROM responses r WHERE r.session_id = s.id AND r.status = 'in_progress') AS in_progress_count,
  (SELECT COUNT(*) FROM responses r WHERE r.session_id = s.id AND r.status = 'submitted') AS submitted_count
`;

const selectAllStmt = db.prepare(`
  SELECT s.*, ${COUNTS_SQL} FROM sessions s ORDER BY s.created_at DESC
`);
const selectForFormStmt = db.prepare(`
  SELECT s.*, ${COUNTS_SQL} FROM sessions s WHERE s.form_id = ? ORDER BY s.created_at DESC
`);
const selectOneStmt = db.prepare(`
  SELECT s.*, ${COUNTS_SQL} FROM sessions s WHERE s.id = ?
`);
// COLLATE NOCASE: belt-and-suspenders against any code stored with different casing than what a
// respondent's link/typed code gets normalized to (see the public join route, which always
// uppercases first) — the actual fix is that every code is generated uppercase to begin with
// (see findOrCreateSyncedSession/findOrCreateGoogleSession/createEndedSession below), but a
// lookup that tolerates either casing costs nothing and can't regress the same way twice.
const selectByCodeStmt = db.prepare(`
  SELECT s.*, ${COUNTS_SQL} FROM sessions s WHERE s.code = ? COLLATE NOCASE
`);
const codeExistsStmt = db.prepare("SELECT 1 FROM sessions WHERE code = ?");

export function listSessions() {
  return selectAllStmt.all().map(rowToSession);
}

export function listSessionsForForm(formId) {
  return selectForFormStmt.all(formId).map(rowToSession);
}

export function getSession(id) {
  const row = selectOneStmt.get(id);
  return row ? rowToSession(row) : null;
}

export function getSessionByCode(code) {
  const row = selectByCodeStmt.get(code);
  return row ? rowToSession(row) : null;
}

export function createSession({
  formId,
  name,
  durationMinutes,
  responsesEditable,
  refocusLockSeconds,
  fullscreenEnabled,
}) {
  let code = generateCode();
  while (codeExistsStmt.get(code)) code = generateCode();

  const id = randomUUID();
  db.prepare(
    `INSERT INTO sessions (id, form_id, name, code, status, duration_minutes, created_at, responses_editable, refocus_lock_seconds, fullscreen_enabled)
     VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?)`
  ).run(
    id,
    formId,
    name || "",
    code,
    durationMinutes ?? null,
    now(),
    responsesEditable ? 1 : 0,
    refocusLockSeconds ?? null,
    fullscreenEnabled ? 1 : 0
  );
  return getSession(id);
}

export function updateSession(id, { name, durationMinutes }) {
  const existing = selectOneStmt.get(id);
  if (!existing) return null;

  db.prepare("UPDATE sessions SET name = ?, duration_minutes = ? WHERE id = ?").run(
    name ?? existing.name,
    durationMinutes !== undefined ? durationMinutes : existing.duration_minutes,
    id
  );
  return getSession(id);
}

// Whether respondents may re-open and change a submitted answer. Unlike name/duration,
// this can be flipped anytime (draft, active, or ended) — the host might turn it on before
// starting, or partway through once they realize a question needs a redo. It only takes
// effect while the session is actually active; see canEditResponses in public routes.
export function setResponsesEditable(id, editable) {
  const existing = selectOneStmt.get(id);
  if (!existing) return null;
  db.prepare("UPDATE sessions SET responses_editable = ? WHERE id = ?").run(editable ? 1 : 0, id);
  return getSession(id);
}

// `seconds` null/0 turns the countdown off; a positive integer sets (or changes) it. Flippable
// anytime for the same reason responses_editable is — see that function's comment.
export function setRefocusLock(id, seconds) {
  const existing = selectOneStmt.get(id);
  if (!existing) return null;
  db.prepare("UPDATE sessions SET refocus_lock_seconds = ? WHERE id = ?").run(
    Number.isInteger(seconds) && seconds > 0 ? seconds : null,
    id
  );
  return getSession(id);
}

export function setFullscreenEnabled(id, enabled) {
  const existing = selectOneStmt.get(id);
  if (!existing) return null;
  db.prepare("UPDATE sessions SET fullscreen_enabled = ? WHERE id = ?").run(enabled ? 1 : 0, id);
  return getSession(id);
}

export function startSession(id) {
  const existing = selectOneStmt.get(id);
  if (!existing) return null;
  if (existing.status !== "draft") return getSession(id);

  db.prepare("UPDATE sessions SET status = 'active', started_at = ? WHERE id = ?").run(now(), id);
  return getSession(id);
}

export function endSession(id) {
  const existing = selectOneStmt.get(id);
  if (!existing) return null;
  if (existing.status === "ended") return getSession(id);
  db.prepare("UPDATE sessions SET status = 'ended', ended_at = ? WHERE id = ?").run(now(), id);
  return getSession(id);
}

// Lets a host un-end a session — e.g. they ended it by mistake, or want to accept more
// joins. Respondents keep their own per-response deadline_at, so reopening doesn't grant
// anyone extra time; it just resumes accepting joins and re-hides scores until ended again.
export function reopenSession(id) {
  const existing = selectOneStmt.get(id);
  if (!existing) return null;
  if (existing.status !== "ended") return getSession(id);
  db.prepare("UPDATE sessions SET status = 'active', ended_at = NULL WHERE id = ?").run(id);
  return getSession(id);
}

export function deleteSession(id) {
  const result = db.prepare("DELETE FROM sessions WHERE id = ?").run(id);
  return result.changes > 0;
}

const selectSyncedSessionStmt = db.prepare(
  "SELECT id FROM sessions WHERE form_id = ? AND code = ? COLLATE NOCASE"
);

// Responses downloaded from the cloud server (see server/cloud/sync.js) were collected under a
// session that only ever existed on the ORIGINATING device — this device never joined it, so it
// has no local session row to attach them to, and `responses.session_id` is a foreign key that
// must point at something real. Rather than inventing a whole "responses that don't belong to a
// session" concept (a second code path through every session-scoped view: SessionDetailPage,
// the gradebook, exports), each remote device gets one durable "ended" session per form here —
// every response synced down from that device lands in it, and it shows up in Sessions/Gradebook
// exactly like a session run on this machine, just labeled by where it actually came from.
export function findOrCreateSyncedSession(formId, remoteDeviceId, deviceLabel) {
  // Uppercase: a respondent-facing code lookup always uppercases first (see server/public/
  // routes.js), and remoteDeviceId is a randomUUID — lowercase hex left in here would make the
  // session's own join link 404 the moment anyone actually followed it.
  const code = `SYNCED-${remoteDeviceId.slice(0, 8).toUpperCase()}`;
  const existing = selectSyncedSessionStmt.get(formId, code);
  if (existing) return existing.id;

  const id = randomUUID();
  db.prepare(
    `INSERT INTO sessions (id, form_id, name, code, status, created_at) VALUES (?, ?, ?, ?, 'ended', ?)`
  ).run(id, formId, `Synced from ${deviceLabel || "another device"}`, code, now());
  return id;
}

// A single already-ended session to hold responses that arrived with an imported form file (see
// server/forms/routes.js POST /import) — they weren't collected through any session on this
// device, but responses.session_id is a required foreign key, so they need somewhere real to live.
export function createEndedSession(formId, name) {
  const id = randomUUID();
  const timestamp = now();
  db.prepare(
    `INSERT INTO sessions (id, form_id, name, code, status, started_at, ended_at, created_at)
     VALUES (?, ?, ?, ?, 'ended', ?, ?, ?)`
  ).run(id, formId, name, `IMPORT-${id.slice(0, 8).toUpperCase()}`, timestamp, timestamp, timestamp);
  return id;
}

// One durable, already-ended session per form to hold responses fetched from Google Forms — like a
// synced session, it exists only so those responses have a real session to belong to (see
// findOrCreateSyncedSession), and shows up in Sessions/Bulk Export like any other.
export function findOrCreateGoogleSession(formId) {
  const code = `GOOGLE-${formId.slice(0, 8).toUpperCase()}`;
  const existing = selectSyncedSessionStmt.get(formId, code);
  if (existing) return existing.id;

  const id = randomUUID();
  const timestamp = now();
  db.prepare(
    `INSERT INTO sessions (id, form_id, name, code, status, started_at, ended_at, created_at)
     VALUES (?, ?, 'Google Forms', ?, 'ended', ?, ?, ?)`
  ).run(id, formId, code, timestamp, timestamp, timestamp);
  return id;
}
