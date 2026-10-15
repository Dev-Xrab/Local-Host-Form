// Run with `npm run test:drive`. Exercises the Drive-backed sync layer against a fake Drive.
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { startFakeDrive, TOKEN } from "./fakeDrive.mjs";

let drive;
let handle;
let DriveError;
before(async () => {
  drive = await startFakeDrive();
  ({ handleCloudRequest: handle } = await import("../../server/cloud/driveCloud.js"));
  ({ DriveError } = await import("../../server/cloud/drive.js"));
});
after(() => drive.close());

const deviceA = { deviceId: randomUUID(), deviceName: "Teacher PC" };
const deviceB = { deviceId: randomUUID(), deviceName: "Phone" };
const call = (method, path, body, ctx = deviceA) => handle(TOKEN, method, path, body, ctx);
const question = (id = "q1") => ({ id, type: "short_answer", title: "Name?" });
const formBody = (title = "Quiz") => ({ title, description: "d", settings: { a: 1 }, questions: [question()] });
const change = (formId, over = {}) => ({
  id: randomUUID(),
  formId,
  formVersion: 1,
  version: 1,
  createdAt: "2026-01-01T00:00:00.000Z",
  payload: { respondentName: "Ana", answers: { q1: "x" } },
  ...over,
});

test("creates, lists, reads and publishes new versions of a form", async () => {
  const created = await call("POST", "/api/forms", formBody("Quiz"));
  assert.equal(created.status, 201);
  const id = created.body.id;
  assert.equal(created.body.version, 1);

  assert.ok((await call("GET", "/api/forms")).body.some((f) => f.id === id && f.questionCount === 1));

  const v2 = await call("PUT", `/api/forms/${id}`, { ...formBody("Quiz v2"), questions: [question(), question("q2")] });
  assert.equal(v2.status, 200);
  assert.equal(v2.body.version, 2);

  assert.equal((await call("GET", `/api/forms/${id}`)).body.title, "Quiz v2");
  assert.equal((await call("GET", `/api/forms/${id}?version=1`)).body.questions.length, 1);
  assert.deepEqual((await call("GET", `/api/forms/${id}/versions`)).body.map((v) => v.version), [2, 1]);
});

test("validates form bodies and ids", async () => {
  assert.equal((await call("POST", "/api/forms", { title: "x" })).status, 400);
  assert.equal((await call("POST", "/api/forms", { questions: [{ id: "a", type: "nope" }] })).status, 400);
  assert.equal((await call("GET", "/api/forms/not-a-uuid")).status, 404);
  assert.equal((await call("GET", `/api/forms/${randomUUID()}`)).status, 404);
});

test("publishing a form the Drive does not know yet creates it under the same id (migration)", async () => {
  const id = randomUUID();
  const res = await call("PUT", `/api/forms/${id}`, formBody("Migrated"));
  assert.equal(res.status, 200);
  assert.equal(res.body.id, id);
  assert.equal((await call("GET", `/api/forms/${id}`)).body.title, "Migrated");
});

test("sync uploads responses and another device downloads them", async () => {
  const formId = (await call("POST", "/api/forms", formBody("Sync"))).body.id;
  const c = change(formId);

  const up = await call("POST", "/api/sync", { lastCursor: 0, changes: [c] }, deviceA);
  assert.deepEqual(up.body.accepted, [c.id]);
  assert.deepEqual(up.body.rejected, []);

  const down = await call("POST", "/api/sync", { lastCursor: 0, changes: [], formId }, deviceB);
  const got = down.body.changes.find((x) => x.id === c.id);
  assert.ok(got, "device B should see the response");
  assert.equal(got.deviceName, "Teacher PC");
  assert.equal(got.deviceId, deviceA.deviceId);
  assert.deepEqual(got.payload, c.payload);
  assert.equal(down.body.hasMore, false);
});

test("retries are idempotent, newer versions win, and a differing same-version write conflicts", async () => {
  const formId = (await call("POST", "/api/forms", formBody("Conflicts"))).body.id;
  const c = change(formId);
  await call("POST", "/api/sync", { changes: [c] });

  // exact retry (key order differs) is accepted without error
  const retry = await call("POST", "/api/sync", { changes: [{ ...c, payload: { answers: { q1: "x" }, respondentName: "Ana" } }] });
  assert.deepEqual(retry.body.accepted, [c.id]);

  // same version, different payload -> conflict
  const clash = await call("POST", "/api/sync", { changes: [{ ...c, payload: { respondentName: "Bo", answers: {} } }] });
  assert.deepEqual(clash.body.rejected, [{ id: c.id, reason: "conflict" }]);

  // higher version replaces it
  const newer = await call("POST", "/api/sync", { changes: [{ ...c, version: 2, payload: { respondentName: "Bo", answers: {} } }] });
  assert.deepEqual(newer.body.accepted, [c.id]);
  const down = await call("POST", "/api/sync", { changes: [], formId }, deviceB);
  const stored = down.body.changes.find((x) => x.id === c.id);
  assert.equal(stored.version, 2);
  assert.equal(stored.payload.respondentName, "Bo");
});

test("rejects responses for an unknown form and malformed changes without failing the batch", async () => {
  const formId = (await call("POST", "/api/forms", formBody("Rejects"))).body.id;
  const good = change(formId);
  const orphan = change(randomUUID());
  const bad = { id: "nope" };
  const res = await call("POST", "/api/sync", { changes: [orphan, bad, good] });
  assert.deepEqual(res.body.accepted, [good.id]);
  assert.deepEqual(res.body.rejected.map((r) => r.reason).sort(), ["invalid", "invalid_form"]);
});

test("cursor returns only newer responses (inclusive at the boundary) and honours the form filter", async () => {
  const formA = (await call("POST", "/api/forms", formBody("A"))).body.id;
  const formB = (await call("POST", "/api/forms", formBody("B"))).body.id;
  const first = change(formA);
  const r1 = await call("POST", "/api/sync", { changes: [first] });
  const cursor = r1.body.nextCursor;
  assert.ok(cursor > 0);

  const second = change(formB);
  await call("POST", "/api/sync", { lastCursor: cursor, changes: [second] });
  const since = await call("POST", "/api/sync", { lastCursor: cursor, changes: [] });
  const ids = since.body.changes.map((c) => c.id);
  assert.ok(ids.includes(second.id));
  assert.ok(since.body.changes.every((c) => c.serverSeq >= cursor));

  const onlyB = await call("POST", "/api/sync", { lastCursor: 0, changes: [], formId: formB });
  assert.ok(onlyB.body.changes.every((c) => c.formId === formB));
});

test("a response over 4 MB is uploaded with the resumable protocol and round-trips", async () => {
  const formId = (await call("POST", "/api/forms", formBody("Big"))).body.id;
  const before = drive.stats.resumable;
  const big = change(formId, { payload: { respondentName: "Big", answers: { q1: "x".repeat(5 * 1024 * 1024) } } });
  const up = await call("POST", "/api/sync", { changes: [big] });
  assert.deepEqual(up.body.accepted, [big.id]);
  assert.equal(drive.stats.resumable, before + 1);

  const down = await call("POST", "/api/sync", { changes: [], formId }, deviceB);
  assert.equal(down.body.changes.find((c) => c.id === big.id).payload.answers.q1.length, 5 * 1024 * 1024);
});

test("deleting a form removes its file and all of its responses", async () => {
  const formId = (await call("POST", "/api/forms", formBody("Delete me"))).body.id;
  await call("POST", "/api/sync", { changes: [change(formId), change(formId)] });
  const countFor = () => [...drive.files.values()].filter((f) => f.name.includes(formId)).length;
  assert.equal(countFor(), 3);

  assert.equal((await call("DELETE", `/api/forms/${formId}`)).status, 204);
  assert.equal(countFor(), 0);
  assert.equal((await call("DELETE", `/api/forms/${formId}`)).status, 404);
  assert.equal((await call("GET", `/api/forms/${formId}`)).status, 404);
});

test("an expired token surfaces as a 401 DriveError so the client can refresh", async () => {
  await assert.rejects(() => handle("bad-token", "GET", "/api/forms", undefined, deviceA), (err) => err instanceof DriveError && err.status === 401);
});

test("sync only touches the app-data folder", async () => {
  assert.ok([...drive.files.values()].every((f) => /^(form|resp)-/.test(f.name)));
});
