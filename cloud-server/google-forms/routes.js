import { Router } from "express";
import { listGoogleForms, getGoogleForm, GoogleApiError } from "./client.js";
import { translateGoogleForm } from "./translate.js";
import { importResponsesForForm } from "./repository.js";
import * as formsRepo from "../forms/repository.js";

export const googleFormsRouter = Router();

function handleGoogleApiError(err, res) {
  if (err instanceof GoogleApiError && err.status === 401) {
    return res.status(401).json({ error: "Google access expired — please sign out and sign in again." });
  }
  res.status(502).json({ error: err.message });
}

googleFormsRouter.get("/", async (req, res) => {
  try {
    res.json(await listGoogleForms(req.userId));
  } catch (err) {
    handleGoogleApiError(err, res);
  }
});

// Converts a real Google Form into a form THIS app owns (via the same createFormForOwner path
// as POST /api/forms) — from this point on it's an ordinary form in this system: syncable to
// the user's other devices through the exact same publish/import flow, with no separate code
// path for "Google-sourced" forms anywhere else in the app.
googleFormsRouter.post("/:id/import", async (req, res) => {
  try {
    const googleForm = await getGoogleForm(req.userId, req.params.id);
    const { title, description, questions, skipped } = translateGoogleForm(googleForm);

    if (questions.length === 0) {
      return res.status(422).json({
        error: "None of this form's questions could be imported (unsupported question types only).",
        skipped,
      });
    }

    const created = await formsRepo.createFormForOwner(req.userId, {
      title,
      description,
      settings: {},
      questions,
      googleFormId: req.params.id,
    });

    // The form itself is already created at this point — a failure pulling in its existing
    // responses (e.g. a missing/rejected OAuth scope) must not make the whole import look like
    // it failed and lose that form. Surfaced as `responseImportError` instead so the caller can
    // tell the user their form came in fine but responses didn't.
    let importedCount = 0;
    let skippedExistingCount = 0;
    let responseImportError = null;
    try {
      ({ importedCount, skippedExistingCount } = await importResponsesForForm(
        req.userId,
        created.id,
        req.params.id,
        questions
      ));
    } catch (err) {
      responseImportError = err.message;
    }

    res.status(201).json({
      ...created,
      skipped,
      importedResponseCount: importedCount,
      skippedExistingResponseCount: skippedExistingCount,
      responseImportError,
    });
  } catch (err) {
    handleGoogleApiError(err, res);
  }
});

// Read-only: fetches and translates the live Google Form this cloud-server form is linked to,
// without writing anything — the local device uses this to compute its own structural diff (see
// server/forms/questionDiff.js) before showing the host a decision dialog, and again to build the
// merged question list once the host picks "Sync From Online" (see
// server/cloud/routes.js GET /google-forms/:id/changes and POST /google-forms/:id/apply-changes).
googleFormsRouter.get("/:formId/live", async (req, res) => {
  try {
    const current = await formsRepo.getFormForOwner(req.userId, req.params.formId);
    if (!current) return res.status(404).json({ error: "Form not found." });
    if (!current.googleFormId) {
      return res.status(400).json({ error: "This form wasn't imported from Google Forms." });
    }

    const googleForm = await getGoogleForm(req.userId, current.googleFormId);
    const { questions, skipped } = translateGoogleForm(googleForm);
    res.json({ questions, skipped });
  } catch (err) {
    handleGoogleApiError(err, res);
  }
});

// "Update from Google": re-fetches the live Google Form and pulls in only what's genuinely new
// since the last import/refresh — never touches an existing question or re-imports an existing
// response (see importResponsesForForm's dedup-by-google_response_id and the append-only diff
// below). `:formId` here is THIS APP'S OWN cloud form id (not the Google Drive file id used by
// POST /:id/import above) — the two routes overload differently-shaped ids on purpose, since a
// per-form "update" button naturally knows the app's own form id, not Google's.
googleFormsRouter.post("/:formId/refresh", async (req, res) => {
  try {
    const current = await formsRepo.getFormForOwner(req.userId, req.params.formId);
    if (!current) return res.status(404).json({ error: "Form not found." });
    if (!current.googleFormId) {
      return res.status(400).json({ error: "This form wasn't imported from Google Forms." });
    }

    const googleForm = await getGoogleForm(req.userId, current.googleFormId);
    const { questions: liveQuestions, skipped: skippedUnsupported } = translateGoogleForm(googleForm);

    const existingIds = new Set(current.questions.map((q) => q.id));
    const newQuestions = liveQuestions.filter((q) => !existingIds.has(q.id));
    const skippedExistingQuestionCount = liveQuestions.length - newQuestions.length;

    const published = newQuestions.length
      ? await formsRepo.appendQuestionsAndPublish(req.userId, req.params.formId, newQuestions)
      : current;

    // Response answers are keyed against the FULL live question set (not just the new ones) so
    // an answer to a question imported earlier still resolves correctly. Best-effort, same as the
    // initial import above — the question/version update already happened and must not be lost
    // just because pulling in responses hit a scope or API error.
    let importedCount = 0;
    let skippedExistingCount = 0;
    let responseImportError = null;
    try {
      ({ importedCount, skippedExistingCount } = await importResponsesForForm(
        req.userId,
        req.params.formId,
        current.googleFormId,
        liveQuestions
      ));
    } catch (err) {
      responseImportError = err.message;
    }

    res.json({
      version: published.version,
      newQuestionCount: newQuestions.length,
      skippedExistingQuestionCount,
      skippedUnsupported,
      newResponseCount: importedCount,
      skippedExistingResponseCount: skippedExistingCount,
      responseImportError,
    });
  } catch (err) {
    handleGoogleApiError(err, res);
  }
});
