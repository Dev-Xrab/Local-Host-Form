import { Router } from "express";
import * as repo from "./repository.js";
import { getSubject } from "../subjects/repository.js";
import { recalculateResponsesForForm } from "../responses/repository.js";

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
  "section",
]);

function validateQuestions(questions) {
  if (!Array.isArray(questions)) return "questions must be an array";
  for (const q of questions) {
    if (!q || typeof q !== "object") return "each question must be an object";
    if (!q.id || typeof q.id !== "string") return "each question must have a string id";
    if (!QUESTION_TYPES.has(q.type)) return `unknown question type: ${q.type}`;
    if (q.points !== undefined && (typeof q.points !== "number" || q.points < 0)) {
      return "points must be a non-negative number";
    }
  }
  return null;
}

export const formsRouter = Router();

formsRouter.get("/", (req, res) => {
  res.json(repo.listForms());
});

formsRouter.post("/", (req, res) => {
  const { title, description, subjectId } = req.body || {};
  if (title !== undefined && typeof title !== "string") {
    return res.status(400).json({ error: "title must be a string" });
  }
  if (subjectId != null && !getSubject(subjectId)) {
    return res.status(400).json({ error: "subjectId does not refer to an existing subject" });
  }
  const form = repo.createForm({ title, description, subjectId: subjectId || null });
  res.status(201).json(form);
});

formsRouter.post("/import", (req, res) => {
  const { title, description, settings, questions, subjectId } = req.body || {};

  if (title !== undefined && typeof title !== "string") {
    return res.status(400).json({ error: "title must be a string" });
  }
  if (description !== undefined && typeof description !== "string") {
    return res.status(400).json({ error: "description must be a string" });
  }
  if (settings !== undefined && (typeof settings !== "object" || settings === null)) {
    return res.status(400).json({ error: "settings must be an object" });
  }
  if (!Array.isArray(questions)) {
    return res.status(400).json({ error: "That file doesn't look like an exported form (missing questions)." });
  }
  const error = validateQuestions(questions);
  if (error) return res.status(400).json({ error });
  if (subjectId != null && !getSubject(subjectId)) {
    return res.status(400).json({ error: "subjectId does not refer to an existing subject" });
  }

  const form = repo.importForm({ title, description, settings, questions, subjectId: subjectId || null });
  res.status(201).json(form);
});

formsRouter.get("/:id", (req, res) => {
  const form = repo.getForm(req.params.id);
  if (!form) return res.status(404).json({ error: "Form not found" });
  res.json(form);
});

formsRouter.put("/:id", (req, res) => {
  const { title, description, settings, questions, subjectId } = req.body || {};

  if (title !== undefined && typeof title !== "string") {
    return res.status(400).json({ error: "title must be a string" });
  }
  if (description !== undefined && typeof description !== "string") {
    return res.status(400).json({ error: "description must be a string" });
  }
  if (settings !== undefined && (typeof settings !== "object" || settings === null)) {
    return res.status(400).json({ error: "settings must be an object" });
  }
  if (questions !== undefined) {
    const error = validateQuestions(questions);
    if (error) return res.status(400).json({ error });
  }
  if (subjectId !== undefined && subjectId !== null && !getSubject(subjectId)) {
    return res.status(400).json({ error: "subjectId does not refer to an existing subject" });
  }

  const form = repo.updateForm(req.params.id, {
    title,
    description,
    settings,
    questions,
    subjectId: subjectId === undefined ? undefined : subjectId || null,
  });
  if (!form) return res.status(404).json({ error: "Form not found" });

  // The grading configuration (correct answers, points) may have just changed — every
  // already-submitted response for this form needs its score re-derived against it, not
  // just newly-submitted ones. This is the one place that trigger fires from.
  let recalculated = 0;
  if (Array.isArray(questions)) {
    recalculated = recalculateResponsesForForm(form.id, form.questions);
  }

  res.json({ ...form, recalculatedResponses: recalculated });
});

formsRouter.delete("/:id", (req, res) => {
  const deleted = repo.deleteForm(req.params.id);
  if (!deleted) return res.status(404).json({ error: "Form not found" });
  res.status(204).end();
});
