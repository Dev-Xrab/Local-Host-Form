import { db } from "../db/index.js";

const KEY = "tunnel_allowed_emails";
const get = db.prepare("SELECT value FROM app_settings WHERE key = ?");
const set = db.prepare("INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
const EMAIL = /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/;

export function getAllowedEmails() {
  try {
    const value = JSON.parse(get.get(KEY)?.value || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function saveAllowedEmails(value) {
  if (!Array.isArray(value) || value.length > 50 || value.some((email) => typeof email !== "string" || !EMAIL.test(email.trim()))) {
    throw new Error("Enter up to 50 valid email addresses.");
  }
  const emails = [...new Set(value.map((email) => email.trim().toLowerCase()))];
  set.run(KEY, JSON.stringify(emails));
  return emails;
}
