import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useForms } from "../../features/forms/hooks/useForms";
import { useSubjects } from "../../features/subjects/hooks/useSubjects";
import { useSessions } from "../../features/sessions/hooks/useSessions";
import { Icons } from "./icons";
import { Monogram, initial } from "./Monogram";
import QrCodeThumb from "./QrCodeThumb";
import { useServerOrigin } from "./useServerOrigin";
import "../../features/sessions/components/session.css";

export default function DashboardHome() {
  const { forms } = useForms();
  const { subjects } = useSubjects();
  const { sessions, refresh } = useSessions();

  const serverAddress = useServerOrigin();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  const handleCopy = () => {
    navigator.clipboard?.writeText(serverAddress).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const activeSessions = sessions.filter((s) => s.status === "active");
  const endedSessions = sessions.filter((s) => s.status === "ended");
  const studentsInProgress = activeSessions.reduce((sum, s) => sum + s.inProgressCount, 0);

  const STATS = [
    { label: "Forms", value: forms.length, icon: "fileText" },
    { label: "Ended Sessions", value: endedSessions.length, icon: "clipboard" },
    { label: "Subjects", value: subjects.length, icon: "book" },
  ];

  return (
    <>
      <header className="dash-header">
        <span className="dash-eyebrow">Admin</span>
        <h1 className="dash-title">Dashboard</h1>
        <p className="dash-subtitle">Manage sessions, subjects, and forms from one place.</p>
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
              <QrCodeThumb value={serverAddress} modalTitle="Scan to join server" />
            </div>

            <div className="server-stats">
              <div className="server-stat">
                <span className="server-stat-value">{activeSessions.length}</span>
                <span className="server-stat-label">Sessions Running</span>
              </div>
              <div className="server-stat">
                <span className="server-stat-value">{studentsInProgress}</span>
                <span className="server-stat-label">Students Connected</span>
              </div>
            </div>
          </div>

          <div className="dash-card quiz-table-card">
            <div className="quiz-table-top">
              <div>
                <span className="quiz-table-title">Live Sessions</span>
                <span className="quiz-table-subtitle">{activeSessions.length} sessions currently running</span>
              </div>
              <Link to="/dashboard/sessions" className="dash-view-all">
                View all
                <Icons.arrowRight className="quiz-open-icon" />
              </Link>
            </div>

            <div className="quiz-table-header dash-live-session-row">
              <span>Session</span>
              <span>Respondents</span>
              <span className="quiz-col-allotted">Time Limit</span>
              <span />
            </div>

            <div className="quiz-table-body">
              {activeSessions.length === 0 && <p className="dash-empty">No sessions running.</p>}
              {activeSessions.map((session) => (
                <div className="quiz-row dash-live-session-row" key={session.id}>
                  <div className="quiz-name-cell">
                    <Monogram label={initial(session.name || session.formTitle)} size={32} />
                    <div className="quiz-name-text">
                      <span className="quiz-name">{session.name || "Untitled session"}</span>
                      <span className="quiz-code">{session.code}</span>
                    </div>
                  </div>

                  <span className="quiz-students">
                    {session.submittedCount + session.inProgressCount} joined
                  </span>

                  <span className="quiz-time-allotted">
                    {session.durationMinutes ? `${session.durationMinutes} min` : "No limit"}
                  </span>

                  <Link to={`/dashboard/sessions/${session.id}`} className="quiz-open-btn">
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
            {subjects.length === 0 && <p className="dash-empty">No subjects yet.</p>}
            {subjects.slice(0, 3).map((subject) => (
              <Link className="dash-item-card dash-item-card-link" key={subject.id} to={`/dashboard/subjects/${subject.id}`}>
                <Monogram label={initial(subject.name)} />
                <span className="dash-item-title">{subject.name}</span>
                {subject.code && <span className="dash-item-subtitle">{subject.code}</span>}
                <span className="dash-item-divider" />
                <span className="dash-item-meta">Form Count: {subject.formCount}</span>
              </Link>
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
            {forms.length === 0 && <p className="dash-empty">No forms yet.</p>}
            {forms.slice(0, 4).map((form) => (
              <Link className="dash-item-card dash-item-card-link" key={form.id} to={`/forms/${form.id}`}>
                <Monogram label={<Icons.fileText />} />
                <span className="dash-item-title">{form.title || "Untitled form"}</span>
                <span className="dash-item-divider" />
                <span className="dash-item-meta">
                  {form.questionCount} question{form.questionCount === 1 ? "" : "s"}
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
