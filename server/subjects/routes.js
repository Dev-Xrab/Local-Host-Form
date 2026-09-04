import { Router } from "express";
import * as repo from "./repository.js";

export const subjectsRouter = Router();

subjectsRouter.get("/", (req, res) => {
  res.json(repo.listSubjects());
});

subjectsRouter.post("/", (req, res) => {
  const { name, code } = req.body || {};
  if (!name || typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "name is required" });
  }
  res.status(201).json(repo.createSubject({ name: name.trim(), code: (code || "").trim() }));
});

subjectsRouter.put("/:id", (req, res) => {
  const { name, code } = req.body || {};
  if (name !== undefined && (typeof name !== "string" || !name.trim())) {
    return res.status(400).json({ error: "name must be a non-empty string" });
  }
  const subject = repo.updateSubject(req.params.id, {
    name: name?.trim(),
    code: code !== undefined ? code.trim() : undefined,
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
