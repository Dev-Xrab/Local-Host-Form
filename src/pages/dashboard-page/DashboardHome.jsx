import { useState } from "react";
import { Link } from "react-router-dom";
import useDashboardStore from "../../../store/useDashboardStore";
import { Icons } from "./icons";
import { Monogram, initial } from "./Monogram";

export default function DashboardHome() {
  const quizzes = useDashboardStore((s) => s.quizzes);
  const subjects = useDashboardStore((s) => s.subjects);
  const forms = useDashboardStore((s) => s.forms);
  const stats = useDashboardStore((s) => s.stats);

  const [serverAddress] = useState("http://localhost:5174");
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard?.writeText(serverAddress).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const STATS = [
    { label: "Draft Quizzes", value: stats.draftQuizzes, icon: "fileText" },
    { label: "Recorded Quizzes", value: stats.recordedQuizzes, icon: "clipboard" },
    { label: "Subjects Handled", value: stats.subjectsHandled, icon: "book" },
  ];

  return (
    <>
      <header className="dash-header">
        <span className="dash-eyebrow">Admin</span>
        <h1 className="dash-title">Dashboard</h1>
        <p className="dash-subtitle">Manage quizzes, subjects, and forms from one place.</p>
      </header>

      <div className="dash-content">
        <div className="dash-top-row">
          <div className="dash-card server-card">
            <div className="server-card-top">
              <span className="server-icon">
                <Icons.pulse />
              </span>
              <span className="server-status">
                <span className="server-status-dot" />
                Online
              </span>
            </div>

            <span className="dashboard-card-label">Local Server</span>

            <div className="server-address-row">
              <span className="server-address">{serverAddress}</span>
              <button type="button" className="server-copy-btn" onClick={handleCopy} title="Copy address">
                {copied ? <Icons.check /> : <Icons.copy />}
              </button>
            </div>

            <div className="server-stats">
              <div className="server-stat">
                <span className="server-stat-value">1</span>
                <span className="server-stat-label">Quizzes Running</span>
              </div>
              <div className="server-stat">
                <span className="server-stat-value">0</span>
                <span className="server-stat-label">Students Connected</span>
              </div>
            </div>
          </div>

          <div className="dash-card quiz-table-card">
            <div className="quiz-table-top">
              <div>
                <span className="quiz-table-title">Live Quizzes</span>
                <span className="quiz-table-subtitle">{quizzes.length} quizzes currently running</span>
              </div>
              <Link to="/dashboard/quizzes" className="dash-view-all">
                View all
                <Icons.arrowRight className="quiz-open-icon" />
              </Link>
            </div>

            <div className="quiz-table-header">
              <span>Quiz</span>
              <span>Students</span>
              <span className="quiz-col-allotted">Time Allotted</span>
              <span>Time Remaining</span>
              <span />
            </div>

            <div className="quiz-table-body">
              {quizzes.map((quiz) => (
                <div className="quiz-row" key={quiz.id}>
                  <div className="quiz-name-cell">
                    <Monogram label={initial(quiz.name)} size={32} />
                    <div className="quiz-name-text">
                      <span className="quiz-name">{quiz.name}</span>
                      <span className="quiz-code">{quiz.code}</span>
                    </div>
                  </div>

                  <span className="quiz-students">
                    {quiz.students} / {quiz.capacity}
                  </span>

                  <span className="quiz-time-allotted">{quiz.timeAllotted} min</span>

                  <div className="quiz-time-remaining">
                    <span className="quiz-time-pill">{quiz.timeRemaining}</span>
                    <div className="quiz-progress-track">
                      <div className="quiz-progress-fill" style={{ width: `${quiz.progress}%` }} />
                    </div>
                  </div>

                  <Link to={`/dashboard/quizzes/${quiz.id}`} className="quiz-open-btn">
                    Open
                    <Icons.arrowRight className="quiz-open-icon" />
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="dash-stats-row">
          {STATS.map((stat) => {
            const Icon = Icons[stat.icon];
            return (
              <div className="dash-card stat-card" key={stat.label}>
                <div className="stat-card-top">
                  <span className="dashboard-card-label">{stat.label}</span>
                  <span className="stat-card-icon">
                    <Icon />
                  </span>
                </div>
                <span className="stat-card-value">{stat.value}</span>
              </div>
            );
          })}
        </div>

        <section className="dash-section">
          <div className="dash-section-header">
            <h2>Subjects</h2>
            <Link to="/dashboard/subjects" className="dash-view-all">
              View all
              <Icons.arrowRight className="quiz-open-icon" />
            </Link>
          </div>

          <div className="dash-card-grid">
            {subjects.slice(0, 3).map((subject) => (
              <div className="dash-item-card" key={subject.id}>
                <Monogram label={initial(subject.name)} />
                <span className="dash-item-title">{subject.name}</span>
                {subject.code && <span className="dash-item-subtitle">{subject.code}</span>}
                <span className="dash-item-divider" />
                <span className="dash-item-meta">Form Count: {subject.formCount}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="dash-section">
          <div className="dash-section-header">
            <h2>Recent Forms</h2>
            <Link to="/dashboard/forms" className="dash-view-all">
              View all
              <Icons.arrowRight className="quiz-open-icon" />
            </Link>
          </div>

          <div className="dash-card-grid">
            {forms.slice(0, 4).map((form) => (
              <div className="dash-item-card" key={form.id}>
                <Monogram label={<Icons.fileText />} />
                <span className="dash-item-title">{form.name}</span>
                <span className="dash-item-divider" />
                <span className="dash-item-meta">{form.description}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
