import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createServer } from "node:net";
import { Device } from "./helpers.mjs";

async function freePort() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

function codeFor(secret) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0, value = 0;
  const bytes = [];
  for (const char of secret) {
    value = (value << 5) | alphabet.indexOf(char);
    bits += 5;
    if (bits >= 8) { bytes.push((value >>> (bits -= 8)) & 255); value &= (1 << bits) - 1; }
  }
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const hash = createHmac("sha1", Buffer.from(bytes)).update(counter).digest();
  return String((hash.readUInt32BE(hash[19] & 15) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

test("remote admin requires local enrollment, password, and authenticator code", async () => {
  const device = new Device(await freePort());
  const remoteHeaders = { "cf-ray": "test-tunnel-ray" };
  try {
    await device.ready();
    assert.equal((await device.api("POST", "/api/auth/setup", { password: "test-password-123" })).status, 200);
    const localCookie = device.cookie;
    assert.equal((await device.api("GET", "/api/forms", undefined, { headers: remoteHeaders })).status, 403);
    assert.equal((await device.api("POST", "/api/auth/login", { password: "test-password-123" }, { headers: remoteHeaders })).status, 403);
    assert.equal((await device.api("POST", "/api/auth/remote-admin/begin", { password: "test-password-123" }, { headers: remoteHeaders })).status, 403);

    const begin = await device.api("POST", "/api/auth/remote-admin/begin", { password: "test-password-123" });
    assert.equal(begin.status, 200);
    assert.match(begin.data.uri, /^otpauth:\/\/totp\//);
    const code = codeFor(begin.data.secret);
    assert.equal((await device.api("POST", "/api/auth/remote-admin/confirm", { code })).status, 200);
    assert.equal((await device.api("GET", "/api/forms", undefined, { headers: remoteHeaders })).status, 401);
    assert.equal((await device.api("POST", "/api/auth/login", { password: "test-password-123", code: "000000" }, { headers: remoteHeaders })).status, 401);

    const login = await device.api("POST", "/api/auth/login", { password: "test-password-123", code }, { headers: remoteHeaders });
    assert.equal(login.status, 200);
    const remoteCookie = device.cookie;
    assert.notEqual(remoteCookie, localCookie);
    assert.match(login.headers.get("set-cookie"), /Secure/);
    assert.equal((await device.api("GET", "/api/forms", undefined, { headers: remoteHeaders })).status, 200);
    assert.equal((await device.api("GET", "/api/tunnel/status", undefined, { headers: remoteHeaders })).status, 403);

    assert.equal((await device.api("POST", "/api/auth/change-password", { oldPassword: "test-password-123", newPassword: "new-test-password-456" }, { headers: remoteHeaders })).status, 200);
    assert.equal((await device.api("GET", "/api/forms", undefined, { headers: remoteHeaders })).status, 200);
    const changedRemoteCookie = device.cookie;

    device.cookie = localCookie;
    assert.equal((await device.api("GET", "/api/forms")).status, 401);
    assert.equal((await device.api("POST", "/api/auth/login", { password: "new-test-password-456" })).status, 200);
    assert.equal((await device.api("POST", "/api/auth/remote-admin/disable", { password: "new-test-password-456", code })).status, 200);
    device.cookie = changedRemoteCookie;
    assert.equal((await device.api("GET", "/api/forms", undefined, { headers: remoteHeaders })).status, 403);
  } finally {
    device.stop();
  }
});
