import * as cloudRepo from "./repository.js";
import { googleClientId, googleClientSecret, googleTokenUrl } from "./googleConfig.js";
import { handleCloudRequest } from "./driveCloud.js";
import { DriveError } from "./drive.js";

// Sync is on once an OAuth client id is configured (see googleConfig.js). There is no cloud server
// to point at any more: this device talks to the user's Google Drive directly.
export function isCloudConfigured() {
  return !!googleClientId();
}

// Google access tokens last about an hour. Two requests that both see an expired token would each
// refresh it, so concurrent callers share one in-flight refresh. (Google does not rotate refresh
// tokens, so this is only about avoiding redundant calls, not a correctness race.)
let refreshInFlight = null;

function describeGoogleFailure(body, status) {
  return body?.error_description || body?.error || `Google sign-in request failed (${status})`;
}

async function doRefreshTokens() {
  const account = cloudRepo.getCloudAccount();
  if (!account) throw new Error("Not signed in.");

  const params = new URLSearchParams({
    client_id: googleClientId(),
    refresh_token: account.refreshToken,
    grant_type: "refresh_token",
  });
  if (googleClientSecret()) params.set("client_secret", googleClientSecret());

  let res;
  try {
    res = await fetch(googleTokenUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });
  } catch (err) {
    // No network: keep the account signed in so sync can resume when the connection is back.
    throw new Error(`Could not reach Google to refresh sign-in: ${err.message}`);
  }

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    // invalid_grant means the user revoked access or the token expired. There is no silent
    // recovery, so sign out and let the UI ask them to sign in again.
    if (body?.error === "invalid_grant") {
      cloudRepo.clearCloudAccount();
      throw new Error("Your Google sign-in expired or was revoked. Please sign in again.");
    }
    throw new Error(describeGoogleFailure(body, res.status));
  }

  cloudRepo.updateCloudTokens({
    accessToken: body.access_token,
    accessTokenExpiresAt: new Date(Date.now() + (Number(body.expires_in) || 3600) * 1000).toISOString(),
    refreshToken: body.refresh_token || account.refreshToken,
  });
  return body.access_token;
}

async function refreshTokens() {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = doRefreshTokens();
  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

async function getValidAccessToken() {
  const account = cloudRepo.getCloudAccount();
  if (!account) throw new Error("Not signed in.");

  const expiresInMs = new Date(account.accessTokenExpiresAt).getTime() - Date.now();
  if (expiresInMs > 60_000) return account.accessToken;
  return refreshTokens();
}

function friendlyDriveMessage(err) {
  if (err.status === 403 && /scope/i.test(err.message)) {
    return "Google Drive access wasn't granted. Sign out and sign in again, and allow access to the app's data folder.";
  }
  if (err.status === 403 && /(quota|rate)/i.test(err.message)) {
    return "Google Drive is rate-limiting requests right now. Try again in a moment.";
  }
  return err.message;
}

function toResponse({ status, body }) {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const deviceName = () => process.env.COMPUTERNAME || process.env.HOSTNAME || "Self Host Form device";

// Every call this local server makes for account-scoped data goes through here so token refresh is
// handled in one place. The shape matches what the old cloud server returned (a fetch Response with
// the same status codes and JSON bodies), so callers did not have to change. A single retry after a
// refresh covers the ordinary "token expired mid-session" case without hiding real failures.
export async function cloudFetch(path, options = {}) {
  const method = String(options.method || "GET").toUpperCase();
  const body = options.body ? JSON.parse(options.body) : undefined;
  const ctx = { deviceId: cloudRepo.getDeviceId(), deviceName: deviceName() };
  const run = (token) => handleCloudRequest(token, method, path, body, ctx);

  try {
    let token = await getValidAccessToken();
    try {
      return toResponse(await run(token));
    } catch (err) {
      if (err instanceof DriveError && err.status === 401) {
        token = await refreshTokens();
        return toResponse(await run(token));
      }
      throw err;
    }
  } catch (err) {
    if (err instanceof DriveError) {
      const status = err.status >= 400 && err.status < 600 ? err.status : 502;
      return toResponse({ status, body: { error: friendlyDriveMessage(err) } });
    }
    throw err;
  }
}
