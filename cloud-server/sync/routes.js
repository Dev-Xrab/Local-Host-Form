import { Router } from "express";
import * as repo from "./repository.js";

export const syncRouter = Router();

function validateChange(change) {
  if (!change || typeof change !== "object") return "each change must be an object";
  if (!change.id || typeof change.id !== "string") return "each change needs a string id";
  if (!change.formId || typeof change.formId !== "string") return "each change needs a string formId";
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
  const { lastCursor, changes } = req.body || {};

  if (changes !== undefined && !Array.isArray(changes)) {
    return res.status(400).json({ error: "changes must be an array when present" });
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

    if (result.status === "accepted") accepted.push(result.id);
    else rejected.push({ id: result.id, reason: result.reason });
  }

  const { rows, pageSize } = await repo.listChangesSince(req.userId, cursor);
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
