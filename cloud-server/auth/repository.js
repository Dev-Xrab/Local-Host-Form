import { pool } from "../db.js";
import { newId, generateToken, hashToken } from "./tokens.js";

const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const HANDOFF_TTL_INTERVAL = "5 minutes";

function rowToUser(row) {
  return { id: row.id, email: row.email, name: row.name, avatarUrl: row.avatar_url };
}

// googleRefreshToken is only passed on a fresh sign-in (prompt=consent guarantees Google issues
// one — see auth/google.js) — COALESCE keeps the existing one on any call that doesn't have a
// new one, so this function stays safe to reuse anywhere a Google profile needs upserting.
export async function upsertUserByGoogleId({ googleId, email, name, avatarUrl, googleRefreshToken }) {
  const existing = await pool.query("SELECT * FROM users WHERE google_id = $1", [googleId]);
  if (existing.rows[0]) {
    const { rows } = await pool.query(
      `UPDATE users SET email = $1, name = $2, avatar_url = $3, updated_at = now(),
              google_refresh_token = COALESCE($5, google_refresh_token)
       WHERE id = $4 RETURNING *`,
      [email, name, avatarUrl, existing.rows[0].id, googleRefreshToken || null]
    );
    return rowToUser(rows[0]);
  }
  const id = newId();
  const { rows } = await pool.query(
    `INSERT INTO users (id, google_id, email, name, avatar_url, google_refresh_token)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [id, googleId, email, name, avatarUrl, googleRefreshToken || null]
  );
  return rowToUser(rows[0]);
}

export async function getGoogleRefreshToken(userId) {
  const { rows } = await pool.query("SELECT google_refresh_token FROM users WHERE id = $1", [userId]);
  return rows[0]?.google_refresh_token || null;
}

export async function getUserById(userId) {
  const { rows } = await pool.query("SELECT * FROM users WHERE id = $1", [userId]);
  return rows[0] ? rowToUser(rows[0]) : null;
}

export async function createOAuthState({ state, codeChallenge, localRedirectUri }) {
  await pool.query(
    `INSERT INTO oauth_states (state, code_challenge, local_redirect_uri) VALUES ($1, $2, $3)`,
    [state, codeChallenge, localRedirectUri]
  );
}

// Single-use: deleted the moment it's read, so a replayed Google callback can't reuse it.
export async function consumeOAuthState(state) {
  const { rows } = await pool.query("DELETE FROM oauth_states WHERE state = $1 RETURNING *", [state]);
  return rows[0] || null;
}

export async function createHandoff({ userId, codeChallenge }) {
  const code = newId();
  await pool.query(
    `INSERT INTO oauth_handoffs (code, user_id, code_challenge) VALUES ($1, $2, $3)`,
    [code, userId, codeChallenge]
  );
  return code;
}

// Single-use + short TTL: the code only ever needs to survive the OS-browser redirect back to
// the local server, which happens within milliseconds under normal conditions.
export async function consumeHandoff(code) {
  const { rows } = await pool.query(
    `UPDATE oauth_handoffs SET consumed_at = now()
     WHERE code = $1 AND consumed_at IS NULL AND created_at > now() - interval '${HANDOFF_TTL_INTERVAL}'
     RETURNING *`,
    [code]
  );
  return rows[0] || null;
}

export async function upsertDevice({ deviceId, userId, name }) {
  await pool.query(
    `INSERT INTO devices (id, user_id, name, last_seen_at) VALUES ($1, $2, $3, now())
     ON CONFLICT (id) DO UPDATE SET last_seen_at = now(), name = excluded.name`,
    [deviceId, userId, name || ""]
  );
}

export async function issueSession({ userId, deviceId }) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_MS);
  await pool.query(
    `INSERT INTO cloud_sessions (token_hash, user_id, device_id, expires_at) VALUES ($1, $2, $3, $4)`,
    [hashToken(token), userId, deviceId, expiresAt]
  );
  return { token, expiresAt };
}

export async function issueRefreshToken({ userId, deviceId }) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
  await pool.query(
    `INSERT INTO cloud_refresh_tokens (token_hash, user_id, device_id, expires_at) VALUES ($1, $2, $3, $4)`,
    [hashToken(token), userId, deviceId, expiresAt]
  );
  return { token, expiresAt };
}

export async function findSessionUser(accessToken) {
  const { rows } = await pool.query(
    `SELECT user_id, device_id FROM cloud_sessions WHERE token_hash = $1 AND expires_at > now()`,
    [hashToken(accessToken)]
  );
  return rows[0] ? { userId: rows[0].user_id, deviceId: rows[0].device_id } : null;
}

// Refresh tokens are rotated on every use: the one just presented is revoked here, and the
// caller issues a fresh pair. If a stolen token is ever replayed after the legitimate client
// already rotated it, this lookup fails (revoked_at is set), which is the detection signal.
export async function consumeRefreshToken(refreshToken) {
  const { rows } = await pool.query(
    `UPDATE cloud_refresh_tokens SET revoked_at = now()
     WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > now()
     RETURNING user_id, device_id`,
    [hashToken(refreshToken)]
  );
  return rows[0] ? { userId: rows[0].user_id, deviceId: rows[0].device_id } : null;
}

export async function revokeRefreshToken(refreshToken) {
  await pool.query(
    `UPDATE cloud_refresh_tokens SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL`,
    [hashToken(refreshToken)]
  );
}
