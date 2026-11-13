# Historical assessment migration

Implemented after user approval on 2026-11-13. The schema change is additive and runs at server startup. It does not rewrite existing response scores or claim to reconstruct missing historical definitions.

## Former behavior

`forms/repository.js` replaces question rows on save, and `forms/routes.js` then re-scores all submitted responses using the latest answer key. `responses.form_version` records a remote version number where available, but does not preserve a local immutable question definition. Past scores and question labels can therefore drift when a host edits a form.

## Implemented compatible change

1. Add an append-only `form_snapshots` table containing form ID, creation time, canonical definition JSON and content hash. Add nullable snapshot references to sessions and responses. Add indexes and foreign keys without dropping current tables or columns.
2. On starting a session, pin its current form definition in a snapshot. Joins, validation, grading and respondent review use that snapshot for the session's lifetime. Editing the builder changes the draft for future sessions only. Preserve question IDs within each snapshot.
3. At join, store the session snapshot ID on the response. Submission retains its original score. Historical breakdowns, analytics and exports use the response's snapshot. Form saves no longer regrade old responses. An explicit host-initiated regrade, if later required, needs a separate grading event and is not implemented.
4. Existing responses cannot be assigned a proven past definition. Mark them `legacy_current_definition` and keep their stored scores. The UI must disclose that their old question text/key cannot be reconstructed from the present database. Never invent a historical snapshot. Existing API payload shapes can remain; add optional provenance metadata.
5. Drive sync carries stable assessment hashes, uploads immutable definitions before response changes, and retries downloaded responses if their definition is unavailable. Portable JSON backups include pinned definitions and reject a pinned response if its definition is missing. Older Drive responses without a hash remain marked legacy. Fake-service two-device sync tests pass; real-account and mixed-version clients remain unverified.

## Verification and rollback gate

A synthetic database test checks SQLite integrity and foreign keys after snapshot creation, form edits, portable import, and legacy response handling. The migration uses `CREATE TABLE IF NOT EXISTS`, column guards, and nullable references. It has not been exercised against a copy of a real older profile, restarted twice with that profile, or rolled back from an installer upgrade. Back up a stopped app's `userData/data` directory before upgrade. Release only after packaged upgrade and real two-device sync checks pass.

The same review should design a durable, idempotent pending-submission queue for AUD-03. That is separate from this schema change; its client acknowledgement states and retry protocol must be specified before implementation.
