import { randomUUID } from "node:crypto";
import { db } from "../db/index.js";
import { decryptToken, encryptToken, isEncrypted } from "../oauth/tokenVault.js";

const now = () => new Date().toISOString();

const getSettingStmt = db.prepare("SELECT value FROM app_settings WHERE key = ?");
const setSettingStmt = db.prepare(
  "INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
);

// Generated once per install and persisted forever — deliberately not the hostname, so a
// reinstalled OS or renamed machine doesn't fracture sync identity on the cloud server.
export function ensureDeviceId() {
  const existing = getSettingStmt.get("device_id");
  if (existing) return existing.value;
  const id = randomUUID();
  setSettingStmt.run("device_id", id);
  return id;
}

export function getDeviceId() {
  return getSettingStmt.get("device_id")?.value || ensureDeviceId();
}

function rowToAccount(row) {
  if (!row) return null;
  return {
    userId: row.user_id,
    email: row.email,
    name: row.name,
    avatarUrl: row.avatar_url,
    accessToken: decryptToken(row.access_token),
    accessTokenExpiresAt: row.access_token_expires_at,
    refreshToken: decryptToken(row.refresh_token),
    scopes: String(row.scopes || "").split(" ").filter(Boolean),
  };
}

const selectAccountStmt = db.prepare("SELECT * FROM cloud_account WHERE id = 1");

// Only ever called from within server/cloud — no route in this app returns the raw tokens to
// the renderer (see routes.js authStatus, which strips them before responding).
export function getCloudAccount() {
  try {
    return rowToAccount(selectAccountStmt.get());
  } catch (err) {
    // Stored tokens that can't be decrypted (the key changed, or the file was tampered with) are
    // unusable: treat the user as signed out so they can sign in again, instead of failing every request.
    console.error("Stored Google sign-in could not be read, signing out:", err.message);
    clearCloudAccount();
    return null;
  }
}

const upsertAccountStmt = db.prepare(`
  INSERT INTO cloud_account (id, user_id, email, name, avatar_url, access_token, access_token_expires_at, refresh_token, scopes, created_at, updated_at)
  VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    user_id = excluded.user_id,
    email = excluded.email,
    name = excluded.name,
    avatar_url = excluded.avatar_url,
    access_token = excluded.access_token,
    access_token_expires_at = excluded.access_token_expires_at,
    refresh_token = excluded.refresh_token,
    scopes = excluded.scopes,
    updated_at = excluded.updated_at
`);

export function saveCloudAccount({ userId, email, name, avatarUrl, accessToken, accessTokenExpiresAt, refreshToken, scopes = [] }) {
  const timestamp = now();
  upsertAccountStmt.run(userId, email, name || "", avatarUrl || null, encryptToken(accessToken), accessTokenExpiresAt, encryptToken(refreshToken), scopes.join(" "), timestamp, timestamp);
}

const updateTokensStmt = db.prepare(`
  UPDATE cloud_account SET access_token = ?, access_token_expires_at = ?, refresh_token = ?, scopes = COALESCE(?, scopes), updated_at = ? WHERE id = 1
`);

// `scopes` is only passed through when Google reported them; a refresh response often omits them.
export function updateCloudTokens({ accessToken, accessTokenExpiresAt, refreshToken, scopes }) {
  updateTokensStmt.run(encryptToken(accessToken), accessTokenExpiresAt, encryptToken(refreshToken), scopes?.length ? scopes.join(" ") : null, now());
}

// Tokens saved by earlier versions are plaintext; encrypt them in place on first run.
export function encryptLegacyTokens() {
  const row = selectAccountStmt.get();
  if (!row || (isEncrypted(row.access_token) && isEncrypted(row.refresh_token))) return;
  updateTokensStmt.run(encryptToken(decryptToken(row.access_token)), row.access_token_expires_at, encryptToken(decryptToken(row.refresh_token)), null, now());
}

export function clearCloudAccount() {
  db.prepare("DELETE FROM cloud_account WHERE id = 1").run();
}

// Automatic saving to Drive is on unless the user turned it off in Settings.
export function getAutoSave() {
  return getSettingStmt.get("auto_save_drive")?.value !== "0";
}

export function setAutoSave(enabled) {
  setSettingStmt.run("auto_save_drive", enabled ? "1" : "0");
}

// The last server_seq this device has fully applied — see server/cloud/sync.js. Stored in
// app_settings (same table the host-password/recovery settings already use) rather than a
// dedicated table, since it's a single scalar with no other fields.
export function getSyncCursor() {
  return Number(getSettingStmt.get("last_sync_cursor")?.value || 0);
}

export function setSyncCursor(cursor) {
  setSettingStmt.run("last_sync_cursor", String(cursor));
}

export function getLastSyncedAt() {
  return getSettingStmt.get("last_synced_at")?.value || null;
}

export function setLastSyncedAt(timestamp) {
  setSettingStmt.run("last_synced_at", timestamp);
}
