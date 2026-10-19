import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

// The vault resolves its key file from DATA_DIR at import time.
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "shf-oauth-"));

const { codeChallengeS256, createCodeVerifier, createState } = await import("../../server/oauth/pkce.js");
const { decryptToken, encryptToken, isEncrypted } = await import("../../server/oauth/tokenVault.js");
const { launchTokens, pendingAttempts } = await import("../../server/oauth/flowStore.js");
const { buildAuthorizationUrl } = await import("../../server/oauth/googleClient.js");

test("PKCE verifier is RFC 7636 length and the challenge is its S256 hash", () => {
  const verifier = createCodeVerifier();
  assert.match(verifier, /^[A-Za-z0-9_-]{43,128}$/);
  assert.equal(codeChallengeS256(verifier), createHash("sha256").update(verifier).digest("base64url"));
  assert.notEqual(createCodeVerifier(), verifier);
  assert.notEqual(createState(), createState());
});

test("tokens round-trip through AES-GCM, are never stored in clear, and tampering is detected", () => {
  const stored = encryptToken("refresh-secret");
  assert.ok(isEncrypted(stored));
  assert.ok(!stored.includes("refresh-secret"));
  assert.notEqual(encryptToken("refresh-secret"), stored, "fresh IV per encryption");
  assert.equal(decryptToken(stored), "refresh-secret");
  assert.equal(decryptToken("legacy-plaintext"), "legacy-plaintext");

  const raw = Buffer.from(stored.slice("enc:v1:".length), "base64");
  raw[raw.length - 1] ^= 1;
  assert.throws(() => decryptToken("enc:v1:" + raw.toString("base64")));
});

test("flow entries are single use", () => {
  launchTokens.set("t", true);
  assert.equal(launchTokens.take("t"), true);
  assert.equal(launchTokens.take("t"), null);
  pendingAttempts.set("s", { codeVerifier: "v" });
  assert.deepEqual(pendingAttempts.take("s"), { codeVerifier: "v" });
  assert.equal(pendingAttempts.take("s"), null);
});

test("authorization URL carries PKCE, state and offline access", () => {
  process.env.GOOGLE_CLIENT_ID = "client-1";
  const url = new URL(buildAuthorizationUrl({ redirectUri: "http://localhost:1/cb", state: "st", codeChallenge: "ch" }));
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(url.searchParams.get("state"), "st");
  assert.equal(url.searchParams.get("access_type"), "offline");
  assert.equal(url.searchParams.get("client_id"), "client-1");
});

test("a stored token that cannot be decrypted signs the user out instead of failing", async () => {
  const { db } = await import("../../server/db/index.js");
  const repo = await import("../../server/cloud/repository.js");
  repo.saveCloudAccount({ userId: "u", email: "a@b.c", accessToken: "at", accessTokenExpiresAt: new Date().toISOString(), refreshToken: "rt", scopes: [] });
  assert.equal(repo.getCloudAccount().refreshToken, "rt");

  db.prepare("UPDATE cloud_account SET refresh_token = ? WHERE id = 1").run("enc:v1:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
  assert.equal(repo.getCloudAccount(), null);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM cloud_account").get().n, 0, "unusable credentials are removed");
});
