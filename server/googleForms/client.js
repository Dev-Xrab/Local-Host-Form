import * as cloudRepo from "../cloud/repository.js";
import { canListGoogleForms, formsApiBase, hasGoogleFormsAccess } from "../oauth/config.js";
import { forceRefresh, getValidAccessToken } from "../oauth/session.js";
import { driveApiBase } from "../cloud/googleConfig.js";
import { fetchWithBackoff } from "./http.js";
import { timeoutSignal } from "../oauth/timeout.js";

const GOOGLE_FORM_MIME_TYPE = "application/vnd.google-apps.form";
const REQUEST_TIMEOUT_MS = 20_000;

export class GoogleApiError extends Error {
  constructor(message, status, code = "google_error") {
    super(message);
    this.name = "GoogleApiError";
    this.status = status;
    this.code = code;
  }
}

// The user can untick the Forms permissions on the consent screen, and accounts connected before this
// feature existed never granted them. Say so clearly instead of letting Google answer with a 403.
function assertFormsAccess() {
  const account = cloudRepo.getCloudAccount();
  if (!account) throw new GoogleApiError("Not signed in.", 401, "not_signed_in");
  if (!hasGoogleFormsAccess(account)) {
    throw new GoogleApiError(
      "This Google account hasn't allowed access to Google Forms. Sign out, sign in again and leave the Google Forms permissions ticked.",
      403,
      "forms_scope_missing"
    );
  }
}

async function googleErrorMessage(res, fallback) {
  try {
    return (await res.json())?.error?.message || fallback;
  } catch {
    return fallback;
  }
}

async function googleGet(url, label) {
  const attempt = async (token) =>
    fetchWithBackoff(url, { headers: { Authorization: `Bearer ${token}` }, signal: timeoutSignal(REQUEST_TIMEOUT_MS) });

  let res;
  try {
    res = await attempt(await getValidAccessToken());
    // A token can be revoked or expire between the expiry check and the call: refresh once and retry.
    if (res.status === 401) res = await attempt(await forceRefresh());
  } catch (err) {
    if (err.code) throw err; // OAuthError: not signed in / grant revoked
    throw new GoogleApiError(`Could not reach Google: ${err.message}`, 502, "network_error");
  }

  if (!res.ok) {
    const message = await googleErrorMessage(res, `${label} request failed (${res.status})`);
    if (res.status === 403 && /(quota|rate)/i.test(message)) {
      throw new GoogleApiError("Google is rate-limiting requests right now. Try again in a moment.", 429, "rate_limited");
    }
    if (res.status === 403 && /(not been used|disabled)/i.test(message)) {
      throw new GoogleApiError(`${message} Enable the API in the Google Cloud project for this app.`, 403, "api_disabled");
    }
    throw new GoogleApiError(message, res.status);
  }
  return res.json();
}

export async function listGoogleForms() {
  assertFormsAccess();
  if (!canListGoogleForms(cloudRepo.getCloudAccount())) {
    throw new GoogleApiError(
      "Browsing your Google Forms wasn't allowed. Paste a form's link instead, or sign in again and leave the Drive file-list permission ticked.",
      403,
      "listing_scope_missing"
    );
  }
  const files = [];
  let pageToken;
  // Drive caps a page at 100 files; follow nextPageToken or everything past the first page is lost.
  do {
    const url = new URL(`${driveApiBase()}/files`);
    url.searchParams.set("q", `mimeType='${GOOGLE_FORM_MIME_TYPE}' and trashed=false`);
    url.searchParams.set("fields", "nextPageToken,files(id,name,modifiedTime)");
    url.searchParams.set("orderBy", "modifiedTime desc");
    url.searchParams.set("pageSize", "100");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const data = await googleGet(url, "Google Drive");
    files.push(...(data.files || []));
    pageToken = data.nextPageToken;
  } while (pageToken);
  return files.map((f) => ({ id: f.id, name: f.name, modifiedTime: f.modifiedTime }));
}

export async function getGoogleForm(googleFormId) {
  assertFormsAccess();
  return googleGet(`${formsApiBase()}/forms/${encodeURIComponent(googleFormId)}`, "Google Forms");
}

// Responses submitted at or after `since` (an ISO timestamp), or all of them. The API filters on the
// submit time; callers still dedupe by response id because the boundary is inclusive.
export async function listGoogleFormResponses(googleFormId, { since = null } = {}) {
  assertFormsAccess();
  const responses = [];
  let pageToken;
  do {
    const url = new URL(`${formsApiBase()}/forms/${encodeURIComponent(googleFormId)}/responses`);
    if (since) url.searchParams.set("filter", `timestamp >= ${since}`);
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const data = await googleGet(url, "Google Forms responses");
    responses.push(...(data.responses || []));
    pageToken = data.nextPageToken;
  } while (pageToken);
  return responses;
}
