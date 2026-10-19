import { randomBytes } from "node:crypto";

// In-memory only, by design: PKCE verifiers must never be written to disk or handed to the
// renderer. Entries are single-use, expire quickly, and the store is size-capped so an unauthenticated
// caller cannot grow it without bound.
const MAX_ENTRIES = 50;

class ExpiringStore {
  #entries = new Map();
  constructor(ttlMs) {
    this.ttlMs = ttlMs;
  }

  #sweep() {
    const cutoff = Date.now() - this.ttlMs;
    for (const [key, entry] of this.#entries) if (entry.createdAt < cutoff) this.#entries.delete(key);
  }

  set(key, value) {
    this.#sweep();
    if (this.#entries.size >= MAX_ENTRIES) this.#entries.delete(this.#entries.keys().next().value);
    this.#entries.set(key, { value, createdAt: Date.now() });
  }

  // Returns the value and removes it; null if missing or expired. Single use.
  take(key) {
    this.#sweep();
    const entry = this.#entries.get(key);
    if (!entry) return null;
    this.#entries.delete(key);
    return entry.value;
  }

  clear() {
    this.#entries.clear();
  }
}

// Launch tokens: minted by an authenticated request, then carried in the URL opened in the OS
// browser (which has no app session cookie). They stop anyone on the LAN from starting a sign-in
// that would connect the host's install to the attacker's own Google account.
export const launchTokens = new ExpiringStore(60_000);

// Pending authorization attempts keyed by `state`.
export const pendingAttempts = new ExpiringStore(10 * 60_000);

export const newLaunchToken = () => randomBytes(24).toString("base64url");
