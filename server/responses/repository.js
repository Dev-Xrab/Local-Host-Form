import { randomUUID } from "node:crypto";
import { db } from "../db/index.js";
import { scoreResponse } from "./grading.js";

const now = () => new Date().toISOString();

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

// Finalizes an in_progress response. Guarded by the status check inside the UPDATE so a
// double-submit race (e.g. two tabs) can't score the same attempt twice — the second
// call affects 0 rows and the caller is told it was already submitted.
export function submitResponse(id, { answers, score, maxScore }) {
  db.exec("BEGIN");
  try {
    const result = db
      .prepare(
        `UPDATE responses SET status = 'submitted', submitted_at = ?, score = ?, max_score = ?
         WHERE id = ? AND status = 'in_progress'`
      )
      .run(now(), score, maxScore, id);

    if (result.changes === 0) {
      db.exec("ROLLBACK");
      return "already_submitted";
    }

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
