import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:net";
import { Device } from "./helpers.mjs";

async function freePort() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

test("only the host can configure Quick Tunnel email access", async () => {
  const device = new Device(await freePort());
  try {
    await device.ready();
    assert.equal((await device.api("PUT", "/api/tunnel/access", { allowedEmails: ["teacher@example.com"] })).status, 401);
    assert.equal((await device.api("POST", "/api/auth/setup", { password: "test-host-password" })).status, 200);
    assert.equal((await device.api("PUT", "/api/tunnel/access", { allowedEmails: ["invalid"] })).status, 400);
    assert.equal((await device.api("PUT", "/api/tunnel/access", { allowedEmails: [" Teacher@Example.com ", "teacher@example.com"] })).status, 200);
    const status = await device.api("GET", "/api/tunnel/status");
    assert.deepEqual(status.data.allowedEmails, ["teacher@example.com"]);
    const start = await device.api("POST", "/api/tunnel/start");
    assert.equal(start.data.status, "error");
    assert.equal(start.data.url, null);
    assert.deepEqual(start.data.allowedEmails, ["teacher@example.com"]);
  } finally {
    device.stop();
  }
});
