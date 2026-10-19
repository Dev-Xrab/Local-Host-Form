# Google OAuth setup

Drive sync uses the OAuth 2.0 Authorization Code flow with PKCE (RFC 7636) against Google. Code lives in `server/oauth/`.

## 1. Google Cloud Console

1. Create a project and enable the **Google Drive API**.
2. **OAuth consent screen**: set app name and support email, add scopes `openid`, `email`, `profile` and `.../auth/drive.appdata`. Add test users while the app is in *Testing*. Refresh tokens issued to apps in *Testing* expire after 7 days, so publish the app for real use.
   Also add `forms.body.readonly`, `forms.responses.readonly` and `drive.metadata.readonly`, and enable the **Google Forms API** in the project (APIs & Services → Library). Without these, Drive sync still works and the Google Forms routes answer `forms_scope_missing`.
3. **Credentials → Create OAuth client ID → Desktop app**. No redirect URI registration is needed; Google allows loopback (`http://localhost:<port>`) redirects for desktop clients.

## 2. Configuration

| Variable | Purpose |
| --- | --- |
| `GOOGLE_CLIENT_ID` | Required. Sync is disabled (503) without it. |
| `GOOGLE_CLIENT_SECRET` | Desktop-client secret; not confidential per Google, PKCE protects the flow. |
| `TOKEN_ENCRYPTION_KEY` | Optional, 32 bytes base64. Otherwise a random key is stored in `<DATA_DIR>/token.key`. |

For a release build (installer or APK), put `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` of a **Desktop app** client in `.env.local` and run `npm run inject:oauth` first. It writes them into `server/oauth/clientDefaults.js` and marks that file skip-worktree, so they cannot be committed (GitHub push protection rejects client secrets). Run `npm run inject:oauth -- --reset` to clear it. Never ship a *Web application* client's secret: that one is confidential.

## 3. Flow

1. `POST /api/cloud/auth/launch` (app session required) returns a single-use, 60 s launch URL.
2. The OS browser opens `/auth/start`, which creates the PKCE verifier and `state` (memory only) and redirects to Google.
3. Google redirects to `/auth/callback`. The `state` is checked and consumed, the code is exchanged server-side with the verifier, the Drive scope and refresh token are verified, and the profile is fetched.
4. Tokens are saved AES-256-GCM encrypted. `server/oauth/session.js` refreshes the access token 60 s before expiry (single-flight) and signs the user out on `invalid_grant`.
5. `POST /auth/logout` revokes the grant at Google and deletes local tokens.

## Testing

`npm run test:drive` runs everything against a fake Google (`tests/server/fakeDrive.mjs`); no account needed.

## Google Forms import and sync

Routes under `/api/google-forms` (app session required), implemented in `server/googleForms/`:

| Route | Purpose |
| --- | --- |
| `GET /` | Lists the user's Google Forms, marking those already on this device. |
| `POST /import/:googleId` | Creates a local form from a Google Form and pulls its responses. Re-importing returns the existing form. |
| `POST /:formId/sync` | Pulls new responses for one form. Incremental (`timestamp >=` cursor) and de-duplicated by Google response id. |
| `POST /sync` | Same for every linked form. A background poll does this every 5 minutes (`GOOGLE_FORMS_POLL_MS`, `0` disables). |
| `GET /:formId/changes` | Read-only diff of local questions against the live form. |
| `POST /:formId/apply-changes` | Makes local questions follow Google. Deleted questions are kept (`removedAt`) so old answers stay labelled. |

Imported responses are stored on the device with `sync_status = local` and only go to Drive if the host chooses to save them. Unsupported question types (grids, file upload, images) are reported in `skipped`, never silently dropped. Accounts connected before these scopes existed must sign in again.
