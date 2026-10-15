import { Router } from "express";
import { scheduleAutoSave } from "../cloud/autosave.js";
import * as repo from "./repository.js";
import { getSubject } from "../subjects/repository.js";
import { recalculateResponsesForForm, importResponses } from "../responses/repository.js";
import { createEndedSession } from "../sessions/repository.js";
import { validateImageSource } from "../security/uploads.js";

const MAX_TITLE_LENGTH = 500;
const MAX_DESCRIPTION_LENGTH = 20_000;
const MAX_QUESTIONS = 500;
const MAX_OPTIONS = 500;
const MAX_IMPORTED_RESPONSES = 10_000;

const QUESTION_TYPES = new Set([
  "short_answer",
  "paragraph",
  "multiple_choice",
  "checkboxes",
  "dropdown",
  "linear_scale",
  "date",
  "time",
  "file_upload",
  "matrix",
  "matrix_checkbox",
  "section",
]);

const optionalString = (value, max) => value === undefined || value === null || (typeof value === "string" && value.length <= max);

function validateQuestions(questions) {
  if (!Array.isArray(questions)) return "questions must be an array";
  if (questions.length > MAX_QUESTIONS) return `a form can have at most ${MAX_QUESTIONS} questions`;
  for (const q of questions) {
    if (!q || typeof q !== "object") return "each question must be an object";
    if (!q.id || typeof q.id !== "string" || q.id.length > 100) return "each question must have a string id";
    if (!QUESTION_TYPES.has(q.type)) return "unknown question type";
    if (!optionalString(q.title, MAX_TITLE_LENGTH * 4)) return "question title is too long";
    if (!optionalString(q.description, MAX_DESCRIPTION_LENGTH)) return "question description is too long";
    if (q.points !== undefined && (typeof q.points !== "number" || !Number.isFinite(q.points) || q.points < 0 || q.points > 100_000)) {
      return "points must be a non-negative number";
    }
    for (const list of [q.options, q.rows, q.correctAnswers, q.correctAnswerIndex]) {
      if (list !== undefined && list !== null && (!Array.isArray(list) || list.length > MAX_OPTIONS)) {
        return "question options must be a list of reasonable size";
      }
    }
    const imageError = validateImageSource(q.imageUrl);
    if (imageError) return imageError;
  }
  return null;
}

// Shared by create/update/import: rejects oversized or wrongly-typed metadata up front.
function validateFormMeta({ title, description, bannerImage }) {
  if (title !== undefined && typeof title !== "string") return "title must be a string";
  if (typeof title === "string" && title.length > MAX_TITLE_LENGTH) return "title is too long";
  if (description !== undefined && typeof description !== "string") return "description must be a string";
  if (typeof description === "string" && description.length > MAX_DESCRIPTION_LENGTH) return "description is too long";
  if (bannerImage !== undefined && bannerImage !== null && typeof bannerImage !== "string") {
    return "bannerImage must be a string or null";
  }
  return validateImageSource(bannerImage);
}

export const formsRouter = Router();

formsRouter.get("/", (req, res) => {
  res.json(repo.listForms());
});

formsRouter.post("/", (req, res) => {
  const { title, description, subjectId } = req.body || {};
  const metaError = validateFormMeta({ title, description });
  if (metaError) return res.status(400).json({ error: metaError });
  if (subjectId != null && (typeof subjectId !== "string" || !getSubject(subjectId))) {
    return res.status(400).json({ error: "subjectId does not refer to an existing subject" });
  }
  const form = repo.createForm({ title, description, subjectId: subjectId || null });
  scheduleAutoSave(form.id);
  res.status(201).json(form);
});

formsRouter.post("/import", (req, res) => {
  const { title, description, settings, questions, subjectId, responses, bannerImage } = req.body || {};

  const metaError = validateFormMeta({ title, description, bannerImage });
  if (metaError) return res.status(400).json({ error: metaError });
  if (settings !== undefined && (typeof settings !== "object" || settings === null || Array.isArray(settings))) {
    return res.status(400).json({ error: "settings must be an object" });
  }
  if (Array.isArray(responses) && responses.length > MAX_IMPORTED_RESPONSES) {
    return res.status(400).json({ error: `A file can include at most ${MAX_IMPORTED_RESPONSES} responses.` });
  }
  if (responses !== undefined && (!Array.isArray(responses) || responses.some((r) => !r || typeof r !== "object"))) {
    return res.status(400).json({ error: "responses must be an array of objects" });
  }
  if (!Array.isArray(questions)) {
    return res.status(400).json({ error: "That file doesn't look like an exported form (missing questions)." });
  }
  const error = validateQuestions(questions);
  if (error) return res.status(400).json({ error });
  if (subjectId != null && (typeof subjectId !== "string" || !getSubject(subjectId))) {
    return res.status(400).json({ error: "subjectId does not refer to an existing subject" });
  }

  const form = repo.importForm({
    title,
    description,
    settings,
    questions,
    subjectId: subjectId || null,
    bannerImage: bannerImage || null,
  });

  // The imported copy gets fresh question ids (see importForm), so each exported id is mapped to
  // its counterpart by position — the questions are inserted in exactly the order they arrived.
  let importedResponseCount = 0;
  if (responses?.length) {
    const idMap = new Map(questions.map((q, i) => [q.id, form.questions[i]?.id]));
    const sessionId = createEndedSession(form.id, "Imported responses");
    importedResponseCount = importResponses(form.id, sessionId, responses, idMap);
  }
  scheduleAutoSave(form.id);
  res.status(201).json({ ...form, importedResponseCount });
});

formsRouter.get("/:id", (req, res) => {
  const form = repo.getForm(req.params.id);
  if (!form) return res.status(404).json({ error: "Form not found" });
  res.json(form);
});

formsRouter.put("/:id", (req, res) => {
  const { title, description, settings, questions, subjectId, bannerImage } = req.body || {};

  const metaError = validateFormMeta({ title, description, bannerImage });
  if (metaError) return res.status(400).json({ error: metaError });
  if (settings !== undefined && (typeof settings !== "object" || settings === null || Array.isArray(settings))) {
    return res.status(400).json({ error: "settings must be an object" });
  }
  if (questions !== undefined) {
    const error = validateQuestions(questions);
    if (error) return res.status(400).json({ error });
  }
  if (subjectId !== undefined && subjectId !== null && (typeof subjectId !== "string" || !getSubject(subjectId))) {
    return res.status(400).json({ error: "subjectId does not refer to an existing subject" });
  }

  const form = repo.updateForm(req.params.id, {
    title,
    description,
    settings,
    questions,
    subjectId: subjectId === undefined ? undefined : subjectId || null,
    bannerImage,
  });
  if (!form) return res.status(404).json({ error: "Form not found" });

  // The grading configuration (correct answers, points) may have just changed — every
  // already-submitted response for this form needs its score re-derived against it, not
  // just newly-submitted ones. This is the one place that trigger fires from.
  let recalculated = 0;
  if (Array.isArray(questions)) {
    recalculated = recalculateResponsesForForm(form.id, form.questions);
  }

  scheduleAutoSave(form.id);
  res.json({ ...form, recalculatedResponses: recalculated });
});

formsRouter.delete("/:id", (req, res) => {
  const deleted = repo.deleteForm(req.params.id);
  if (!deleted) return res.status(404).json({ error: "Form not found" });
  res.status(204).end();
});
