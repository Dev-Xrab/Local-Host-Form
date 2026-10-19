import * as cloudRepo from "../cloud/repository.js";
import { hasGoogleFormsAccess } from "../oauth/config.js";
import { syncAllLinkedForms } from "./sync.js";

// Keeps Google-linked forms' responses fresh without the host pressing anything: one sweep every few
// minutes while signed in with Forms access. Best effort; a failure leaves the manual Sync button.
const intervalMs = () => Number(process.env.GOOGLE_FORMS_POLL_MS || 5 * 60_000);
let timer = null;
let lastError = null;
let running = false;

export const getLastPollError = () => lastError;

async function sweep() {
  if (running || !hasGoogleFormsAccess(cloudRepo.getCloudAccount())) return;
  running = true;
  try {
    const failed = (await syncAllLinkedForms()).find((r) => r.error);
    lastError = failed ? failed.error : null;
  } catch (err) {
    lastError = err.message;
  } finally {
    running = false;
  }
}

export function startGoogleFormsPolling() {
  if (timer || intervalMs() <= 0) return;
  timer = setInterval(sweep, intervalMs());
  timer.unref?.();
}
