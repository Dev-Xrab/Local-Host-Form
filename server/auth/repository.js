import { randomBytes } from "node:crypto";
import { db } from "../db/index.js";
import { hashPassword, verifyPassword } from "./passwords.js";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const REMOTE_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export const MIN_PASSWORD_LENGTH = 8;
// scrypt cost is fixed per call, but there's no reason to accept megabytes of "password".
const MAX_PASSWORD_LENGTH = 1024;

function isAcceptableNewPassword(password) {
  return typeof password === "string" && password.length >= MIN_PASSWORD_LENGTH && password.length <= MAX_PASSWORD_LENGTH;
}

const getSettingStmt = db.prepare("SELECT value FROM app_settings WHERE key = ?");
const setSettingStmt = db.prepare(
  "INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
);

// No account exists until someone completes the setup screen — there's no seeded default
// password to fall back on (see createOwnerAccount), so a fresh install is a real "nobody
// can sign in yet" state rather than a known-password one.
export function hasOwner() {
  return !!getSettingStmt.get("host_password_hash");
}

// Only succeeds once — the first call to claim an unowned server. Later calls (e.g. a stale
// setup tab still open after someone else finished) fail closed rather than resetting the
// password a real owner already chose.
export function createOwnerAccount(password) {
  if (hasOwner()) return "already_exists";
  if (!isAcceptableNewPassword(password)) return "too_short";
  setSettingStmt.run("host_password_hash", hashPassword(password));
  return "ok";
}

export function verifyHostPassword(password) {
  const row = getSettingStmt.get("host_password_hash");
  if (!row || typeof password !== "string" || password.length > MAX_PASSWORD_LENGTH) return false;
  return verifyPassword(password, row.value);
}

export function changeHostPassword(oldPassword, newPassword) {
  if (!verifyHostPassword(oldPassword)) return "wrong_password";
  if (!isAcceptableNewPassword(newPassword)) return "too_short";
  setSettingStmt.run("host_password_hash", hashPassword(newPassword));
  // Every existing sign-in (possibly on a device the host no longer trusts) stops working; the
  // caller issues a fresh session for whoever just changed it.
  deleteAllSessionsStmt.run();
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
  if (question.length > 300 || answer.length > MAX_PASSWORD_LENGTH) return "too_long";

  setSettingStmt.run("recovery_question", question.trim());
  setSettingStmt.run("recovery_answer_hash", hashPassword(normalizeAnswer(answer)));
  return "ok";
}

export function resetPasswordWithRecovery(answer, newPassword) {
  const hashRow = getSettingStmt.get("recovery_answer_hash");
  if (!hashRow) return "not_configured";
  if (!answer || typeof answer !== "string" || answer.length > MAX_PASSWORD_LENGTH) return "wrong_answer";
  if (!verifyPassword(normalizeAnswer(answer), hashRow.value)) return "wrong_answer";
  if (!isAcceptableNewPassword(newPassword)) return "too_short";

  setSettingStmt.run("host_password_hash", hashPassword(newPassword));
  deleteAllSessionsStmt.run();
  return "ok";
}

const insertSessionStmt = db.prepare(
  "INSERT INTO auth_sessions (token, created_at, expires_at, remote_allowed) VALUES (?, ?, ?, ?)"
);
const selectSessionStmt = db.prepare("SELECT * FROM auth_sessions WHERE token = ?");
const deleteSessionStmt = db.prepare("DELETE FROM auth_sessions WHERE token = ?");
const deleteExpiredStmt = db.prepare("DELETE FROM auth_sessions WHERE expires_at < ?");
const deleteAllSessionsStmt = db.prepare("DELETE FROM auth_sessions");
const deleteRemoteSessionsStmt = db.prepare("DELETE FROM auth_sessions WHERE remote_allowed = 1");

export function createAuthSession({ remote = false } = {}) {
  // 256 bits from the CSPRNG (randomUUID carries 122).
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + (remote ? REMOTE_SESSION_TTL_MS : SESSION_TTL_MS));
  insertSessionStmt.run(token, now.toISOString(), expiresAt.toISOString(), remote ? 1 : 0);
  return { token, expiresAt };
}

export function isValidAuthSession(token, { remote = false } = {}) {
  if (!token) return false;
  deleteExpiredStmt.run(new Date().toISOString());
  const row = selectSessionStmt.get(token);
  return !!row && (!remote || !!row.remote_allowed);
}

export function deleteRemoteAuthSessions() {
  deleteRemoteSessionsStmt.run();
}

export function deleteAuthSession(token) {
  if (!token) return;
  deleteSessionStmt.run(token);
}
