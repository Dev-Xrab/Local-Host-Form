# Self-Host Form controlled security assessment

Date: 2026-11-13. Scope: this repository and isolated localhost instances with synthetic data. This is a bounded assessment, not a claim of complete penetration-test coverage. Existing workspace changes were preserved. No external tools were installed and no production, cloud, or classroom service was probed.

## Executive verdict

One confirmed assessment-integrity flaw was remediated: the API accepted answers for 30 seconds after a server deadline or host stop. A new isolated API regression test passes. Release should remain gated on a full security pass of the mobile and cloud runtimes, and on triage of dependency advisories. Plain HTTP on the classroom LAN leaves host cookies, respondent device identifiers, answers, and grades exposed to a network observer.

Severity breakdown: 1 confirmed medium finding, fixed; 1 high residual architectural risk; 1 unverified dependency advisory group (4 high, 8 moderate package records). No critical issue was confirmed in this pass.

## Threat model and boundaries

| Attacker | Reachable surface | Boundary/control | Impact if breached |
| --- | --- | --- | --- |
| Unauthenticated LAN user/device | Static UI, health, public session and response routes, host login | Host cookie and per-route public checks; rate limits | Enumeration, response tampering, password attack |
| Malicious student or limited respondent | Session code, join, owned response, submit/edit | Device ID as a bearer-like secret; edit code for cross-device editing | Grade changes or another student's data |
| Compromised respondent browser | Same public API plus any locally stored identifier | Browser storage and server ownership checks | Its own response; other responses if secrets stolen |
| Malicious form creator / authenticated host | Form definitions, import/export, gradebook, cloud actions | Single owner role; input validation and CSP | Answer-key disclosure, stored content attacks, data loss |
| Compromised Electron renderer | Local web API and narrow preload window controls | Sandbox, context isolation, Node disabled, main-frame IPC check | Host data/actions via authenticated web session; possible OS escalation if Electron boundary fails |
| Attacker with app files | SQLite and config/token material | OS file permissions and token encryption where available | Offline grade or secret tampering |

There is one host role, not separate administrator/teacher roles. A LAN host with the password has broad form and gradebook access. Respondents have no account; a device identifier is their response credential. That identifier can be copied by a compromised browser or observed over HTTP.

## Attack surface inventory

- Local server: `server/index.js` listens on `0.0.0.0`; API and static UI share a port. `/api/health` and `/api/public/ping` are open.
- Public API: `GET /api/public/sessions/:code`; `POST /api/public/sessions/:code/join`; `GET /api/public/responses/:id`; `POST /api/public/responses/:id/{edit,refocus-lock,submit}`. Response routes require the matching device ID; join also accepts an edit code for a permitted cross-device edit.
- Host authentication: `/api/auth/{setup,login,logout,me,change-password,recovery-question,recover-password}`. Setup and recovery are local-console restricted; login is LAN reachable and rate limited. Host resources require a valid cookie or bearer token. State-changing host routes use origin/fetch-metadata checks.
- Host resources: `/api/forms` CRUD/import and nested sessions/responses; `/api/sessions` CRUD, start/end/reopen, settings, respondent detail/export; `/api/subjects`, `/api/roster`, `/api/maintenance`; `/api/cloud`, `/api/google-forms`, `/api/tunnel`. See the route modules under `server/` for individual operations. The cloud OAuth start/callback endpoints are intentionally unauthenticated and use a flow store.
- Separate `cloud-server/` contains auth, forms, sync, and Google Forms APIs. `mobile-server/` shares the Express app but has a separate launcher. These were source-mapped, not dynamically attacked in this pass.
- Electron: `electron/main.js` starts the local server; preload exposes window minimize/maximize/close/status only. Main and splash windows set `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`. Navigation and external URLs are filtered in main. IPC checks the main frame.
- Storage/integrations: SQLite through `server/db` and repository modules; app user-data directory; Google OAuth/Drive/Forms and optional Cloudflare tunnel. Form import/export and inline image/file data are high-input surfaces.

### Authorization matrix

| Resource/action | Anonymous LAN | Respondent with session code | Respondent with matching device ID/edit code | Authenticated host | Remote tunnel |
| --- | --- | --- | --- | --- | --- |
| Health, public ping, session summary | Allow | Allow | Allow | Allow | Allow |
| Join active session | Allow with valid code/name/device ID | Allow | Allow | Allow | Allow |
| Read/submit own response | Deny without identifier | Deny without identifier | Allow subject to status/deadline | Public route uses identifier | Allow with identifier |
| Forms, gradebook, roster, sessions management | Deny | Deny | Deny | Allow | Deny through host guard |
| Host login | Allow on LAN, rate limited | Allow on LAN | Allow on LAN | Allow | Deny |
| Owner setup/password recovery | Local console only | Deny | Deny | Local console for recovery | Deny |

## Findings

### PT-01 — Submission accepted after cutoff (confirmed, remediated)

- Severity: Medium; CWE-841 (improper enforcement of behavioral workflow), CWE-863 (incorrect authorization); estimated CVSS 6.5 (network, low complexity, low privilege, integrity impact). The score is an estimate, not a formal CVSS assessment.
- Affected: `server/public/routes.js`, `canStillSubmit` and public submit route.
- Preconditions: student has joined a timed session or host ends an active session; student retains response ID and device ID.
- Root cause/evidence: prior code allowed `Date.now() - deadline < 30_000` and similarly allowed 30 seconds after `endedAt`. A direct POST could therefore submit a new answer after the authoritative cutoff, regardless of UI state.
- Impact: late answer changes and unfair grading.
- Fix: reject immediately once server time reaches the deadline or the session is ended; reject malformed stored deadlines. The new API test submits with `timedOut: true` after a short deadline and after host end; both receive HTTP 400.
- Regression: `node --test tests/server/securityIntegrity.test.mjs` passes. Recheck late submissions in desktop and mobile UX because a delayed auto-submit can now fail visibly.
- Verification: fixed in isolated Node server; mobile build/runtime not retested.

### PT-02 — Plain HTTP LAN credential and answer exposure (architectural risk, unremediated)

- Severity: High where the classroom network is untrusted; CWE-319; CVSS not assigned because exploitability depends on network placement.
- Affected: `server/index.js`, session cookie and public device-ID traffic.
- Preconditions: attacker can observe or alter traffic on the same path (for example a hostile access point or LAN position).
- Root cause/evidence: listener serves HTTP on all interfaces; cookies omit `Secure` to support HTTP. The respondent identifier is sent in requests and operates as a response credential. This was established by source inspection, not packet capture.
- Impact: stolen host session or respondent identifier, answer/grade disclosure or tampering.
- Remediation: provide authenticated HTTPS for LAN use or explicitly constrain deployment to a trusted, isolated network; use short-lived respondent credentials bound to a server session. Test with a controlled network capture before claiming transport protection.
- Regression/verification: no dynamic MITM test performed; risk remains.

### PT-03 — Dependency advisories require triage (scanner finding, unverified exploitability)

- Severity: 4 high and 8 moderate npm package records; CWE varies by advisory.
- Affected: lockfile dependency tree, notably `decode-uri-component`, `query-string`, `brace-expansion`, `minimatch` and dependents including Expo and electron-builder.
- Evidence: `npm audit --json` returned 12 records and nonzero exit status on 2026-11-13. Some are build-tool or transitive advisories; this does not prove a reachable app exploit.
- Impact/remediation: assess reachability in shipped web/Electron/mobile bundles, then update compatible package versions and rerun the audit and functional tests. Avoid blind major downgrades suggested by npm.
- Verification: advisory presence confirmed; runtime exploitability untested.

## Controlled checks and limits

The new test confirms host form listing rejects anonymous access (401), joined form omits `correctAnswerIndex` and `correctAnswers`, a different device ID cannot read or submit a response (403), and server deadlines/host end reject submission (400). Existing snapshot test covers pinned historical grade definitions. Server scoring and duplicate-submit SQL guards were reviewed but not independently stress tested. Session code entropy, brute-force resistance, edit-code collision/guessing, XSS payloads, CSRF across browser origins, import parsing, file uploads, SSRF, race/load limits, Electron packaged binary, Android runtime, cloud server, and tunnel routing still need targeted dynamic tests. Semgrep, Gitleaks, ZAP and Playwright were not present as installed commands; no installation was attempted under the rules of engagement.

## Follow-up remediation (2026-11-13)

The Node/Electron host now supports opt-in LAN HTTPS. With `SHF_TLS_CERT` and `SHF_TLS_KEY`, HTTP binds only to loopback, the LAN listener uses HTTPS, generated share links use its port, and HTTPS auth cookies are `Secure`. Setup and trust requirements are in `docs/security/LAN_HTTPS.md`. This does not secure the phone-host runtime or installations left in HTTP mode. Respondent response reads now carry the device identifier in a request header instead of the URL; this reduces URL/history/log leakage, but TLS remains necessary to protect it on the wire. `npm audit --omit=dev` reports zero advisories; the 12 records in the full audit are in development/build dependencies and still need build-pipeline triage.

Post-change checks: 54 Node server tests, 13 logic tests, TypeScript type checking, web build, and the phone runtime harness (51 checks) passed. An ephemeral self-signed test certificate was used only for local validation: HTTPS `/api/health` returned 200, and the HTTP listener was observed on `127.0.0.1` only. Certificate trust and deployment on actual student devices have not been verified.

## Release recommendation

Do not treat this as full release clearance. Complete the untested areas above, prioritize transport protection and dependency triage, and run the full existing suite plus desktop/mobile workflow checks after the deadline change. The confirmed late-submit issue is fixed in the local server and has a passing negative regression test.
