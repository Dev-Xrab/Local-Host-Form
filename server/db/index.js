import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");
if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

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
    created_at TEXT NOT NULL
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
    submitted_at TEXT
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
ensureColumn("sessions", "name", "TEXT NOT NULL DEFAULT ''");
ensureColumn("sessions", "duration_minutes", "INTEGER");
ensureColumn("sessions", "ends_at", "TEXT");
ensureColumn("sessions", "created_at", "TEXT");
ensureColumn("responses", "respondent_name", "TEXT NOT NULL DEFAULT ''");
ensureColumn("responses", "status", "TEXT NOT NULL DEFAULT 'in_progress'");
ensureColumn("responses", "started_at", "TEXT");
ensureColumn("responses", "deadline_at", "TEXT");

// Backfill: sessions/responses created before this migration are already "started"/"submitted"
// under the old single-shot model — reflect that in the new lifecycle columns instead of
// leaving them looking unstarted.
db.exec(`
  UPDATE sessions SET created_at = started_at WHERE created_at IS NULL AND started_at IS NOT NULL;
  UPDATE responses SET status = 'submitted' WHERE status = 'in_progress' AND submitted_at IS NOT NULL;
  UPDATE responses SET started_at = submitted_at WHERE started_at IS NULL AND submitted_at IS NOT NULL;
`);

db.exec("CREATE INDEX IF NOT EXISTS idx_forms_subject_id ON forms(subject_id);");
