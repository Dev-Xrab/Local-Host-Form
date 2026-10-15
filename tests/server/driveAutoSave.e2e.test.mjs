// Run with `npm run test:drive`. Checks that forms and responses reach the Drive on their own once the
// user is signed in and online, and that the Settings switch and offline periods are respected.
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { startFakeDrive } from "./fakeDrive.mjs";
import { Device } from "./helpers.mjs";

let google;
const devices = [];
const FAST = { AUTO_SAVE_DRIVE: "1", AUTO_SAVE_DEBOUNCE_MS: "250", AUTO_SAVE_SWEEP_MS: "700" };

before(async () => {
  google = await startFakeDrive();
});
after(async () => {
  devices.forEach((d) => d.stop());
  await google.close();
});

async function newDevice(port) {
  const d = new Device(port, { ...FAST, CLOUD_PING_URL: `${google.base}/generate_204` });
  devices.push(d);
  await d.ready();
  assert.equal((await d.api("POST", "/api/auth/setup", { password: "correct-horse-battery" })).status, 200);
  return d;
}

async function until(fn, what, timeoutMs = 8000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const value = await fn();
    if (value) return value;
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`timed out waiting for: ${what}`);
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const question = {
  id: "q1",
  type: "multiple_choice",
  title: "2+2?",
  required: true,
  options: ["3", "4"],
  correctAnswerIndex: [1],
  points: 1,
  rows: [],
  scale: { min: 1, max: 5, minLabel: "", maxLabel: "" },
};
const driveForm = (remoteId) => {
  const f = [...google.files.values()].find((x) => x.name === `form-${remoteId}.json`);
  return f ? JSON.parse(f.content) : null;
};
const driveResponses = (remoteId) => [...google.files.values()].filter((f) => f.name.startsWith(`resp-${remoteId}-`));
const putForm = (device, id, full, title) =>
  device.api("PUT", `/api/forms/${id}`, { title, description: "d", settings: full.settings, questions: full.questions });

let A;
let formId;
let remoteId;

test("a new form is saved to Drive automatically once signed in", async () => {
  A = await newDevice(5321);
  assert.equal((await A.signIn("good-code")).callback.status, 200);

  const created = await A.api("POST", "/api/forms/import", { title: "Auto quiz", description: "d", questions: [question] });
  assert.equal(created.status, 201);
  formId = created.data.id;

  const saved = await until(async () => {
    const f = (await A.api("GET", `/api/forms/${formId}`)).data;
    return f.remoteFormId ? f : null;
  }, "form to get a Drive id");
  remoteId = saved.remoteFormId;
  assert.equal(driveForm(remoteId).title, "Auto quiz");
  assert.equal(driveForm(remoteId).currentVersion, 1);
});

test("edits are saved automatically, and rapid edits stay in one version", async () => {
  const full = (await A.api("GET", `/api/forms/${formId}`)).data;
  for (const title of ["Auto quiz (edit 1)", "Auto quiz (edit 2)"]) {
    assert.equal((await putForm(A, formId, full, title)).status, 200);
    await wait(80);
  }
  await until(() => driveForm(remoteId)?.title === "Auto quiz (edit 2)", "Drive copy to show the latest edit");
  assert.equal(driveForm(remoteId).currentVersion, 1, "edits within one session should not pile up versions");
  await until(async () => (await A.api("GET", `/api/forms/${formId}`)).data.hasUnsavedCloudChanges === false, "form to be marked saved");
});

test("responses are uploaded automatically after they are submitted", async () => {
  const session = (await A.api("POST", "/api/sessions", { name: "Period 1", formId })).data;
  await A.api("POST", `/api/sessions/${session.id}/start`);
  const code = (await A.api("GET", `/api/sessions/${session.id}`)).data.code;
  const deviceId = "device-autosave-0001-abc";
  const joined = await A.api("POST", `/api/public/sessions/${code}/join`, { name: "Ana Reyes", deviceId });
  const responseId = joined.data.responseId || joined.data.response?.id || joined.data.id;
  const questionId = (await A.api("GET", `/api/forms/${formId}`)).data.questions[0].id;
  const submit = await A.api("POST", `/api/public/responses/${responseId}/submit`, { deviceId, answers: { [questionId]: 1 } });
  assert.equal(submit.status, 200, JSON.stringify(submit.data));

  await until(() => driveResponses(remoteId).length === 1, "response file in Drive");
  const status = await until(async () => {
    const s = (await A.api("GET", "/api/cloud/sync/status")).data;
    return s.pendingCount === 0 ? s : null;
  }, "no pending responses");
  assert.equal(status.failedCount, 0);
});

test("the Settings switch turns automatic saving off, and turning it on catches up", async () => {
  assert.equal((await A.api("GET", "/api/cloud/auto-save")).data.enabled, true);
  assert.equal((await A.api("PUT", "/api/cloud/auto-save", { enabled: "yes" })).status, 400);
  assert.equal((await A.api("PUT", "/api/cloud/auto-save", { enabled: false })).data.enabled, false);
  assert.equal((await A.api("GET", "/api/cloud/sync/status")).data.autoSave, false);

  const full = (await A.api("GET", `/api/forms/${formId}`)).data;
  await putForm(A, formId, full, "Edited while off");
  await wait(1800); // several debounce and sweep periods
  assert.equal(driveForm(remoteId).title, "Auto quiz (edit 2)", "nothing should upload while it is off");
  assert.equal((await A.api("GET", `/api/forms/${formId}`)).data.hasUnsavedCloudChanges, true);

  await A.api("PUT", "/api/cloud/auto-save", { enabled: true });
  await until(() => driveForm(remoteId)?.title === "Edited while off", "catch-up save after turning it back on");
});

test("changes made offline go up by themselves once the connection is back", async () => {
  await fetch(`${google.base}/__offline?on=1`, { method: "POST" });
  const full = (await A.api("GET", `/api/forms/${formId}`)).data;
  await putForm(A, formId, full, "Edited offline");
  await wait(1800);
  assert.equal(driveForm(remoteId).title, "Edited while off", "must not upload while offline");
  assert.equal((await A.api("GET", `/api/forms/${formId}`)).data.hasUnsavedCloudChanges, true);

  await fetch(`${google.base}/__offline?on=0`, { method: "POST" });
  await until(() => driveForm(remoteId)?.title === "Edited offline", "retry after reconnecting");
});

test("a form made before signing in is saved as soon as the account is connected", async () => {
  const B = await newDevice(5322);
  const created = await B.api("POST", "/api/forms/import", { title: "Made while signed out", description: "d", questions: [question] });
  assert.equal(created.status, 201);
  await wait(1500);
  assert.equal((await B.api("GET", `/api/forms/${created.data.id}`)).data.remoteFormId ?? null, null, "nothing to save to yet");

  assert.equal((await B.signIn("good-code")).callback.status, 200);
  const saved = await until(async () => {
    const f = (await B.api("GET", `/api/forms/${created.data.id}`)).data;
    return f.remoteFormId ? f : null;
  }, "existing form to be saved after sign-in");
  assert.equal(driveForm(saved.remoteFormId).title, "Made while signed out");
});
