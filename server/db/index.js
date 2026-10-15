import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { dataDir } from "./dataDir.js";

export { dataDir };

const dbPath = path.join(dataDir, "stonearch.sqlite");
export const db = new DatabaseSync(dbPath);

db.exec("PRAGMA foreign_keys = ON;");

db.exec(`
  CREATE TABLE IF NOT EXISTS subjects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL DEFAULT '',
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS forms (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft',
    settings TEXT NOT NULL DEFAULT '{}',
    subject_id TEXT REFERENCES subjects(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS questions (
    id TEXT PRIMARY KEY,
    form_id TEXT NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    order_index INTEGER NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    show_description INTEGER NOT NULL DEFAULT 0,
    show_image INTEGER NOT NULL DEFAULT 0,
    required INTEGER NOT NULL DEFAULT 0,
    options TEXT NOT NULL DEFAULT '[]',
    scale TEXT NOT NULL DEFAULT '{}',
    rows TEXT NOT NULL DEFAULT '[]',
    image_url TEXT,
    correct_answer_index TEXT NOT NULL DEFAULT '[]',
    correct_answers TEXT NOT NULL DEFAULT '[]',
    points INTEGER NOT NULL DEFAULT 1
  );

  CREATE INDEX IF NOT EXISTS idx_questions_form_id ON questions(form_id);

  -- A session is one administered attempt-window of a form: draft (configured, not
  -- yet open) -> active (respondents can join until ends_at) -> ended (final).
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    form_id TEXT NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT '',
    code TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    duration_minutes INTEGER,
    started_at TEXT,
    ends_at TEXT,
    ended_at TEXT,
    created_at TEXT NOT NULL,
    responses_editable INTEGER NOT NULL DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_form_id ON sessions(form_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_code ON sessions(code);
  CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);

  -- A response is one respondent's attempt within a session: created at join time
  -- (in_progress) and finalized at submit time (submitted). Submitted answers are
  -- immutable; score/max_score are derived and recalculated whenever grading changes.
  CREATE TABLE IF NOT EXISTS responses (
    id TEXT PRIMARY KEY,
    form_id TEXT NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
    device_id TEXT,
    respondent_name TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'in_progress',
    score INTEGER,
    max_score INTEGER,
    started_at TEXT,
    deadline_at TEXT,
    submitted_at TEXT,
    edit_code TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_responses_form_id ON responses(form_id);
  CREATE INDEX IF NOT EXISTS idx_responses_session_id ON responses(session_id);
  CREATE INDEX IF NOT EXISTS idx_responses_status ON responses(status);

  CREATE TABLE IF NOT EXISTS response_answers (
    id TEXT PRIMARY KEY,
    response_id TEXT NOT NULL REFERENCES responses(id) ON DELETE CASCADE,
    question_id TEXT NOT NULL,
    value TEXT NOT NULL DEFAULT 'null'
  );

  CREATE INDEX IF NOT EXISTS idx_response_answers_response_id ON response_answers(response_id);

  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS auth_sessions (
    token TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );

  -- The host's own master roster, kept separate from respondents: a respondent's typed
  -- name is matched against a student's name/aliases so the gradebook can show one
  -- consistent row per real student even when they type their name differently.
  CREATE TABLE IF NOT EXISTS roster_students (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL DEFAULT '',
    student_id TEXT NOT NULL DEFAULT '',
    aliases TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  -- Singleton: this install is signed in to the cloud server as at most one Google account.
  -- Tokens never leave this table — no API route ever returns access_token/refresh_token to
  -- the renderer, only the derived connected/email/name status (see server/cloud/routes.js).
  CREATE TABLE IF NOT EXISTS cloud_account (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    user_id TEXT NOT NULL,
    email TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    avatar_url TEXT,
    access_token TEXT NOT NULL,
    access_token_expires_at TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

// Lightweight migration guard: add columns introduced after a user's DB was first created,
// so upgrading the app never silently drops their existing forms/responses.
function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

ensureColumn("responses", "device_id", "TEXT");
ensureColumn("forms", "subject_id", "TEXT");
ensureColumn("subjects", "is_default", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("questions", "points", "INTEGER NOT NULL DEFAULT 1");
// Matrix/grid questions' row labels — one shared column list already fits the existing
// `options` JSON column (each entry becomes {id, label, value} instead of a plain string).
ensureColumn("questions", "rows", "TEXT NOT NULL DEFAULT '[]'");
ensureColumn("sessions", "name", "TEXT NOT NULL DEFAULT ''");
ensureColumn("sessions", "duration_minutes", "INTEGER");
ensureColumn("sessions", "ends_at", "TEXT");
ensureColumn("sessions", "created_at", "TEXT");
ensureColumn("responses", "respondent_name", "TEXT NOT NULL DEFAULT ''");
ensureColumn("responses", "status", "TEXT NOT NULL DEFAULT 'in_progress'");
ensureColumn("responses", "started_at", "TEXT");
ensureColumn("responses", "deadline_at", "TEXT");
ensureColumn("responses", "edit_code", "TEXT");
ensureColumn("sessions", "responses_editable", "INTEGER NOT NULL DEFAULT 0");

// Null/0 = off. When set, a respondent who switches away from the answering tab and comes back
// is held on a countdown overlay for this many seconds before the questions reappear — a
// deterrent against looking things up elsewhere mid-quiz (see the respondent page's
// visibilitychange handling). Like responses_editable, flippable anytime, not just while draft —
// it only affects respondents from the moment it's turned on, nothing retroactive to enforce.
ensureColumn("sessions", "refocus_lock_seconds", "INTEGER");

// Off (0) unless the host turns it on: whether the respondent page tries to enter fullscreen the
// moment a respondent starts answering (join, or reopening an edit). A manual "Fullscreen" button
// is always offered on the respondent page regardless — this only controls the automatic attempt.
ensureColumn("sessions", "fullscreen_enabled", "INTEGER NOT NULL DEFAULT 0");

// Set the moment this respondent's tab is detected going hidden (see POST
// /api/public/responses/:id/refocus-lock) to "now + the session's refocusLockSeconds", not when
// they come back — so the lock survives a reload while away or right after returning instead of
// resetting with the rest of the page's client-only state. Read back on every join/resume so the
// countdown a reload would otherwise skip keeps counting down server-side regardless.
ensureColumn("responses", "refocus_locked_until", "TEXT");

// Bookkeeping for forms imported from the cloud server — null for locally-authored forms.
// remote_version pins the local copy to the exact form_versions snapshot it was imported from,
// so a later edit on the cloud server doesn't silently change a form already in offline use.
ensureColumn("forms", "remote_form_id", "TEXT");
ensureColumn("forms", "remote_version", "INTEGER");
// When this form's content was last in step with the cloud copy — stamped on import and on every
// publish (see server/forms/repository.js setRemoteInfo). A form whose updated_at is later than
// this has local edits the cloud doesn't have yet, which is what drives the "save to cloud" prompt.
ensureColumn("forms", "remote_saved_at", "TEXT");
db.exec("UPDATE forms SET remote_saved_at = updated_at WHERE remote_form_id IS NOT NULL AND remote_saved_at IS NULL;");
ensureColumn("forms", "owner_user_id", "TEXT");

// UNIQUE (not just indexed): the app-level dedup check in importCentralFormLocally
// (server/cloud/routes.js — look up by remote_form_id before importing) is a check-then-insert,
// which is only ever correct up to a race (a double-click, or two near-simultaneous imports).
// This index turns "two local forms pointing at the same cloud form" from a rare possibility
// into a constraint violation. NULL is exempt (every locally-authored form has no remote_form_id
// at all, and SQLite already treats distinct NULLs as non-conflicting, but the WHERE clause makes
// that intent explicit rather than incidental). Replaces a plain, non-unique index of the same
// name from an earlier migration — DROP first because CREATE ... IF NOT EXISTS matches by name,
// not definition, so an install that already has the old plain index would otherwise never
// actually gain the uniqueness guarantee.
db.exec("DROP INDEX IF EXISTS idx_forms_remote_form_id;");
db.exec(
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_forms_remote_form_id ON forms(remote_form_id) WHERE remote_form_id IS NOT NULL;"
);

// Set only for forms imported from a real Google Form (see server/cloud/routes.js
// POST /google-forms/:id/import) — lets "Update from Google" (POST /google-forms/:id/refresh)
// find its way back to the source Drive file id later. Null for every other form.
ensureColumn("forms", "google_form_id", "TEXT");

// An optional decorative image shown across the top of the form, both in the builder and on the
// respondent page — a data: URI, the same inline-base64 approach question images already use
// (see ImageBlock.jsx), so it round-trips with the rest of the form on export/import with no
// separate asset storage or upload endpoint.
ensureColumn("forms", "banner_image", "TEXT");

// Sync bookkeeping for responses collected under a cloud-linked form (see server/cloud/sync.js).
// No separate outbox/queue table: these columns on the responses row itself ARE the queue —
// "pending" rows are exactly the ones sync needs to upload, so there is only one place that can
// drift out of sync with what actually happened to a response.
// version: bumped on every finalize (first submit AND resubmit-after-edit) — the optimistic-
//   concurrency counter the cloud server uses to accept/reject/detect-conflict on upload.
// form_version: the remote form version this response was answered against (copied from
//   forms.remote_version at submit time), so a later form edit doesn't retroactively change
//   what an already-submitted response is considered to have answered.
// sync_status: 'pending' (needs upload) | 'synced' | 'failed' (rejected or errored — retryable).
ensureColumn("responses", "version", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("responses", "form_version", "INTEGER");
ensureColumn("responses", "sync_status", "TEXT NOT NULL DEFAULT 'pending'");
ensureColumn("responses", "synced_at", "TEXT");
ensureColumn("responses", "retry_count", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("responses", "sync_error", "TEXT");

// A response fetched from a real Google Form (see server/cloud/routes.js pullGoogleResponsesLocally)
// keeps Google's own response id so it's never fetched twice, and so uploading it to the cloud later
// can't duplicate a copy the cloud already has. Its sync_status starts as 'local' — a fourth state,
// neither 'pending' nor 'failed', so it is NOT uploaded until the host chooses to save it to the
// cloud (server/cloud/routes.js POST /google-forms/:id/save-to-cloud flips it to 'pending').
ensureColumn("responses", "google_response_id", "TEXT");
db.exec("CREATE INDEX IF NOT EXISTS idx_responses_google_response_id ON responses(form_id, google_response_id);");

db.exec("CREATE INDEX IF NOT EXISTS idx_responses_sync_status ON responses(sync_status);");

// Backfill: sessions/responses created before this migration are already "started"/"submitted"
// under the old single-shot model — reflect that in the new lifecycle columns instead of
// leaving them looking unstarted.
db.exec(`
  UPDATE sessions SET created_at = started_at WHERE created_at IS NULL AND started_at IS NOT NULL;
  UPDATE responses SET status = 'submitted' WHERE status = 'in_progress' AND submitted_at IS NOT NULL;
  UPDATE responses SET started_at = submitted_at WHERE started_at IS NULL AND submitted_at IS NOT NULL;
`);

// The line above finalizes pre-sync-era responses straight to 'submitted' via raw SQL, bypassing
// submitResponse() — the only place that bumps `version` off its default 0. That leaves them
// violating the sync engine's own invariant ("submitted" implies version >= 1, see
// server/responses/repository.js submitResponse) and permanently unsyncable: the cloud server
// rejects any version < 1 as "invalid", and no amount of retrying ever changes that version.
// Idempotent — matches nothing once every such row has been bumped once.
db.exec(`UPDATE responses SET version = 1 WHERE status = 'submitted' AND version = 0;`);

// SYNCED-/GOOGLE-/IMPORT- session codes (see server/sessions/repository.js) embed a slice of a
// randomUUID, which is lowercase hex — but every respondent-facing lookup of a code uppercases it
// first (see server/public/routes.js), the same as a real 6-character join code always is. A code
// minted with lowercase hex in it could never actually be matched by a respondent typing or
// following that exact link — reopening one of these sessions and sharing its link 404'd. Session
// generation now always uppercases that slice; this backfills every row already created the old
// way. Idempotent — UPPER() on an already-uppercase code is a no-op.
db.exec(`
  UPDATE sessions SET code = UPPER(code)
  WHERE code LIKE 'SYNCED-%' OR code LIKE 'GOOGLE-%' OR code LIKE 'IMPORT-%';
`);

db.exec("CREATE INDEX IF NOT EXISTS idx_forms_subject_id ON forms(subject_id);");
db.exec("CREATE INDEX IF NOT EXISTS idx_responses_edit_code ON responses(session_id, edit_code);");

// removed_at: set when a Google Forms structural sync detects this question no longer exists on
// the live online form and the host chooses "Sync From Online" (see server/forms/questionDiff.js
// and server/cloud/routes.js POST /google-forms/:id/apply-changes). The row itself is never
// deleted — response_answers has no foreign key to questions, so nothing there is at risk either
// way, but keeping the row (with its last-known title/type/options) is what lets analytics still
// show a removed question's historical answers, labeled instead of just vanishing.
ensureColumn("questions", "removed_at", "TEXT");
