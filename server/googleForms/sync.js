import { db } from "../db/index.js";
import * as formsRepo from "../forms/repository.js";
import * as responsesRepo from "../responses/repository.js";
import { findOrCreateGoogleSession } from "../sessions/repository.js";
import { diffQuestions, mergeQuestions } from "../forms/questionDiff.js";
import { getGoogleForm, listGoogleFormResponses } from "./client.js";
import { translateGoogleForm } from "./translate.js";
import { translateGoogleFormResponses } from "./translateResponses.js";

// Per-form high-water mark: the newest submit time already pulled from Google. It only narrows what
// we ask Google for; responses are still deduped by Google's response id, so a stale or missing
// cursor can cost time but never produces duplicates or lost responses.
const getSettingStmt = db.prepare("SELECT value FROM app_settings WHERE key = ?");
const setSettingStmt = db.prepare(
  "INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
);
const cursorKey = (formId) => `google_responses_cursor:${formId}`;
const syncedAtKey = (formId) => `google_synced_at:${formId}`;

export const getGoogleCursor = (formId) => getSettingStmt.get(cursorKey(formId))?.value || null;
export const getGoogleSyncedAt = (formId) => getSettingStmt.get(syncedAtKey(formId))?.value || null;

function requireLinkedForm(formId) {
  const form = formsRepo.getForm(formId);
  if (!form) throw Object.assign(new Error("Form not found."), { status: 404 });
  if (!form.googleFormId) throw Object.assign(new Error("This form wasn't imported from Google Forms."), { status: 400 });
  return form;
}

// Pulls responses Google has that this device doesn't, into the form's Google session. Answers are
// mapped using the local question list, so the host's edits to a form never break old answers.
//
// Two pulls for the same form at once (a click during the background poll) would both see a response as
// new, so concurrent callers share one in-flight pull.
const pullsInFlight = new Map();
export function pullResponses(formId) {
  if (!pullsInFlight.has(formId)) {
    pullsInFlight.set(formId, doPullResponses(formId).finally(() => pullsInFlight.delete(formId)));
  }
  return pullsInFlight.get(formId);
}

async function doPullResponses(formId) {
  const form = requireLinkedForm(formId);
  const since = getGoogleCursor(formId);
  const raw = await listGoogleFormResponses(form.googleFormId, { since });

  const fresh = raw.filter((r) => !responsesRepo.findResponseByGoogleId(formId, r.responseId));
  const translated = translateGoogleFormResponses(form.questions, fresh);

  const sessionId = fresh.length ? findOrCreateGoogleSession(formId) : null;
  let skippedAnswerCount = 0;
  for (const response of translated) {
    responsesRepo.insertGoogleResponse({ formId, sessionId, formVersion: form.remoteVersion ?? null, ...response });
    skippedAnswerCount += response.skippedAnswerCount;
  }

  const newest = raw.map((r) => r.lastSubmittedTime || r.createTime).filter(Boolean).sort().at(-1);
  if (newest && (!since || newest > since)) setSettingStmt.run(cursorKey(formId), newest);
  setSettingStmt.run(syncedAtKey(formId), new Date().toISOString());

  return { newResponseCount: translated.length, alreadyHeldCount: raw.length - fresh.length, skippedAnswerCount };
}

// Read-only comparison of the local copy against the live Google Form.
export async function checkChanges(formId) {
  const form = requireLinkedForm(formId);
  const live = translateGoogleForm(await getGoogleForm(form.googleFormId));
  return { ...diffQuestions(form.questions, live.questions), skipped: live.skipped };
}

// "Sync from online": makes the local question list follow Google. Questions deleted on Google are kept
// with removedAt so their historical answers stay labelled; local grading settings are preserved.
export async function applyChanges(formId) {
  const form = requireLinkedForm(formId);
  const live = translateGoogleForm(await getGoogleForm(form.googleFormId));
  const updated = formsRepo.updateForm(formId, {
    title: live.title,
    description: live.description,
    questions: mergeQuestions(form.questions, live.questions),
  });
  return { form: updated, skipped: live.skipped };
}

// Creates a local form from a Google Form. Re-importing one already on this device returns the
// existing copy (remote ids are unique per device) and just syncs its responses.
export async function importGoogleForm(googleFormId, { withResponses = true } = {}) {
  const existing = formsRepo.listForms().find((f) => f.googleFormId === googleFormId);
  if (existing) {
    const sync = withResponses ? await pullResponses(existing.id) : null;
    return { form: formsRepo.getForm(existing.id), alreadyImported: true, skipped: [], sync };
  }

  const live = translateGoogleForm(await getGoogleForm(googleFormId));
  if (live.questions.length === 0) {
    throw Object.assign(new Error("None of this form's questions could be imported (unsupported question types only)."), {
      status: 422,
      skipped: live.skipped,
    });
  }

  const form = formsRepo.importForm({
    title: live.title,
    description: live.description,
    questions: live.questions,
    preserveQuestionIds: true,
    googleFormId,
  });

  // The form is already saved; a failure fetching responses must not make the import look failed.
  let sync = null;
  let responseImportError = null;
  if (withResponses) {
    try {
      sync = await pullResponses(form.id);
    } catch (err) {
      responseImportError = err.message;
    }
  }
  return { form: formsRepo.getForm(form.id), alreadyImported: false, skipped: live.skipped, sync, responseImportError };
}

// Syncs every Google-linked form, one at a time, collecting per-form results so one failure does not
// stop the rest.
export async function syncAllLinkedForms() {
  const results = [];
  for (const form of formsRepo.listForms().filter((f) => f.googleFormId)) {
    try {
      results.push({ formId: form.id, ...(await pullResponses(form.id)) });
    } catch (err) {
      results.push({ formId: form.id, error: err.message, code: err.code });
      // Revoked or signed out: every remaining form would fail the same way.
      if (err.code === "not_signed_in" || err.code === "forms_scope_missing" || err.code === "invalid_grant") break;
    }
  }
  return results;
}
