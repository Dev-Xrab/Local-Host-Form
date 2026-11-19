import { Router } from "express";
import * as repo from "./repository.js";

export const rosterRouter = Router();

const MAX_FIELD_LENGTH = 200;
const MAX_ALIASES = 50;

function cleanAliases(aliases) {
  if (!Array.isArray(aliases)) return [];
  return aliases.slice(0, MAX_ALIASES).map((a) => String(a).trim().slice(0, MAX_FIELD_LENGTH)).filter(Boolean);
}

// Rejects anything but a short string (or an omitted field) for every text field.
function validateStudentFields({ name, email, studentId }) {
  for (const [label, value] of [["name", name], ["email", email], ["studentId", studentId]]) {
    if (value === undefined || value === null) continue;
    if (typeof value !== "string" || value.length > MAX_FIELD_LENGTH) {
      return `${label} must be a string of at most ${MAX_FIELD_LENGTH} characters`;
    }
  }
  return null;
}

rosterRouter.get("/", (req, res) => {
  res.json(repo.listStudents());
});

rosterRouter.post("/", (req, res) => {
  const { name, email, studentId, aliases } = req.body || {};
  const fieldError = validateStudentFields({ name, email, studentId });
  if (fieldError) return res.status(400).json({ error: fieldError });
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
  const fieldError = validateStudentFields({ name, email, studentId });
  if (fieldError) return res.status(400).json({ error: fieldError });
  if (name !== undefined && (typeof name !== "string" || !name.trim())) {
    return res.status(400).json({ error: "name must be a non-empty string" });
  }
  const student = repo.updateStudent(req.params.id, {
    name: name?.trim(),
    email: typeof email === "string" ? email.trim() : undefined,
    studentId: typeof studentId === "string" ? studentId.trim() : undefined,
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
