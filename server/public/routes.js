import { Router } from "express";
import * as formsRepo from "../forms/repository.js";
import * as sessionsRepo from "../sessions/repository.js";
import * as responsesRepo from "../responses/repository.js";
import {
  findMissingRequiredQuestions,
  scoreResponse,
  buildAnswerReview,
  buildRespondentSummary,
} from "../responses/grading.js";

export const publicRouter = Router();

function stripAnswerKeys(form) {
  return {
    ...form,
    questions: form.questions.map(({ correctAnswerIndex: _a, correctAnswers: _b, ...q }) => q),
  };
}

function sessionSummary(session) {
  return {
    id: session.id,
    name: session.name,
    code: session.code,
    status: session.status,
    durationMinutes: session.durationMinutes,
    responsesEditable: session.responsesEditable,
  };
}

// Editing a submitted answer is only ever allowed while the host still has the session
// open — ending it locks answers in place even if the "editable" toggle was left on.
function canEditResponses(session) {
  return session.responsesEditable && session.status === "active";
}

// A response with its own deadline can still be submitted a short grace period past it
// (covers the auto-submit-at-zero request landing late over the network); one with no
// deadline (untimed session) is only cut off if the host has explicitly ended the session.
function canStillSubmit(response, session) {
  if (response.deadlineAt) {
    return Date.now() - new Date(response.deadlineAt).getTime() < 30_000;
  }
  return session.status !== "ended";
}

function answerableQuestionsOf(form) {
  return form.questions.filter((q) => q.type !== "section");
}

function joinedPayload(session, response, form) {
  const base = {
    responseId: response.id,
    status: response.status,
    session: sessionSummary(session),
    deadlineAt: response.deadlineAt,
  };

  if (response.status === "in_progress") {
    // Included so a device reopening this response for editing (possibly not the device
    // that originally answered — see the edit-code flow below) can prefill what was already
    // there instead of starting blank; a brand-new in_progress response just has none yet.
    return { ...base, form: stripAnswerKeys(form), answers: response.answers };
  }

  const answerable = answerableQuestionsOf(form);
  return {
    ...base,
    score: form.settings.showScoreImmediately ? response.score : null,
    maxScore: form.settings.showScoreImmediately ? response.maxScore : null,
    review: form.settings.revealCorrectAnswers ? buildAnswerReview(answerable, response.answers) : null,
    answers: buildRespondentSummary(answerable, response.answers, {
      includeChoices: form.settings.downloadIncludesChoices,
    }),
    formTitle: form.title,
    // Always shown so the respondent can note it down, even if editing is currently
    // disabled — "responsesEditable" only gates whether the code can be *used* right now
    // (see canEditResponses), not whether it's issued at submission time.
    editCode: response.editCode,
  };
}

publicRouter.get("/sessions/:code", (req, res) => {
  const session = sessionsRepo.getSessionByCode(req.params.code.trim().toUpperCase());
  if (!session) return res.status(404).json({ error: "That code isn't valid." });

  const form = formsRepo.getForm(session.formId);
  res.json({ ...sessionSummary(session), formTitle: form.title, formDescription: form.description });
});

publicRouter.post("/sessions/:code/join", (req, res) => {
  const session = sessionsRepo.getSessionByCode(req.params.code.trim().toUpperCase());
  if (!session) return res.status(404).json({ error: "That code isn't valid." });

  const form = formsRepo.getForm(session.formId);
  const { name, deviceId, editCode } = req.body || {};

  // Cross-device edit access: proving ownership with the response's own edit code instead
  // of the device that originally submitted it, so a respondent can fix an answer from a
  // different computer/phone without anyone else being able to reach their response.
  if (editCode && typeof editCode === "string") {
    if (!canEditResponses(session)) {
      return res.status(403).json({ error: "Editing isn't currently allowed for this session." });
    }
    const existing = responsesRepo.findResponseByEditCode(session.id, editCode.trim().toUpperCase());
    if (!existing) {
      return res.status(404).json({ error: "That edit code doesn't match any response in this session." });
    }
    const reopened = responsesRepo.reopenResponseForEditing(existing.id, deviceId);
    return res.json(joinedPayload(session, reopened, form));
  }

  // Resuming an existing attempt (submitted -> show their result again; in_progress ->
  // keep answering) works regardless of the session's current status — ending a session
  // stops new joins, it doesn't retroactively lock out someone already mid-attempt or
  // someone coming back to see their own already-submitted result.
  if (!form.settings.allowMultipleResponses) {
    const existing = responsesRepo.findExistingResponse(session.id, deviceId);
    if (existing) {
      return res.json(joinedPayload(session, existing, form));
    }
  }

  if (session.status === "draft") {
    return res.status(400).json({ error: "This session hasn't started yet." });
  }
  if (session.status === "ended") {
    return res.status(400).json({ error: "This session has ended." });
  }
  if (!name || typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "Your name is required to join." });
  }

  const response = responsesRepo.createInProgressResponse({
    formId: form.id,
    sessionId: session.id,
    deviceId,
    respondentName: name.trim(),
    durationMinutes: session.durationMinutes,
  });
  res.status(201).json(joinedPayload(session, response, form));
});

publicRouter.get("/responses/:id", (req, res) => {
  const response = responsesRepo.getResponse(req.params.id);
  if (!response) return res.status(404).json({ error: "Response not found" });

  // A response ID alone isn't enough to view it — the requester must be the same
  // device that created it, so one respondent can't inspect another's by guessing an id.
  const deviceId = req.query.deviceId;
  if (response.deviceId && response.deviceId !== deviceId) {
    return res.status(403).json({ error: "You don't have access to this response." });
  }

  const session = sessionsRepo.getSession(response.sessionId);
  const form = formsRepo.getForm(response.formId);
  res.json(joinedPayload(session, response, form));
});

// Same-device edit: the respondent is looking at their own "done" screen right after
// submitting and taps "Edit my response" — ownership is already established by deviceId,
// same as GET /responses/:id above, so no edit code is needed on this path.
publicRouter.post("/responses/:id/edit", (req, res) => {
  const response = responsesRepo.getResponse(req.params.id);
  if (!response) return res.status(404).json({ error: "Response not found" });
  if (response.deviceId && response.deviceId !== req.body?.deviceId) {
    return res.status(403).json({ error: "You don't have access to this response." });
  }
  if (response.status !== "submitted") {
    return res.status(400).json({ error: "Only a submitted response can be edited." });
  }

  const session = sessionsRepo.getSession(response.sessionId);
  if (!canEditResponses(session)) {
    return res.status(403).json({ error: "Editing isn't currently allowed for this session." });
  }

  const form = formsRepo.getForm(response.formId);
  const reopened = responsesRepo.reopenResponseForEditing(response.id);
  res.json(joinedPayload(session, reopened, form));
});

publicRouter.post("/responses/:id/submit", (req, res) => {
  const response = responsesRepo.getResponse(req.params.id);
  if (!response) return res.status(404).json({ error: "Response not found" });
  if (response.deviceId && response.deviceId !== req.body?.deviceId) {
    return res.status(403).json({ error: "You don't have access to this response." });
  }
  if (response.status !== "in_progress") {
    return res.status(409).json({ error: "This response has already been submitted." });
  }

  const session = sessionsRepo.getSession(response.sessionId);
  if (!canStillSubmit(response, session)) {
    return res.status(400).json({ error: "Your time is up — this response can no longer be submitted." });
  }

  const form = formsRepo.getForm(response.formId);
  const { answers, timedOut } = req.body || {};
  if (!answers || typeof answers !== "object") {
    return res.status(400).json({ error: "answers must be an object" });
  }

  const answerableQuestions = answerableQuestionsOf(form);

  // A timed-out auto-submit skips the required-field gate (whatever was answered is
  // final); a deliberate submit still has to satisfy it.
  if (!timedOut) {
    const missing = findMissingRequiredQuestions(answerableQuestions, answers);
    if (missing.length > 0) {
      return res.status(400).json({
        error: "Some required questions are missing an answer.",
        missingQuestionIds: missing.map((q) => q.id),
      });
    }
  }

  const validIds = new Set(answerableQuestions.map((q) => q.id));
  const cleanedAnswers = Object.fromEntries(
    Object.entries(answers).filter(([id]) => validIds.has(id))
  );
  const { score, maxScore } = scoreResponse(answerableQuestions, cleanedAnswers);

  const saved = responsesRepo.submitResponse(response.id, { answers: cleanedAnswers, score, maxScore });
  if (saved === "already_submitted") {
    return res.status(409).json({ error: "This response has already been submitted." });
  }

  res.status(200).json(joinedPayload(session, saved, form));
});
