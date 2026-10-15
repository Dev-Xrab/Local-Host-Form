// Runs a fake Google (sign-in page, OAuth tokens, Drive app-data folder) so the real app's Drive sync
// can be clicked through without a Google OAuth client. Nothing is sent to Google.
//
//   node scripts/dev-fake-google.mjs
//
// Then start the local server with the printed environment variables.
import { startFakeDrive } from "../tests/server/fakeDrive.mjs";

const port = Number(process.env.FAKE_GOOGLE_PORT || 5330);
const fake = await startFakeDrive({ port });
console.log(`Fake Google running at ${fake.base}`);
console.log(`See stored Drive files: ${fake.base}/__files`);
console.log("Start the app server (npm run server) with these environment variables set:");
for (const [key, value] of Object.entries({
  GOOGLE_CLIENT_ID: "demo-client",
  GOOGLE_AUTH_URL: `${fake.base}/auth`,
  GOOGLE_TOKEN_URL: `${fake.base}/token`,
  GOOGLE_USERINFO_URL: `${fake.base}/userinfo`,
  GOOGLE_REVOKE_URL: `${fake.base}/revoke`,
  DRIVE_API_BASE: `${fake.base}/drive/v3`,
  DRIVE_UPLOAD_BASE: `${fake.base}/upload/drive/v3`,
})) {
  console.log(`  ${key}=${value}`);
}
