# SelfHost Form — React Native migration plan

Status: all stages complete for web + Electron. Native Android/iOS is not verified (see Limitations).

## 1. Audit findings (verified against the repo)

**Runtime topology**
- `server/` — Express 5 + `node:sqlite`, one process on port 5174. Serves `/api/*` and the built `dist/` (SPA fallback). Needs Node >= 22.5.
- `electron/main.js` — spawns `server/index.js`, waits for `/api/health`, then loads `http://localhost:5174` in a frameless window. Window controls go through `electron/preload.cjs` (IPC) and are drawn by `src/components/TitleBar`.
- `cloud-server/` — optional Postgres + Google OAuth service. The local server proxies to it (`server/cloud/*`). Google tokens stay server-side; the frontend never sees them. The OAuth flow opens in the OS browser via `window.open` -> `shell.openExternal`.
- Frontend: React 19 + Vite 8, React Router 7, Zustand 5, plain CSS (about 8k lines), JavaScript (no TypeScript). Dev server uses HTTPS via mkcert and proxies `/api` to 5174.

**Constraints that shape the migration**
1. **Auth is a same-origin cookie.** `requireSameOrigin` rejects cross-origin state-changing requests, and the CSP is `default-src 'self'`. The UI must stay served by the Express server (or proxied same-origin in dev). Native clients cannot use this as-is.
2. **API client is relative-path `fetch('/api/...')`** in `src/features/*/services/*.js`. These are pure JS with no DOM dependency, so they can be reused unchanged.
3. **Browser-only features in the respondent flow** (`src/features/responses`): fullscreen gate, refocus lock, copy protection, `visibilitychange`. These have no native equivalent and stay web-only (`.web.tsx` files). Students answer in a browser, so this matches the product.
4. **Exports** (`exportPdf`, `exportResponses`, `exportForm`) use jspdf, exceljs, jszip and Blob downloads. They are web/Electron only, so they stay behind a platform module.
5. **Electron's download handling** relies on `data:`/`blob:` URLs. Keep them working.
6. **No tests exist.** `npm run lint` (oxlint) passes with warnings only (about 9 warnings) and `npm run build` succeeds. Baseline recorded 2026-10-09.

**Reusable as-is:** `server/**`, `cloud-server/**`, `electron/**` (apart from the TitleBar contract), `store/*` (Zustand), `src/features/*/services|hooks|utils`, `src/lib/*` (question registry, matrix logic), `useAuthStore`/`useFormStore`.

**Must be rewritten (DOM/CSS to RN primitives):** everything under `src/pages`, `src/components`, and the `components/` and `pages/` folders of `src/features/*`.

## 2. Route inventory (from `src/App.jsx`)

| Route | Screen | Auth |
| --- | --- | --- |
| `/` | RolePage (host or respondent) | public |
| `/host/login`, `/host/recover`, setup | HostLogin / HostRecovery / HostSetup | public |
| `/respondent/login` | RespondentLogin | public |
| `/s/:code` | RespondForm (the exam taker) | public |
| `/dashboard` | DashboardHome | host |
| `/dashboard/sessions`, `/sessions/:id` | SessionsList, SessionDetail | host |
| `/dashboard/subjects`, `/subjects/:id` | Subjects, SubjectDetail | host |
| `/dashboard/forms` | FormsPage (plus TemplateGallery) | host |
| `/dashboard/export` | BulkExportPage | host |
| `/dashboard/settings` | SettingsPage (cloud, tunnel, network, account) | host |
| `/forms/:formId` | QuestionsPage (editor) | host |
| `/forms/:formId/responses` | AllResponsesPage | host |
| `/forms/:formId/settings` | Form SettingsPage | host |

## 3. Architecture decision

**Expo (SDK 57) + expo-router + react-native-web, TypeScript for new UI code, in this repo.**

- `expo export -p web` (single-page output) writes to `dist/`, so Express and Electron keep working unchanged, which is also why the `build` script still produces `dist/`.
- expo-router gives one file-based route tree for web and native, and deep links map to the existing URLs (`/s/:code`, `/forms/:id`).
- Shared logic (stores, API clients, registry) is kept in place and imported by the new UI. No backend rewrite.
- Platform splits use `.web.tsx` / `.native.tsx` only where behaviour truly differs (respondent integrity features, exports, window chrome).
- Styling: React Native `StyleSheet` driven by one token module (`src/design/tokens.ts`) with light/dark themes, so no CSS files and no per-screen magic numbers.
- Icons: `lucide-react-native` (SVG, no emoji), if compatible with the chosen RN-SVG version.
- Dev: Metro serves the web app. `/api` has to be same-origin, so dev uses a small proxy (decision in Stage 1). The old Vite app remains until the slice that replaces it ships. It is removed at the end, not kept as a parallel UI.

**Native scope (decided with the user):** Web + Electron first. The code is written native-ready (platform splits, configurable API base URL) but the backend is not changed. Android/iOS builds are not expected to work against the host until a token-auth path is added (documented as a later stage).

## 4. Stage checklist

- [x] 0. Audit, route inventory, constraints, baseline build/lint
- [x] 1. Scaffold Expo + expo-router + RN-Web; dev proxy; `expo export` into `dist/`; verify Express and Electron serve it
- [x] 2. Design tokens, theme, core components (Button, Input, Select, Checkbox/Radio/Switch, Dialog/Sheet, Menu, Tabs, Toast, EmptyState, Skeleton, Table/List)
- [x] 3. App shell and navigation (desktop sidebar, mobile bottom tabs), TitleBar contract for Electron
- [x] 4. Auth and entry: Role, HostSetup, HostLogin, HostRecovery, RespondentLogin
- [x] 5. Dashboard home, forms list, subjects, templates
- [x] 6. Form editor (questions, sections, settings) and preview
- [x] 7. Respondent flow (`/s/:code`), including web-only integrity features
- [x] 8. Sessions, responses, analytics, exports
- [x] 9. Settings: cloud account, Google import, tunnel, sync states
- [x] 10. Remove the legacy Vite UI, update scripts/README, final QA at 360/390/768/1024/1440

Each stage ends with: build passes, screenshots inspected at the target widths, console/network checked, one visual refinement pass.

## 5. Baseline (before changes)

- `npm run build`: passes (Vite 8).
- `npm run lint`: passes with warnings (react-hooks style: set-state-in-effect, only-export-components).
- Tests: none exist.
- App launched through `server/index.js` against an isolated `DATA_DIR` (not the project's `server/data`). The landing page renders.

## 6. Outcome (2026-10-09)

**Done:** Expo + expo-router + React Native Web UI replaces the Vite/React DOM UI. `npm run build` exports to `dist/`, served by the unchanged Express server and loaded by Electron. Backend, database and API contracts are unchanged. 34 shared JS modules remain in `src/` (API clients, data hooks, grading/export utilities).

**Design:** dark-first, modelled on walbi.com and its app (near-black canvas, hairline-bordered panels, one blue accent, dense sans-serif). Light and system themes under Settings > Appearance. All values live in `ui/tokens.ts`.

**Verified in a browser (isolated QA database, not the project data):** first-run setup and login; dashboard; forms list, create, template gallery; folders; form editor with all 11 question types; preview; save; session create/start/end; respondent join, answer, submit, score; session detail with respondent dialog; responses screen; bulk export matrix; settings; layouts at 1440, 1024, 768, 390 and 360 px (no horizontal overflow on the routes checked at 360); keyboard tab order, Escape and Enter in dialogs and forms.

**Automated:** `npm run typecheck` clean; `npm test` 11 passing (logic only); `npm run lint` warnings only; `npm run build` passes. There were no tests before this work.

**Not verified:** Android and iOS; Electron window (`npm run desktop`, `npm run dist`); Google sign-in, cloud import and Google sync (no cloud server was configured); Remote Access tunnel; actual Excel/PDF download output; the respondent fullscreen gate, refocus lock and copy protection against real browser behavior; file upload questions; the 1024 px layout after the final restyle.

**Limitations / decisions**
- Native needs a configurable server URL and token auth (the server only accepts same-origin cookies).
- Excel/PDF exports, file downloads and the respondent PDF are web/Electron only.
- Dropped: the "Auto-save drafts" toggle (it never did anything) and per-response printing.
- Drag-and-drop question reordering was not rebuilt; question order uses move up/down.
- Tablet icon rail has no hover tooltips.
- `npm approve-scripts` may be needed for the cloudflared and Electron install scripts on new npm versions.
