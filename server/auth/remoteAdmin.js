import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { db } from "../db/index.js";
import { encryptToken, decryptToken } from "../oauth/tokenVault.js";

const KEY = "remote_admin_totp_secret";
const get = db.prepare("SELECT value FROM app_settings WHERE key = ?");
const set = db.prepare("INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
const remove = db.prepare("DELETE FROM app_settings WHERE key = ?");
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
let pending = null;

function base32(bytes) {
  let bits = 0;
  let value = 0;
  let result = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      result += ALPHABET[(value >>> (bits -= 5)) & 31];
    }
  }
  if (bits) result += ALPHABET[(value << (5 - bits)) & 31];
  return result;
}

function decode32(secret) {
  let bits = 0;
  let value = 0;
  const bytes = [];
  for (const char of secret) {
    const index = ALPHABET.indexOf(char);
    if (index < 0) return null;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits -= 8)) & 255);
      value &= (1 << bits) - 1;
    }
  }
  return Buffer.from(bytes);
}

function totp(secret, step) {
  const key = decode32(secret);
  if (!key) return null;
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hash = createHmac("sha1", key).update(counter).digest();
  const offset = hash[hash.length - 1] & 15;
  const value = (hash.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return String(value).padStart(6, "0");
}

export function verifyTotp(secret, code, at = Date.now()) {
  if (typeof code !== "string" || !/^\d{6}$/.test(code)) return false;
  const step = Math.floor(at / 30_000);
  const provided = Buffer.from(code);
  return [-1, 0, 1].some((offset) => timingSafeEqual(provided, Buffer.from(totp(secret, step + offset))));
}

export function isRemoteAdminEnabled() {
  return !!get.get(KEY)?.value;
}

export function verifyRemoteAdminCode(code) {
  const stored = get.get(KEY)?.value;
  return !!stored && verifyTotp(decryptToken(stored), code);
}

export function beginRemoteAdminSetup() {
  const secret = base32(randomBytes(20));
  pending = { secret, expiresAt: Date.now() + 10 * 60_000 };
  const label = encodeURIComponent("Self Host Form:Remote admin");
  return { secret, uri: `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent("Self Host Form")}&algorithm=SHA1&digits=6&period=30` };
}

export function confirmRemoteAdminSetup(code) {
  if (!pending || Date.now() > pending.expiresAt || !verifyTotp(pending.secret, code)) return false;
  set.run(KEY, encryptToken(pending.secret));
  pending = null;
  return true;
}

export function disableRemoteAdmin() {
  remove.run(KEY);
  pending = null;
}
