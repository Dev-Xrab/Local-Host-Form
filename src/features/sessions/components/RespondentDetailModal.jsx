import { useState } from "react";
import Modal from "../../../pages/dashboard-page/Modal";
import { Icons } from "../../../pages/dashboard-page/icons";
import logo from "../../../images/logo.png";
import "./respondent-detail.css";

function formatAnswer(value) {
  if (value === null || value === undefined || value === "") return "No answer";
  if (Array.isArray(value)) return value.join(", ") || "No answer";
  return String(value);
}

// The stored value is a raw data: URI (see server/responses/grading.js) — derive a
// sensible download filename from its mime type since the original filename isn't kept.
function fileNameFromDataUri(dataUri, questionTitle) {
  const mime = /^data:([^;]+);base64,/.exec(dataUri || "")?.[1] || "";
  const ext = mime.split("/")[1]?.split("+")[0];
  const base = (questionTitle || "attachment").trim().replace(/\s+/g, "-").toLowerCase() || "attachment";
  return ext ? `${base}.${ext}` : base;
}

function isImage(dataUri) {
  return /^data:image\//.test(dataUri || "");
}

export default function RespondentDetailModal({ respondent, onClose, onPrev, onNext, position }) {
  const [editCodeVisible, setEditCodeVisible] = useState(false);

  if (!respondent) return null;

  const headerActions = (
    <>
      {(onPrev || onNext) && (
        <div className="respondent-nav">
          <button
            type="button"
            className="respondent-nav-btn"
            disabled={!onPrev}
            onClick={onPrev || undefined}
            aria-label="Previous respondent"
          >
            <Icons.chevronLeft />
          </button>
          {position && (
            <span className="respondent-nav-position">
              {position.index + 1} / {position.total}
            </span>
          )}
          <button
            type="button"
            className="respondent-nav-btn"
            disabled={!onNext}
            onClick={onNext || undefined}
            aria-label="Next respondent"
          >
            <Icons.chevronRight />
          </button>
        </div>
      )}
      <button
        type="button"
        className="respondent-nav-btn"
        onClick={() => window.print()}
        aria-label="Print this response"
        title="Print / Save as PDF"
      >
        <Icons.printer />
      </button>
    </>
  );

  return (
    <Modal title={respondent.respondentName || "Respondent"} onClose={onClose} headerActions={headerActions}>
      <div className="respondent-detail">
        <div className="respondent-detail-print-header">
          <img src={logo} alt="" className="respondent-detail-print-logo" />
          <div>
            <p className="respondent-detail-print-app">StoneArch</p>
            <h2>{respondent.respondentName || "Anonymous"}</h2>
            <p>
              Score: {respondent.score ?? "—"} / {respondent.maxScore ?? "—"}
              {respondent.submittedAt ? ` · Submitted ${new Date(respondent.submittedAt).toLocaleString()}` : ""}
            </p>
          </div>
        </div>

        <div className="respondent-detail-summary">
          <span>
            Score: <strong>{respondent.score ?? "—"} / {respondent.maxScore ?? "—"}</strong>
          </span>
          {respondent.maxScore ? (
            <span>{Math.round((respondent.score / respondent.maxScore) * 1000) / 10}%</span>
          ) : null}
          {respondent.editCode && (
            <span className="respondent-edit-code">
              Edit code:{" "}
              <strong>{editCodeVisible ? respondent.editCode : "•".repeat(respondent.editCode.length)}</strong>
              <button
                type="button"
                className="respondent-edit-code-toggle"
                onClick={() => setEditCodeVisible((v) => !v)}
                aria-label={editCodeVisible ? "Hide edit code" : "Show edit code"}
                title={editCodeVisible ? "Hide edit code" : "Show edit code"}
              >
                {editCodeVisible ? <Icons.eyeOff /> : <Icons.eye />}
              </button>
            </span>
          )}
        </div>

        <div className="respondent-detail-questions">
          {respondent.breakdown.map((b, i) => (
            <div className="respondent-question" key={b.questionId}>
              <div className="respondent-question-header">
                <span className="respondent-question-index">Question {i + 1}</span>
                {b.gradable && (
                  <span className={`respondent-question-status ${b.correct ? "is-correct" : "is-wrong"}`}>
                    {b.correct ? "Correct" : "Incorrect"} · {b.pointsEarned}/{b.points}
                  </span>
                )}
              </div>
              <p className="respondent-question-title">{b.title || "Untitled question"}</p>

              <div className="respondent-answer-row">
                <span className="respondent-answer-label">Submitted</span>
                {b.fileUrl ? (
                  <a
                    className="respondent-file-link"
                    href={b.fileUrl}
                    download={fileNameFromDataUri(b.fileUrl, b.title)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Icons.download />
                    {isImage(b.fileUrl) ? "View / download image" : "Download file"}
                  </a>
                ) : (
                  <span className="respondent-answer-value">{formatAnswer(b.submittedAnswer)}</span>
                )}
              </div>
              {b.fileUrl && isImage(b.fileUrl) && (
                <a href={b.fileUrl} target="_blank" rel="noreferrer" className="respondent-file-preview-link">
                  <img className="respondent-file-preview" src={b.fileUrl} alt={b.title || "Uploaded file"} />
                </a>
              )}

              {b.gradable && (
                <div className="respondent-answer-row">
                  <span className="respondent-answer-label">Correct</span>
                  <span className="respondent-answer-value">{formatAnswer(b.correctAnswer)}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
