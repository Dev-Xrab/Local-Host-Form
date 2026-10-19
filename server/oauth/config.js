import { DEFAULT_CLIENT_ID, DEFAULT_CLIENT_SECRET } from "./clientDefaults.js";

// Google OAuth 2.0 configuration. Everything is read at call time so tests can point the endpoints
// at a fake Google (see tests/server/fakeDrive.mjs).
//
// Scopes are deliberately minimal: `drive.appdata` is limited to a hidden folder that only this app
// can see (it cannot list or read any other Drive file); the rest identify the connected account.
export const DRIVE_APPDATA_SCOPE = "https://www.googleapis.com/auth/drive.appdata";

// Read-only access for importing Google Forms and their responses. These are optional at consent time:
// sync to Drive works without them, and the Google Forms routes report what is missing.
export const FORMS_BODY_SCOPE = "https://www.googleapis.com/auth/forms.body.readonly";
export const FORMS_RESPONSES_SCOPE = "https://www.googleapis.com/auth/forms.responses.readonly";
// Lets the app list the user's Google Forms by name (file metadata only, never file content).
export const DRIVE_METADATA_SCOPE = "https://www.googleapis.com/auth/drive.metadata.readonly";
export const GOOGLE_FORMS_SCOPES = [FORMS_BODY_SCOPE, FORMS_RESPONSES_SCOPE, DRIVE_METADATA_SCOPE];

export const GOOGLE_SCOPES = ["openid", "email", "profile", DRIVE_APPDATA_SCOPE, ...GOOGLE_FORMS_SCOPES];

export const authUrl = () => process.env.GOOGLE_AUTH_URL || "https://accounts.google.com/o/oauth2/v2/auth";
export const tokenUrl = () => process.env.GOOGLE_TOKEN_URL || "https://oauth2.googleapis.com/token";
export const revokeUrl = () => process.env.GOOGLE_REVOKE_URL || "https://oauth2.googleapis.com/revoke";
export const userinfoUrl = () => process.env.GOOGLE_USERINFO_URL || "https://openidconnect.googleapis.com/v1/userinfo";

// "Desktop app" OAuth client from Google Cloud Console. Google documents that an installed-app
// client's secret is not confidential, so it may ship with the app; PKCE is what protects the flow.
// The built-in defaults live in clientDefaults.js, which is empty in git and filled in at release time by
// `npm run inject:oauth`. Ship only a Desktop client there, never a "Web application" client's secret.
//
// Resolution order: GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET in the environment (desktop, dev, tests),
// then EXPO_PUBLIC_GOOGLE_CLIENT_ID / EXPO_PUBLIC_GOOGLE_CLIENT_SECRET, which Metro inlines at build
// time into the phone app (the phone has no real process.env, so runtime variables cannot reach it),
// then the built-in defaults.
//
// The EXPO_PUBLIC_* names must be written out in full, not looked up dynamically, or Metro cannot inline them.

export const clientId = () => process.env.GOOGLE_CLIENT_ID || process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || DEFAULT_CLIENT_ID;
export const clientSecret = () => process.env.GOOGLE_CLIENT_SECRET || process.env.EXPO_PUBLIC_GOOGLE_CLIENT_SECRET || DEFAULT_CLIENT_SECRET;
export const isConfigured = () => !!clientId();

export const formsApiBase = () => process.env.FORMS_API_BASE || "https://forms.googleapis.com/v1";

export const CALLBACK_PATH = "/api/cloud/auth/callback";

// Network timeout for every call to Google, so a stalled connection cannot hang a request forever.
export const HTTP_TIMEOUT_MS = 15_000;

// Refresh this long before the access token actually expires to absorb clock skew and latency.
export const EXPIRY_SKEW_MS = 60_000;

// `account` is the object from cloud/repository.js getCloudAccount (or null when signed out).
// Reading a form and its responses needs only the two Forms scopes; listing the user's forms by name
// is a bonus that needs the Drive metadata scope, so importing by pasted link works without it.
export const hasGoogleFormsAccess = (account) =>
  !!account && [FORMS_BODY_SCOPE, FORMS_RESPONSES_SCOPE].every((scope) => account.scopes?.includes(scope));

export const canListGoogleForms = (account) => hasGoogleFormsAccess(account) && account.scopes.includes(DRIVE_METADATA_SCOPE);
