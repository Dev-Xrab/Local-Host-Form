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

test("recent activity is private and shows saved actions newest first", async () => {
  const device = new Device(await freePort());
  try {
    await device.ready();
    assert.equal((await device.api("GET", "/api/activity")).status, 401);
    assert.equal((await device.api("POST", "/api/auth/setup", { password: "test-host-password" })).status, 200);
    const folder = await device.api("POST", "/api/subjects", { name: "Science" });
    const form = await device.api("POST", "/api/forms", { title: "Quiz", subjectId: folder.data.id });
    assert.equal(folder.status, 201);
    assert.equal(form.status, 201);
    const result = await device.api("GET", "/api/activity");
    assert.equal(result.status, 200);
    assert.ok(result.data.some((item) => item.type === "folder_created" && item.label === "Science"));
    assert.ok(result.data.some((item) => item.type === "form_created" && item.label === "Quiz"));
    assert.ok(result.data.every((item, index, items) => index === 0 || items[index - 1].occurredAt >= item.occurredAt));
  } finally {
    device.stop();
  }
});
