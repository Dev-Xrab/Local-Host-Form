# Test report — 2026-11-13

| Check | Baseline | After changes |
| --- | --- | --- |
| `npm run typecheck` | Pass | Pass after code changes |
| `npm run lint` | Exit 0, warnings | Exit 0, warnings after clean install |
| `npm test` | Failed runner configuration | 13/13 pure logic tests pass |
| `npm run test:drive` | 51/51 pass | 52/52 pass, including snapshot and portable import checks |
| `npm run test:phone` | 50 checks pass, Windows cleanup `EPERM` | 51/51 checks pass, exit 0 |
| `npm run build` | Pass, nine JS bundles | Pass, nine JS bundles after clean install |
| `npm audit --omit=dev` | 4 advisories | 0 advisories after lockfile refresh |
| `npx electron-builder --dir` | Not run | Pass; `release/win-unpacked` created, unsigned |

Phone test uses a fresh temporary SQLite directory. Its new assertion sends `timedOut: true` with blank required answers before deadline and verifies HTTP 400. The Drive suite uses a fake Google service. No production data or real Google account was used. These tests do not cover real LAN outages, simultaneous student devices, a launched packaged Electron app, Android/iOS hardware or a complete accessibility audit. The attempted launch of the unpacked executable under an isolated Windows profile was rejected by automatic tool approval, so no packaged runtime claim is made.

After the snapshot migration, typecheck, lint (warnings only), web build, production dependency audit (zero advisories), 13 logic tests, 52 server/Drive tests, 51 phone checks and an unpacked Electron build passed. The synthetic assessment test verifies pinned grading across edits, portable import, legacy score preservation, `PRAGMA integrity_check` and `PRAGMA foreign_key_check`. A launched packaged upgrade is still pending.
