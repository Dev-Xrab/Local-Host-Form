import { Router } from "express";
import * as repo from "./repository.js";

// Kept in sync with the question types the local app's editor/renderer understands
// (server/forms/routes.js on the desktop app side).
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

function validateQuestions(questions) {
  if (!Array.isArray(questions)) return "questions must be an array";
  for (const q of questions) {
    if (!q || typeof q !== "object") return "each question must be an object";
    if (!q.id || typeof q.id !== "string") return "each question must have a string id";
    if (!QUESTION_TYPES.has(q.type)) return `unknown question type: ${q.type}`;
  }
  return null;
}

function validateFormBody(body) {
  const { title, description, settings, questions } = body || {};
  if (title !== undefined && typeof title !== "string") return "title must be a string";
  if (description !== undefined && typeof description !== "string") return "description must be a string";
  if (settings !== undefined && (typeof settings !== "object" || settings === null)) {
    return "settings must be an object";
  }
  return validateQuestions(questions);
}

export const formsRouter = Router();

// req.userId comes only from the verified bearer token (see auth/middleware.js) — every route
// below scopes its query to that id, so one account can never list, read, or publish into
// another account's forms no matter what id shows up in the request body/URL.
formsRouter.get("/", async (req, res) => {
  res.json(await repo.listFormsForOwner(req.userId));
});

// ?version=N fetches that specific historical snapshot instead of always the latest — see
// forms/repository.js getFormForOwner. Omit (or an invalid value) for the usual current-version
// behavior.
formsRouter.get("/:id", async (req, res) => {
  const version = Number.isInteger(Number(req.query.version)) && req.query.version !== undefined
    ? Number(req.query.version)
    : undefined;
  const form = await repo.getFormForOwner(req.userId, req.params.id, version);
  if (!form) return res.status(404).json({ error: "Form not found." });
  res.json(form);
});

// Every published version of this form, newest first — powers the "Import from Cloud"
// version-picker dropdown (defaults to latest).
formsRouter.get("/:id/versions", async (req, res) => {
  const versions = await repo.listVersionsForForm(req.userId, req.params.id);
  if (versions.length === 0) {
    // Distinguishes "form not found/not yours" from "form exists but somehow has no versions"
    // (the latter should never happen — every form gets version 1 at creation).
    const exists = await repo.getFormForOwner(req.userId, req.params.id);
    if (!exists) return res.status(404).json({ error: "Form not found." });
  }
  res.json(versions);
});

formsRouter.post("/", async (req, res) => {
  const error = validateFormBody(req.body);
  if (error) return res.status(400).json({ error });
  const form = await repo.createFormForOwner(req.userId, req.body);
  res.status(201).json(form);
});

// Publishing a local edit as a new version — never mutates a prior version in place, so any
// device that already imported an older version keeps a self-consistent definition.
formsRouter.put("/:id", async (req, res) => {
  const error = validateFormBody(req.body);
  if (error) return res.status(400).json({ error });
  const form = await repo.publishNewVersion(req.userId, req.params.id, req.body);
  if (!form) return res.status(404).json({ error: "Form not found." });
  res.json(form);
});

// Deletes this form from the cloud account entirely — every version, every response, every
// device's access to it (cascades via ON DELETE CASCADE, see cloud-server/db.js). Irreversible;
// the local proxy (server/cloud/routes.js) is expected to have the host confirm first.
formsRouter.delete("/:id", async (req, res) => {
  const deleted = await repo.deleteForm(req.userId, req.params.id);
  if (!deleted) return res.status(404).json({ error: "Form not found." });
  res.status(204).end();
});
