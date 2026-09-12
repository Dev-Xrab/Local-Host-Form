import * as authRepo from "../auth/repository.js";
import { refreshGoogleAccessToken } from "../auth/google.js";
import { fetchWithBackoff } from "./http.js";

const DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files";
const FORMS_URL = "https://forms.googleapis.com/v1/forms";
const GOOGLE_FORM_MIME_TYPE = "application/vnd.google-apps.form";

// Always refreshed on demand rather than cached — this is called at most a couple of times per
// "browse my Google Forms" click, so the extra round-trip isn't worth the complexity of a cache
// that would need its own expiry bookkeeping alongside this app's own token cache.
async function getValidGoogleAccessToken(userId) {
  const refreshToken = await authRepo.getGoogleRefreshToken(userId);
  if (!refreshToken) {
    throw new Error(
      "No Google Drive/Forms access on file for this account — please sign out and sign in again to grant it."
    );
  }
  const tokens = await refreshGoogleAccessToken(refreshToken);
  return tokens.access_token;
}

export class GoogleApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

// Google's error body (`{error: {code, message, status}}`) says specifically *why* — API not
// enabled, insufficient scope, invalid credentials, etc. Surfacing that instead of just the
// HTTP status is the difference between "something's wrong" and being able to fix it.
async function googleErrorMessage(res, fallback) {
  try {
    const body = await res.json();
    return body?.error?.message || fallback;
  } catch {
    return fallback;
  }
}

export async function listGoogleForms(userId) {
  const accessToken = await getValidGoogleAccessToken(userId);
  const files = [];
  let pageToken;

  // Drive caps each page at 100 files — an account with more Google Forms than that needs the
  // full pageToken loop or everything past the first page is silently lost.
  do {
    const url = new URL(DRIVE_FILES_URL);
    url.searchParams.set("q", `mimeType='${GOOGLE_FORM_MIME_TYPE}' and trashed=false`);
    url.searchParams.set("fields", "nextPageToken,files(id,name,modifiedTime)");
    url.searchParams.set("orderBy", "modifiedTime desc");
    url.searchParams.set("pageSize", "100");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetchWithBackoff(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) {
      throw new GoogleApiError(await googleErrorMessage(res, `Google Drive request failed (${res.status})`), res.status);
    }
    const data = await res.json();
    files.push(...(data.files || []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  return files.map((f) => ({ id: f.id, name: f.name, modifiedTime: f.modifiedTime }));
}

export async function getGoogleForm(userId, googleFormId) {
  const accessToken = await getValidGoogleAccessToken(userId);
  const res = await fetchWithBackoff(`${FORMS_URL}/${encodeURIComponent(googleFormId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new GoogleApiError(await googleErrorMessage(res, `Google Forms request failed (${res.status})`), res.status);
  }
  return res.json();
}

// All of a Google Form's submitted responses, paginated — used both for the initial import
// (bring in what's already there) and "update from Google" (bring in what's new since).
// Deduping against what's already been imported is the caller's job (see
// google-forms/repository.js importResponsesForForm) — this just returns everything Google has.
export async function listGoogleFormResponses(userId, googleFormId) {
  const accessToken = await getValidGoogleAccessToken(userId);
  const responses = [];
  let pageToken;

  do {
    const url = new URL(`${FORMS_URL}/${encodeURIComponent(googleFormId)}/responses`);
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetchWithBackoff(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) {
      throw new GoogleApiError(await googleErrorMessage(res, `Google Forms responses request failed (${res.status})`), res.status);
    }
    const data = await res.json();
    responses.push(...(data.responses || []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  return responses;
}
