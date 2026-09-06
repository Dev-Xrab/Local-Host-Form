import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AnswerQuestion from "../components/AnswerQuestion";
import { responsesApi } from "../services/responsesApi";
import { getDeviceId } from "../utils/deviceId";
import { downloadAnswersAsText } from "../utils/downloadAnswers";
import { formatClock, secondsRemaining } from "../../sessions/utils/time";
import "./respond-form.css";

const NAME_STORAGE_KEY = "stonearch_respondent_name";
const ANSWERS_STORAGE_PREFIX = "stonearch_respondent_answers_";

const isImageDataUri = (dataUri) => /^data:image\//.test(dataUri || "");

const isEmpty = (question, value) => {
  if (value === undefined || value === null) return true;
  if (question.type === "checkboxes") return !Array.isArray(value) || value.length === 0;
  return String(value).trim() === "";
};

// In-progress answers are mirrored to localStorage under the response's own id (stable
// across reloads for the same device+session, see the resume-by-deviceId join above) so a
// refresh mid-quiz restores exactly where the respondent left off instead of starting blank.
const loadStoredAnswers = (responseId) => {
  try {
    const raw = localStorage.getItem(ANSWERS_STORAGE_PREFIX + responseId);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const saveStoredAnswers = (responseId, answers) => {
  try {
    localStorage.setItem(ANSWERS_STORAGE_PREFIX + responseId, JSON.stringify(answers));
  } catch {
    // best-effort convenience only
  }
};

const clearStoredAnswers = (responseId) => {
  try {
    localStorage.removeItem(ANSWERS_STORAGE_PREFIX + responseId);
  } catch {
    // best-effort convenience only
  }
};

export default function RespondForm() {
  const { code } = useParams();
  const navigate = useNavigate();

  const [pageStatus, setPageStatus] = useState("loading"); // loading | not-found | join | answering | done
  const [sessionInfo, setSessionInfo] = useState(null);

  const [name, setName] = useState(() => {
    try {
      return localStorage.getItem(NAME_STORAGE_KEY) || "";
    } catch {
      return "";
    }
  });
  const [joinError, setJoinError] = useState(null);
  const [joining, setJoining] = useState(false);
  const [showEditCodeForm, setShowEditCodeForm] = useState(false);
  const [editCode, setEditCode] = useState("");
  const [editCodeError, setEditCodeError] = useState(null);
  const [submittingEditCode, setSubmittingEditCode] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [reopenError, setReopenError] = useState(null);

  const [responseId, setResponseId] = useState(null);
  const [form, setForm] = useState(null);
  const [deadlineAt, setDeadlineAt] = useState(null);

  const [answers, setAnswers] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitStatus, setSubmitStatus] = useState("idle"); // idle | submitting | error
  const [submitError, setSubmitError] = useState(null);
  const [result, setResult] = useState(null);
  const [autoSubmitted, setAutoSubmitted] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const [secondsLeft, setSecondsLeft] = useState(null);
  const submitStatusRef = useRef("idle");
  submitStatusRef.current = submitStatus;

  const loadSessionInfo = () => {
    responsesApi
      .getSessionByCode(code)
      .then((info) => {
        setSessionInfo(info);
        setPageStatus((prev) => (prev === "loading" ? "join" : prev));
      })
      .catch(() => setPageStatus("not-found"));
  };

  // Before asking for a name, try a silent resume: this device may already have a
  // response for this session — joined moments ago via the combined Identifier +
  // Session Code page, or from a previous visit to this same link — in which case we
  // skip straight to it instead of prompting again.
  useEffect(() => {
    let cancelled = false;
    responsesApi
      .join(code, { deviceId: getDeviceId() })
      .then((payload) => {
        if (!cancelled) applyJoinPayload(payload);
      })
      .catch(() => {
        if (!cancelled) loadSessionInfo();
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // While waiting on a session that hasn't started yet, poll so the join screen unlocks
  // the moment the host starts it, without the respondent needing to refresh.
  useEffect(() => {
    if (pageStatus !== "join" || sessionInfo?.status !== "draft") return;
    const interval = setInterval(loadSessionInfo, 4000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageStatus, sessionInfo?.status]);

  const answerableQuestions = useMemo(
    () => (form ? form.questions.filter((q) => q.type !== "section") : []),
    [form]
  );
  const questionsById = useMemo(
    () => Object.fromEntries(answerableQuestions.map((q) => [q.id, q])),
    [answerableQuestions]
  );

  const applyJoinPayload = (payload) => {
    setResponseId(payload.responseId);
    if (payload.status === "submitted") {
      clearStoredAnswers(payload.responseId);
      setResult(payload);
      setPageStatus("done");
    } else {
      setForm(payload.form);
      setDeadlineAt(payload.deadlineAt);
      // A local draft (this device, still mid-attempt) wins if there is one; otherwise fall
      // back to whatever the server has for this response — the case when editing a
      // previously-submitted answer, possibly from a different device than the one that
      // originally submitted it.
      const stored = loadStoredAnswers(payload.responseId);
      setAnswers(Object.keys(stored).length > 0 ? stored : payload.answers || {});
      setPageStatus("answering");
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    setJoining(true);
    setJoinError(null);
    try {
      const payload = await responsesApi.join(code, { name: name.trim(), deviceId: getDeviceId() });
      try {
        localStorage.setItem(NAME_STORAGE_KEY, name.trim());
      } catch {
        // best-effort convenience only
      }
      applyJoinPayload(payload);
    } catch (err) {
      setJoinError(err.message);
    } finally {
      setJoining(false);
    }
  };

  const handleEditCodeSubmit = async (e) => {
    e.preventDefault();
    setSubmittingEditCode(true);
    setEditCodeError(null);
    try {
      const payload = await responsesApi.join(code, { editCode: editCode.trim(), deviceId: getDeviceId() });
      applyJoinPayload(payload);
    } catch (err) {
      setEditCodeError(err.message);
    } finally {
      setSubmittingEditCode(false);
    }
  };

  const handleEditFromDone = async () => {
    setReopening(true);
    setReopenError(null);
    try {
      const payload = await responsesApi.editResponse(responseId, getDeviceId());
      applyJoinPayload(payload);
    } catch (err) {
      setReopenError(err.message);
    } finally {
      setReopening(false);
    }
  };

  // Mirror answers to localStorage as the respondent types/selects, so a reload (or the
  // browser crashing, or accidentally closing the tab) restores this response's progress
  // via applyJoinPayload's silent resume instead of losing it.
  useEffect(() => {
    if (pageStatus !== "answering" || !responseId) return;
    saveStoredAnswers(responseId, answers);
  }, [pageStatus, responseId, answers]);

  const submitAnswers = async ({ timedOut = false } = {}) => {
    setSubmitStatus("submitting");
    setSubmitError(null);
    try {
      const res = await responsesApi.submit(responseId, { answers, timedOut, deviceId: getDeviceId() });
      clearStoredAnswers(responseId);
      setResult(res);
      setAutoSubmitted(timedOut);
      setPageStatus("done");
    } catch (err) {
      setSubmitStatus("error");
      if (err.status === 400 && err.body?.missingQuestionIds) {
        setFieldErrors(
          Object.fromEntries(err.body.missingQuestionIds.map((id) => [id, "This question is required."]))
        );
        setSubmitError("Some required questions are missing an answer.");
      } else {
        setSubmitError(err.message);
      }
    }
  };

  // The timer is always derived from THIS respondent's own server-provided deadline
  // (set once, at join time) — never a locally-stored duration — so it stays correct
  // across refresh and can't be tampered with client-side.
  useEffect(() => {
    if (pageStatus !== "answering" || !deadlineAt) return;

    const tick = () => {
      const remaining = secondsRemaining(deadlineAt);
      setSecondsLeft(remaining);
      if (remaining <= 0 && (submitStatusRef.current === "idle" || submitStatusRef.current === "error")) {
        submitAnswers({ timedOut: true });
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageStatus, deadlineAt]);

  // Safety net for untimed responses: detect the host manually ending the session while
  // this respondent is still answering (a timed response is governed by its own deadline
  // above and isn't cut off just because the session stopped accepting new joiners).
  useEffect(() => {
    if (pageStatus !== "answering" || !responseId || deadlineAt) return;
    const interval = setInterval(() => {
      responsesApi.getResponse(responseId, getDeviceId()).then((payload) => {
        if (payload.session.status === "ended" && submitStatusRef.current === "idle") {
          submitAnswers({ timedOut: true });
        }
      }).catch(() => {});
    }, 8000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageStatus, responseId, deadlineAt]);

  const setAnswer = (questionId, value) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    setFieldErrors((prev) => (prev[questionId] ? { ...prev, [questionId]: undefined } : prev));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const missing = answerableQuestions.filter((q) => q.required && isEmpty(q, answers[q.id]));
    if (missing.length > 0) {
      setFieldErrors(Object.fromEntries(missing.map((q) => [q.id, "This question is required."])));
      document
        .getElementById(`answer-${missing[0].id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    submitAnswers();
  };

  const handleExit = () => {
    if (pageStatus === "answering") {
      setShowExitConfirm(true);
    } else {
      navigate("/");
    }
  };

  if (pageStatus === "loading") {
    return <div className="respond-page-message">Loading…</div>;
  }

  if (pageStatus === "not-found") {
    return <div className="respond-page-message respond-page-message-error">That code isn't valid.</div>;
  }

  if (pageStatus === "join") {
    const isDraft = sessionInfo.status === "draft";
    const isEnded = sessionInfo.status === "ended";
    return (
      <div className="respond-page">
        <div className="respond-code-card">
          <button type="button" className="respond-exit-link" onClick={() => navigate("/")}>
            ← Leave
          </button>
          <h1>{sessionInfo.formTitle || "Untitled form"}</h1>
          <p>{sessionInfo.name}</p>

          {isDraft && <p className="respond-code-error">This session hasn't started yet — waiting for the host…</p>}
          {isEnded && <p className="respond-code-error">This session has ended.</p>}

          <form onSubmit={handleJoin} className="respond-code-form respond-join-form">
            <input
              type="text"
              className="respond-code-input respond-name-input"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              disabled={isDraft}
            />
            <button type="submit" className="respond-code-submit" disabled={joining || isDraft || !name.trim()}>
              {joining ? "Joining…" : "Continue"}
            </button>
          </form>
          {joinError && <p className="respond-code-error">{joinError}</p>}

          {sessionInfo.responsesEditable && sessionInfo.status === "active" && (
            <div className="respond-edit-code-section">
              {showEditCodeForm ? (
                <form onSubmit={handleEditCodeSubmit} className="respond-code-form">
                  <input
                    type="text"
                    className="respond-code-input"
                    placeholder="Your edit code"
                    value={editCode}
                    onChange={(e) => setEditCode(e.target.value)}
                    autoFocus
                  />
                  <button type="submit" className="respond-code-submit" disabled={submittingEditCode || !editCode.trim()}>
                    {submittingEditCode ? "Looking up…" : "Edit my response"}
                  </button>
                </form>
              ) : (
                <button type="button" className="respond-edit-code-link" onClick={() => setShowEditCodeForm(true)}>
                  Already submitted? Edit your response
                </button>
              )}
              {editCodeError && <p className="respond-code-error">{editCodeError}</p>}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (pageStatus === "done") {
    return (
      <div className="respond-page">
        <div className="respond-done-card respond-done-card-wide">
          <h1>Response recorded</h1>
          <p>
            {autoSubmitted
              ? "Time was up, so your response was submitted automatically."
              : "Thanks — your response has been submitted."}
          </p>
          {result?.score !== null && result?.score !== undefined && (
            <p className="respond-score">
              Score: {result.score} / {result.maxScore}
            </p>
          )}

          {Array.isArray(result?.review) && result.review.length > 0 && (
            <div className="respond-review-list">
              {result.review.map((r) => (
                <div
                  className={`respond-review-item ${
                    r.gradable ? (r.correct ? "respond-review-item-correct" : "respond-review-item-wrong") : ""
                  }`}
                  key={r.questionId}
                >
                  {r.gradable && <span className="respond-review-mark">{r.correct ? "✓" : "✗"}</span>}
                  <div className="respond-review-text">
                    <span className="respond-review-question">
                      {r.title || questionsById[r.questionId]?.title || "Question"}
                    </span>
                    {r.questionImageUrl && (
                      <img className="respond-review-image" src={r.questionImageUrl} alt="" />
                    )}
                    <span className="respond-review-answer">Your answer: {r.submittedAnswer || "No answer"}</span>
                    {r.fileUrl && isImageDataUri(r.fileUrl) && (
                      <img className="respond-review-image" src={r.fileUrl} alt="" />
                    )}
                    {r.gradable && !r.correct && (
                      <span className="respond-review-answer">Correct answer: {r.correctAnswer}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {Array.isArray(result?.answers) && result.answers.length > 0 && (
            <button
              type="button"
              className="respond-download-btn"
              onClick={() => downloadAnswersAsText(result.formTitle, result.answers)}
            >
              <span>↓</span> Download my answers
            </button>
          )}

          {result?.editCode && (
            <div className="respond-edit-section">
              {result?.session?.responsesEditable && result?.session?.status === "active" && (
                <button
                  type="button"
                  className="respond-download-btn"
                  onClick={handleEditFromDone}
                  disabled={reopening}
                >
                  <span>✎</span> {reopening ? "Opening…" : "Edit my response"}
                </button>
              )}
              <p className="respond-edit-code-note">
                Your edit code: <strong>{result.editCode}</strong> — save this in case you want to edit your
                response later from a different device (you'll also need this session's code).
              </p>
              {reopenError && <p className="respond-code-error">{reopenError}</p>}
            </div>
          )}

          <button type="button" className="respond-code-submit respond-done-exit" onClick={() => navigate("/")}>
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="respond-page">
      <form className="respond-form-column" onSubmit={handleSubmit}>
        <div className="respond-form-header">
          <div className="respond-form-header-row">
            <button type="button" className="respond-exit-link" onClick={handleExit}>
              ← Leave
            </button>
            {secondsLeft !== null && (
              <span className={`respond-timer ${secondsLeft <= 60 ? "respond-timer-urgent" : ""}`}>
                {formatClock(secondsLeft)}
              </span>
            )}
          </div>
          <h1>{form.title || "Untitled form"}</h1>
          {form.description && <p>{form.description}</p>}
        </div>

        {answerableQuestions.map((q, i) => (
          <div id={`answer-${q.id}`} key={q.id}>
            <AnswerQuestion
              question={q}
              index={i}
              value={answers[q.id]}
              onChange={(value) => setAnswer(q.id, value)}
              error={fieldErrors[q.id]}
            />
          </div>
        ))}

        {answerableQuestions.length === 0 && (
          <p className="respond-page-message">This form doesn't have any questions yet.</p>
        )}

        {submitError && <p className="respond-submit-error">{submitError}</p>}

        <button type="submit" className="respond-submit-btn" disabled={submitStatus === "submitting"}>
          {submitStatus === "submitting" ? "Submitting…" : "Submit"}
        </button>
      </form>

      {showExitConfirm && (
        <div className="respond-exit-overlay">
          <div className="respond-exit-dialog">
            <h2>Leave quiz?</h2>
            <p>Your progress may be lost if you leave before submitting.</p>
            <div className="respond-exit-actions">
              <button type="button" className="dash-ghost-btn" onClick={() => setShowExitConfirm(false)}>
                Stay
              </button>
              <button type="button" className="respond-exit-confirm" onClick={() => navigate("/")}>
                Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
