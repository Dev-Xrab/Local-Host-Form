// End-to-end API smoke test: auth, folders, forms, import, sessions, respondent journey, grading,
// roster and the cross-site guard. Run it against any running server: SMOKE_BASE=http://localhost:5174
// Cleans up everything it creates.

const password = process.env.SMOKE_PASSWORD || "phone-runtime-test-password";
const BASE = process.env.SMOKE_BASE || "http://localhost:5190";
let cookie = "";
const results = [];
const ok = (name, pass, detail = "") => { results.push({ name, pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`); };

async function call(method, url, body, { base = BASE, auth = true, headers = {} } = {}) {
  const res = await fetch(base + url, {
    method,
    headers: { "Content-Type": "application/json", ...(auth && cookie ? { Cookie: cookie } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const set = res.headers.get("set-cookie");
  if (set && auth && base === BASE) cookie = set.split(";")[0];
  let json = null;
  try { json = await res.json(); } catch { /* no body */ }
  return { status: res.status, json };
}

const q = (id, type, title, extra = {}) => ({ id, type, title, description: "", showDescription: false, showImage: false, required: false, options: [], rows: [], scale: { min: 1, max: 5, minLabel: "", maxLabel: "" }, imageUrl: null, correctAnswerIndex: [], correctAnswers: [], points: 1, ...extra });

// ---- auth
let r = await call("GET", "/api/auth/me");
if (r.json?.needsSetup) { r = await call("POST", "/api/auth/setup", { password }); console.log("INFO  first-run setup", r.status); }
r = await call("POST", "/api/auth/login", { password });
ok("host login", r.status === 200);
r = await call("GET", "/api/auth/me");
ok("session cookie authenticates", r.json?.authenticated === true);
r = await call("GET", "/api/forms", undefined, { auth: false });
ok("host API rejects unauthenticated requests", r.status === 401);
r = await call("POST", "/api/auth/login", { password: "wrong-password-xyz" });
ok("wrong password rejected", r.status === 401 || r.status === 400 || r.status === 429, `status ${r.status}`);
await call("POST", "/api/auth/login", { password });

// ---- network info
r = await call("GET", "/api/network-info");
ok("network info lists LAN addresses", Array.isArray(r.json?.addresses), JSON.stringify(r.json?.addresses?.[0] ?? null));

// ---- folders
r = await call("POST", "/api/subjects", { name: "Smoke Folder", code: "SM1" });
const subj = r.json;
ok("create folder", r.status === 201 || r.status === 200, `status ${r.status}`);
r = await call("PUT", `/api/subjects/${subj.id}`, { name: "Smoke Folder 2", code: "SM2" });
ok("rename folder", r.json?.name === "Smoke Folder 2");

// ---- forms: create, update, export/import round trip, grading
r = await call("POST", "/api/forms", { title: "Smoke Quiz", description: "d", subjectId: subj.id });
const form = r.json;
ok("create form in folder", !!form?.id && form.subjectId === subj.id);
const questions = [
  q("q1", "multiple_choice", "2+2?", { options: ["3", "4"], correctAnswerIndex: [1], required: true, points: 2 }),
  q("q2", "short_answer", "Capital of France?", { correctAnswers: ["Paris"], points: 3 }),
  q("q3", "checkboxes", "Primes", { options: ["2", "4", "5"], correctAnswerIndex: [0, 2], points: 2 }),
  q("q4", "linear_scale", "Confidence"),
];
r = await call("PUT", `/api/forms/${form.id}`, { title: "Smoke Quiz", description: "d", bannerImage: null, settings: { showScoreImmediately: true, revealCorrectAnswers: true }, questions, subjectId: subj.id });
ok("save questions", r.status === 200, `status ${r.status}`);
r = await call("GET", `/api/forms/${form.id}`);
ok("form reloads with 4 questions", r.json?.questions?.length === 4);
const exported = r.json;
r = await call("POST", "/api/forms/import", { title: exported.title + " (copy)", description: "", settings: exported.settings, questions: exported.questions, subjectId: subj.id });
ok("import form from exported JSON", r.status === 201 || r.status === 200, `status ${r.status}`);
const copyId = r.json?.id;
r = await call("GET", "/api/forms");
ok("forms list includes both", r.json?.filter((f) => f.subjectId === subj.id).length === 2);

// ---- sessions + respondent flow + grading
r = await call("POST", "/api/sessions", { name: "Smoke Session", formId: form.id, durationMinutes: null, responsesEditable: true, fullscreenEnabled: false, refocusLockSeconds: null });
const sess = r.json;
ok("create session", !!sess?.code, `code ${sess?.code}`);
r = await call("GET", `/api/public/sessions/${sess.code}`, undefined, { auth: false });
ok("public session lookup while draft reports draft", r.json?.status === "draft");
r = await call("POST", `/api/sessions/${sess.id}/start`);
ok("start session", r.json?.status === "active");
const deviceId = "smoke-device-" + Date.now();
r = await call("POST", `/api/public/sessions/${sess.code}/join`, { name: "Smoke Student", deviceId }, { auth: false });
const joined = r.json;
ok("respondent joins (no host cookie)", !!joined?.responseId);
r = await call("POST", `/api/public/responses/${joined.responseId}/submit`, { answers: { q1: 1, q2: "paris", q3: [0, 2], q4: 4 }, timedOut: false, deviceId }, { auth: false });
ok("submit and auto-grade", r.json?.score === 7 && r.json?.maxScore === 7, `score ${r.json?.score}/${r.json?.maxScore}`);
const editCode = r.json?.editCode;
ok("edit code issued (editable session)", !!editCode);
r = await call("POST", `/api/public/responses/${joined.responseId}/submit`, { answers: {}, deviceId }, { auth: false });
ok("resubmitting is refused", r.status >= 400, `status ${r.status}`);
r = await call("GET", `/api/sessions/${sess.id}/respondents`);
ok("host sees respondent", r.json?.length === 1 && r.json[0].status === "submitted");
r = await call("GET", `/api/forms/${form.id}/responses`);
ok("form responses endpoint returns breakdown", r.json?.[0]?.breakdown?.length === 4);
r = await call("GET", `/api/sessions/${sess.id}/export`);
ok("session export payload", r.status === 200);
r = await call("POST", `/api/sessions/${sess.id}/end`);
ok("end session", r.json?.status === "ended");
r = await call("POST", `/api/public/sessions/${sess.code}/join`, { name: "Late", deviceId: "late-" + Date.now() }, { auth: false });
ok("joining an ended session is refused", r.status >= 400, `status ${r.status}`);

// ---- roster
r = await call("POST", "/api/roster", { name: "Smoke Student", studentId: "1", email: "" });
const stu = r.json;
ok("roster add", !!stu?.id);
r = await call("PUT", `/api/roster/${stu.id}`, { name: "Smoke Student", studentId: "2", email: "s@x.edu" });
ok("roster update", r.status === 200);

// ---- security header / same-origin guard
r = await call("POST", "/api/subjects", { name: "x" }, { headers: { Origin: "http://evil.example", "Sec-Fetch-Site": "cross-site" } });
ok("cross-site state-changing request blocked", r.status === 403, `status ${r.status}`);

// ---- cloud / tunnel status endpoints reachable
r = await call("GET", "/api/cloud/auth/status");
console.log("INFO  cloud auth status:", r.status, JSON.stringify(r.json));
r = await call("GET", "/api/tunnel/status");
ok("tunnel status endpoint", r.status === 200, JSON.stringify(r.json));

// ---- cleanup
await call("DELETE", `/api/sessions/${sess.id}`);
await call("DELETE", `/api/forms/${form.id}`);
if (copyId) await call("DELETE", `/api/forms/${copyId}`);
await call("DELETE", `/api/roster/${stu.id}`);
r = await call("DELETE", `/api/subjects/${subj.id}?forms=delete`);
ok("cleanup (folder + contents deleted)", r.status === 200 || r.status === 204, `status ${r.status}`);

const failed = results.filter((x) => !x.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
