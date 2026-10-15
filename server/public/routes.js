import { Router } from "express";
import * as formsRepo from "../forms/repository.js";
import * as sessionsRepo from "../sessions/repository.js";
import { isPlaceholderCode } from "../sessions/repository.js";
import * as responsesRepo from "../responses/repository.js";
import {
  findMissingRequiredQuestions,
  scoreResponse,
  buildAnswerReview,
  buildRespondentSummary,
} from "../responses/grading.js";
import { validateAnswers } from "../responses/validateAnswers.js";
import { scheduleAutoSync } from "../cloud/autosave.js";
import {
  joinLimiter,
  editCodeLimiter,
  refocusLimiter,
  isEditCodeLockedForSession,
  recordEditCodeFailure,
} from "../security/rateLimits.js";

export const publicRouter = Router();

const MAX_NAME_LENGTH = 100;
const MAX_CODE_LENGTH = 64;
// Also matches the older "device-<timestamp>-<hex>" fallback ids already stored on some devices.
const DEVICE_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;
// Stops an unauthenticated client from filling the host's disk with junk attempts.
const MAX_RESPONSES_PER_SESSION = 1000;

const isValidDeviceId = (value) => typeof value === "string" && DEVICE_ID_PATTERN.test(value);

// The deviceId is the only thing tying a respondent to their own response, so it's required to
// match exactly — a response with no device on record (imported, pulled from Google) is never
// reachable through these public routes at all.
function ownsResponse(response, deviceId) {
  return !!response.deviceId && isValidDeviceId(deviceId) && response.deviceId === deviceId;
}

const NOT_JOINABLE_MESSAGE =
  "That code belongs to responses synced from another device, so it can't be joined. Ask the host to start a new session for this form and use its code.";

function sessionCodeParam(req) {
  const code = String(req.params.code || "").trim().toUpperCase();
  return code.length > 0 && code.length <= MAX_CODE_LENGTH ? code : null;
}

// A question a Google structural sync marked removed (see server/forms/questionDiff.js) is kept
// server-side so its past answers stay labeled in All Responses, but a respondent filling out the
// form now must never see or be asked to answer it.
function stripAnswerKeys(form) {
  // Cloud/Google bookkeeping ids are host-side details a respondent never needs.
  const {
    remoteFormId: _r,
    remoteVersion: _v,
    remoteSavedAt: _s,
    hasUnsavedCloudChanges: _u,
    ownerUserId: _o,
    googleFormId: _g,
    subjectId: _sub,
    ...rest
  } = form;
  return {
    ...rest,
    questions: form.questions
      .filter((q) => !q.removedAt)
      .map(({ correctAnswerIndex: _a, correctAnswers: _b, ...q }) => q),
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
    refocusLockSeconds: session.refocusLockSeconds,
    fullscreenEnabled: session.fullscreenEnabled,
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
  return form.questions.filter((q) => q.type !== "section" && !q.removedAt);
}

function joinedPayload(session, response, form) {
  const base = {
    responseId: response.id,
    status: response.status,
    session: sessionSummary(session),
    deadlineAt: response.deadlineAt,
    // Present (and possibly still in the future) even across a reload — see
    // POST /responses/:id/refocus-lock — so the tab-refocus countdown can't be skipped by
    // reloading the page while it's running.
    refocusLockedUntil: response.refocusLockedUntil,
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

// A do-nothing endpoint a respondent's page polls to tell "the server is reachable" from "this
// device lost the connection" (see features/responses/hooks/useServerConnection.js). Deliberately
// touches no data, so polling it is cheap.
publicRouter.get("/ping", (req, res) => {
  res.set("Cache-Control", "no-store");
  res.status(204).end();
});

publicRouter.get("/sessions/:code", (req, res) => {
  const code = sessionCodeParam(req);
  const session = code && sessionsRepo.getSessionByCode(code);
  if (!session) return res.status(404).json({ error: "That code isn't valid." });
  if (isPlaceholderCode(session.code)) return res.status(400).json({ error: NOT_JOINABLE_MESSAGE });

  const form = formsRepo.getForm(session.formId);
  res.json({
    ...sessionSummary(session),
    formTitle: form.title,
    formDescription: form.description,
    // Needed before the respondent has joined (the form itself isn't sent until then).
    blurOnDisconnect: !!form.settings.blurOnDisconnect,
    restrictCopying: !!form.settings.restrictCopying,
  });
});

// Only edit-code attempts go through the (failure-counting) edit-code limiter — an ordinary
// join that fails validation shouldn't eat into a respondent's edit-code budget.
function limitEditCodeAttempts(req, res, next) {
  if (req.body?.editCode) return editCodeLimiter(req, res, next);
  next();
}

publicRouter.post("/sessions/:code/join", joinLimiter, limitEditCodeAttempts, (req, res) => {
  const code = sessionCodeParam(req);
  const session = code && sessionsRepo.getSessionByCode(code);
  if (!session) return res.status(404).json({ error: "That code isn't valid." });
  if (isPlaceholderCode(session.code)) return res.status(400).json({ error: NOT_JOINABLE_MESSAGE });

  const form = formsRepo.getForm(session.formId);
  const { name, deviceId, editCode } = req.body || {};

  if (!isValidDeviceId(deviceId)) {
    return res.status(400).json({ error: "This device couldn't be identified. Reload the page and try again." });
  }

  // Cross-device edit access: proving ownership with the response's own edit code instead
  // of the device that originally submitted it, so a respondent can fix an answer from a
  // different computer/phone without anyone else being able to reach their response.
  if (editCode) {
    if (typeof editCode !== "string" || editCode.length > 32) {
      return res.status(400).json({ error: "That edit code isn't valid." });
    }
    if (!canEditResponses(session)) {
      return res.status(403).json({ error: "Editing isn't currently allowed for this session." });
    }
    if (isEditCodeLockedForSession(session.id)) {
      return res.status(429).json({ error: "Too many incorrect edit codes have been tried in this session. Try again in 15 minutes." });
    }
    const existing = responsesRepo.findResponseByEditCode(session.id, editCode.trim().toUpperCase());
    if (!existing) {
      recordEditCodeFailure(session.id);
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
  if (name.trim().length > MAX_NAME_LENGTH) {
    return res.status(400).json({ error: `Your name must be ${MAX_NAME_LENGTH} characters or fewer.` });
  }
  if (session.respondentCount >= MAX_RESPONSES_PER_SESSION) {
    return res.status(409).json({ error: "This session has reached its maximum number of respondents." });
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
  if (!ownsResponse(response, req.query.deviceId)) {
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
  if (!ownsResponse(response, req.body?.deviceId)) {
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

// Called the instant a respondent's tab goes hidden (not when they come back — see
// server/db/index.js's comment on refocus_locked_until) so the countdown is anchored to a
// server-held timestamp a page reload can't reset. The session must actually have the setting
// on — a respondent tampering with the client can't invent a lock that wasn't configured, but
// they also can't clear a real one this way, since only the server ever advances or clears it.
publicRouter.post("/responses/:id/refocus-lock", refocusLimiter, (req, res) => {
  const response = responsesRepo.getResponse(req.params.id);
  if (!response) return res.status(404).json({ error: "Response not found" });
  if (!ownsResponse(response, req.body?.deviceId)) {
    return res.status(403).json({ error: "You don't have access to this response." });
  }
  if (response.status !== "in_progress") {
    return res.json({ refocusLockedUntil: response.refocusLockedUntil });
  }

  const session = sessionsRepo.getSession(response.sessionId);
  if (!session || !session.refocusLockSeconds) {
    return res.json({ refocusLockedUntil: null });
  }

  const lockedUntil = new Date(Date.now() + session.refocusLockSeconds * 1000).toISOString();
  const updated = responsesRepo.setRefocusLockUntil(response.id, lockedUntil);
  res.json({ refocusLockedUntil: updated.refocusLockedUntil });
});

// submitLimiter is applied in server/index.js, ahead of the (larger) body parser for this route.
publicRouter.post("/responses/:id/submit", (req, res) => {
  const response = responsesRepo.getResponse(req.params.id);
  if (!response) return res.status(404).json({ error: "Response not found" });
  if (!ownsResponse(response, req.body?.deviceId)) {
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
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
    return res.status(400).json({ error: "answers must be an object" });
  }

  const answerableQuestions = answerableQuestionsOf(form);
  const answerError = validateAnswers(answerableQuestions, answers);
  if (answerError) return res.status(400).json({ error: answerError });

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

  const saved = responsesRepo.submitResponse(response.id, {
    answers: cleanedAnswers,
    score,
    maxScore,
    formVersion: form.remoteVersion,
  });
  if (saved === "already_submitted") {
    return res.status(409).json({ error: "This response has already been submitted." });
  }

  scheduleAutoSync();
  res.status(200).json(joinedPayload(session, saved, form));
});
