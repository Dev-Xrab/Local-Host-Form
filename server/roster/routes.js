import { Router } from "express";
import * as repo from "./repository.js";

export const rosterRouter = Router();

function cleanAliases(aliases) {
  if (!Array.isArray(aliases)) return [];
  return aliases.map((a) => String(a).trim()).filter(Boolean);
}

rosterRouter.get("/", (req, res) => {
  res.json(repo.listStudents());
});

rosterRouter.post("/", (req, res) => {
  const { name, email, studentId, aliases } = req.body || {};
  if (!name || typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "name is required" });
  }
  res.status(201).json(
    repo.createStudent({
      name: name.trim(),
      email: (email || "").trim(),
      studentId: (studentId || "").trim(),
      aliases: cleanAliases(aliases),
    })
  );
});

rosterRouter.put("/:id", (req, res) => {
  const { name, email, studentId, aliases } = req.body || {};
  if (name !== undefined && (typeof name !== "string" || !name.trim())) {
    return res.status(400).json({ error: "name must be a non-empty string" });
  }
  const student = repo.updateStudent(req.params.id, {
    name: name?.trim(),
    email: email !== undefined ? email.trim() : undefined,
    studentId: studentId !== undefined ? studentId.trim() : undefined,
    aliases: aliases !== undefined ? cleanAliases(aliases) : undefined,
  });
  if (!student) return res.status(404).json({ error: "Student not found" });
  res.json(student);
});

rosterRouter.delete("/:id", (req, res) => {
  const deleted = repo.deleteStudent(req.params.id);
  if (!deleted) return res.status(404).json({ error: "Student not found" });
  res.status(204).end();
});
