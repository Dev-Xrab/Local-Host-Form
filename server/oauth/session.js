import * as cloudRepo from "../cloud/repository.js";
import { EXPIRY_SKEW_MS } from "./config.js";
import { OAuthError, refreshAccessToken } from "./googleClient.js";

// Two callers that both see an expired token would each refresh it, so concurrent callers share one
// in-flight refresh.
let refreshInFlight = null;

async function doRefresh() {
  const account = cloudRepo.getCloudAccount();
  if (!account) throw new OAuthError("Not signed in.", { code: "not_signed_in", status: 401 });

  try {
    const tokens = await refreshAccessToken(account.refreshToken);
    cloudRepo.updateCloudTokens(tokens);
    return tokens.accessToken;
  } catch (err) {
    // invalid_grant means the user revoked access or the grant expired. There is no silent
    // recovery, so sign out and let the UI ask them to sign in again. Network errors keep the
    // account so sync resumes when the connection is back.
    if (err instanceof OAuthError && err.code === "invalid_grant") {
      cloudRepo.clearCloudAccount();
      throw new OAuthError("Your Google sign-in expired or was revoked. Please sign in again.", { code: "invalid_grant", status: 401 });
    }
    throw err;
  }
}

export function forceRefresh() {
  if (!refreshInFlight) refreshInFlight = doRefresh().finally(() => (refreshInFlight = null));
  return refreshInFlight;
}

export async function getValidAccessToken() {
  const account = cloudRepo.getCloudAccount();
  if (!account) throw new OAuthError("Not signed in.", { code: "not_signed_in", status: 401 });
  if (new Date(account.accessTokenExpiresAt).getTime() - Date.now() > EXPIRY_SKEW_MS) return account.accessToken;
  return forceRefresh();
}
