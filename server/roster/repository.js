import { randomUUID } from "node:crypto";
import { db } from "../db/index.js";

const now = () => new Date().toISOString();

function rowToStudent(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    studentId: row.student_id,
    aliases: JSON.parse(row.aliases),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const selectAllStmt = db.prepare("SELECT * FROM roster_students ORDER BY name ASC");
const selectOneStmt = db.prepare("SELECT * FROM roster_students WHERE id = ?");

export function listStudents() {
  return selectAllStmt.all().map(rowToStudent);
}

export function getStudent(id) {
  const row = selectOneStmt.get(id);
  return row ? rowToStudent(row) : null;
}

export function createStudent({ name, email = "", studentId = "", aliases = [] }) {
  const id = randomUUID();
  const timestamp = now();
  db.prepare(
    `INSERT INTO roster_students (id, name, email, student_id, aliases, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, name, email, studentId, JSON.stringify(aliases), timestamp, timestamp);
  return getStudent(id);
}

export function updateStudent(id, { name, email, studentId, aliases }) {
  const existing = selectOneStmt.get(id);
  if (!existing) return null;
  db.prepare(
    `UPDATE roster_students SET name = ?, email = ?, student_id = ?, aliases = ?, updated_at = ? WHERE id = ?`
  ).run(
    name ?? existing.name,
    email ?? existing.email,
    studentId ?? existing.student_id,
    aliases ? JSON.stringify(aliases) : existing.aliases,
    now(),
    id
  );
  return getStudent(id);
}

export function deleteStudent(id) {
  const result = db.prepare("DELETE FROM roster_students WHERE id = ?").run(id);
  return result.changes > 0;
}

const norm = (s) => String(s ?? "").trim().toLowerCase();

// Matches a respondent's free-typed name against the roster by exact name or any
// registered alias (case-insensitive) — used to fold a session's real submissions
// into one row per real student in the gradebook.
export function matchStudentByName(students, respondentName) {
  const target = norm(respondentName);
  if (!target) return null;
  return (
    students.find((s) => norm(s.name) === target) ||
    students.find((s) => s.aliases.some((a) => norm(a) === target)) ||
    null
  );
}
