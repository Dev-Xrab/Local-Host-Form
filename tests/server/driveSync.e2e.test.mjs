// Run with `npm run test:drive`. Starts two real local servers (two "devices") against a fake Google
// (OAuth + Drive) and walks the whole flow: sign in, publish a form, sync a response, sign in on the
// second device, import the form and its responses, then revoke access.
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { startFakeDrive } from "./fakeDrive.mjs";

const SERVER = fileURLToPath(new URL("../../server/index.js", import.meta.url));
let google;
const devices = [];

class Device {
  constructor(port) {
    this.port = port;
    this.origin = `http://127.0.0.1:${port}`;
    this.dir = mkdtempSync(join(tmpdir(), "shf-e2e-"));
    this.cookie = "";
    this.proc = spawn(process.execPath, [SERVER], {
      env: { ...process.env, PORT: String(port), DATA_DIR: this.dir, GOOGLE_CLIENT_ID: "test-client", NODE_ENV: "test" },
      stdio: ["ignore", "ignore", "pipe"],
    });
    this.stderr = "";
    this.proc.stderr.on("data", (d) => (this.stderr += d));
  }

  async ready() {
    for (let i = 0; i < 100; i++) {
      try {
        if ((await fetch(`${this.origin}/api/health`)).ok) return;
      } catch {
        // not up yet
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error(`server on ${this.port} did not start\n${this.stderr}`);
  }

  async api(method, path, body, extra = {}) {
    const res = await fetch(`${this.origin}${path}`, {
      method,
      redirect: "manual",
      headers: { "Content-Type": "application/json", Origin: this.origin, Cookie: this.cookie, ...(extra.headers || {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const set = res.headers.getSetCookie?.() || [];
    if (set.length) this.cookie = set.map((c) => c.split(";")[0]).join("; ");
    const text = await res.text();
    let data = text;
    try {
      data = JSON.parse(text);
    } catch {
      // html or empty
    }
    return { status: res.status, data, headers: res.headers };
  }

  // Walks the same steps the app does: mint a launch link, open it, let "Google" send the browser
  // back to our callback, and finish.
  async signIn(code = "good-code") {
    const launch = await this.api("POST", "/api/cloud/auth/launch");
    assert.equal(launch.status, 200);
    const start = await fetch(launch.data.url, { redirect: "manual" });
    assert.equal(start.status, 302);
    const googleUrl = new URL(start.headers.get("location"));
    const callback = await fetch(`${new URL(googleUrl.searchParams.get("redirect_uri")).origin}/api/cloud/auth/callback?code=${code}&state=${googleUrl.searchParams.get("state")}`);
    return { googleUrl, callback, html: await callback.text() };
  }

  stop() {
    this.proc.kill();
    try {
      rmSync(this.dir, { recursive: true, force: true });
    } catch {
      // temp dir still locked on Windows; harmless
    }
  }
}

before(async () => {
  google = await startFakeDrive();
  for (const port of [5311, 5312]) {
    const d = new Device(port);
    devices.push(d);
    await d.ready();
    const setup = await d.api("POST", "/api/auth/setup", { password: "correct-horse-battery" });
    assert.equal(setup.status, 200, JSON.stringify(setup.data));
  }
});
after(async () => {
  devices.forEach((d) => d.stop());
  await google.close();
});

const [A, B] = [() => devices[0], () => devices[1]];
const question = { id: "q1", type: "multiple_choice", title: "2+2?", required: true, options: ["3", "4"], correctAnswerIndex: [1], points: 1, rows: [], scale: { min: 1, max: 5, minLabel: "", maxLabel: "" } };

test("sign-in sends the browser to Google with PKCE and only the app-data Drive scope", async () => {
  const { googleUrl } = await A().signIn("good-code");
  assert.equal(googleUrl.searchParams.get("client_id"), "test-client");
  assert.equal(googleUrl.searchParams.get("code_challenge_method"), "S256");
  assert.equal(googleUrl.searchParams.get("access_type"), "offline");
  const scopes = googleUrl.searchParams.get("scope").split(" ");
  assert.deepEqual(scopes.sort(), ["email", "https://www.googleapis.com/auth/drive.appdata", "openid", "profile"]);
  assert.match(googleUrl.searchParams.get("redirect_uri"), /\/api\/cloud\/auth\/callback$/);
  // the verifier was sent to Google's token endpoint, never to the browser
  assert.ok(google.stats.verifiers.at(-1) && google.stats.verifiers.at(-1).length >= 43);
  assert.ok(!googleUrl.toString().includes(google.stats.verifiers.at(-1)));

  const status = await A().api("GET", "/api/cloud/auth/status");
  assert.deepEqual(status.data, { connected: true, email: "teacher@example.com", name: "Test Teacher", avatarUrl: null });
  assert.ok(!JSON.stringify(status.data).includes("refresh"), "tokens must never reach the UI");
});

test("sign-in is refused without the Drive permission, on a bad code, and on a stale state", async () => {
  const d = devices[1];
  const noDrive = await d.signIn("no-drive-code");
  assert.equal(noDrive.callback.status, 400);
  assert.match(noDrive.html, /Google Drive/);
  assert.equal((await d.api("GET", "/api/cloud/auth/status")).data.connected, false);

  const bad = await d.signIn("wrong-code");
  assert.equal(bad.callback.status, 502);
  assert.equal((await d.api("GET", "/api/cloud/auth/status")).data.connected, false);

  const stale = await fetch(`${d.origin}/api/cloud/auth/callback?code=good-code&state=never-issued`);
  assert.equal(stale.status, 400);
});

let remoteFormId;
test("publishing a form and syncing a response store them in the Drive app folder", async () => {
  const form = await A().api("POST", "/api/forms/import", { title: "Math quiz", description: "d", questions: [question] });
  assert.equal(form.status, 201, JSON.stringify(form.data));
  const formId = form.data.id;

  const publish = await A().api("POST", `/api/cloud/forms/${formId}/publish`);
  assert.equal(publish.status, 200, JSON.stringify(publish.data));
  remoteFormId = publish.data.remoteFormId;
  assert.ok(remoteFormId);
  assert.ok(google.stats.refreshes >= 1, "expired token should have been refreshed through Google");
  assert.ok([...google.files.values()].some((f) => f.name === `form-${remoteFormId}.json`));

  const session = (await A().api("POST", "/api/sessions", { name: "Period 1", formId })).data;
  await A().api("POST", `/api/sessions/${session.id}/start`);
  const code = (await A().api("GET", `/api/sessions/${session.id}`)).data.code;
  const deviceId = "device-e2e-0001-abcdef";
  const joined = await A().api("POST", `/api/public/sessions/${code}/join`, { name: "Ana Reyes", deviceId });
  assert.equal(joined.status, 201, JSON.stringify(joined.data));
  const responseId = joined.data.responseId || joined.data.response?.id || joined.data.id;
  // Importing a form assigns fresh question ids, so answer by the id the form actually has.
  const stored = (await A().api("GET", `/api/forms/${formId}`)).data;
  const submit = await A().api("POST", `/api/public/responses/${responseId}/submit`, { deviceId, answers: { [stored.questions[0].id]: 1 } });
  assert.equal(submit.status, 200, JSON.stringify(submit.data));

  const sync = await A().api("POST", "/api/cloud/sync");
  assert.equal(sync.status, 200, JSON.stringify(sync.data));
  assert.ok(sync.data.uploaded >= 1, JSON.stringify(sync.data));
  assert.deepEqual(sync.data.rejected, []);
  assert.ok([...google.files.values()].some((f) => f.name.startsWith(`resp-${remoteFormId}-`)));

  const status = await A().api("GET", "/api/cloud/sync/status");
  assert.equal(status.data.pendingCount, 0);
  assert.equal(status.data.failedCount, 0);
});

let importedLocalId;
test("a second device signs in to the same account, lists the form and imports it with its responses", async () => {
  const signedIn = await B().signIn("good-code");
  assert.equal(signedIn.callback.status, 200);

  const list = await B().api("GET", "/api/cloud/forms");
  assert.equal(list.status, 200, JSON.stringify(list.data));
  assert.ok(list.data.some((f) => f.id === remoteFormId && f.title === "Math quiz"));

  const imported = await B().api("POST", `/api/cloud/forms/${remoteFormId}/import`, {});
  assert.ok([200, 201].includes(imported.status), JSON.stringify(imported.data));
  importedLocalId = imported.data.id;
  assert.equal(imported.data.title, "Math quiz");
  assert.equal(imported.data.questions[0].title, "2+2?");

  const responses = await B().api("GET", `/api/forms/${importedLocalId}/responses`);
  assert.equal(responses.status, 200, JSON.stringify(responses.data));
  const names = JSON.stringify(responses.data);
  assert.match(names, /Ana Reyes/, "the response collected on device A should arrive on device B");
});

test("publishing again adds a version, and the other device can pull it", async () => {
  const local = (await A().api("GET", "/api/forms")).data.find((f) => f.title === "Math quiz");
  const full = (await A().api("GET", `/api/forms/${local.id}`)).data;
  const edit = await A().api("PUT", `/api/forms/${local.id}`, { title: "Math quiz (edited)", description: "d", settings: full.settings, questions: full.questions });
  assert.equal(edit.status, 200, JSON.stringify(edit.data));
  const publish = await A().api("POST", `/api/cloud/forms/${local.id}/publish`);
  assert.equal(publish.status, 200);
  assert.equal(publish.data.remoteVersion, 2);

  const pulled = await B().api("POST", `/api/cloud/forms/${remoteFormId}/import`, {});
  assert.equal(pulled.status, 200, JSON.stringify(pulled.data));
  assert.equal(pulled.data.title, "Math quiz (edited)");
});

test("signing out revokes the token; the other device is then signed out cleanly instead of looping", async () => {
  const out = await A().api("POST", "/api/cloud/auth/logout");
  assert.equal(out.status, 204);
  assert.equal(google.stats.revokes, 1);
  assert.equal((await A().api("GET", "/api/cloud/auth/status")).data.connected, false);

  // Device B's access token is already expired (the fake issues 1-second tokens), so its next call
  // refreshes, Google says invalid_grant, and B is signed out with a clear message.
  await new Promise((r) => setTimeout(r, 1200));
  const res = await B().api("GET", "/api/cloud/forms");
  assert.ok(res.status >= 400, "should fail rather than succeed");
  assert.match(JSON.stringify(res.data), /sign in again/i);
  assert.equal((await B().api("GET", "/api/cloud/auth/status")).data.connected, false);

  // The user's data is untouched by signing out.
  assert.ok([...google.files.values()].some((f) => f.name === `form-${remoteFormId}.json`));
});

test("cloud endpoints refuse unauthenticated callers", async () => {
  const res = await fetch(`${A().origin}/api/cloud/forms`, { headers: { Origin: A().origin } });
  assert.ok([401, 403].includes(res.status), `got ${res.status}`);
});
