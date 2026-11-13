# Audit change log — 2026-11-13

- Required-answer bypass via forged early timeout closed server side; 30-second in-flight cutoff after host session end.
- Added a respondent API regression assertion for early timeout claims.
- Separated roster text parsing from network-backed sync so Vitest can test pure logic; targeted the Vitest suite in `npm test`.
- Waited for the phone server child to exit before deleting its temporary SQLite directory on Windows.
- Updated tertiary text tokens for better contrast on dark and light surfaces.
- Refreshed dependency lockfile within declared package ranges; production dependency advisories fell from four to zero.
- Removed packaging's automatic local data wipe.
- Restricted Electron window-control IPC to the main window's primary frame.
- Added immutable assessment snapshots for new sessions and responses. Form edits no longer silently regrade submitted work.
- Scoped historical breakdowns, analytics, Excel/PDF exports, portable JSON backups and Drive sync to each response's pinned definition. Legacy responses disclose unknown historical provenance.

No API route was removed. Session-end submission now has a 30-second grace period for in-flight requests; timed attempts can no longer remain submit-able until their personal deadline after a host ends the session.
