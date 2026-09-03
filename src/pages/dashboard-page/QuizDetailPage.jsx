import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import useDashboardStore, { useDashboardActions } from "../../../store/useDashboardStore";
import { Icons } from "./icons";
import { Monogram, initial } from "./Monogram";
import { STATUS_LABEL, QUIZ_STATUS_LABEL, QUIZ_STATUS_PILL, sortParticipants } from "./resultsUtils";

const toCsvCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;

const exportCsv = (quiz, participants) => {
  const header = ["Name", "Email", "Status", "Joined At", "Score", "Time Taken"];
  const rows = participants.map((p) => [
    p.name,
    p.email,
    STATUS_LABEL[p.status],
    p.joinedAt,
    p.score ?? "",
    p.timeTaken ?? "",
  ]);

  const csv = [header, ...rows].map((row) => row.map(toCsvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `${quiz.name.trim().replace(/\s+/g, "-").toLowerCase()}-results.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export default function QuizDetailPage() {
  const { quizId } = useParams();
  const quizzes = useDashboardStore((s) => s.quizzes);
  const forms = useDashboardStore((s) => s.forms);
  const { updateQuiz } = useDashboardActions();

  const [sortBy, setSortBy] = useState("joinTime");

  const quiz = quizzes.find((q) => String(q.id) === quizId);

  if (!quiz) {
    return (
      <>
        <header className="dash-header">
          <Link to="/dashboard/quizzes" className="dash-back-link">
            <Icons.arrowLeft />
            Back to Quizzes
          </Link>
        </header>
        <div className="dash-content">
          <p className="dash-empty">This quiz couldn't be found.</p>
        </div>
      </>
    );
  }

  const attachedForm = forms.find((f) => String(f.id) === String(quiz.formId));
  const participants = sortParticipants(quiz.participants || [], sortBy);
  const isLive = quiz.status === "live";
  const isEnded = quiz.status === "ended";

  return (
    <>
      <header className="dash-header">
        <Link to="/dashboard/quizzes" className="dash-back-link">
          <Icons.arrowLeft />
          Back to Quizzes
        </Link>

        <div className="dash-header-row">
          <div>
            <span className="dash-eyebrow">{quiz.code || "Quiz"}</span>
            <h1 className="dash-title">{quiz.name}</h1>
            <p className="dash-subtitle">
              <span className={`status-pill ${QUIZ_STATUS_PILL[quiz.status]}`}>
                {QUIZ_STATUS_LABEL[quiz.status]}
              </span>
              {" · "}
              {quiz.students} of {quiz.capacity} students joined
            </p>
          </div>

          {!isEnded && (
            <div className="dash-quiz-actions">
              {isLive ? (
                <button
                  type="button"
                  className="dash-ghost-btn"
                  onClick={() => updateQuiz(quiz.id, { status: "paused" })}
                >
                  <Icons.pause />
                  Pause
                </button>
              ) : (
                <button
                  type="button"
                  className="dash-ghost-btn"
                  onClick={() => updateQuiz(quiz.id, { status: "live" })}
                >
                  <Icons.play />
                  Resume
                </button>
              )}

              <button
                type="button"
                className="dash-ghost-btn dash-danger-btn"
                onClick={() => updateQuiz(quiz.id, { status: "ended" })}
              >
                <Icons.square />
                Stop
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="dash-content">
        <div className="dash-stats-row">
          <div className="dash-card stat-card">
            <span className="dashboard-card-label">Students Joined</span>
            <span className="stat-card-value">
              {quiz.students}/{quiz.capacity}
            </span>
          </div>

          <div className="dash-card stat-card">
            <span className="dashboard-card-label">Time Remaining</span>
            <span className="stat-card-value">{quiz.timeRemaining}</span>
            <div className={`quiz-progress-track ${!isLive ? "quiz-progress-track-inactive" : ""}`}>
              <div className="quiz-progress-fill" style={{ width: `${quiz.progress}%` }} />
            </div>
          </div>

          <div className="dash-card stat-card">
            <span className="dashboard-card-label">Time Allotted</span>
            <span className="stat-card-value">{quiz.timeAllotted} min</span>
          </div>

          <div className="dash-card stat-card">
            <span className="dashboard-card-label">Attached Form</span>
            <span className="stat-card-value stat-card-value-text">
              {attachedForm ? attachedForm.name : "None attached"}
            </span>
          </div>
        </div>

        <section className="dash-section">
          <div className="dash-section-header">
            <h2>Results</h2>

            {participants.length > 0 && (
              <div className="dash-section-actions">
                <div className="dash-segment">
                  <button
                    type="button"
                    className={`dash-segment-btn ${sortBy === "joinTime" ? "dash-segment-btn-active" : ""}`}
                    onClick={() => setSortBy("joinTime")}
                  >
                    Join Time
                  </button>
                  <button
                    type="button"
                    className={`dash-segment-btn ${sortBy === "score" ? "dash-segment-btn-active" : ""}`}
                    onClick={() => setSortBy("score")}
                  >
                    Score
                  </button>
                </div>

                <button
                  type="button"
                  className="dash-ghost-btn"
                  onClick={() => exportCsv(quiz, participants)}
                >
                  <Icons.download />
                  Export
                </button>
              </div>
            )}
          </div>

          <div className="dash-card">
            {participants.length === 0 ? (
              <p className="dash-empty">No students have joined yet.</p>
            ) : (
              <>
                <div className="results-row results-row-header">
                  <span>#</span>
                  <span>Name</span>
                  <span>Email</span>
                  <span>Status</span>
                  <span>Joined At</span>
                  <span>Score</span>
                  <span>Time Taken</span>
                </div>

                {participants.map((p, i) => (
                  <div className="results-row" key={p.id}>
                    <Monogram label={i + 1} size={26} />
                    <div className="quiz-name-cell">
                      <Monogram label={initial(p.name)} size={26} />
                      <span className="quiz-name">{p.name}</span>
                    </div>
                    <span className="dash-item-meta">{p.email}</span>
                    <span className={`status-pill status-pill-${p.status}`}>
                      {STATUS_LABEL[p.status]}
                    </span>
                    <span className="dash-item-meta">{p.joinedAt}</span>
                    <span className="dash-item-meta">{p.score ?? "—"}</span>
                    <span className="dash-item-meta">{p.timeTaken ?? "—"}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
