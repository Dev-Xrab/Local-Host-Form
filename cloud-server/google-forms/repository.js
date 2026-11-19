import { pool } from "../db.js";
import { newId } from "../auth/tokens.js";
import { listGoogleFormResponses } from "./client.js";
import { translateGoogleFormResponses } from "./translateResponses.js";

const SYNTHETIC_DEVICE_NAME = "Google Forms Import";

// Every response imported from Google is attributed to one durable per-user device row so it
// rides the app's EXISTING download-sync pipeline (server/cloud/sync.js -> applyDownloadedChanges
// -> findOrCreateSyncedSession) down to every device on the account — no separate download-side
// code is needed for Google-sourced responses at all. Reuses the plain `devices` table; no schema
// change needed for this part.
async function getOrCreateImportDevice(ownerId) {
  const existing = await pool.query(
    "SELECT id FROM devices WHERE user_id = $1 AND name = $2 LIMIT 1",
    [ownerId, SYNTHETIC_DEVICE_NAME]
  );
  if (existing.rows[0]) return existing.rows[0].id;

  const id = newId();
  await pool.query(
    "INSERT INTO devices (id, user_id, name, last_seen_at) VALUES ($1, $2, $3, now())",
    [id, ownerId, SYNTHETIC_DEVICE_NAME]
  );
  return id;
}

async function alreadyImportedResponseIds(formId) {
  const { rows } = await pool.query(
    "SELECT google_response_id FROM google_form_imports WHERE form_id = $1",
    [formId]
  );
  return new Set(rows.map((r) => r.google_response_id));
}

async function currentFormVersion(formId) {
  const { rows } = await pool.query("SELECT current_version FROM forms WHERE id = $1", [formId]);
  return rows[0]?.current_version ?? 1;
}

// Fetches every response on the live Google Form, skips whatever's already been imported (see
// google_form_imports), and inserts the rest directly into this server's own `responses` table —
// same shape as a device's normal sync upload, just written server-side instead of arriving over
// POST /api/sync. `questions` must be the SAME translated question list the form was created/
// updated with (see translate.js), since answers are matched to questions by id.
export async function importResponsesForForm(ownerId, formId, googleFormId, questions) {
  const [rawResponses, alreadyImported, deviceId, formVersion] = await Promise.all([
    listGoogleFormResponses(ownerId, googleFormId),
    alreadyImportedResponseIds(formId),
    getOrCreateImportDevice(ownerId),
    currentFormVersion(formId),
  ]);

  const newRaw = rawResponses.filter((r) => !alreadyImported.has(r.responseId));
  const translated = translateGoogleFormResponses(questions, newRaw);

  let importedCount = 0;
  for (const response of translated) {
    const responseId = newId();
    const payload = {
      respondentName: response.respondentName,
      googleResponseId: response.googleResponseId,
      score: null,
      maxScore: null,
      startedAt: response.startedAt,
      submittedAt: response.submittedAt,
      editCode: null,
      answers: response.answers,
    };

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO responses (id, form_id, form_version, owner_id, device_id, payload, version, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, 1, now())`,
        [responseId, formId, formVersion, ownerId, deviceId, JSON.stringify(payload)]
      );
      await client.query(
        `INSERT INTO google_form_imports (form_id, google_response_id, response_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (form_id, google_response_id) DO NOTHING`,
        [formId, response.googleResponseId, responseId]
      );
      await client.query("COMMIT");
      importedCount += 1;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  return { importedCount, skippedExistingCount: rawResponses.length - newRaw.length };
}

// Read-only counterpart of importResponsesForForm: fetches the live Google Form's responses and
// returns the ones this account's cloud copy doesn't hold yet, translated onto the app's answer
// shape, without writing anything. The local device stores them itself and only uploads them if the
// host chooses to save them to the cloud (see server/cloud/routes.js).
export async function listNewResponsesForForm(ownerId, formId, googleFormId, questions) {
  const [rawResponses, alreadyImported] = await Promise.all([
    listGoogleFormResponses(ownerId, googleFormId),
    alreadyImportedResponseIds(formId),
  ]);
  const newRaw = rawResponses.filter((r) => !alreadyImported.has(r.responseId));
  return {
    responses: translateGoogleFormResponses(questions, newRaw),
    skippedExistingCount: rawResponses.length - newRaw.length,
  };
}
