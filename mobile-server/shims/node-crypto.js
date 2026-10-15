// `node:crypto` for the phone runtime: just the functions the server uses.
// Randomness comes from the platform's secure RNG (globalThis.crypto, installed from expo-crypto
// at app start). scrypt and sha256 are pure JS and produce byte-identical output to Node's.
import { Buffer } from "buffer";
import { scrypt } from "@noble/hashes/scrypt.js";
import { sha256 } from "@noble/hashes/sha2.js";

const toBytes = (v) => (typeof v === "string" ? new Uint8Array(Buffer.from(v, "utf8")) : new Uint8Array(v));

function secureRandom(length) {
  const out = new Uint8Array(length);
  const c = globalThis.crypto;
  if (!c?.getRandomValues) throw new Error("No secure random source is available.");
  // getRandomValues is limited to 65536 bytes per call.
  for (let i = 0; i < length; i += 65536) c.getRandomValues(out.subarray(i, Math.min(length, i + 65536)));
  return out;
}

export function randomBytes(size) {
  return Buffer.from(secureRandom(size));
}

export function randomUUID() {
  const c = globalThis.crypto;
  if (typeof c?.randomUUID === "function") return c.randomUUID();
  const b = secureRandom(16);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Uniform integer in [min, max) without modulo bias, like node:crypto.randomInt. */
export function randomInt(minOrMax, maxArg) {
  const [min, max] = maxArg === undefined ? [0, minOrMax] : [minOrMax, maxArg];
  const range = max - min;
  if (!(range > 0)) throw new RangeError("randomInt: max must be greater than min");
  const limit = Math.floor(0x1_0000_0000 / range) * range; // reject values that would skew the distribution
  for (;;) {
    const b = secureRandom(4);
    const n = ((b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]) >>> 0;
    if (n < limit) return min + (n % range);
  }
}

/** Same defaults as Node: N=16384, r=8, p=1. */
export function scryptSync(password, salt, keylen, options = {}) {
  const { N = 16384, r = 8, p = 1 } = options;
  return Buffer.from(scrypt(toBytes(password), toBytes(salt), { N, r, p, dkLen: keylen }));
}

export function timingSafeEqual(a, b) {
  if (a.length !== b.length) throw new RangeError("Input buffers must have the same byte length");
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export function createHash(algorithm) {
  if (String(algorithm).toLowerCase() !== "sha256") throw new Error(`Unsupported hash algorithm: ${algorithm}`);
  const parts = [];
  return {
    update(data) {
      parts.push(toBytes(data));
      return this;
    },
    digest(encoding) {
      const total = parts.reduce((n, p) => n + p.length, 0);
      const all = new Uint8Array(total);
      let o = 0;
      for (const p of parts) {
        all.set(p, o);
        o += p.length;
      }
      const out = Buffer.from(sha256(all));
      return encoding ? out.toString(encoding) : out;
    },
  };
}

export default { randomBytes, randomUUID, randomInt, scryptSync, timingSafeEqual, createHash };
