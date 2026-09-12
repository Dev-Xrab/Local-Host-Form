import { pool } from "../db.js";
import { newId } from "../auth/tokens.js";

function rowToFormSummary(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    version: row.current_version,
    questionCount: Array.isArray(row.questions)
      ? row.questions.filter((q) => q.type !== "section").length
      : 0,
    updatedAt: row.updated_at,
  };
}

function rowToFormDetail(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    settings: row.settings,
    version: row.current_version,
    questions: row.questions,
    updatedAt: row.updated_at,
    googleFormId: row.google_form_id ?? null,
  };
}

// Ownership is always enforced in the WHERE clause here — every query in this file takes
// ownerId from the authenticated bearer token (see auth/middleware.js), never from the client.
export async function listFormsForOwner(ownerId) {
  const { rows } = await pool.query(
    `SELECT f.id, f.title, f.description, f.current_version, f.updated_at, fv.questions
     FROM forms f
     JOIN form_versions fv ON fv.form_id = f.id AND fv.version = f.current_version
     WHERE f.owner_id = $1 AND f.status = 'active'
     ORDER BY f.updated_at DESC`,
    [ownerId]
  );
  return rows.map(rowToFormSummary);
}

// `version` picks a specific historical snapshot instead of always the current one — used by
// the "Import from Cloud" version picker (see forms/routes.js GET /:id?version=). Falls back to
// current_version when omitted, matching every existing caller's expectation.
export async function getFormForOwner(ownerId, formId, version) {
  const { rows } = await pool.query(
    `SELECT f.id, f.title, f.description, f.settings, f.current_version, f.updated_at, f.google_form_id,
            fv.version AS snapshot_version, fv.questions
     FROM forms f
     JOIN form_versions fv ON fv.form_id = f.id AND fv.version = COALESCE($3, f.current_version)
     WHERE f.owner_id = $1 AND f.id = $2`,
    [ownerId, formId, version ?? null]
  );
  if (!rows[0]) return null;
  // rowToFormDetail's `version` field reflects whichever snapshot was actually fetched — the
  // requested historical version when one was given, current_version otherwise — not always
  // current_version, since a caller picking an old version needs to see that reflected back.
  return { ...rowToFormDetail(rows[0]), version: rows[0].snapshot_version };
}

// Every published snapshot for a form, newest first — powers the version-picker dropdown on
// "Import from Cloud" (defaults to latest, but lets the host pick an older one). Ownership is
// enforced via the EXISTS subquery rather than a join, since form_versions itself carries no
// owner_id column.
export async function listVersionsForForm(ownerId, formId) {
  const { rows } = await pool.query(
    `SELECT fv.version, fv.created_at
     FROM form_versions fv
     WHERE fv.form_id = $1 AND EXISTS (SELECT 1 FROM forms f WHERE f.id = $1 AND f.owner_id = $2)
     ORDER BY fv.version DESC`,
    [formId, ownerId]
  );
  return rows.map((r) => ({ version: r.version, createdAt: r.created_at }));
}

// Ownership-scoped and unconditional — deletes the form and, via existing ON DELETE CASCADE
// foreign keys, every one of its versions, responses, and google_form_imports ledger rows too.
// Every device signed in to this account loses access to it on its next sync; there is no
// "undo" — the caller (server/cloud/routes.js) is expected to have confirmed with the host first.
export async function deleteForm(ownerId, formId) {
  const { rowCount } = await pool.query(`DELETE FROM forms WHERE id = $1 AND owner_id = $2`, [formId, ownerId]);
  return rowCount > 0;
}

export async function createFormForOwner(ownerId, { title, description, settings, questions, googleFormId = null }) {
  const id = newId();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO forms (id, owner_id, title, description, settings, current_version, google_form_id)
       VALUES ($1, $2, $3, $4, $5, 1, $6)`,
      [id, ownerId, title || "", description || "", JSON.stringify(settings || {}), googleFormId]
    );
    await client.query(
      `INSERT INTO form_versions (form_id, version, title, description, settings, questions)
       VALUES ($1, 1, $2, $3, $4, $5)`,
      [id, title || "", description || "", JSON.stringify(settings || {}), JSON.stringify(questions || [])]
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  return getFormForOwner(ownerId, id);
}

// Publishing an edit never overwrites the previous version's snapshot — it adds a new one and
// moves current_version forward, so devices that already imported an older version keep a
// definition that still matches the responses collected against it.
export async function publishNewVersion(ownerId, formId, { title, description, settings, questions }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `SELECT current_version FROM forms WHERE id = $1 AND owner_id = $2 FOR UPDATE`,
      [formId, ownerId]
    );
    if (!rows[0]) {
      await client.query("ROLLBACK");
      return null;
    }
    const nextVersion = rows[0].current_version + 1;

    await client.query(
      `UPDATE forms SET title = $1, description = $2, settings = $3, current_version = $4, updated_at = now()
       WHERE id = $5`,
      [title || "", description || "", JSON.stringify(settings || {}), nextVersion, formId]
    );
    await client.query(
      `INSERT INTO form_versions (form_id, version, title, description, settings, questions)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [formId, nextVersion, title || "", description || "", JSON.stringify(settings || {}), JSON.stringify(questions || [])]
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  return getFormForOwner(ownerId, formId);
}

// Used only by "Update from Google" (see google-forms/routes.js POST /:formId/refresh) — always
// additive: appends brand-new questions (already filtered by the caller to exclude any id the
// form already has) to the end of the current version's question list and publishes that as a
// new version via the same version-locked path as an ordinary edit. Never reorders or touches
// an existing question, so a host's local edits to already-imported questions are untouched.
export async function appendQuestionsAndPublish(ownerId, formId, newQuestions) {
  if (!newQuestions.length) return getFormForOwner(ownerId, formId);
  const current = await getFormForOwner(ownerId, formId);
  if (!current) return null;
  return publishNewVersion(ownerId, formId, {
    title: current.title,
    description: current.description,
    settings: current.settings,
    questions: [...current.questions, ...newQuestions],
  });
}
