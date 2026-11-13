import test from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import { Device } from "./helpers.mjs";
import { setSessionCookie, clearSessionCookie } from "../../server/auth/cookies.js";

test("HTTPS auth cookies carry Secure on issue and clear", () => {
  const headers = {};
  const response = { setHeader: (name, value) => { headers[name] = value; } };
  setSessionCookie(response, "synthetic-token", new Date("2030-01-01T00:00:00Z"), true);
  assert.match(headers["Set-Cookie"], /; Secure(?:;|$)/);
  clearSessionCookie(response, true);
  assert.match(headers["Set-Cookie"], /; Secure(?:;|$)/);
});

const port = await new Promise((resolve) => {
  const server = net.createServer();
  server.listen(0, "127.0.0.1", () => {
    const selected = server.address().port;
    server.close(() => resolve(selected));
  });
});

test("respondent boundaries and server deadlines", async (t) => {
  const device = new Device(port);
  t.after(() => device.stop());
  await device.ready();
  assert.equal((await device.api("GET", "/api/forms")).status, 401);
  assert.equal((await device.api("POST", "/api/auth/setup", { password: "synthetic-security-password" })).status, 200);
  const form = await device.api("POST", "/api/forms", { title: "Security quiz" });
  assert.equal(form.status, 201);
  const question = { id: "q1", type: "multiple_choice", title: "Pick B", required: true,
    options: ["A", "B"], correctAnswerIndex: [1], correctAnswers: [], points: 2, rows: [], scale: {} };
  assert.equal((await device.api("PUT", `/api/forms/${form.data.id}`, { questions: [question] })).status, 200);
  const session = await device.api("POST", "/api/sessions", { formId: form.data.id, durationMinutes: 0.001 });
  assert.equal(session.status, 201);
  await device.api("POST", `/api/sessions/${session.data.id}/start`);
  const joined = await device.api("POST", `/api/public/sessions/${session.data.code}/join`,
    { name: "Synthetic student", deviceId: "security-device-123" });
  assert.equal(joined.status, 201);
  assert.equal(JSON.stringify(joined.data.form).includes("correctAnswerIndex"), false);
  assert.equal(JSON.stringify(joined.data.form).includes("correctAnswers"), false);
  const id = joined.data.responseId;
  assert.equal((await device.api("GET", `/api/public/responses/${id}?deviceId=security-device-123`)).status, 403);
  assert.equal((await device.api("GET", `/api/public/responses/${id}`, undefined,
    { headers: { "X-Respondent-Device-Id": "other-device-123" } })).status, 403);
  assert.equal((await device.api("POST", `/api/public/responses/${id}/submit`,
    { deviceId: "other-device-123", answers: { q1: 1 } })).status, 403);
  await new Promise((resolve) => setTimeout(resolve, 100));
  const late = await device.api("POST", `/api/public/responses/${id}/submit`,
    { deviceId: "security-device-123", answers: { q1: 1 }, timedOut: true });
  assert.equal(late.status, 400);
  assert.equal((await device.api("GET", `/api/public/responses/${id}`, undefined,
    { headers: { "X-Respondent-Device-Id": "security-device-123" } })).data.status, "in_progress");

  const untimed = await device.api("POST", "/api/sessions", { formId: form.data.id });
  await device.api("POST", `/api/sessions/${untimed.data.id}/start`);
  const second = await device.api("POST", `/api/public/sessions/${untimed.data.code}/join`,
    { name: "Second student", deviceId: "security-device-456" });
  await device.api("POST", `/api/sessions/${untimed.data.id}/end`);
  assert.equal((await device.api("POST", `/api/public/responses/${second.data.responseId}/submit`,
    { deviceId: "security-device-456", answers: { q1: 1 }, timedOut: true })).status, 400);
});
