import { randomUUID } from "node:crypto";
import { db } from "../db/index.js";

const now = () => new Date().toISOString();
const DEFAULT_SUBJECT_NAME = "General";

function rowToSubject(row) {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    isDefault: !!row.is_default,
    formCount: row.form_count ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const selectAllStmt = db.prepare(`
  SELECT s.*, (SELECT COUNT(*) FROM forms f WHERE f.subject_id = s.id) AS form_count
  FROM subjects s ORDER BY s.is_default DESC, s.name ASC
`);
const selectOneStmt = db.prepare("SELECT * FROM subjects WHERE id = ?");
const selectDefaultStmt = db.prepare("SELECT * FROM subjects WHERE is_default = 1 LIMIT 1");
const selectByNameStmt = db.prepare("SELECT * FROM subjects WHERE lower(name) = lower(?) LIMIT 1");

export function listSubjects() {
  return selectAllStmt.all().map(rowToSubject);
}

export function getSubject(id) {
  const row = selectOneStmt.get(id);
  return row ? rowToSubject(row) : null;
}

export function createSubject({ name, code = "" }) {
  const id = randomUUID();
  const timestamp = now();
  db.prepare(
    "INSERT INTO subjects (id, name, code, is_default, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)"
  ).run(id, name, code, timestamp, timestamp);
  return getSubject(id);
}

// Ensures a permanent, non-deletable "General" subject exists — seeded once on boot so
// there's always a sensible bucket for forms, the same way ensureHostPassword seeds auth.
export function ensureDefaultSubject() {
  if (selectDefaultStmt.get()) return;

  const existingGeneral = selectByNameStmt.get(DEFAULT_SUBJECT_NAME);
  if (existingGeneral) {
    db.prepare("UPDATE subjects SET is_default = 1, updated_at = ? WHERE id = ?").run(
      now(),
      existingGeneral.id
    );
    return;
  }

  const id = randomUUID();
  const timestamp = now();
  db.prepare(
    "INSERT INTO subjects (id, name, code, is_default, created_at, updated_at) VALUES (?, ?, '', 1, ?, ?)"
  ).run(id, DEFAULT_SUBJECT_NAME, timestamp, timestamp);
}

export function updateSubject(id, { name, code }) {
  const existing = selectOneStmt.get(id);
  if (!existing) return null;
  db.prepare("UPDATE subjects SET name = ?, code = ?, updated_at = ? WHERE id = ?").run(
    name ?? existing.name,
    code ?? existing.code,
    now(),
    id
  );
  return getSubject(id);
}

// formsAction: "move" (reassign this subject's forms to the default/General subject),
// "delete" (delete every form under this subject — cascades to their sessions and
// responses via the forms table's ON DELETE CASCADE foreign keys), or the default
// "unassign" (leave the forms in place with no subject).
export function deleteSubject(id, formsAction = "unassign") {
  const existing = selectOneStmt.get(id);
  if (!existing) return "not_found";
  if (existing.is_default) return "default";

  db.exec("BEGIN");
  try {
    if (formsAction === "delete") {
      db.prepare("DELETE FROM forms WHERE subject_id = ?").run(id);
    } else if (formsAction === "move") {
      const general = selectDefaultStmt.get();
      db.prepare("UPDATE forms SET subject_id = ? WHERE subject_id = ?").run(general?.id ?? null, id);
    } else {
      db.prepare("UPDATE forms SET subject_id = NULL WHERE subject_id = ?").run(id);
    }
    db.prepare("DELETE FROM subjects WHERE id = ?").run(id);
    db.exec("COMMIT");
    return "deleted";
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}
