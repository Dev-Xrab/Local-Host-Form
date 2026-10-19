import { Router } from "express";
import { isConfigured } from "../oauth/config.js";
import { OAuthError } from "../oauth/googleClient.js";
import { GoogleApiError, listGoogleForms } from "./client.js";
import { applyChanges, checkChanges, getGoogleSyncedAt, importGoogleForm, pullResponses, syncAllLinkedForms } from "./sync.js";
import * as formsRepo from "../forms/repository.js";

export const googleFormsRouter = Router();

// A Google Drive file id, or a local form uuid. Checked up front so junk is a clean 404.
const GOOGLE_ID = /^[A-Za-z0-9_-]{10,200}$/;
const LOCAL_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
googleFormsRouter.param("googleId", (req, res, next, id) => (GOOGLE_ID.test(id) ? next() : res.status(404).json({ error: "Google Form not found." })));
googleFormsRouter.param("formId", (req, res, next, id) => (LOCAL_ID.test(id) ? next() : res.status(404).json({ error: "Form not found." })));

googleFormsRouter.use((req, res, next) => {
  if (!isConfigured()) return res.status(503).json({ error: "Google sign-in is not set up in this build." });
  next();
});

function fail(res, err) {
  if (err instanceof GoogleApiError || err instanceof OAuthError || err.status) {
    const status = [401, 403, 404, 422, 429].includes(err.status) || err.status === 400 ? err.status : 502;
    return res.status(status).json({ error: err.message, code: err.code, skipped: err.skipped });
  }
  console.error("Google Forms request failed:", err);
  res.status(500).json({ error: "Internal server error" });
}

const wrap = (handler) => async (req, res) => {
  try {
    await handler(req, res);
  } catch (err) {
    fail(res, err);
  }
};

// The user's Google Forms, newest first, marking the ones already on this device.
googleFormsRouter.get("/", wrap(async (req, res) => {
  const imported = new Map(formsRepo.listForms().filter((f) => f.googleFormId).map((f) => [f.googleFormId, f.id]));
  const forms = await listGoogleForms();
  res.json(forms.map((f) => ({ ...f, localFormId: imported.get(f.id) || null })));
}));

// Brings a Google Form (questions, then its responses) onto this device.
googleFormsRouter.post("/import/:googleId", wrap(async (req, res) => {
  const result = await importGoogleForm(req.params.googleId, { withResponses: req.query.responses !== "false" });
  res.status(result.alreadyImported ? 200 : 201).json(result);
}));

// Pulls every Google-linked form's new responses.
googleFormsRouter.post("/sync", wrap(async (req, res) => {
  res.json({ results: await syncAllLinkedForms() });
}));

googleFormsRouter.get("/:formId/status", wrap(async (req, res) => {
  const form = formsRepo.getForm(req.params.formId);
  if (!form) return res.status(404).json({ error: "Form not found." });
  res.json({ linked: !!form.googleFormId, googleFormId: form.googleFormId, lastSyncedAt: getGoogleSyncedAt(form.id) });
}));

// Pulls this form's new responses (incremental; nothing is fetched twice).
googleFormsRouter.post("/:formId/sync", wrap(async (req, res) => {
  res.json(await pullResponses(req.params.formId));
}));

// Read-only: how the live Google Form differs from the local copy.
googleFormsRouter.get("/:formId/changes", wrap(async (req, res) => {
  res.json(await checkChanges(req.params.formId));
}));

// Makes the local questions follow the live Google Form. Only on the host's say-so.
googleFormsRouter.post("/:formId/apply-changes", wrap(async (req, res) => {
  res.json(await applyChanges(req.params.formId));
}));
