const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

// drive.metadata.readonly lists/names a user's Google Forms (Forms live in Drive as files with
// a distinct mimeType — see google-forms/client.js); forms.body.readonly reads one form's actual
// questions; forms.responses.readonly reads its submitted responses (google-forms/client.js
// listGoogleFormResponses — used by both the initial import and "update from Google"). All three
// are read-only and narrower than the general drive.readonly/forms.body scopes — this app never
// writes to a user's Drive or Forms.
const SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/drive.metadata.readonly",
  "https://www.googleapis.com/auth/forms.body.readonly",
  "https://www.googleapis.com/auth/forms.responses.readonly",
].join(" ");

// The Google OAuth client id/secret live only in this process's environment — never sent to
// the desktop app or bundled into any client build.
export function buildGoogleAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: process.env.GOOGLE_OAUTH_REDIRECT_URI,
    response_type: "code",
    scope: SCOPES,
    // offline + consent: Drive/Forms lookups happen well after sign-in (whenever the user opens
    // the Google Forms picker), not just at login, so a refresh token is required — and Google
    // only ever issues one on a prompt=consent screen, not on a silent repeat sign-in.
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeGoogleCode(code) {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: process.env.GOOGLE_OAUTH_REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed (${res.status})`);
  return res.json();
}

// Used later (not at sign-in) whenever this server needs to actually call Drive/Forms on the
// user's behalf — see google-forms/client.js. Google access tokens are short-lived (~1h), so
// this is called fresh each time rather than caching one.
export async function refreshGoogleAccessToken(refreshToken) {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google token refresh failed (${res.status})`);
  return res.json();
}

export async function fetchGoogleUserInfo(accessToken) {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Google userinfo request failed (${res.status})`);
  return res.json();
}
