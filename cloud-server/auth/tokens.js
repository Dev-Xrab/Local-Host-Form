import { randomBytes, randomUUID, createHash } from "node:crypto";

export const newId = () => randomUUID();

// Raw tokens are only ever handed to the client — the database only ever stores hashToken(raw).
export function generateToken() {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}
