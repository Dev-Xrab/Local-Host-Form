# Self-Host Form redesign plan

**Status:** Approved implementation applied. Final production validation remains pending for physical-device LAN, packaged desktop and assistive-technology checks. The product direction is a field-neutral, self-hosted form and assessment tool.  
**Audit date:** 18 November 2026  
**Basis:** Source review of routes, screens, components, stores, API handlers, platform adapters, package manifests and existing audit notes. This is a code-informed design audit; no packaged Electron app, physical phone, or assistive-technology session was exercised for the original plan.

## 1. Product and technical baseline

Self-Host Form is a field-neutral, local-first form and assessment tool. The host creates reusable forms on a desktop or web UI, runs timed or untimed sessions from a local Express server, and receives answers from respondent browsers over the LAN. A Cloudflare tunnel can optionally publish respondent links and allow protected remote administration. Google Drive sync and Google Forms import are optional online capabilities. The same Expo/React Native Web UI is loaded by Electron; Android phone hosting exists but is explicitly experimental.

| Layer | Current implementation | Redesign boundary |
| --- | --- | --- |
| Routing | `app/` with Expo Router: `/`, `/host/login`, `/host/recover`, `/respondent/login`, `/s/:code`, `/dashboard/*`, `/forms/:formId/*` | Preserve direct links and route behavior. Reorganize labels and layout without breaking URLs. |
| Host UI | `components/shell`, `components/forms`, `components/editor`, `components/sessions`, `components/export`, `components/settings`, `components/subjects` | Reuse workflow logic and change presentation incrementally. |
| Respondent UI | `components/respond` with join, answer, review, completion, and exam overlays | Treat as a focused assessment experience, separate from host chrome. |
| State and data | Zustand auth/form stores; feature hooks and API clients in `src/features`; typed wrappers in `lib/` | Preserve payload shapes and manual-save semantics until explicitly changed and tested. |
| Local service | Express 5, SQLite, `/api/*` in `server/createApp.js`; Electron starts the service with a user-data directory | Do not change storage, auth, route contracts, or LAN availability as part of visual work. |
| Platforms | Expo/React Native Web, Electron, native adapter in `mobile-server/` | No framework migration. Keep platform-specific capabilities and fallbacks. |
| Dependencies | React 19, React Native, Expo Router, Zustand, lucide, Express, SQLite, PDF/Excel/ZIP and QR helpers | No new UI framework, font CDN, icon pack, animation framework, or cloud service. |

`cloud-server/` is documented as legacy and not used by the current app. Its presence must not be mistaken for an active dependency. Existing uncommitted work in `package.json` and `scripts/release.mjs` predates this plan and must be left intact.

### Functionality inventory and preservation contract

- **Identity and first run:** role picker; local-only first-host claim with password; host login/logout; password change and local-only recovery question; optional remote admin with authenticator code; native connection to a desktop server or experimental host-on-phone path.
- **Forms:** blank creation; templates; JSON import/export; Drive import/publish; Google Forms import and change sync; folders; search; question and section duplication; banner and question images; sections; manual save, preview and form settings.
- **Question model:** short/paragraph text, multiple choice, checkboxes, dropdown, linear scale, date, time, file upload, single-choice matrix and checkbox matrix. Required state, answer keys where supported, points, row/column controls, image and description controls must survive.
- **Sessions:** create with form, name, timer and integrity options; draft/start/end/reopen/delete; join code, LAN/public links and QR; live respondent counts/status and remaining time; editable responses, fullscreen and refocus settings; immutable assessment snapshots for new sessions.
- **Results:** form-wide responses by respondent and by question; version-aware analytics, including legacy-definition labeling; session respondent detail, answers, attachment preview/download, score and ranking; participant matching; cross-session results matrix and response rate; Excel/PDF exports and form JSON backup.
- **Respondents:** code and direct-link entry, same-device resume, edit-code recovery when enabled, section paging, validation, timer, local draft restore, submission and completion, optional score/key disclosure and answer PDF on supported platforms; connection, fullscreen, refocus and copy restrictions.
- **Operations:** server/LAN address, optional tunnel, Google account and autosave, sync status/issues/retry/discard, theme choice, data clearing, local-only operation, web/native capability messaging.

The active API families are `/api/auth`, `/api/forms`, `/api/forms/:id/sessions`, `/api/forms/:id/responses`, `/api/sessions`, `/api/public`, `/api/subjects`, `/api/roster`, `/api/cloud`, `/api/google-forms`, `/api/tunnel`, `/api/activity`, `/api/maintenance`, and `/api/network-info`. Host requests use cookie or native bearer auth; public response endpoints use device ownership and edit-code checks. These boundaries are product constraints, not redesign targets.

## 2. Current experience audit

### Information architecture and navigation

The host sidebar originally exposed Dashboard, Sessions, Forms, Folders, Bulk export and Settings. The dashboard repeated every form, while Forms already owned that full list. “Bulk export” understated the participant list and cross-session results matrix inside it. Form results live under a form tab, whereas session results and a ranking live under session detail; users must understand those distinct scopes. “Folders” is a separate destination that organizes forms. On phones, primary destinations are tabs and the remainder are under More; on desktop, the editor replaces the host shell with a focused workspace.

The role picker and respondent login are separate from direct `/s/:code` joining. The direct link silently resumes and otherwise asks for a name; the respondent login asks for identifier and code first. Both paths must remain, but instructions, validation, and naming should converge.

### Visual system and interaction consistency

There is already a tokenized dark/light palette, spacing scale, basic typography, reusable controls, and responsive layouts in `ui/`. The current 13 px body, 11 px captions and 30 px controls make dense screens compact but raise readability and target-size concerns. The UI relies heavily on bordered `Surface` wrappers, including forms, session panels and export controls. Headers, sections, tables and settings rows are reused, yet workflow-specific page layouts and action placement differ. Several actions are icon-only or exposed through dialogs despite being primary tasks. Page-level `FadeIn` and auth transitions add motion without communicating state. The existing UI audit checked first-run screens and some token contrast only; it did **not** verify all controls, viewports or screen-reader behavior.

### Accessibility and usability findings to validate during implementation

1. `ui/Dialog.tsx` provides a modal, Escape and backdrop close, but does not explicitly manage initial focus, return focus, destructive-action lockout during pending requests, or a labeled dialog relationship. Audit keyboard and screen-reader behavior before changing its presentation.
2. The editor's outline uses button semantics and scrolls by DOM id; active state is local to clicks rather than the actual focused/visible question. Navigation can become misleading after editing or keyboard movement.
3. Host sidebar rows are 28 px high; small body/caption text and dense action rows merit a target-size and 200% zoom review. Keep visual density, but make hit areas usable.
4. Dashboard activity failure becomes an empty panel with a different title, while some other screens show retry notices; loading, empty, error and stale-data language is inconsistent.
5. Respondent drafts are saved in device storage and submitted to the server only at the end. A failed or ambiguous submit, local storage limits, timer expiry, and network recovery need explicit state wording and verification. The existing release audit identifies unacknowledged-answer loss as an open blocker; a visual redesign cannot claim it is solved.
6. Host “offline” can mean the internet is down while LAN hosting still works, or that the local server itself is unreachable. Current sync status and page errors cover pieces of this, but the global status language must distinguish them.
7. Question settings, session settings, account/security settings and connection settings use similar “Settings” labels at different scopes. Breadcrumbs and scope labels should prevent changes being applied in the wrong place.

### Redundancy and simplification opportunities

| Current pattern | Proposed treatment | Feature retained |
| --- | --- | --- |
| Dashboard lists every form and Forms lists every form | Dashboard shows a short recent list and live-session tasks; Forms remains the complete library | All forms remain reachable. |
| “Bulk export” holds participant matching, a cross-session matrix and export | Rename navigation to **Results matrix**; retain export as an action and preserve current URL `/dashboard/export` | Participant list, cross-session matrix and both export formats remain. |
| Folders as a separate primary destination | Keep the existing route; make folders a Forms sub-navigation/filter on desktop and a clear Forms entry on small screens | Create, rename, delete and move forms remain. |
| Multiple result entry points without scope cues | Use “Results for this form,” “Results for this session,” and “Results matrix across sessions” in headings and cross-links | Analytics, ranking and detailed answers remain. |
| Two join entry paths | Align copy, field labels, resume behavior and validation; keep both `/respondent/login` and `/s/:code` | Codes and share links remain valid. |
| Repeated save-to-cloud prompts after local save | Present local save and Drive sync as separate status/action states, subject to confirmation of existing publish behavior | Manual save and explicit publish remain. |

These are proposed presentation and navigation changes. No route or capability should be removed without separate approval.

## 3. Journey maps

### Host: first launch to first session

1. Open app → determine server availability and account state. Desktop hosts see a clear local-server status; native clients choose phone hosting or a server address where supported.
2. Select Host → claim unconfigured local server with a password → offer recovery-question setup as a visible next task, with a defer option and persistent reminder.
3. Arrive at a useful empty workspace: **Create form**, **Import form**, or **Start from template**. Explain that respondents join from the same network and that an internet connection is optional.
4. Create/open form → edit title, description, questions and answer keys → manual save status → preview as respondent → configure form-wide response/result settings.
5. Create session from that form or Sessions → set name, timer, edit/integrity controls → review a concise preflight summary → create as draft → start.
6. Share code, LAN URL or QR; if tunnel is enabled, show the public link separately. Monitor joined/in-progress/submitted counts and connection issues. End or reopen with explicit status feedback.
7. Review respondent details, scores and session ranking → inspect form-level question analytics or the cross-session Results matrix → export results. Return to the same form for another session.

### Host: everyday and exceptional paths

- Return to Dashboard → resume live sessions, find recent forms, see actionable sync/reconnection issues.
- Browse/search Forms, filter by folder, import JSON/Drive/Google Forms, export form backup, publish, or delete with consequence wording.
- Manage the participant list and compare ended sessions in Results matrix; filter unmatched names; inspect a cell/answer; export selected sessions.
- Manage local address, public link, Google account, autosave, sync errors, theme, password, recovery and remote admin under Settings.
- If local server is unavailable, show a reconnect/retry state without implying forms are safely saved; if internet is unavailable, keep LAN workflows usable and mark Drive/tunnel actions unavailable or pending.

### Respondent: join to completion

1. Open session link/QR or enter code and identifier → validate code and session state. If already joined on this device, resume without a second identity step; if draft, wait for host; if ended/invalid, show a specific explanation and next action.
2. Read form title, instructions and time limit → enter fullscreen if required and supported → answer questions in sections/pages with visible progress, required-field feedback and accessible controls.
3. On refresh or recoverable disconnect, restore the same attempt and page. Explain whether answers are only saved on this device, are submitting, or are confirmed by the host server. Preserve deadline behavior.
4. Submit → show a clear pending state until server acknowledgment. If the request fails or acknowledgment is unknown, retain answers, show retry guidance and avoid falsely reporting success.
5. Completion → submission receipt, score/correct answers only when the form allows them, answer PDF on supported platforms, edit-code/edit flow only while enabled and active, then leave.

## 4. Proposed information architecture

**Host primary navigation:** Home, Forms, Sessions, Results matrix, Settings. Use the existing `/dashboard`, `/dashboard/forms`, `/dashboard/sessions`, `/dashboard/export`, `/dashboard/settings` URLs. **Forms secondary organization:** All forms and Folders (existing `/dashboard/subjects` routes). Avoid a route migration; labels may change while deep links continue to work. The global shell shows local server state and a separate optional Drive state. The active workspace title and breadcrumb identify current form/session and parent destination.

**Form workspace:** Questions · Results · Settings, plus persistent Save, Preview and a contextual **Create session** action. “Results” keeps by-respondent/by-question views and explicit session/version filters. The form editor remains a focused canvas with one question insertion path visible near the content and an optional outline/palette on wide screens.

**Session workspace:** Overview/live monitor · Respondents · Ranking · Settings. These are in-page tabs at the current URL. The overview prioritizes state, join code/link/QR, timer and participation; ended sessions prioritize results. Session actions remain available in the header, with destructive actions visually secondary.

**Respondent experience:** one narrow, quiet column for join, answering and confirmation, with a stable top line for form name, progress and time. No host navigation or host sync controls. Direct links and manual code entry share the same language and error taxonomy.

## 5. Unified design system proposal

**Approved final direction:** The product is suitable for any field. All visible copy uses host, organizer, respondent, participant, form, session and results. The existing `roster`, `leaderboard`, `subject` and `/dashboard/export` identifiers remain in code and API contracts; visible labels are Participant list, Ranking, Folders and Results matrix. Desktop entry screens use a 45/55 split with content on a shared vertical grid; below 900 px they collapse to one column. Each entry task uses a 400–440 px focused form column. The spacing scale is 4/8/12/16/24/32/48, controls are at least 48 px tall, and the theme control has a visible boundary and accessible name. Secondary text is designed for WCAG AA contrast in both themes.

**Identity:** A precise, field-neutral workspace for self-hosted forms and assessments. Use strong typography, readable content surfaces and direct form editing while retaining a restrained green brand accent and local ownership cues. Avoid dashboards built from metric cards, gradients, oversized rounded boxes, decorative icons or motion for its own sake.

| Foundation | Proposed specification |
| --- | --- |
| Typography | Local/system stack only (existing `fontFamily`); body 14–15 px/21–23, secondary 13–14 px, labels 13 px, captions at least 12 px, page title 24–28 px/32–36. Use tabular numerals for codes, time, counts and scores. Avoid all-caps long labels. |
| Color | Evolve existing charcoal/neutral surfaces and restrained green accent. Light and dark themes share hierarchy. Semantic green/amber/red have text or icon labels; never rely on color alone. Target WCAG AA contrast (4.5:1 normal text, 3:1 large text and meaningful UI boundaries). Check every token pairing, not only canvas text. |
| Spacing | Keep 4 px base; primary increments 4/8/12/16/24/32/48. Typical page gutter 24–32 desktop, 16 mobile. Use 8 px for related controls and 24–32 px between sections. |
| Borders and surfaces | 1 px neutral dividers; 4–6 px control radius, 6–8 px panel radius. Prefer flat page sections and tables; reserve bordered surfaces for editing blocks, focused tasks and overlays. No decorative shadows except menus/dialogs. |
| Components | One Button set (primary/secondary/quiet/destructive), text and number inputs, select/search, checkbox/radio/switch, tabs, status badge, inline notice, toast, table/list row, empty state, dialog, popover/menu, skeleton and progress indicator. Define sizes and icon/text pairing once in `ui/`. |
| States | Every interactive component specifies default, hover, pressed, focus-visible, disabled, loading, success and error where relevant. Pending destructive actions cannot be double-submitted. Save, sync and submission states include text and timestamps or counts when useful. |
| Motion | Keep functional transitions at 120–180 ms, honor reduced motion, remove automatic page entrance motion from routine navigation. No animation may delay inputs or mask loaded state. |
| Content | Sentence case, short action verbs, scope-specific titles and explicit outcomes. Distinguish “Saved on this device/server,” “Waiting to sync,” and “Submitted to host.” |

**Responsive behavior:** ≥1024 px: 208–224 px sidebar, optional editor rail and wide results table. 768–1023 px: compact navigation with labels available on demand, single-column editor and horizontally scrollable data table where needed. <768 px: bottom primary navigation for host, compact actions/overflow, full-width forms and dialog sheets. At 200% zoom, no clipped critical controls; respect safe areas and keyboard occlusion. Respondent content max width about 680–720 px at every viewport. All touch targets aim for at least 44×44 px, while dense desktop rows may retain compact visual height with expanded hit area.

## 6. Screen-by-screen specification

| Screen / current route | Intended layout and primary action | Required states and retained behavior |
| --- | --- | --- |
| Role choice `/` | Two plain, clearly described paths: Host and Join a session; local-first premise in one sentence. | Server checking/unavailable, keyboard focus, both paths. |
| Host setup/login `/host/login` | Single-column auth with distinct setup, local login, remote-admin code and native server-choice variants. Recovery setup is a post-claim task. | Loading check, invalid password/code, remote admin disabled, unreachable server, local-only claim restriction. |
| Recovery `/host/recover` | Stepwise question → answer/new password → success. Show local-only restriction prominently. | No question, 403 local-only, pending, failure, success. |
| Home `/dashboard` | Task-led start: live sessions first, recent forms (short list), recent activity and one clear new-form action. Compact operational status, no repeated full forms table. | Empty first use, partial data, server error/retry, activity stale/error, active-session refresh. |
| Forms `/dashboard/forms` | Search/filterable library with folder grouping and a single New menu containing blank/template/import choices; preserve direct import actions in menu. Row actions are discoverable. | Loading, no forms, no results, import/publish/error, cloud sign-in continuation, delete confirmation. |
| Folders `/dashboard/subjects`, `/:subjectId` | Forms organization view with name/code, count and contained forms; breadcrumb back to Forms. | Create/rename, empty, search, move forms to General or delete with explicit downstream consequences. |
| Form questions `/forms/:id` | Editable document canvas: title/description, inline question blocks, section breaks, insert control and optional wide-screen outline. Stable Save/Preview/Create session controls. | Initial load, load error, dirty/saving/saved/error, cloud difference, no questions, long forms, keyboard reorder path, image errors. |
| Form results `/forms/:id/responses` | Scope label “Results for this form”; by respondent/by question switch, session and assessment-definition filters; readable bar/text/matrix analysis. | No submissions, no matching filter, legacy-definition notice, loading/retry, export pending/error, answer detail. |
| Form settings `/forms/:id/settings` | Group Organization, Response rules, Integrity, Results, Downloads, Backup and Danger; explain that changes require Save. | Unsaved changes, unavailable exports on native, destructive confirmation, field errors. |
| Sessions `/dashboard/sessions` | Status segmented filters, search and Create session; compact rows show form, code, status, counts, time. | Draft/active/ended, zero sessions, no matches, polling/stale/error. |
| Create session dialog | Form selector, name, timer and optional advanced integrity controls with a summary before creation. | Validation, unavailable form, busy/error; preserve existing settings defaults and payloads. |
| Session detail `/dashboard/sessions/:id` | State-aware overview with start/end/reopen, join panel and live participation. Respondent list, ranking and settings remain in the same workspace. | Draft waiting, active live updates, ended review, missing session, no respondents/scores, tunnel unavailable, sync-before-start prompt, destructive confirmation. |
| Results matrix `/dashboard/export` | Participant list and session selection beside a scrollable respondent-by-session matrix; answer drilldown and export at the table level. | No ended sessions, no selection, no participant list, unmatched names, empty cell, fetch error, large table, export failure. |
| Settings `/dashboard/settings` | Clear sections: This device, Local server, Remote access, Google Drive, Security, Data. Show capability limits near controls. | LAN address missing, tunnel setup/error, Drive disconnected/offline/sync issues, remote-admin 2FA, password/recovery validation, clear-data confirmation. |
| Respondent code entry `/respondent/login` | Name/identifier and session code with one Continue action; concise explanation of where the code comes from. | Invalid/ended/draft code, join pending, same-device resume, network error. |
| Direct join `/s/:code` | Session identity and status, name or edit code only if needed; avoid duplicate prompts after silent resume. | Draft wait/poll, invalid code, ended, edit disabled, fullscreen prompt, connection loss. |
| Respondent answering `/s/:code` | Quiet question pages with stable progress, timer, Back/Next/Submit; required errors at field and page level. | Draft restore, timed expiry, host ending session, local disconnect, refocus lock, fullscreen gate, submit pending/failed/unknown. |
| Respondent completion `/s/:code` | Explicit receipt and conditional score/key, edit and PDF actions. | Auto-submit, hidden result settings, edit no longer allowed, PDF unavailable/failure. |

### Cross-screen state rules

- **Loading:** use skeletons only where structure is stable; otherwise a labeled spinner. Avoid blank screens. Do not show a false zero while data is loading.
- **Empty:** explain why the area is empty and provide the next useful action, without decorative illustration.
- **Error:** keep entered data and current context, give a retry action where safe, and distinguish validation from service failure.
- **Offline:** separate internet/Drive/tunnel unavailability from host-server/LAN unreachability. Show the last confirmed local save or server submission only when confirmed.
- **Reconnect:** retry idempotent reads automatically; retain drafts and show an explicit retry for writes whose outcome is uncertain. Reconcile the response before another submit to avoid duplicate attempts.
- **Accessibility:** logical heading order, visible keyboard focus, labeled fields/tables/dialogs, announcements for save/submit/status, noncolor indicators, reduced motion, meaningful hit areas and 200% zoom support. Exam safeguards must still give understandable status to assistive technology.

## 7. Implementation phases after approval

1. **Baseline and visual QA:** Create a synthetic disposable profile and route/state inventory; capture desktop/tablet/mobile screenshots; test keyboard and screen-reader flows; record current payloads, empty/error states and LAN/offline behavior. Preserve the current user database. Establish regression fixtures for all question types and legacy assessment definitions.
2. **Design-system foundation:** Update tokens and shared `ui/` controls, focus/dialog behavior, responsive layout primitives and status language. Verify light/dark contrast and reduced-motion behavior before broad screen changes.
3. **Host shell and first run:** Simplify navigation and Home, unify auth/setup/recovery layouts, clarify local-server versus Drive status. Keep old URLs and authentication rules.
4. **Forms and editor:** Rebuild library/folder presentation, creation/import entry, question canvas, save/preview/status and form settings. Preserve all question schema fields and manual-save contract.
5. **Sessions and respondent flow:** Implement state-aware session workspace and share panel, then distinct respondent join/answer/completion layouts. Exercise timed, untimed, reconnect, resume, edit-code and integrity flows against the local API.
6. **Results matrix:** Clarify form/session/cross-session scopes, analytics, participant matching, respondent drilldown and export. Verify snapshot and legacy results without rewriting grading logic.
7. **Operations and release validation:** Settings, tunnel/Drive/sync issues, desktop window resizing, LAN trial with multiple devices, accessibility audit, performance check and packaged Electron smoke test. Keep phone-host testing separate and mark it experimental until real-device verification.

Each phase should land as a small reviewable change with route screenshots, keyboard checks and contract regression tests. Do not introduce broad state-management or data-layer rewrites to support visual changes.

## 8. Technical risks and decisions to resolve

- **Manual save / unsaved navigation:** The store mutates immediately but saves only on explicit Save. Changing tabs or routes can create ambiguous dirty-state behavior. Design must expose accurate dirty state; an autosave change would be a separate product/contract decision.
- **Response delivery during network loss:** Local respondent drafts are not proof of receipt by the host. The existing readiness audit calls this a release blocker. The redesign must represent uncertainty honestly; a resilient submission protocol is separate engineering work if approved.
- **Snapshot/legacy data:** New sessions pin definitions; older responses can only be labeled against a legacy current definition. Analytics and exports must preserve this provenance and avoid implying historical certainty.
- **Live polling and performance:** Dashboard and session views poll. Large form lists, question editors and results matrices may need memoization/windowing using existing tools, measured before adding dependencies.
- **Platform splits:** Web-only fullscreen, copy protection, Excel/PDF/download and Electron title bar have native fallbacks. Design cannot promise these features on unsupported phone builds.
- **Networking and security:** LAN can run on HTTP; tunnel and remote admin have separate trust boundaries. No redesign should expose host actions to public respondents or weaken local-only recovery/setup.
- **Drive/Google Forms:** OAuth and import/sync can be unavailable offline or unconfigured. Never block local form creation or session hosting on a cloud status.
- **Data safety:** Delete folder/form/session and clear-data actions have different scopes. Keep consequence copy and confirmations, and never use production user data for design QA.
- **Runtime verification:** Prior UI audit covered only early screens; this plan should not be read as a confirmed accessibility or usability test of every screen. Phase 1 must establish that evidence.

## 9. Acceptance criteria

**Functional parity**

- Every existing route/deep link works; all question types, form settings, session controls, respondent safeguards, participant-list functions, results views, imports, exports and optional integrations remain reachable.
- Existing API methods, request/response bodies, auth boundaries, SQLite schema and stored data remain compatible unless separately reviewed and approved.
- Forms and sessions can be created, answered and reviewed over an isolated LAN without internet. An offline internet state does not block local work.
- Desktop and web support their current export/download capabilities; unsupported native actions are explained rather than silently failing.

**Experience quality**

- A new host can reach a live session from first launch without searching through Settings; a respondent can join from a link or code and understands session status and submission outcome.
- At every host and respondent screen in the table above, loading, empty, error, offline and reconnect behavior is defined and tested where applicable.
- Navigation identifies whether results/settings belong to a form, one session or the cross-session results matrix. No capability is hidden behind an unlabeled icon alone.
- All primary flows work with keyboard only and at 200% browser zoom; focus remains visible and returns sensibly after dialogs. Text/UI contrast meets WCAG 2.2 AA targets, and status is never color-only.
- The interface retains a restrained, consistent visual hierarchy in dark/light modes at desktop, tablet and phone widths, with reduced motion respected.

**Verification gate**

- Typecheck/lint and existing relevant logic/server tests pass, with any baseline failures documented. Use synthetic profiles for upgrade and packaged-app checks.
- Run an actual multi-device LAN session, a disconnect/reconnect and uncertain-submit trial, timed and untimed respondent flows, and export comparisons before calling the redesign production-ready.
- No features, routes or backend behavior are removed as an incidental part of a screen cleanup. Any proposed removal or behavior change is listed separately for approval.
