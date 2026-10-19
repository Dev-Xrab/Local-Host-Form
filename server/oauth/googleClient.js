import * as config from "./config.js";

// Failure from Google's OAuth endpoints. `code` is the RFC 6749 error code (e.g. invalid_grant).
export class OAuthError extends Error {
  constructor(message, { code = "server_error", status = 502 } = {}) {
    super(message);
    this.name = "OAuthError";
    this.code = code;
    this.status = status;
  }
}

async function post(url, params) {
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: params,
      signal: AbortSignal.timeout(config.HTTP_TIMEOUT_MS),
    });
  } catch (err) {
    throw new OAuthError(`Could not reach Google: ${err.message}`, { code: "network_error" });
  }
  const body = await res.json().catch(() => ({}));
  return { res, body };
}

function failure(body, status) {
  return new OAuthError(body?.error_description || body?.error || `Google request failed (${status})`, {
    code: body?.error || "server_error",
    status: status >= 400 && status < 500 ? 400 : 502,
  });
}

function withClient(params) {
  params.set("client_id", config.clientId());
  if (config.clientSecret()) params.set("client_secret", config.clientSecret());
  return params;
}

function normalizeTokens(body, previousRefreshToken) {
  return {
    accessToken: body.access_token,
    accessTokenExpiresAt: new Date(Date.now() + (Number(body.expires_in) || 3600) * 1000).toISOString(),
    // Google does not rotate refresh tokens, but accept a new one if it ever sends one.
    refreshToken: body.refresh_token || previousRefreshToken || null,
    scopes: String(body.scope || "").split(" ").filter(Boolean),
  };
}

export function buildAuthorizationUrl({ redirectUri, state, codeChallenge }) {
  const url = new URL(config.authUrl());
  url.search = new URLSearchParams({
    client_id: config.clientId(),
    redirect_uri: redirectUri,
    response_type: "code",
    scope: config.GOOGLE_SCOPES.join(" "),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    // offline + consent so Google issues a refresh token: syncing happens long after sign-in.
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "false",
  }).toString();
  return url.toString();
}

export async function exchangeCode({ code, redirectUri, codeVerifier }) {
  const { res, body } = await post(
    config.tokenUrl(),
    withClient(new URLSearchParams({ code, redirect_uri: redirectUri, grant_type: "authorization_code", code_verifier: codeVerifier }))
  );
  if (!res.ok || !body.access_token) throw failure(body, res.status);
  return normalizeTokens(body);
}

export async function refreshAccessToken(refreshToken) {
  const { res, body } = await post(
    config.tokenUrl(),
    withClient(new URLSearchParams({ refresh_token: refreshToken, grant_type: "refresh_token" }))
  );
  if (!res.ok || !body.access_token) throw failure(body, res.status);
  return normalizeTokens(body, refreshToken);
}

// Best-effort: callers clear local credentials regardless of the outcome.
export async function revokeToken(token) {
  try {
    await post(config.revokeUrl(), new URLSearchParams({ token }));
    return true;
  } catch {
    return false;
  }
}

export async function fetchUserInfo(accessToken) {
  let res;
  try {
    res = await fetch(config.userinfoUrl(), {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(config.HTTP_TIMEOUT_MS),
    });
  } catch (err) {
    throw new OAuthError(`Could not reach Google: ${err.message}`, { code: "network_error" });
  }
  if (!res.ok) throw new OAuthError(`Google profile request failed (${res.status})`);
  const info = await res.json();
  if (!info?.sub || !info?.email) throw new OAuthError("Google did not return an account identity.");
  return { userId: info.sub, email: info.email, name: info.name || "", avatarUrl: info.picture || null };
}
