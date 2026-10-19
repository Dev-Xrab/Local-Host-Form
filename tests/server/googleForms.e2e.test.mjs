// Run with `npm run test:drive`. Imports a Google Form and its responses from a fake Google Forms API,
// then checks incremental sync, de-duplication, structural diff/apply and the missing-scope path.
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { startFakeDrive } from "./fakeDrive.mjs";
import { Device } from "./helpers.mjs";

let google;
let d;
const GID = "google-form-abc123";

const item = (itemId, questionId, title, question) => ({ itemId, title, questionItem: { question: { questionId, required: true, ...question } } });
const baseForm = () => ({
  info: { title: "Quiz from Google", description: "desc" },
  items: [
    item("i1", "q1", "Capital of France?", { choiceQuestion: { type: "RADIO", options: [{ value: "Berlin" }, { value: "Paris" }] } }),
    item("i2", "q2", "Pick fruits", { choiceQuestion: { type: "CHECKBOX", options: [{ value: "Apple" }, { value: "Rock" }, { value: "Pear" }] } }),
    item("i3", "q3", "Your name", { textQuestion: { paragraph: false } }),
    { itemId: "i4", title: "Grid", questionGroupItem: { questions: [] } },
  ],
});
const response = (n, minute) => ({
  responseId: `r${n}`,
  createTime: `2026-02-01T10:0${minute}:00Z`,
  lastSubmittedTime: `2026-02-01T10:0${minute}:00Z`,
  respondentEmail: `s${n}@example.com`,
  answers: {
    q1: { questionId: "q1", textAnswers: { answers: [{ value: "Paris" }] } },
    q2: { questionId: "q2", textAnswers: { answers: [{ value: "Apple" }, { value: "Pear" }] } },
    q3: { questionId: "q3", textAnswers: { answers: [{ value: `Student ${n}` }] } },
  },
});

before(async () => {
  google = await startFakeDrive();
  google.forms.set(GID, baseForm());
  google.formResponses.set(GID, [response(1, 1), response(2, 2), response(3, 3)]);
  d = new Device(5331);
  await d.ready();
  assert.equal((await d.api("POST", "/api/auth/setup", { password: "correct-horse-battery" })).status, 200);
});
after(async () => {
  d.stop();
  await google.close();
});

test("Google Forms routes need a signed-in account", async () => {
  const res = await d.api("GET", "/api/google-forms");
  assert.equal(res.status, 401);
  assert.equal((await d.signIn("good-code")).callback.status, 200);
});

let localId;
test("lists the user's Google Forms and imports one with all paginated responses", async () => {
  const list = await d.api("GET", "/api/google-forms");
  assert.equal(list.status, 200, JSON.stringify(list.data));
  assert.deepEqual(list.data.map((f) => [f.id, f.name, f.localFormId]), [[GID, "Quiz from Google", null]]);

  const imported = await d.api("POST", `/api/google-forms/import/${GID}`);
  assert.equal(imported.status, 201, JSON.stringify(imported.data));
  localId = imported.data.form.id;
  assert.equal(imported.data.form.googleFormId, GID);
  assert.deepEqual(imported.data.form.questions.map((q) => q.id), ["q1", "q2", "q3"]);
  assert.equal(imported.data.skipped.length, 1, "the grid question is reported, not silently dropped");
  assert.equal(imported.data.sync.newResponseCount, 3);

  // Answers are stored the way the app stores them: option index / index array / raw text.
  const responses = await d.api("GET", `/api/forms/${localId}/responses`);
  assert.equal(responses.status, 200, JSON.stringify(responses.data));
  assert.equal(responses.data.length, 3);
  const r3 = responses.data.find((r) => r.googleResponseId === "r3");
  assert.deepEqual(r3.answers, { q1: 1, q2: [0, 2], q3: "Student 3" });
  assert.equal(r3.syncStatus, "local", "kept on this device until the host chooses to save it to Drive");
});

test("re-importing returns the same form and never duplicates responses", async () => {
  const again = await d.api("POST", `/api/google-forms/import/${GID}`);
  assert.equal(again.status, 200);
  assert.equal(again.data.alreadyImported, true);
  assert.equal(again.data.form.id, localId);
  assert.equal(again.data.sync.newResponseCount, 0);
  // Only the boundary response is re-requested thanks to the stored cursor, and it is recognised.
  assert.equal(again.data.sync.alreadyHeldCount, 1);
  const forms = await d.api("GET", "/api/forms");
  assert.equal(forms.data.filter((f) => f.googleFormId === GID).length, 1);
});

test("sync is incremental: only newer responses are requested and stored", async () => {
  google.formResponses.get(GID).push(response(4, 4));
  const sync = await d.api("POST", `/api/google-forms/${localId}/sync`);
  assert.equal(sync.status, 200, JSON.stringify(sync.data));
  assert.equal(sync.data.newResponseCount, 1);
  assert.match(google.stats.lastFormFilter, /^timestamp >= 2026-02-01T10:03:00Z$/, "filtered by the stored cursor");

  const none = await d.api("POST", `/api/google-forms/${localId}/sync`);
  assert.equal(none.data.newResponseCount, 0);

  const status = await d.api("GET", `/api/google-forms/${localId}/status`);
  assert.equal(status.data.linked, true);
  assert.ok(status.data.lastSyncedAt);

  const all = await d.api("POST", "/api/google-forms/sync");
  assert.equal(all.status, 200);
  assert.equal(all.data.results.length, 1);
  assert.equal(all.data.results[0].newResponseCount, 0);
});

test("structure changes are detected read-only, then applied without losing removed questions", async () => {
  const live = baseForm();
  live.items.splice(1, 1); // q2 deleted on Google
  live.items.push(item("i5", "q5", "Favourite subject", { textQuestion: { paragraph: true } }));
  live.items[0].title = "Capital city of France?";
  google.forms.set(GID, live);

  const changes = await d.api("GET", `/api/google-forms/${localId}/changes`);
  assert.deepEqual([changes.data.added.map((q) => q.id), changes.data.removed.map((q) => q.id), changes.data.modified.map((q) => q.id)], [["q5"], ["q2"], ["q1"]]);
  const before = await d.api("GET", `/api/forms/${localId}`);
  assert.equal(before.data.questions.length, 3, "checking for changes must not modify the form");

  const applied = await d.api("POST", `/api/google-forms/${localId}/apply-changes`);
  assert.equal(applied.status, 200, JSON.stringify(applied.data));
  const byId = Object.fromEntries(applied.data.form.questions.map((q) => [q.id, q]));
  assert.equal(byId.q1.title, "Capital city of France?");
  assert.ok(byId.q2.removedAt, "removed question is kept for historical answers");
  assert.ok(byId.q5 && !byId.q5.removedAt);
});

test("bad ids, unknown forms and a missing scope are clean errors", async () => {
  assert.equal((await d.api("POST", "/api/google-forms/import/x")).status, 404);
  assert.equal((await d.api("POST", "/api/google-forms/import/does-not-exist-1")).status, 404);
  assert.equal((await d.api("POST", "/api/google-forms/not-a-uuid/sync")).status, 404);

  assert.equal((await d.api("POST", "/api/cloud/auth/logout")).status, 204);
  const limited = await d.signIn("no-drive-code"); // grants no Drive/Forms scopes, so sign-in itself is refused
  assert.equal(limited.callback.status, 400);
  assert.equal((await d.api("GET", "/api/google-forms")).status, 401);
});
