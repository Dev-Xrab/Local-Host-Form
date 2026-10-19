// Google Drive API bases. Overridable so the sync layer can be tested against a fake Drive without
// touching Google. OAuth configuration lives in server/oauth/config.js.
export { DRIVE_APPDATA_SCOPE } from "../oauth/config.js";

export const driveApiBase = () => process.env.DRIVE_API_BASE || "https://www.googleapis.com/drive/v3";
export const driveUploadBase = () => process.env.DRIVE_UPLOAD_BASE || "https://www.googleapis.com/upload/drive/v3";
