import { Router } from "express";
import * as repo from "./repository.js";

export const subjectsRouter = Router();

const MAX_FIELD_LENGTH = 200;

function validateSubjectFields({ name, code }) {
  if (name !== undefined && (typeof name !== "string" || name.length > MAX_FIELD_LENGTH)) {
    return `name must be a string of at most ${MAX_FIELD_LENGTH} characters`;
  }
  if (code !== undefined && code !== null && (typeof code !== "string" || code.length > MAX_FIELD_LENGTH)) {
    return `code must be a string of at most ${MAX_FIELD_LENGTH} characters`;
  }
  return null;
}

subjectsRouter.get("/", (req, res) => {
  res.json(repo.listSubjects());
});

subjectsRouter.post("/", (req, res) => {
  const { name, code } = req.body || {};
  const fieldError = validateSubjectFields({ name, code });
  if (fieldError) return res.status(400).json({ error: fieldError });
  if (!name || typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "name is required" });
  }
  res.status(201).json(repo.createSubject({ name: name.trim(), code: (code || "").trim() }));
});

subjectsRouter.put("/:id", (req, res) => {
  const { name, code } = req.body || {};
  const fieldError = validateSubjectFields({ name, code });
  if (fieldError) return res.status(400).json({ error: fieldError });
  if (name !== undefined && (typeof name !== "string" || !name.trim())) {
    return res.status(400).json({ error: "name must be a non-empty string" });
  }
  const subject = repo.updateSubject(req.params.id, {
    name: name?.trim(),
    code: typeof code === "string" ? code.trim() : undefined,
  });
  if (!subject) return res.status(404).json({ error: "Subject not found" });
  res.json(subject);
});

subjectsRouter.delete("/:id", (req, res) => {
  const formsAction = ["move", "delete"].includes(req.query.forms) ? req.query.forms : "unassign";
  const result = repo.deleteSubject(req.params.id, formsAction);
  if (result === "not_found") return res.status(404).json({ error: "Subject not found" });
  if (result === "default") {
    return res.status(400).json({ error: "The default subject can't be deleted." });
  }
  res.status(204).end();
});
