import { randomUUID } from "node:crypto";
import { db } from "../db/index.js";

const SESSION_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const generateCode = () =>
  Array.from({ length: 6 }, () => SESSION_CODE_CHARS[Math.floor(Math.random() * SESSION_CODE_CHARS.length)]).join("");

const now = () => new Date().toISOString();

// A session's status only ever changes via an explicit host action (start/end) — the
// time limit is per-respondent now (each response gets its own deadline_at at join
// time), so the session itself no longer auto-expires on a clock.
function rowToSession(row) {
  return {
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
const selectByCodeStmt = db.prepare(`
  SELECT s.*, ${COUNTS_SQL} FROM sessions s WHERE s.code = ?
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

export function createSession({ formId, name, durationMinutes }) {
  let code = generateCode();
  while (codeExistsStmt.get(code)) code = generateCode();

  const id = randomUUID();
  db.prepare(
    `INSERT INTO sessions (id, form_id, name, code, status, duration_minutes, created_at)
     VALUES (?, ?, ?, ?, 'draft', ?, ?)`
  ).run(id, formId, name || "", code, durationMinutes ?? null, now());
  return getSession(id);
}

export function updateSession(id, { name, durationMinutes }) {
  const existing = selectOneStmt.get(id);
  if (!existing) return null;
  if (existing.status !== "draft") return "not_draft";

  db.prepare("UPDATE sessions SET name = ?, duration_minutes = ? WHERE id = ?").run(
    name ?? existing.name,
    durationMinutes !== undefined ? durationMinutes : existing.duration_minutes,
    id
  );
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
