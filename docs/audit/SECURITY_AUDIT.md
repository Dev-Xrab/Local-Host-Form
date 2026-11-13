# Security audit — 2026-11-13

Baseline: [OWASP ASVS 5.0.0](https://asvs.owasp.org/downloads/) Level 2 where applicable, and the [Electron security checklist](https://www.electronjs.org/docs/latest/tutorial/security/). This is a partial review, not certification.

## Threat model

An untrusted respondent on the LAN or public tunnel can send arbitrary HTTP requests, choose any client-side clock/device ID, and upload allowed data. A compromised renderer can call exposed Electron APIs. A local user can inspect the SQLite file. Google Drive and Forms are external systems that may be unavailable or return unexpected data. The most important assets are host credentials, student identities, answers, grades and OAuth tokens.

## Verified controls and findings

- Host routes use `requireAuth`; setup and recovery are local-console restricted; login and public join/submit routes are rate limited (`server/createApp.js`, `server/auth/routes.js`, `server/security/rateLimits.js`). Native bearer tokens and browser cookies use the same server-side session validation. No credential was printed or tested against a real account.
- Respondent routes strip answer keys before join and require matching device ID for view/submit; edit codes are separate from shared join codes (`server/public/routes.js`). The device ID is a bearer-like secret stored in the browser; physical/shared browser access is a limitation.
- JSON size limits, data-URI signatures, CSP, `nosniff` and a same-origin mutation check exist (`server/createApp.js`, `server/security/uploads.js`, `server/security/network.js`). The forged early-timeout route was remediated and tested. Full XSS, CSRF, injection and ASVS control-by-control testing remains open.
- Electron enables isolation and sandbox, disables Node integration and webviews, restricts navigation and permissions, and limits external protocols (`electron/main.js`). IPC handlers now check the main window and frame, but a packaged runtime test remains open (AUD-04). Remote HTTP question images are allowed by CSP; privacy implications need review.
- LAN HTTP has no transport confidentiality (AUD-02). A tunnel adds internet exposure for respondent paths; tunnel attribution relies on Cloudflare headers and local proxy behavior. This was code-reviewed only.
- SQLite uses prepared statements and foreign keys. Auth sessions and encrypted Google tokens are persisted locally. A file-permission, backup encryption and restore review remains open.
- Dependency scan after lockfile refresh: `npm audit --omit=dev` reports zero advisories. A full-tree audit still reports development/build-tool advisories; no `--force` upgrade was applied.

## Privacy

Student names, responses and grades are stored on the host and may be exported or synced to the teacher's Google account if enabled. The host must define access, retention and backup practices. The [Philippine Data Privacy Act of 2012](https://privacy.gov.ph/data-privacy-act/) may apply; this technical review does not establish legal compliance.
