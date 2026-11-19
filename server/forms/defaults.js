import { db } from "../db/index.js";

// Google Forms' "Defaults" section: settings every new form starts with, and what a new question
// starts as. Stored once per server in app_settings, not on any form.
const KEY = "form_defaults";

// Which form settings can be defaulted (a subset: per-form rules like shuffling stay per form).
export const DEFAULTABLE_FORM_SETTINGS = ["collectEmail", "allowDownloadCopy", "allowResponseEditing", "showProgressBar"];

const FALLBACK = {
  form: { collectEmail: false, allowDownloadCopy: true, allowResponseEditing: false, showProgressBar: true },
  question: { required: false, points: 1 },
};

const getStmt = db.prepare("SELECT value FROM app_settings WHERE key = ?");
const setStmt = db.prepare("INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");

export function getDefaults() {
  let stored = {};
  try { stored = JSON.parse(getStmt.get(KEY)?.value || "{}"); } catch { /* fall back */ }
  return { form: { ...FALLBACK.form, ...stored.form }, question: { ...FALLBACK.question, ...stored.question } };
}

export function validateDefaults(body) {
  if (!body || typeof body !== "object") return "defaults must be an object";
  for (const [group, allowed] of [["form", DEFAULTABLE_FORM_SETTINGS], ["question", ["required", "points"]]]) {
    const part = body[group];
    if (part === undefined) continue;
    if (!part || typeof part !== "object" || Array.isArray(part)) return `${group} defaults must be an object`;
    for (const [k, v] of Object.entries(part)) {
      if (!allowed.includes(k)) return `unknown ${group} default: ${k}`;
      if (k === "points" ? !(Number.isFinite(v) && v >= 0 && v <= 100_000) : typeof v !== "boolean") return `invalid value for ${k}`;
    }
  }
  return null;
}

export function setDefaults(body) {
  const current = getDefaults();
  const next = { form: { ...current.form, ...body.form }, question: { ...current.question, ...body.question } };
  setStmt.run(KEY, JSON.stringify(next));
  return next;
}
