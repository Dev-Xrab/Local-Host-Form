import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required — see .env.example.");
  process.exit(1);
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// IDs are generated in application code (crypto.randomUUID), not by the database, to keep
// one ID scheme across the whole app (local SQLite already generates its own UUIDs this way).
export async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY,
      google_id TEXT UNIQUE NOT NULL,
      email TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      avatar_url TEXT,
      -- Lets this server list/read the user's real Google Forms on demand (see
      -- google-forms/client.js) — scoped to drive.metadata.readonly + forms.body.readonly only,
      -- never a write scope. This is meaningfully more sensitive than this app's own session
      -- tokens: it's a standing credential for the user's actual Google account, not just this
      -- app's data, so treat a leak of this column as a Drive/Forms-read compromise, not just an
      -- app-account compromise.
      google_refresh_token TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    ALTER TABLE users ADD COLUMN IF NOT EXISTS google_refresh_token TEXT;

    -- One row per installation that has ever signed in, keyed by a client-generated UUID
    -- (never the hostname) so a reinstall or rename doesn't fracture sync identity later.
    CREATE TABLE IF NOT EXISTS devices (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_seen_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS idx_devices_user ON devices(user_id);

    -- Short-lived bridge between "local server started an OAuth attempt" and "Google sent the
    -- user back to us" — deleted the moment it's consumed (see consumeOAuthState).
    CREATE TABLE IF NOT EXISTS oauth_states (
      state TEXT PRIMARY KEY,
      code_challenge TEXT NOT NULL,
      local_redirect_uri TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- One-time code handed to the user's OS browser after Google auth completes, so the real
    -- access/refresh tokens are only ever exchanged server-to-server (see /auth/exchange) and
    -- never appear in a browser URL bar or history.
    CREATE TABLE IF NOT EXISTS oauth_handoffs (
      code TEXT PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      code_challenge TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      consumed_at TIMESTAMPTZ
    );

    -- Bearer tokens are stored hashed (sha256) so a database leak alone can't be used to
    -- authenticate as anyone.
    CREATE TABLE IF NOT EXISTS cloud_sessions (
      token_hash TEXT PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      expires_at TIMESTAMPTZ NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_cloud_sessions_user ON cloud_sessions(user_id);

    -- Rotated on every use (see rotateRefreshToken) so a stolen-and-replayed refresh token is
    -- detectable: the legitimate client's next refresh will fail because it's already revoked.
    CREATE TABLE IF NOT EXISTS cloud_refresh_tokens (
      token_hash TEXT PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      expires_at TIMESTAMPTZ NOT NULL,
      revoked_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS idx_cloud_refresh_tokens_user ON cloud_refresh_tokens(user_id);

    CREATE TABLE IF NOT EXISTS forms (
      id UUID PRIMARY KEY,
      owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      settings JSONB NOT NULL DEFAULT '{}',
      current_version INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'active',
      -- Set only when this form was created from a real Google Form (see
      -- google-forms/routes.js POST /:id/import) — the Drive file id, so a later
      -- "update from Google" (POST /:formId/refresh) can re-fetch the live source.
      google_form_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    ALTER TABLE forms ADD COLUMN IF NOT EXISTS google_form_id TEXT;
    CREATE INDEX IF NOT EXISTS idx_forms_owner ON forms(owner_id);

    -- Immutable per-version snapshot, so a device that imported v2 (or a response created
    -- against v2) keeps working even after the owner publishes v3.
    CREATE TABLE IF NOT EXISTS form_versions (
      form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
      version INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      settings JSONB NOT NULL,
      questions JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (form_id, version)
    );

    -- Drives cursor-based sync: every insert AND every accepted update gets a fresh seq value
    -- (see forms/sync in cloud-server/sync/repository.js), so "changes since cursor X" is a
    -- single indexed range scan instead of a full table diff, and a row that changes twice
    -- between two sync calls is still only sent once (its latest state, at its latest seq).
    CREATE SEQUENCE IF NOT EXISTS responses_seq;

    -- id is CLIENT-GENERATED and is the idempotency key: retrying the same upload is always
    -- an INSERT ... ON CONFLICT(id) on this table, never a fresh row. Responses are owner-scoped
    -- (not per-form-collaborator) because this app has no concept of sharing a form between
    -- Google accounts yet — see server/cloud/routes.js publish, which always publishes to the
    -- signed-in account's own forms.
    CREATE TABLE IF NOT EXISTS responses (
      id UUID PRIMARY KEY,
      form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
      form_version INTEGER NOT NULL,
      owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
      payload JSONB NOT NULL,
      version INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      server_seq BIGINT NOT NULL DEFAULT nextval('responses_seq')
    );
    CREATE INDEX IF NOT EXISTS idx_responses_owner_seq ON responses(owner_id, server_seq);
    CREATE INDEX IF NOT EXISTS idx_responses_form ON responses(form_id);

    -- Dedup ledger for responses pulled in from a real Google Form (see
    -- google-forms/repository.js importResponsesForForm). Google's own response id isn't a
    -- UUID, so it can't be the responses.id itself — this table is the only place that
    -- mapping is recorded, and it's what makes both the initial import and a later "update
    -- from Google" safe to re-run without ever re-importing the same response twice.
    CREATE TABLE IF NOT EXISTS google_form_imports (
      form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
      google_response_id TEXT NOT NULL,
      response_id UUID REFERENCES responses(id) ON DELETE SET NULL,
      imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (form_id, google_response_id)
    );
  `);
}

// Opportunistic cleanup of expired short-lived rows — called from a couple of hot paths
// rather than a cron job, mirroring the local server's isValidAuthSession pattern.
export async function cleanupExpiredOAuthArtifacts() {
  await pool.query("DELETE FROM oauth_states WHERE created_at < now() - interval '10 minutes'");
  await pool.query("DELETE FROM oauth_handoffs WHERE created_at < now() - interval '10 minutes'");
}
