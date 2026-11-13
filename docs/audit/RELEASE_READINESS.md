# Release readiness — 2026-11-13

**Recommendation: do not release for high-stakes classroom assessments yet.** This audit pass removed a data-wiping build hook and a required-answer bypass and now pins new sessions to immutable assessment definitions. Real-device/restart behavior is unverified.

## Release blockers

1. AUD-01: the additive snapshot migration is implemented for new sessions and portable backups. Older responses lack a provable historical definition. Verify upgrade/rollback on an older profile and sync with real accounts and mixed app versions before release.
2. AUD-02: decide and test a LAN transport model suitable for the deployment environment; communicate any plain-HTTP limitation to hosts.
3. AUD-03: prevent recoverable network loss from silently losing unacknowledged answers.
4. AUD-12: the unpacked Windows build succeeded, but its executable launch was rejected by automatic tool approval. Build and launch the installer on a disposable profile, then test upgrade with existing synthetic forms, responses and grades.

Also verify AUD-04 in a launched Electron app, resolve AUD-10, complete a control-by-control ASVS assessment, and run accessibility, concurrency, offline/reconnect and real-device tests. Google Forms and Drive behavior is covered by 51 fake-service tests but real-account scopes, partial failures and rate limits remain unverified. Phone hosting remains experimental as documented in README.

## Documentation and operations

README documents architecture, development commands, LAN hosting and the experimental phone host. For local-only use, keep the host awake and on the same Wi-Fi; respondent browsers use the host's displayed LAN URL or session code. Google Drive sync requires a Desktop OAuth client and Drive API per README and `docs/google-oauth-setup.md`. Back up the Electron `userData/data` SQLite database while the app is stopped, preserve the token key separately, and test restoration on a copy before relying on it. There is no verified automated backup/restore workflow. Do not run `scripts/clear-dev-data.js` against a real profile.

No installer was published, code signed, pushed or deployed in this pass.
