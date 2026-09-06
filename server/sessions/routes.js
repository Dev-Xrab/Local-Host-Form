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

// Mounted at /api/sessions
export const sessionsRouter = Router();

function withFormTitle(session) {
  const form = formsRepo.getForm(session.formId);
  return { ...session, formTitle: form?.title || "Untitled form", subjectId: form?.subjectId ?? null };
}

sessionsRouter.get("/", (req, res) => {
  res.json(sessionsRepo.listSessions().map(withFormTitle));
});

sessionsRouter.post("/", (req, res) => {
  const { name, formId, durationMinutes, responsesEditable } = req.body || {};
  if (!formId || typeof formId !== "string") {
    return res.status(400).json({ error: "formId is required" });
  }
  if (!formsRepo.getForm(formId)) {
    return res.status(400).json({ error: "formId does not refer to an existing form" });
  }
  if (durationMinutes !== undefined && durationMinutes !== null) {
    if (typeof durationMinutes !== "number" || durationMinutes <= 0) {
      return res.status(400).json({ error: "durationMinutes must be a positive number" });
    }
  }
  const session = sessionsRepo.createSession({
    formId,
    name: typeof name === "string" ? name.trim() : "",
    durationMinutes: durationMinutes || null,
    responsesEditable: !!responsesEditable,
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
  const result = sessionsRepo.updateSession(req.params.id, { name, durationMinutes });
  if (!result) return res.status(404).json({ error: "Session not found" });
  if (result === "not_draft") {
    return res.status(400).json({ error: "Only a session that hasn't started yet can be edited." });
  }
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
