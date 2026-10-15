import { Router } from "express";
import * as sessionsRepo from "./repository.js";
import * as formsRepo from "../forms/repository.js";
import * as responsesRepo from "../responses/repository.js";
import { buildFullBreakdown } from "../responses/grading.js";

// Mounted at /api/forms/:formId/sessions — a convenience listing, sessions themselves
// are managed as top-level resources (they're created by picking a form, not the reverse).
export const formSessionsRouter = Router({ mergeParams: true });

formSessionsRouter.get("/", (req, res) => {
  if (!formsRepo.getForm(req.params.formId)) {
    return res.status(404).json({ error: "Form not found" });
  }
  res.json(sessionsRepo.listSessionsForForm(req.params.formId));
});

// Mounted at /api/forms/:formId/responses — every submitted response to this form, across every
// session that used it, each run through the same buildFullBreakdown per-question detail the
// single-response endpoint below already uses. Powers the "All Responses" tab.
export const formResponsesRouter = Router({ mergeParams: true });

formResponsesRouter.get("/", (req, res) => {
  const form = formsRepo.getForm(req.params.formId);
  if (!form) return res.status(404).json({ error: "Form not found" });

  const responses = responsesRepo.listSubmittedResponsesForForm(req.params.formId);
  res.json(
    responses.map((r) => ({ ...r, breakdown: buildFullBreakdown(form.questions, r.answers) }))
  );
});

// Mounted at /api/sessions
export const sessionsRouter = Router();

function withFormTitle(session) {
  const form = formsRepo.getForm(session.formId);
  return {
    ...session,
    formTitle: form?.title || "Untitled form",
    subjectId: form?.subjectId ?? null,
    formIsCloudLinked: form?.remoteFormId != null,
  };
}

sessionsRouter.get("/", (req, res) => {
  res.json(sessionsRepo.listSessions().map(withFormTitle));
});

const MAX_SESSION_NAME_LENGTH = 200;
const MAX_DURATION_MINUTES = 7 * 24 * 60;

function validateSessionFields({ name, durationMinutes }) {
  if (name !== undefined && name !== null && (typeof name !== "string" || name.length > MAX_SESSION_NAME_LENGTH)) {
    return `name must be a string of at most ${MAX_SESSION_NAME_LENGTH} characters`;
  }
  if (durationMinutes !== undefined && durationMinutes !== null) {
    if (typeof durationMinutes !== "number" || !Number.isFinite(durationMinutes) || durationMinutes <= 0 || durationMinutes > MAX_DURATION_MINUTES) {
      return "durationMinutes must be a positive number of minutes (at most one week)";
    }
  }
  return null;
}

function validateRefocusLockSeconds(refocusLockSeconds) {
  if (refocusLockSeconds === undefined || refocusLockSeconds === null) return null;
  if (typeof refocusLockSeconds !== "number" || !Number.isInteger(refocusLockSeconds) || refocusLockSeconds <= 0 || refocusLockSeconds > 3600) {
    return "refocusLockSeconds must be a positive whole number of seconds";
  }
  return null;
}

sessionsRouter.post("/", (req, res) => {
  const { name, formId, durationMinutes, responsesEditable, refocusLockSeconds, fullscreenEnabled } = req.body || {};
  if (!formId || typeof formId !== "string") {
    return res.status(400).json({ error: "formId is required" });
  }
  if (!formsRepo.getForm(formId)) {
    return res.status(400).json({ error: "formId does not refer to an existing form" });
  }
  const fieldError = validateSessionFields({ name, durationMinutes });
  if (fieldError) return res.status(400).json({ error: fieldError });
  const refocusError = validateRefocusLockSeconds(refocusLockSeconds);
  if (refocusError) return res.status(400).json({ error: refocusError });

  const session = sessionsRepo.createSession({
    formId,
    name: typeof name === "string" ? name.trim() : "",
    durationMinutes: durationMinutes || null,
    responsesEditable: !!responsesEditable,
    refocusLockSeconds: refocusLockSeconds || null,
    fullscreenEnabled: !!fullscreenEnabled,
  });
  res.status(201).json(withFormTitle(session));
});

sessionsRouter.get("/:id", (req, res) => {
  const session = sessionsRepo.getSession(req.params.id);
  if (!session) return res.status(404).json({ error: "Session not found" });
  res.json(withFormTitle(session));
});

sessionsRouter.put("/:id", (req, res) => {
  const { name, durationMinutes } = req.body || {};
  const fieldError = validateSessionFields({ name, durationMinutes });
  if (fieldError) return res.status(400).json({ error: fieldError });
  const result = sessionsRepo.updateSession(req.params.id, { name, durationMinutes });
  if (!result) return res.status(404).json({ error: "Session not found" });
  res.json(withFormTitle(result));
});

sessionsRouter.post("/:id/editable", (req, res) => {
  const { editable } = req.body || {};
  if (typeof editable !== "boolean") {
    return res.status(400).json({ error: "editable must be a boolean" });
  }
  const session = sessionsRepo.setResponsesEditable(req.params.id, editable);
  if (!session) return res.status(404).json({ error: "Session not found" });
  res.json(withFormTitle(session));
});

// `seconds`: null/0 turns the countdown off; a positive integer sets it (see
// sessionsRepo.setRefocusLock and the respondent page's visibilitychange handling).
sessionsRouter.post("/:id/refocus-lock", (req, res) => {
  const { seconds } = req.body || {};
  if (seconds !== null && seconds !== undefined) {
    const error = validateRefocusLockSeconds(seconds);
    if (error) return res.status(400).json({ error });
  }
  const session = sessionsRepo.setRefocusLock(req.params.id, seconds || null);
  if (!session) return res.status(404).json({ error: "Session not found" });
  res.json(withFormTitle(session));
});

sessionsRouter.post("/:id/fullscreen", (req, res) => {
  const { enabled } = req.body || {};
  if (typeof enabled !== "boolean") {
    return res.status(400).json({ error: "enabled must be a boolean" });
  }
  const session = sessionsRepo.setFullscreenEnabled(req.params.id, enabled);
  if (!session) return res.status(404).json({ error: "Session not found" });
  res.json(withFormTitle(session));
});

sessionsRouter.post("/:id/start", (req, res) => {
  const session = sessionsRepo.startSession(req.params.id);
  if (!session) return res.status(404).json({ error: "Session not found" });
  res.json(withFormTitle(session));
});

sessionsRouter.post("/:id/end", (req, res) => {
  const session = sessionsRepo.endSession(req.params.id);
  if (!session) return res.status(404).json({ error: "Session not found" });
  res.json(withFormTitle(session));
});

sessionsRouter.post("/:id/reopen", (req, res) => {
  const session = sessionsRepo.reopenSession(req.params.id);
  if (!session) return res.status(404).json({ error: "Session not found" });
  res.json(withFormTitle(session));
});

// Deterministic priority ordering for the respondent table: currently active people
// first, then most-recently-active, oldest/inactive last — never an arbitrary DB order.
function sortRespondents(respondents) {
  const rank = (r) => (r.status === "in_progress" ? 0 : 1);
  const activityTime = (r) => new Date(r.submittedAt || r.startedAt || 0).getTime();
  return [...respondents].sort((a, b) => rank(a) - rank(b) || activityTime(b) - activityTime(a));
}

function stripSensitive(r) {
  const { score: _score, maxScore: _maxScore, ...rest } = r;
  return rest;
}

sessionsRouter.get("/:id/respondents", (req, res) => {
  const session = sessionsRepo.getSession(req.params.id);
  if (!session) return res.status(404).json({ error: "Session not found" });

  const respondents = sortRespondents(responsesRepo.listResponsesForSession(session.id));
  // A respondent's own score/answers become visible to the host as soon as THEY submit —
  // no need to wait for the whole session to end just to see one finished attempt. Anyone
  // still in_progress stays hidden until the session itself ends.
  const visible = session.status === "ended"
    ? respondents
    : respondents.map((r) => (r.status === "submitted" ? r : stripSensitive(r)));
  res.json(visible);
});

sessionsRouter.get("/:id/respondents/:responseId", (req, res) => {
  const session = sessionsRepo.getSession(req.params.id);
  if (!session) return res.status(404).json({ error: "Session not found" });

  const response = responsesRepo.getResponse(req.params.responseId);
  if (!response || response.sessionId !== session.id) {
    return res.status(404).json({ error: "Response not found" });
  }
  if (session.status !== "ended" && response.status !== "submitted") {
    return res.status(403).json({ error: "This respondent hasn't submitted yet." });
  }

  const form = formsRepo.getForm(session.formId);
  res.json({ ...response, breakdown: buildFullBreakdown(form.questions, response.answers) });
});

sessionsRouter.get("/:id/export", (req, res) => {
  const session = sessionsRepo.getSession(req.params.id);
  if (!session) return res.status(404).json({ error: "Session not found" });

  const form = formsRepo.getForm(session.formId);
  const respondents = sortRespondents(responsesRepo.listResponsesForSession(session.id));
  const rows = respondents.map((r) => {
    const full = responsesRepo.getResponse(r.id);
    return {
      ...r,
      percentage: r.maxScore ? Math.round((r.score / r.maxScore) * 1000) / 10 : null,
      breakdown: buildFullBreakdown(form.questions, full.answers),
    };
  });

  res.json({ session, formTitle: form.title, respondents: rows });
});

sessionsRouter.delete("/:id", (req, res) => {
  const deleted = sessionsRepo.deleteSession(req.params.id);
  if (!deleted) return res.status(404).json({ error: "Session not found" });
  res.status(204).end();
});
