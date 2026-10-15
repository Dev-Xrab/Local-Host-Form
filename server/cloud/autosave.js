import * as cloudRepo from "./repository.js";
import * as formsRepo from "../forms/repository.js";
import { isCloudConfigured } from "./client.js";
import { runSync, pingCloudServer } from "./sync.js";
import { publishFormToCloud } from "./publish.js";

// Keeps the user's Google Drive up to date without them pressing anything, as long as they are
// signed in and online:
//   - a form is saved a few seconds after it is created or edited (debounced, so typing is not a
//     burst of uploads), and
//   - responses are uploaded a few seconds after they are submitted, and
//   - a periodic sweep retries anything that could not go up (offline, signed in later, an error) and
//     picks up changes made on the user's other devices.
// It can be switched off in Settings. Everything here is best effort: a failure never affects the
// local save, and the form or response simply stays marked as not yet saved to Drive.

const debounceMs = () => Number(process.env.AUTO_SAVE_DEBOUNCE_MS || 4000);
const sweepMs = () => Number(process.env.AUTO_SAVE_SWEEP_MS || 60_000);

const formTimers = new Map();
const formsInFlight = new Set();
const formsEditedWhileSaving = new Set();
let syncTimer = null;
let sweepTimer = null;
let lastError = null;

export const isAutoSaveEnabled = () => process.env.AUTO_SAVE_DRIVE !== "0" && cloudRepo.getAutoSave();
export const getLastAutoSaveError = () => lastError;

function canAutoSave() {
  return isCloudConfigured() && !!cloudRepo.getCloudAccount() && isAutoSaveEnabled();
}

const needsSave = (form) => !form.remoteFormId || form.hasUnsavedCloudChanges;

function remember(err) {
  lastError = { message: err?.message || "Auto-save failed.", at: new Date().toISOString() };
}

async function saveForm(id) {
  // An edit that lands while this form is mid-upload would otherwise be marked saved by the upload
  // that finished (it stamps "saved now"), so it is flagged and saved again straight afterwards.
  if (formsInFlight.has(id)) {
    formsEditedWhileSaving.add(id);
    return;
  }
  formsInFlight.add(id);
  try {
    let again = true;
    let force = false;
    while (again) {
      again = false;
      const form = formsRepo.getForm(id);
      if (!form) break;
      if (force || needsSave(form)) await publishFormToCloud(id, { coalesce: true });
      if (formsEditedWhileSaving.delete(id)) {
        again = true;
        force = true;
      }
    }
    lastError = null;
  } catch (err) {
    remember(err);
  } finally {
    formsInFlight.delete(id);
  }
}

/** Call after a form is created or edited. */
export function scheduleAutoSave(formId) {
  if (!canAutoSave()) return;
  clearTimeout(formTimers.get(formId));
  const timer = setTimeout(async () => {
    formTimers.delete(formId);
    if (!canAutoSave() || !(await pingCloudServer())) return; // the sweep retries later
    await saveForm(formId);
  }, debounceMs());
  timer.unref?.();
  formTimers.set(formId, timer);
}

async function syncNow() {
  if (!canAutoSave() || !(await pingCloudServer())) return;
  try {
    await runSync();
    lastError = null;
  } catch (err) {
    remember(err);
  }
}

/** Call after a response is submitted or edited. */
export function scheduleAutoSync() {
  if (!canAutoSave()) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(syncNow, debounceMs());
  syncTimer.unref?.();
}

async function sweep() {
  if (!canAutoSave() || !(await pingCloudServer())) return;
  try {
    for (const form of formsRepo.listForms()) {
      if (needsSave(form)) await saveForm(form.id);
    }
  } catch (err) {
    remember(err);
  }
  await syncNow();
}

/** Starts the periodic sweep. Safe to call once per process. */
export function startAutoSave() {
  if (sweepTimer) return;
  sweepTimer = setInterval(() => {
    sweep().catch(remember);
  }, sweepMs());
  sweepTimer.unref?.();
  // Shortly after start, so work left over from an offline session goes up without waiting a minute.
  setTimeout(() => sweep().catch(remember), Math.min(5000, sweepMs())).unref?.();
}
