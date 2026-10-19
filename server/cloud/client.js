import * as cloudRepo from "./repository.js";
import { isConfigured } from "../oauth/config.js";
import { forceRefresh, getValidAccessToken } from "../oauth/session.js";
import { handleCloudRequest } from "./driveCloud.js";
import { DriveError } from "./drive.js";

// Sync is on once an OAuth client id is configured (see server/oauth/config.js). This device talks to
// the user's Google Drive directly; token refresh lives in server/oauth/session.js.
export const isCloudConfigured = isConfigured;

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
// handled in one place. The result is a fetch Response with the status codes and JSON bodies callers
// already expect. A single retry after a refresh covers the ordinary "token expired mid-session"
// case without hiding real failures.
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
        token = await forceRefresh();
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
