import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { dataDir } from "../db/dataDir.js";

// Encrypts OAuth tokens at rest (AES-256-GCM) so a copied database file does not leak long-lived
// Google credentials. The key comes from TOKEN_ENCRYPTION_KEY (32 bytes, base64) when provided,
// otherwise a random key is generated once and stored beside the database with owner-only
// permissions. This protects against casual copying of the .sqlite file; it is not a substitute
// for OS disk encryption, since anyone who can read the whole data directory can read the key.
const PREFIX = "enc:v1:";
let cachedKey = null;

function loadKey() {
  if (cachedKey) return cachedKey;
  const fromEnv = process.env.TOKEN_ENCRYPTION_KEY;
  if (fromEnv) {
    const key = Buffer.from(fromEnv, "base64");
    if (key.length !== 32) throw new Error("TOKEN_ENCRYPTION_KEY must be 32 bytes, base64-encoded.");
    return (cachedKey = key);
  }
  const keyFile = path.join(dataDir, "token.key");
  if (existsSync(keyFile)) {
    const key = Buffer.from(readFileSync(keyFile, "utf8").trim(), "base64");
    if (key.length === 32) return (cachedKey = key);
  }
  const key = randomBytes(32);
  writeFileSync(keyFile, key.toString("base64"), { mode: 0o600 });
  try {
    chmodSync(keyFile, 0o600);
  } catch {
    // Not supported on every filesystem (e.g. Windows); the mode above is best-effort.
  }
  return (cachedKey = key);
}

export function isEncrypted(value) {
  return typeof value === "string" && value.startsWith(PREFIX);
}

export function encryptToken(plain) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", loadKey(), iv);
  const data = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64");
}

// Values written before encryption existed are returned as-is, then re-encrypted on the next save.
export function decryptToken(stored) {
  if (!isEncrypted(stored)) return stored;
  const raw = Buffer.from(stored.slice(PREFIX.length), "base64");
  const decipher = createDecipheriv("aes-256-gcm", loadKey(), raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
}
