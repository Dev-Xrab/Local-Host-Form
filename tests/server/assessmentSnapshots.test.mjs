import test from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import { DatabaseSync } from "node:sqlite";
import { join as pathJoin } from "node:path";
import { Device } from "./helpers.mjs";

const port = await new Promise((resolve) => {
  const server = net.createServer();
  server.listen(0, "127.0.0.1", () => {
    const chosenPort = server.address().port;
    server.close(() => resolve(chosenPort));
  });
});
const device = new Device(port, { AUTO_SAVE_DRIVE: "0" });

const question = (title, correctAnswerIndex, points) => ({
  id: "q1", type: "multiple_choice", title, required: true,
  options: ["A", "B"], correctAnswerIndex: [correctAnswerIndex],
  correctAnswers: [], points, rows: [], scale: {},
});

test("session definition and submitted grade survive later form edits", async (t) => {
  t.after(() => device.stop());
  await device.ready();
  assert.equal((await device.api("POST", "/api/auth/setup", { password: "synthetic-test-password" })).status, 200);
  const created = await device.api("POST", "/api/forms", { title: "Original quiz" });
  assert.equal(created.status, 201);
  const formId = created.data.id;
  assert.equal((await device.api("PUT", `/api/forms/${formId}`, { questions: [question("Original question", 1, 2)] })).status, 200);

  const session = await device.api("POST", "/api/sessions", { formId, name: "Original session" });
  assert.equal(session.status, 201);
  const started = await device.api("POST", `/api/sessions/${session.data.id}/start`);
  assert.equal(started.status, 200);
  assert.ok(started.data.formSnapshotId);

  const join = await device.api("POST", `/api/public/sessions/${session.data.code}/join`, { name: "Student", deviceId: "snapshot-device-123" });
  assert.equal(join.status, 201);
  assert.equal(join.data.form.questions[0].title, "Original question");

  const edited = await device.api("PUT", `/api/forms/${formId}`, { title: "Edited quiz", questions: [question("Changed question", 0, 9)] });
  assert.equal(edited.status, 200);
  assert.equal(edited.data.recalculatedResponses, 0);

  const submitted = await device.api("POST", `/api/public/responses/${join.data.responseId}/submit`, {
    deviceId: "snapshot-device-123", answers: { q1: 1 }, timedOut: false,
  });
  assert.equal(submitted.status, 200);
  assert.equal(submitted.data.score, 2);
  assert.equal(submitted.data.maxScore, 2);

  const details = await device.api("GET", `/api/sessions/${session.data.id}/respondents/${join.data.responseId}`);
  assert.equal(details.status, 200);
  assert.equal(details.data.definitionProvenance, "pinned");
  assert.equal(details.data.breakdown[0].title, "Original question");
  assert.equal(details.data.score, 2);

  const more = await device.api("POST", `/api/public/sessions/${session.data.code}/join`, { name: "Second student", deviceId: "snapshot-device-456" });
  assert.equal(more.data.form.questions[0].title, "Original question");
  assert.equal((await device.api("PUT", `/api/forms/${formId}`, { questions: [question("Third question", 0, 10)] })).data.recalculatedResponses, 0);
  const stillOriginal = await device.api("GET", `/api/forms/${formId}/responses`);
  assert.equal(stillOriginal.data[0].score, 2);
  assert.equal(stillOriginal.data[0].breakdown[0].title, "Original question");

  const definitions = (await device.api("GET", `/api/forms/${formId}/responses/definitions`)).data;
  assert.equal(definitions.length, 1);
  const portable = await device.api("POST", "/api/forms/import", {
    title: "Portable copy", questions: (await device.api("GET", `/api/forms/${formId}`)).data.questions,
    assessmentDefinitions: definitions,
    responses: stillOriginal.data.map((r) => ({ ...r, assessmentId: r.formSnapshotId })),
  });
  assert.equal(portable.status, 201, JSON.stringify(portable.data));
  const restored = await device.api("GET", `/api/forms/${portable.data.id}/responses`);
  assert.equal(restored.data[0].score, 2);
  assert.equal(restored.data[0].definitionProvenance, "pinned");
  assert.equal(restored.data[0].breakdown[0].title, "Original question");

  const next = await device.api("POST", "/api/sessions", { formId, name: "Next session" });
  await device.api("POST", `/api/sessions/${next.data.id}/start`);
  const nextJoin = await device.api("POST", `/api/public/sessions/${next.data.code}/join`, { name: "Third student", deviceId: "snapshot-device-789" });
  assert.equal(nextJoin.data.form.questions[0].title, "Third question");

  const legacy = await device.api("POST", "/api/forms/import", {
    title: "Old import", questions: [question("Old question", 1, 2)],
    responses: [{ respondentName: "Earlier student", score: 2, maxScore: 2, answers: { q1: 1 } }],
  });
  assert.equal(legacy.status, 201);
  const changedLegacyQuestion = { ...question("New question", 0, 9), id: legacy.data.questions[0].id };
  assert.equal((await device.api("PUT", `/api/forms/${legacy.data.id}`, { questions: [changedLegacyQuestion] })).data.recalculatedResponses, 0);
  const oldResponses = await device.api("GET", `/api/forms/${legacy.data.id}/responses`);
  assert.equal(oldResponses.data[0].score, 2);
  assert.equal(oldResponses.data[0].definitionProvenance, "legacy_current_definition");

  const db = new DatabaseSync(pathJoin(device.dir, "stonearch.sqlite"), { readOnly: true });
  assert.equal(db.prepare("PRAGMA integrity_check").get().integrity_check, "ok");
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  db.close();
});
