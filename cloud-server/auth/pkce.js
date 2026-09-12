import { createHash } from "node:crypto";

// RFC 7636 S256: the client keeps `verifier` secret until /auth/exchange; only its derived
// `challenge` ever travels through the browser (via Google and back).
export function challengeFromVerifier(verifier) {
  return createHash("sha256").update(verifier).digest("base64url");
}
