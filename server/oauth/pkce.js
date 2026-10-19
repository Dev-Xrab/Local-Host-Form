import { createHash, randomBytes } from "node:crypto";

// RFC 7636: the verifier is 43-128 unreserved characters; 32 random bytes encode to 43.
export function createCodeVerifier() {
  return randomBytes(32).toString("base64url");
}

export function codeChallengeS256(verifier) {
  return createHash("sha256").update(verifier).digest("base64url");
}

// `state` binds the callback to the attempt that started it (CSRF protection, RFC 6749 §10.12).
export function createState() {
  return randomBytes(24).toString("base64url");
}
