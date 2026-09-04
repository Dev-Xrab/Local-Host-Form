import { randomUUID } from "node:crypto";
import { db } from "../db/index.js";
import { hashPassword, verifyPassword } from "./passwords.js";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const DEFAULT_PASSWORD = "password";

const getSettingStmt = db.prepare("SELECT value FROM app_settings WHERE key = ?");
const setSettingStmt = db.prepare(
  "INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
);

// Seeds a host password on first boot — a known default ("password") unless HOST_PASSWORD
// is set, so a fresh install is never blocked by a password nobody was told. Whoever logs
// in with the still-default password gets reminded to change it (see isDefaultPassword).
export function ensureHostPassword() {
  const existing = getSettingStmt.get("host_password_hash");
  if (existing) return;

  const password = process.env.HOST_PASSWORD || DEFAULT_PASSWORD;
  setSettingStmt.run("host_password_hash", hashPassword(password));
  setSettingStmt.run("is_default_password", process.env.HOST_PASSWORD ? "false" : "true");
}

export function verifyHostPassword(password) {
  const row = getSettingStmt.get("host_password_hash");
  if (!row) return false;
  return verifyPassword(password, row.value);
}

export function isDefaultPassword() {
  return getSettingStmt.get("is_default_password")?.value === "true";
}

export function changeHostPassword(oldPassword, newPassword) {
  if (!verifyHostPassword(oldPassword)) return "wrong_password";
  if (!newPassword || newPassword.length < 4) return "too_short";
  setSettingStmt.run("host_password_hash", hashPassword(newPassword));
  setSettingStmt.run("is_default_password", "false");
  return "ok";
}

// The recovery answer is matched case/whitespace-insensitively — respondents (well, hosts)
// shouldn't get locked out over "Fluffy" vs "fluffy " when they set it up months earlier.
const normalizeAnswer = (answer) => String(answer).trim().toLowerCase();

export function getRecoveryQuestion() {
  return getSettingStmt.get("recovery_question")?.value || null;
}

export function hasRecoveryQuestion() {
  return !!getSettingStmt.get("recovery_answer_hash");
}

export function setRecoveryQuestion(currentPassword, question, answer) {
  if (!verifyHostPassword(currentPassword)) return "wrong_password";
  if (!question || typeof question !== "string" || !question.trim()) return "question_required";
  if (!answer || typeof answer !== "string" || !normalizeAnswer(answer)) return "answer_required";

  setSettingStmt.run("recovery_question", question.trim());
  setSettingStmt.run("recovery_answer_hash", hashPassword(normalizeAnswer(answer)));
  return "ok";
}

export function resetPasswordWithRecovery(answer, newPassword) {
  const hashRow = getSettingStmt.get("recovery_answer_hash");
  if (!hashRow) return "not_configured";
  if (!answer || !verifyPassword(normalizeAnswer(answer), hashRow.value)) return "wrong_answer";
  if (!newPassword || newPassword.length < 4) return "too_short";

  setSettingStmt.run("host_password_hash", hashPassword(newPassword));
  setSettingStmt.run("is_default_password", "false");
  return "ok";
}

const insertSessionStmt = db.prepare(
  "INSERT INTO auth_sessions (token, created_at, expires_at) VALUES (?, ?, ?)"
);
const selectSessionStmt = db.prepare("SELECT * FROM auth_sessions WHERE token = ?");
const deleteSessionStmt = db.prepare("DELETE FROM auth_sessions WHERE token = ?");
const deleteExpiredStmt = db.prepare("DELETE FROM auth_sessions WHERE expires_at < ?");

export function createAuthSession() {
  const token = randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  insertSessionStmt.run(token, now.toISOString(), expiresAt.toISOString());
  return { token, expiresAt };
}

export function isValidAuthSession(token) {
  if (!token) return false;
  deleteExpiredStmt.run(new Date().toISOString());
  const row = selectSessionStmt.get(token);
  return !!row;
}

export function deleteAuthSession(token) {
  if (!token) return;
  deleteSessionStmt.run(token);
}
