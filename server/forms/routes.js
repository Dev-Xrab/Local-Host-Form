import { Router } from "express";
import { randomUUID } from "node:crypto";
import { scheduleAutoSave } from "../cloud/autosave.js";
import * as repo from "./repository.js";
import { getSubject } from "../subjects/repository.js";
import { importResponses } from "../responses/repository.js";
import { createEndedSession } from "../sessions/repository.js";
import { validateImageSource } from "../security/uploads.js";
import { saveFormSnapshotDefinition } from "./snapshots.js";
import { getDefaults, setDefaults, validateDefaults } from "./defaults.js";

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

const MAX_TARGET_LENGTH = 100;
const validTarget = (t) => t === null || (typeof t === "string" && t.length <= MAX_TARGET_LENGTH);

const optionalString = (value, max) => value === undefined || value === null || (typeof value === "string" && value.length <= max);

function validateNavigation(navigation) {
  if (navigation === undefined || navigation === null) return null;
  if (typeof navigation !== "object" || Array.isArray(navigation)) return "question navigation must be an object";
  if (navigation.next !== undefined && !validTarget(navigation.next)) return "section link target is invalid";
  const { options } = navigation;
  if (options !== undefined && (!Array.isArray(options) || options.length > MAX_OPTIONS || !options.every(validTarget))) {
    return "answer link targets are invalid";
  }
  return null;
}

function validateQuestions(questions) {
  if (!Array.isArray(questions)) return "questions must be an array";
  if (questions.length > MAX_QUESTIONS) return `a form can have at most ${MAX_QUESTIONS} questions`;
  const seenIds = new Set();
  for (const q of questions) {
    if (!q || typeof q !== "object") return "each question must be an object";
    if (!q.id || typeof q.id !== "string" || q.id.length > 100) return "each question must have a string id";
    if (seenIds.has(q.id)) return "question ids must be unique";
    seenIds.add(q.id);
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
    const navigationError = validateNavigation(q.navigation);
    if (navigationError) return navigationError;
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

// Registered before "/:id" so "defaults" isn't read as a form id.
formsRouter.get("/defaults", (req, res) => res.json(getDefaults()));

formsRouter.put("/defaults", (req, res) => {
  const error = validateDefaults(req.body);
  if (error) return res.status(400).json({ error });
  res.json(setDefaults(req.body));
});

formsRouter.post("/", (req, res) => {
  const { title, description, subjectId } = req.body || {};
  const metaError = validateFormMeta({ title, description });
  if (metaError) return res.status(400).json({ error: metaError });
  if (subjectId != null && (typeof subjectId !== "string" || !getSubject(subjectId))) {
    return res.status(400).json({ error: "subjectId does not refer to an existing subject" });
  }
  const form = repo.createForm({ title, description, subjectId: subjectId || null, settings: getDefaults().form });
  scheduleAutoSave(form.id);
  res.status(201).json(form);
});

formsRouter.post("/import", (req, res) => {
  const { title, description, settings, questions, subjectId, responses, bannerImage, assessmentDefinitions } = req.body || {};

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
  if (assessmentDefinitions !== undefined) {
    if (!Array.isArray(assessmentDefinitions) || assessmentDefinitions.length > MAX_IMPORTED_RESPONSES) {
      return res.status(400).json({ error: "assessmentDefinitions must be a reasonable-sized list" });
    }
    const seen = new Set();
    for (const definition of assessmentDefinitions) {
      if (!definition || typeof definition.id !== "string" || definition.id.length > 100 || seen.has(definition.id)) {
        return res.status(400).json({ error: "assessment definitions need unique ids" });
      }
      seen.add(definition.id);
      if (typeof definition.title !== "string") return res.status(400).json({ error: "assessment title must be a string" });
      const definitionError = validateFormMeta(definition) || validateQuestions(definition.questions);
      if (definitionError) return res.status(400).json({ error: definitionError });
      if (definition.settings !== undefined && (typeof definition.settings !== "object" || definition.settings === null || Array.isArray(definition.settings))) {
        return res.status(400).json({ error: "assessment settings must be an object" });
      }
      if (definition.remoteVersion != null && (!Number.isInteger(definition.remoteVersion) || definition.remoteVersion < 0)) {
        return res.status(400).json({ error: "assessment remoteVersion must be a non-negative integer" });
      }
    }
    if (responses?.some((r) => r.assessmentId != null && !seen.has(r.assessmentId))) {
      return res.status(400).json({ error: "response refers to an unknown assessment definition" });
    }
  } else if (responses?.some((r) => r.assessmentId != null)) {
    return res.status(400).json({ error: "response refers to an unknown assessment definition" });
  }
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
  try {
    if (responses?.length) {
      const idMap = new Map(questions.map((q, i) => [q.id, form.questions[i]?.id]));
      const assessmentMaps = new Map();
      for (const definition of assessmentDefinitions || []) {
        for (const q of definition.questions) if (!idMap.has(q.id)) idMap.set(q.id, randomUUID());
        const mappedQuestions = definition.questions.map((q) => {
          return { ...q, id: idMap.get(q.id), navigation: repo.remapNavigation(q.navigation, idMap) };
        });
        const snapshotId = saveFormSnapshotDefinition(form.id, {
          title: definition.title,
          description: definition.description || "",
          settings: definition.settings || {},
          bannerImage: definition.bannerImage || null,
          remoteVersion: definition.remoteVersion ?? null,
          questions: mappedQuestions,
        });
        assessmentMaps.set(definition.id, { snapshotId, idMap: new Map(definition.questions.map((q) => [q.id, idMap.get(q.id)])) });
      }
      const sessionId = createEndedSession(form.id, "Imported responses");
      importedResponseCount = importResponses(form.id, sessionId, responses, idMap, assessmentMaps);
    }
  } catch (err) {
    repo.deleteForm(form.id);
    throw err;
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
  if (typeof settings?.confirmationMessage === "string" && settings.confirmationMessage.length > 2000) {
    return res.status(400).json({ error: "confirmation message is too long" });
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

  scheduleAutoSave(form.id);
  // Keep the response shape for existing clients. Saving a draft never rewrites past grades.
  res.json({ ...form, recalculatedResponses: 0 });
});

formsRouter.delete("/:id", (req, res) => {
  const deleted = repo.deleteForm(req.params.id);
  if (!deleted) return res.status(404).json({ error: "Form not found" });
  res.status(204).end();
});
