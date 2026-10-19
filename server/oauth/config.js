// Google OAuth 2.0 configuration. Everything is read at call time so tests can point the endpoints
// at a fake Google (see tests/server/fakeDrive.mjs).
//
// Scopes are deliberately minimal: `drive.appdata` is limited to a hidden folder that only this app
// can see (it cannot list or read any other Drive file); the rest identify the connected account.
export const DRIVE_APPDATA_SCOPE = "https://www.googleapis.com/auth/drive.appdata";

export const GOOGLE_SCOPES = ["openid", "email", "profile", DRIVE_APPDATA_SCOPE];

export const authUrl = () => process.env.GOOGLE_AUTH_URL || "https://accounts.google.com/o/oauth2/v2/auth";
export const tokenUrl = () => process.env.GOOGLE_TOKEN_URL || "https://oauth2.googleapis.com/token";
export const revokeUrl = () => process.env.GOOGLE_REVOKE_URL || "https://oauth2.googleapis.com/revoke";
export const userinfoUrl = () => process.env.GOOGLE_USERINFO_URL || "https://openidconnect.googleapis.com/v1/userinfo";

// "Desktop app" OAuth client from Google Cloud Console. Google documents that an installed-app
// client's secret is not confidential, so it may ship with the app; PKCE is what protects the flow.
// Set GOOGLE_CLIENT_ID (and GOOGLE_CLIENT_SECRET) in the environment, or fill in the defaults
// before building a release.
const DEFAULT_CLIENT_ID = "";
const DEFAULT_CLIENT_SECRET = "";

export const clientId = () => process.env.GOOGLE_CLIENT_ID || DEFAULT_CLIENT_ID;
export const clientSecret = () => process.env.GOOGLE_CLIENT_SECRET || DEFAULT_CLIENT_SECRET;
export const isConfigured = () => !!clientId();

export const CALLBACK_PATH = "/api/cloud/auth/callback";

// Network timeout for every call to Google, so a stalled connection cannot hang a request forever.
export const HTTP_TIMEOUT_MS = 15_000;

// Refresh this long before the access token actually expires to absorb clock skew and latency.
export const EXPIRY_SKEW_MS = 60_000;
