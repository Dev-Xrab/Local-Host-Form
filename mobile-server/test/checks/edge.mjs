// Edge cases for the phone HTTP stack: large and malformed bodies, protocol abuse, bearer auth,
// security headers and rate limiting. Locks the client out at the end (by design), so run it last.
import net from "node:net";

const password = process.env.SMOKE_PASSWORD || "phone-runtime-test-password";
const BASE = process.env.SMOKE_BASE || "http://localhost:5191";
const { hostname, port } = new URL(BASE);
let pass = 0, fail = 0;
const ok = (name, cond, detail = "") => { cond ? pass++ : fail++; console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`); };

/** Raw TCP request so we control every byte (what a hostile or odd client sends). */
function raw(bytes, { wait = 1500 } = {}) {
  return new Promise((resolve) => {
    const chunks = [];
    const s = net.connect(Number(port), hostname, () => { for (const b of [].concat(bytes)) s.write(b); });
    s.on("data", (d) => chunks.push(d));
    s.on("close", () => resolve(Buffer.concat(chunks).toString("latin1")));
    s.on("error", () => resolve(Buffer.concat(chunks).toString("latin1")));
    setTimeout(() => s.destroy(), wait);
  });
}
const status = (r) => Number((/^HTTP\/1\.1 (\d+)/.exec(r) || [])[1] || 0);

// --- auth via bearer (the native-app path)
let r = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json", "X-Auth-Mode": "bearer" }, body: JSON.stringify({ password }) });
const login = await r.json();
ok("bearer login returns a token in the body", typeof login.token === "string" && login.token.length > 20);
const auth = { Authorization: `Bearer ${login.token}`, "Content-Type": "application/json" };
r = await fetch(`${BASE}/api/auth/me`, { headers: auth });
ok("bearer token authenticates (no cookie jar needed)", (await r.json()).authenticated === true);
r = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
ok("browser login sets an HttpOnly cookie and hides the token", /HttpOnly/i.test(r.headers.get("set-cookie") || "") && (await r.json()).token === undefined);

// --- headers
r = await fetch(`${BASE}/api/health`);
ok("CSP header present", /default-src 'self'/.test(r.headers.get("content-security-policy") || ""));
ok("nosniff + no-store", r.headers.get("x-content-type-options") === "nosniff" && r.headers.get("cache-control") === "no-store");
ok("JSON content type", /application\/json/.test(r.headers.get("content-type")));
r = await fetch(`${BASE}/api/health`, { method: "HEAD" });
ok("HEAD returns headers and no body", r.status === 200 && (await r.text()) === "");
r = await fetch(`${BASE}/api/health/`);
ok("trailing slash tolerated", r.status === 200);
r = await fetch(`${BASE}/api/does-not-exist`, { headers: auth });
ok("unknown API path is a clean JSON 404 (not a crash)", r.status === 404 && (await r.json()).error);

// --- bodies
const png = Buffer.concat([Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489", "hex"), Buffer.alloc(6 * 1024 * 1024)]);
const big = { title: "Big", description: "", settings: {}, questions: [{ id: "q1", type: "short_answer", title: "Has a 6 MB image", description: "", showImage: true, imageUrl: "data:image/png;base64," + png.toString("base64"), options: [], rows: [], scale: {}, correctAnswerIndex: [], correctAnswers: [], points: 1 }] };
const t0 = Date.now();
r = await fetch(`${BASE}/api/forms/import`, { method: "POST", headers: auth, body: JSON.stringify(big) });
ok("~8 MB JSON body (6 MB image) accepted on the large-body route", r.status === 201 || r.status === 200, `status ${r.status} in ${Date.now() - t0}ms`);
if (r.status < 300) { const f = await r.json(); await fetch(`${BASE}/api/forms/${f.id}`, { method: "DELETE", headers: auth }); }
r = await fetch(`${BASE}/api/subjects`, { method: "POST", headers: auth, body: JSON.stringify({ name: "y".repeat(400 * 1024) }) });
ok("body over the 256 KB default limit is refused with 413", r.status === 413, `status ${r.status}`);
r = await fetch(`${BASE}/api/subjects`, { method: "POST", headers: auth, body: "{not json" });
ok("malformed JSON is a 400, not a crash", r.status === 400, `status ${r.status}`);

// --- raw protocol abuse
let out = await raw("GARBAGE\r\n\r\n");
ok("garbage request line -> 400", status(out) === 400, `got ${status(out)}`);
out = await raw("GET /api/health HTTP/1.1\r\nHost: x\r\nX-Pad: " + "a".repeat(40 * 1024) + "\r\n\r\n");
ok("oversized headers -> 431", status(out) === 431, `got ${status(out)}`);
out = await raw("POST /api/subjects HTTP/1.1\r\nHost: x\r\nContent-Type: application/json\r\nContent-Length: 999999999\r\n\r\n");
ok("absurd Content-Length -> 413 before reading the body", status(out) === 413, `got ${status(out)}`);
out = await raw(["POST /api/public/sessions/NOPE/join HTTP/1.1\r\nHost: x\r\nContent-Type: application/json\r\nTransfer-Encoding: chunked\r\n\r\n", "10\r\n{\"name\":\"abcdefg\"}\r\n".slice(0, 0) + "11\r\n{\"name\":\"abcdefgh\"}\r\n0\r\n\r\n"]);
ok("chunked request body is decoded", [400, 404].includes(status(out)) && /\{/.test(out), `got ${status(out)}`);
out = await raw("POST /api/public/sessions/NOPE/join HTTP/1.1\r\nHost: x\r\nContent-Type: application/json\r\nContent-Length: 14\r\nExpect: 100-continue\r\n\r\n", { wait: 600 });
ok("Expect: 100-continue is answered", /^HTTP\/1\.1 100 Continue/.test(out));
// Body split across many tiny TCP writes, as a slow mobile network delivers it.
const payload = JSON.stringify({ name: "Slow Student", deviceId: "dev-slow" });
const parts = [`POST /api/public/sessions/NOPE/join HTTP/1.1\r\nHost: x\r\nContent-Type: application/json\r\nContent-Length: ${payload.length}\r\n\r\n`, ...payload.match(/.{1,5}/g)];
out = await raw(parts);
ok("request split into tiny packets still parses", status(out) === 404, `got ${status(out)}`);
out = await raw("GET /api/health HTTP/1.1\r\nHost: x\r\n", { wait: 400 });
ok("incomplete request does not crash the server", (await fetch(`${BASE}/api/health`)).status === 200);

// --- same-origin guard still keys off the real Host header
r = await fetch(`${BASE}/api/subjects`, { method: "POST", headers: { ...auth, Origin: "http://evil.example" }, body: JSON.stringify({ name: "z" }) });
ok("foreign Origin on a state-changing request is blocked", r.status === 403, `status ${r.status}`);

// --- rate limiting: 10 failed logins then locked (loginLimiter, keyed by client address)
let last = 0;
for (let i = 0; i < 14; i++) { last = (await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: "nope-" + i }) })).status; }
ok("repeated wrong passwords hit the rate limit (429)", last === 429, `final status ${last}`);

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
