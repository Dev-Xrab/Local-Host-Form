import { randomUUID } from "node:crypto";
import { db } from "../db/index.js";

// Timer/session-code settings moved to the session itself (a session now owns its own
// time limit) — a form only carries grading-disclosure and retake policy.
const DEFAULT_SETTINGS = {
  allowMultipleResponses: false,
  showScoreImmediately: true,
  revealCorrectAnswers: false,
  downloadIncludesChoices: false,
};

const now = () => new Date().toISOString();

function rowToQuestion(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    description: row.description,
    showDescription: !!row.show_description,
    showImage: !!row.show_image,
    required: !!row.required,
    options: JSON.parse(row.options),
    scale: JSON.parse(row.scale),
    imageUrl: row.image_url,
    correctAnswerIndex: JSON.parse(row.correct_answer_index),
    correctAnswers: JSON.parse(row.correct_answers),
    points: row.points,
  };
}

function rowToFormMeta(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    settings: { ...DEFAULT_SETTINGS, ...JSON.parse(row.settings) },
    subjectId: row.subject_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const selectFormStmt = db.prepare("SELECT * FROM forms WHERE id = ?");
const selectQuestionsStmt = db.prepare(
  "SELECT * FROM questions WHERE form_id = ? ORDER BY order_index ASC"
);
const selectAllFormsStmt = db.prepare("SELECT * FROM forms ORDER BY updated_at DESC");
const countQuestionsStmt = db.prepare(
  "SELECT form_id, COUNT(*) as count FROM questions WHERE type != 'section' GROUP BY form_id"
);

export function listForms() {
  const forms = selectAllFormsStmt.all();
  const counts = Object.fromEntries(
    countQuestionsStmt.all().map((r) => [r.form_id, r.count])
  );
  return forms.map((row) => ({
    ...rowToFormMeta(row),
    questionCount: counts[row.id] || 0,
  }));
}

export function getForm(id) {
  const row = selectFormStmt.get(id);
  if (!row) return null;
  const questions = selectQuestionsStmt.all(id).map(rowToQuestion);
  return { ...rowToFormMeta(row), questions };
}

export function createForm({ title = "", description = "", subjectId = null } = {}) {
  const id = randomUUID();
  const timestamp = now();
  db.prepare(
    `INSERT INTO forms (id, title, description, status, settings, subject_id, created_at, updated_at)
     VALUES (?, ?, ?, 'draft', ?, ?, ?, ?)`
  ).run(id, title, description, JSON.stringify(DEFAULT_SETTINGS), subjectId, timestamp, timestamp);
  return getForm(id);
}

const deleteQuestionsStmt = db.prepare("DELETE FROM questions WHERE form_id = ?");
const insertQuestionStmt = db.prepare(`
  INSERT INTO questions (
    id, form_id, order_index, type, title, description, show_description, show_image,
    required, options, scale, image_url, correct_answer_index, correct_answers, points
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const updateFormMetaStmt = db.prepare(`
  UPDATE forms SET title = ?, description = ?, settings = ?, subject_id = ?, updated_at = ? WHERE id = ?
`);

export function updateForm(id, { title, description, settings, questions, subjectId }) {
  const existing = selectFormStmt.get(id);
  if (!existing) return null;

  const nextTitle = title ?? existing.title;
  const nextDescription = description ?? existing.description;
  const nextSubjectId = subjectId !== undefined ? subjectId : existing.subject_id;
  const nextSettings = {
    ...DEFAULT_SETTINGS,
    ...JSON.parse(existing.settings),
    ...(settings || {}),
  };
  const timestamp = now();

  db.exec("BEGIN");
  try {
    updateFormMetaStmt.run(
      nextTitle,
      nextDescription,
      JSON.stringify(nextSettings),
      nextSubjectId,
      timestamp,
      id
    );

    if (Array.isArray(questions)) {
      deleteQuestionsStmt.run(id);
      questions.forEach((q, index) => {
        insertQuestionStmt.run(
          q.id || randomUUID(),
          id,
          index,
          q.type,
          q.title || "",
          q.description || "",
          q.showDescription ? 1 : 0,
          q.showImage ? 1 : 0,
          q.required ? 1 : 0,
          JSON.stringify(q.options || []),
          JSON.stringify(q.scale || {}),
          q.imageUrl || null,
          JSON.stringify(q.correctAnswerIndex || []),
          JSON.stringify(q.correctAnswers || []),
          Number.isFinite(q.points) && q.points >= 0 ? q.points : 1
        );
      });
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  return getForm(id);
}

// Recreates a form from a previously-exported definition as a brand new form — always
// fresh form/question IDs (never reuse the exported ones) so importing the same file twice,
// or on a different server, can never collide with an existing row. Question images are
// already inline base64 data: URIs on the question object (see ImageBlock.jsx), so they
// round-trip for free with no separate asset handling.
export function importForm({ title = "", description = "", settings, questions, subjectId = null } = {}) {
  const id = randomUUID();
  const timestamp = now();
  const nextSettings = { ...DEFAULT_SETTINGS, ...(settings || {}) };

  db.exec("BEGIN");
  try {
    db.prepare(
      `INSERT INTO forms (id, title, description, status, settings, subject_id, created_at, updated_at)
       VALUES (?, ?, ?, 'draft', ?, ?, ?, ?)`
    ).run(id, title, description, JSON.stringify(nextSettings), subjectId, timestamp, timestamp);

    (questions || []).forEach((q, index) => {
      insertQuestionStmt.run(
        randomUUID(),
        id,
        index,
        q.type,
        q.title || "",
        q.description || "",
        q.showDescription ? 1 : 0,
        q.showImage ? 1 : 0,
        q.required ? 1 : 0,
        JSON.stringify(q.options || []),
        JSON.stringify(q.scale || {}),
        q.imageUrl || null,
        JSON.stringify(q.correctAnswerIndex || []),
        JSON.stringify(q.correctAnswers || []),
        Number.isFinite(q.points) && q.points >= 0 ? q.points : 1
      );
    });
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  return getForm(id);
}

export function deleteForm(id) {
  const result = db.prepare("DELETE FROM forms WHERE id = ?").run(id);
  return result.changes > 0;
}
