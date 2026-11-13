# Project audit — 2026-11-13

## Scope and baseline

Repository branch `drive-sync` was clean before this audit. The source tree has about 366 files excluding generated output and dependencies. No `AGENTS.md` was found. Node on the audit machine was 26.13.0; `package.json` requires 22.5 or newer. Baseline: `npm run typecheck` passed; `npm run lint` exited 0 with warnings; `npm run test:drive` passed 51 tests; `npm test` failed because Vitest collected Node test files and imported React Native Flow; `npm run test:phone` passed 50 checks but failed on Windows cleanup; `npm run build` exported nine JavaScript bundles. A local built UI was opened on port 5199 against a separate synthetic data directory. No existing user database was opened for testing.

## Architecture and data flow

- `app/` Expo Router screens: landing page, host login/recovery, dashboard, forms, subjects, sessions, settings, respondent login and `/s/[code]` assessment. `components/` and `ui/` implement the workflows and design system; `src/features/` and `lib/` hold API wrappers and shared logic.
- `server/index.js` binds Express to all interfaces on port 5174 by default. `server/createApp.js` mounts public respondent routes separately from authenticated host routes. `server/db/index.js` initializes SQLite with additive column guards. Forms, sessions, responses, subjects and roster use repository modules.
- `electron/main.js` starts the local server with `DATA_DIR` under Electron `userData`, loads the local UI, and exposes four window actions through `electron/preload.cjs`.
- LAN respondents use the host IP, code and browser. A Cloudflare Quick Tunnel optionally exposes respondent routes on the internet. Device IDs in local storage and per-response edit codes control respondent access; host controls use an HttpOnly cookie or native bearer token.
- Google Drive app-data sync and Google Forms import live in `server/cloud/`, `server/oauth/` and `server/googleForms/`. `cloud-server/` is legacy according to README. `mobile-server/` adapts the local server to the experimental phone host runtime.

## Trust boundaries and initial findings

Untrusted inputs include host-browser requests, LAN and tunnel respondent requests, uploaded data URIs, imported forms, Google responses, and content later rendered in Electron. Host authentication, request limits, upload signature checks and a CSP exist. This audit closed the forged early-timeout bypass, removed the data-wiping packaging hook, and added immutable snapshots for new assessment sessions. Existing responses have no provable past definition. LAN transport remains plain HTTP. See `ISSUE_REGISTER.md` for evidence and status.

## Limits of this pass

This is a targeted engineering pass, not complete ASVS Level 2 certification. No classroom LAN, real Android/iOS device, real Google account, launched packaged app, crash/restart, accessibility tooling, load generator or cross-platform build was available for verification. An unpacked Windows artifact was built but launch was blocked by automatic tool approval. The release recommendation remains **do not release for high-stakes classroom use** until the blockers in `RELEASE_READINESS.md` are resolved and verified.
