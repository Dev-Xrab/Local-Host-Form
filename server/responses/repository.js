import { randomUUID } from "node:crypto";
import { db } from "../db/index.js";
import { scoreResponse } from "./grading.js";

const now = () => new Date().toISOString();

// A response's own edit code, separate from the session's shared join code: the join code
// is public to the whole class, so it can't double as proof of ownership. This is generated
// once (at first submit) and stays stable across edits, so a respondent can note it down and
// use it — together with the session code — to reopen their own answer from another device
// without anyone else being able to guess or reuse it to touch someone else's response.
const EDIT_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const generateEditCode = () =>
  Array.from({ length: 6 }, () => EDIT_CODE_CHARS[Math.floor(Math.random() * EDIT_CODE_CHARS.length)]).join("");

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
export function createInProgressResponse({ formId, sessionId, deviceId, respondentName, durationMinutes }) {
  const id = randomUUID();
  const startedAt = now();
  const deadlineAt = durationMinutes
    ? new Date(Date.now() + durationMinutes * 60 * 1000).toISOString()
    : null;
  db.prepare(
    `INSERT INTO responses (id, form_id, session_id, device_id, respondent_name, status, started_at, deadline_at)
     VALUES (?, ?, ?, ?, ?, 'in_progress', ?, ?)`
  ).run(id, formId, sessionId, deviceId || null, respondentName || "", startedAt, deadlineAt);
  return rowToResponseSummary(selectResponseStmt.get(id));
}

// Finalizes an in_progress response — this covers both a first submit and a resubmit after
// the respondent reopened an already-submitted answer to edit it (see reopenResponseForEditing),
// since both start from status 'in_progress'. Guarded by the status check inside the UPDATE so
// a double-submit race (e.g. two tabs) can't score the same attempt twice — the second call
// affects 0 rows and the caller is told it was already submitted.
export function submitResponse(id, { answers, score, maxScore }) {
  const existing = selectResponseStmt.get(id);
  if (!existing) return "already_submitted";
  // Stable across edits: generated once at first submit, reused on every resubmit so the
  // respondent's noted-down edit code keeps working.
  const editCode = existing.edit_code || uniqueEditCodeForSession(existing.session_id);

  db.exec("BEGIN");
  try {
    const result = db
      .prepare(
        `UPDATE responses SET status = 'submitted', submitted_at = ?, score = ?, max_score = ?, edit_code = ?
         WHERE id = ? AND status = 'in_progress'`
      )
      .run(now(), score, maxScore, editCode, id);

    if (result.changes === 0) {
      db.exec("ROLLBACK");
      return "already_submitted";
    }

    // Clear any answers from a prior submit of this same response (a resubmit-after-edit)
    // before inserting the new set, so editing an answer replaces it instead of stacking a
    // second row for the same question.
    db.prepare("DELETE FROM response_answers WHERE response_id = ?").run(id);
    const insertAnswer = db.prepare(
      "INSERT INTO response_answers (id, response_id, question_id, value) VALUES (?, ?, ?, ?)"
    );
    Object.entries(answers).forEach(([questionId, value]) => {
      insertAnswer.run(randomUUID(), id, questionId, JSON.stringify(value));
    });
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
    `UPDATE responses SET status = 'in_progress', submitted_at = NULL, deadline_at = NULL, device_id = ?
     WHERE id = ?`
  ).run(finalDeviceId, id);
  return getResponse(id);
}

const selectForSessionStmt = db.prepare(
  "SELECT * FROM responses WHERE session_id = ? ORDER BY started_at DESC"
);

export function listResponsesForSession(sessionId) {
  return selectForSessionStmt.all(sessionId).map(rowToResponseSummary);
}

const selectSubmittedForFormStmt = db.prepare(
  "SELECT id FROM responses WHERE form_id = ? AND status = 'submitted'"
);
const updateScoreStmt = db.prepare("UPDATE responses SET score = ?, max_score = ? WHERE id = ?");

// The critical piece for "grading changed after people already answered": re-run the
// authoritative scorer against every already-submitted response's stored answers, using
// whatever the form's questions look like right now, and persist the new score. Submitted
// answers themselves are never touched — only the derived score.
export function recalculateResponsesForForm(formId, questions) {
  const ids = selectSubmittedForFormStmt.all(formId).map((r) => r.id);
  if (ids.length === 0) return 0;

  const answerableQuestions = questions.filter((q) => q.type !== "section");

  db.exec("BEGIN");
  try {
    for (const id of ids) {
      const answers = answersFor(id);
      const { score, maxScore } = scoreResponse(answerableQuestions, answers);
      updateScoreStmt.run(score, maxScore, id);
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  return ids.length;
}
