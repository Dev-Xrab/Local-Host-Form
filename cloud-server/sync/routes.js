import { Router } from "express";
import * as repo from "./repository.js";

export const syncRouter = Router();

// ids are uuid columns in Postgres — a malformed one would otherwise throw mid-batch and fail the
// whole sync request with a 500 instead of rejecting just that one change.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_CHANGES_PER_REQUEST = 500;

function validateChange(change) {
  if (!change || typeof change !== "object") return "each change must be an object";
  if (typeof change.id !== "string" || !UUID_PATTERN.test(change.id)) return "each change needs a uuid id";
  if (typeof change.formId !== "string" || !UUID_PATTERN.test(change.formId)) return "each change needs a uuid formId";
  if (Number.isNaN(Date.parse(change.createdAt))) return "createdAt must be a date";
  if (!Number.isInteger(change.version) || change.version < 1) return "each change needs an integer version >= 1";
  if (!change.createdAt || typeof change.createdAt !== "string") return "each change needs a string createdAt";
  if (change.payload === undefined || change.payload === null || typeof change.payload !== "object") {
    return "each change needs a payload object";
  }
  if (change.formVersion !== undefined && !Number.isInteger(change.formVersion)) {
    return "formVersion must be an integer when present";
  }
  return null;
}

// req.userId/req.deviceId come only from the verified bearer token (see auth/middleware.js) —
// every response written or read here is scoped to that identity, never to anything the client
// puts in the request body.
syncRouter.post("/", async (req, res) => {
  const { lastCursor, changes, formId: onlyFormId } = req.body || {};

  if (changes !== undefined && !Array.isArray(changes)) {
    return res.status(400).json({ error: "changes must be an array when present" });
  }
  if (Array.isArray(changes) && changes.length > MAX_CHANGES_PER_REQUEST) {
    return res.status(400).json({ error: `At most ${MAX_CHANGES_PER_REQUEST} changes per request.` });
  }
  if (onlyFormId !== undefined && onlyFormId !== null && (typeof onlyFormId !== "string" || !UUID_PATTERN.test(onlyFormId))) {
    return res.status(400).json({ error: "formId must be a uuid when present" });
  }
  const cursor = Number.isFinite(Number(lastCursor)) ? Number(lastCursor) : 0;

  const accepted = [];
  const rejected = [];

  for (const change of changes || []) {
    const error = validateChange(change);
    if (error) {
      rejected.push({ id: change?.id || null, reason: "invalid", detail: error });
      continue;
    }

    // A response saved up from a device that had fetched it from Google itself: if the cloud already
    // holds a copy of that Google response under a different id, it's already saved — acknowledge
    // it without writing a duplicate.
    const googleResponseId =
      typeof change.payload.googleResponseId === "string" ? change.payload.googleResponseId : null;
    if (googleResponseId) {
      const existing = await repo.findGoogleImport(req.userId, change.formId, googleResponseId);
      if (existing && existing.response_id !== change.id) {
        accepted.push(change.id);
        continue;
      }
    }

    const result = await repo.upsertResponse({
      id: change.id,
      formId: change.formId,
      ownerId: req.userId,
      deviceId: req.deviceId,
      version: change.version,
      payload: change.payload,
      createdAt: change.createdAt,
      formVersion: change.formVersion ?? 1,
    });

    if (result.status === "accepted") {
      accepted.push(result.id);
      if (googleResponseId) await repo.recordGoogleImport(change.formId, googleResponseId, result.id);
    } else {
      rejected.push({ id: result.id, reason: result.reason });
    }
  }

  const { rows, pageSize } = await repo.listChangesSince(
    req.userId,
    cursor,
    typeof onlyFormId === "string" ? onlyFormId : null
  );
  const nextCursor = rows.length > 0 ? rows[rows.length - 1].server_seq : cursor;

  res.json({
    accepted,
    rejected,
    changes: rows.map((r) => ({
      id: r.id,
      formId: r.form_id,
      formVersion: r.form_version,
      version: r.version,
      deviceId: r.device_id,
      deviceName: r.device_name,
      payload: r.payload,
      serverSeq: r.server_seq,
    })),
    nextCursor,
    hasMore: rows.length === pageSize,
  });
});
