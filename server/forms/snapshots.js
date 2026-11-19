import { createHash, randomUUID } from "node:crypto";
import { db } from "../db/index.js";
import { getForm, onFormUpdated } from "./repository.js";

const insertStmt = db.prepare(`
  INSERT OR IGNORE INTO form_snapshots (id, form_id, content_hash, definition, created_at)
  VALUES (?, ?, ?, ?, ?)
`);
const byHashStmt = db.prepare("SELECT * FROM form_snapshots WHERE form_id = ? AND content_hash = ?");
const byIdStmt = db.prepare("SELECT * FROM form_snapshots WHERE id = ?");

function definitionOf(form) {
  return {
    title: form.title,
    description: form.description,
    settings: form.settings,
    bannerImage: form.bannerImage,
    remoteVersion: form.remoteVersion,
    questions: form.questions,
  };
}

function hashOf(definition) {
  return createHash("sha256").update(JSON.stringify(definition)).digest("hex");
}

export function createFormSnapshot(formId) {
  const form = getForm(formId);
  if (!form) throw new Error("Cannot snapshot a missing form");
  const definition = JSON.stringify(definitionOf(form));
  const hash = hashOf(JSON.parse(definition));
  const existing = byHashStmt.get(formId, hash);
  if (existing) return existing.id;
  const id = randomUUID();
  insertStmt.run(id, formId, hash, definition, new Date().toISOString());
  return byHashStmt.get(formId, hash).id;
}

export function getFormSnapshot(id) {
  if (!id) return null;
  const row = byIdStmt.get(id);
  if (!row) return null;
  const definition = JSON.parse(row.definition);
  return { id: row.id, hash: row.content_hash, definition, form: { id: row.form_id, ...definition } };
}

export function importFormSnapshot(formId, definition, expectedHash) {
  if (!definition || !Array.isArray(definition.questions) || typeof definition.title !== "string") {
    throw new Error("Invalid synced assessment definition");
  }
  const hash = hashOf(definition);
  if (hash !== expectedHash) throw new Error("Synced assessment definition did not match its hash");
  return saveFormSnapshotDefinition(formId, definition);
}

export function saveFormSnapshotDefinition(formId, definition) {
  if (!definition || !Array.isArray(definition.questions) || typeof definition.title !== "string") {
    throw new Error("Invalid assessment definition");
  }
  const hash = hashOf(definition);
  const existing = byHashStmt.get(formId, hash);
  if (existing) return existing.id;
  const id = randomUUID();
  insertStmt.run(id, formId, hash, JSON.stringify(definition), new Date().toISOString());
  return byHashStmt.get(formId, hash).id;
}

export function formForSession(session) {
  if (!session.formSnapshotId) return getForm(session.formId);
  const snapshot = getFormSnapshot(session.formSnapshotId);
  if (!snapshot) throw new Error("Assessment definition is missing");
  return snapshot.form;
}

export function formForResponse(response) {
  if (!response.formSnapshotId) return getForm(response.formId);
  const snapshot = getFormSnapshot(response.formSnapshotId);
  if (!snapshot) throw new Error("Assessment definition is missing");
  return snapshot.form;
}

// A session that is running follows its form: when the host saves an edit, everyone still answering
// gets the new questions on their next load instead of the definition pinned when the session
// started. Submitted responses stay on the definition they were answered against, so past results
// are unaffected, and ended or not-yet-started sessions are left alone.
const activeSessionIdsStmt = db.prepare("SELECT id, form_snapshot_id FROM sessions WHERE form_id = ? AND status = 'active'");
const repinSessionStmt = db.prepare("UPDATE sessions SET form_snapshot_id = ? WHERE id = ?");
const repinResponsesStmt = db.prepare(
  "UPDATE responses SET form_snapshot_id = ? WHERE session_id = ? AND status = 'in_progress' AND form_snapshot_id IS NOT ?"
);

export function repinActiveSessions(formId) {
  const sessions = activeSessionIdsStmt.all(formId);
  if (sessions.length === 0 || !getForm(formId)) return;
  const snapshotId = createFormSnapshot(formId);
  for (const session of sessions) {
    if (session.form_snapshot_id !== snapshotId) repinSessionStmt.run(snapshotId, session.id);
    repinResponsesStmt.run(snapshotId, session.id, snapshotId);
  }
}

/** Catches edits that never went through a save here (made while the server was off, or synced in). */
export function repinAllActiveSessions() {
  const formIds = db.prepare("SELECT DISTINCT form_id FROM sessions WHERE status = 'active'").all();
  for (const { form_id } of formIds) repinActiveSessions(form_id);
}

onFormUpdated(repinActiveSessions);
