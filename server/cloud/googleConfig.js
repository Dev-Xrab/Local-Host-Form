// Google OAuth + Drive settings for optional sync. Sign-in runs on THIS device (no cloud server):
// the local server talks to Google directly, and the user's forms and responses are stored in the
// hidden "app data" folder of their own Google Drive.
//
// Only these scopes are requested. drive.appdata is limited to a folder that only this app can see
// (it cannot read or list any other Drive file), and the rest is basic profile for showing which
// account is connected.
export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/drive.appdata",
].join(" ");

export const DRIVE_APPDATA_SCOPE = "https://www.googleapis.com/auth/drive.appdata";

// Endpoints are read at call time so tests can point them at a fake Google (see tests/server).
export const googleAuthUrl = () => process.env.GOOGLE_AUTH_URL || "https://accounts.google.com/o/oauth2/v2/auth";
export const googleTokenUrl = () => process.env.GOOGLE_TOKEN_URL || "https://oauth2.googleapis.com/token";
export const googleRevokeUrl = () => process.env.GOOGLE_REVOKE_URL || "https://oauth2.googleapis.com/revoke";
export const googleUserinfoUrl = () => process.env.GOOGLE_USERINFO_URL || "https://openidconnect.googleapis.com/v1/userinfo";

// A "Desktop app" OAuth client from Google Cloud Console. Google documents that an installed-app
// client's secret is not confidential, so it may ship inside the app. Set GOOGLE_CLIENT_ID (and
// GOOGLE_CLIENT_SECRET) in the environment, or fill in the defaults below before building a release.
const DEFAULT_CLIENT_ID = "";
const DEFAULT_CLIENT_SECRET = "";

export const googleClientId = () => process.env.GOOGLE_CLIENT_ID || DEFAULT_CLIENT_ID;
export const googleClientSecret = () => process.env.GOOGLE_CLIENT_SECRET || DEFAULT_CLIENT_SECRET;

// Overridable so the sync layer can be tested against a fake Drive without touching Google.
export const driveApiBase = () => process.env.DRIVE_API_BASE || "https://www.googleapis.com/drive/v3";
export const driveUploadBase = () => process.env.DRIVE_UPLOAD_BASE || "https://www.googleapis.com/upload/drive/v3";
