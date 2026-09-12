// Shared retry wrapper for every Google Drive/Forms API call this server makes. Google's Drive
// and Forms APIs share the same per-user quota pool, and a classroom-sized import (a form with
// hundreds of responses, paginated) is exactly the kind of burst that can trip a 429 — without
// this, a transient rate limit or a momentary 5xx would fail the whole import instead of just
// slowing down for a moment.
const MAX_RETRIES = 4;
const BASE_DELAY_MS = 500;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryDelayMs(res, attempt) {
  const retryAfter = res?.headers?.get?.("Retry-After");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return seconds * 1000;
  }
  // Exponential backoff with jitter: 500ms, 1s, 2s, 4s (+/- up to 25%).
  const base = BASE_DELAY_MS * 2 ** attempt;
  return base + Math.random() * base * 0.25;
}

// Retries only on 429 (rate limited) and 5xx (transient server-side failure) — every other
// status is returned as-is so the caller's own error handling (GoogleApiError, etc.) still runs.
export async function fetchWithBackoff(url, options = {}, { retries = MAX_RETRIES } = {}) {
  let lastRes;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, options);
    if (res.ok || (res.status !== 429 && res.status < 500)) return res;
    lastRes = res;
    if (attempt === retries) return res;
    await sleep(retryDelayMs(res, attempt));
  }
  return lastRes;
}
