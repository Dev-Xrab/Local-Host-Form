# Google OAuth setup

Drive sync uses the OAuth 2.0 Authorization Code flow with PKCE (RFC 7636) against Google. Code lives in `server/oauth/`.

## 1. Google Cloud Console

1. Create a project and enable the **Google Drive API**.
2. **OAuth consent screen**: set app name and support email, add scopes `openid`, `email`, `profile` and `.../auth/drive.appdata`. Add test users while the app is in *Testing*. Refresh tokens issued to apps in *Testing* expire after 7 days, so publish the app for real use.
3. **Credentials → Create OAuth client ID → Desktop app**. No redirect URI registration is needed; Google allows loopback (`http://localhost:<port>`) redirects for desktop clients.

## 2. Configuration

| Variable | Purpose |
| --- | --- |
| `GOOGLE_CLIENT_ID` | Required. Sync is disabled (503) without it. |
| `GOOGLE_CLIENT_SECRET` | Desktop-client secret; not confidential per Google, PKCE protects the flow. |
| `TOKEN_ENCRYPTION_KEY` | Optional, 32 bytes base64. Otherwise a random key is stored in `<DATA_DIR>/token.key`. |

For a release build, put the client id/secret in `DEFAULT_CLIENT_ID` / `DEFAULT_CLIENT_SECRET` in `server/oauth/config.js`.

## 3. Flow

1. `POST /api/cloud/auth/launch` (app session required) returns a single-use, 60 s launch URL.
2. The OS browser opens `/auth/start`, which creates the PKCE verifier and `state` (memory only) and redirects to Google.
3. Google redirects to `/auth/callback`. The `state` is checked and consumed, the code is exchanged server-side with the verifier, the Drive scope and refresh token are verified, and the profile is fetched.
4. Tokens are saved AES-256-GCM encrypted. `server/oauth/session.js` refreshes the access token 60 s before expiry (single-flight) and signs the user out on `invalid_grant`.
5. `POST /auth/logout` revokes the grant at Google and deletes local tokens.

## Testing

`npm run test:drive` runs everything against a fake Google (`tests/server/fakeDrive.mjs`); no account needed.
