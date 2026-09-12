import { pool } from "../db.js";

const PAGE_SIZE = 500;

// Every write in this file is owner-scoped by a parameter taken from the verified bearer token
// (see auth/middleware.js requireBearer) — never from the request body. That scoping is also
// baked into the SQL itself (WHERE/AND owner_id = ...), not just the calling code, specifically
// so a bug elsewhere can't turn into a cross-account data leak or overwrite.

async function getFormOwner(formId) {
  const { rows } = await pool.query("SELECT owner_id FROM forms WHERE id = $1", [formId]);
  return rows[0]?.owner_id || null;
}

// Postgres's jsonb type does not preserve object key order (it normalizes on storage) — a
// plain JSON.stringify(a) === JSON.stringify(b) comparison between a freshly-submitted payload
// and one read back from a jsonb column will spuriously report "different" for identical
// content whose keys just landed in a different order. Sorting keys recursively before
// stringifying makes the comparison order-independent, which is what "is this the exact same
// retry, or an actual conflicting write" needs to mean.
function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

// Idempotent, conflict-aware upsert for one response. id is client-generated and is the whole
// idempotency mechanism: the same id uploaded twice is always this one INSERT ... ON CONFLICT,
// never two rows.
//
// - No existing row: inserted as-is (status: "accepted").
// - Existing row, incoming version is newer: updated in place, gets a fresh server_seq so
//   downstream syncs see it as a change (status: "accepted").
// - Existing row, incoming version is <= stored version: this is either a harmless retry
//   (the payload matches what's already stored — status: "accepted", no-op) or a genuine
//   conflicting write that lost a race (payload differs — status: "rejected", reason:
//   "conflict"). Either way nothing is silently overwritten.
// - Existing row belongs to a different owner (should be unreachable — ids are random UUIDs —
//   but the WHERE clause enforces it at the SQL level regardless): status "rejected", reason
//   "forbidden".
export async function upsertResponse({ id, formId, ownerId, deviceId, version, payload, createdAt, formVersion }) {
  const formOwnerId = await getFormOwner(formId);
  if (!formOwnerId || formOwnerId !== ownerId) {
    return { id, status: "rejected", reason: "invalid_form" };
  }

  const upsert = await pool.query(
    `INSERT INTO responses (id, form_id, form_version, owner_id, device_id, payload, version, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (id) DO UPDATE SET
       payload = EXCLUDED.payload,
       version = EXCLUDED.version,
       form_version = EXCLUDED.form_version,
       device_id = EXCLUDED.device_id,
       updated_at = now(),
       server_seq = nextval('responses_seq')
     WHERE responses.owner_id = $4 AND responses.version < EXCLUDED.version
     RETURNING id`,
    [id, formId, formVersion, ownerId, deviceId, JSON.stringify(payload), version, createdAt]
  );

  if (upsert.rows[0]) return { id, status: "accepted" };

  const { rows } = await pool.query("SELECT owner_id, payload FROM responses WHERE id = $1", [id]);
  const existing = rows[0];
  if (!existing || existing.owner_id !== ownerId) {
    return { id, status: "rejected", reason: "forbidden" };
  }

  const samePayload = canonicalJson(existing.payload) === canonicalJson(payload);
  return samePayload
    ? { id, status: "accepted" }
    : { id, status: "rejected", reason: "conflict" };
}

// Cursor-based download: only rows changed since `cursor`, oldest first, capped at PAGE_SIZE.
// A caller that gets back exactly PAGE_SIZE rows should call again with the new cursor — this
// is what keeps a large backlog from ever being downloaded in one shot.
export async function listChangesSince(ownerId, cursor) {
  const { rows } = await pool.query(
    `SELECT r.id, r.form_id, r.form_version, r.payload, r.version, r.device_id, r.server_seq,
            d.name AS device_name
     FROM responses r
     JOIN devices d ON d.id = r.device_id
     WHERE r.owner_id = $1 AND r.server_seq > $2
     ORDER BY r.server_seq ASC
     LIMIT $3`,
    [ownerId, cursor, PAGE_SIZE]
  );
  return { rows, pageSize: PAGE_SIZE };
}
