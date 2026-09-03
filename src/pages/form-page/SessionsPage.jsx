import useFormStore, { useFormActions } from "../../../store/useFormStore";
import "./sessions-page.css";

const formatDateTime = (iso) => new Date(iso).toLocaleString();

export default function SessionsPage() {
  const sessions = useFormStore((s) => s.sessions);
  const { startSession, endSession, deleteSession } = useFormActions();

  const activeSessions = sessions.filter((s) => s.status === "active");
  const orderedSessions = [...sessions].reverse();

  return (
    <div className="sessions-page">
      <div className="sessions-header">
        <div className="sessions-header-text">
          <h1>Form Sessions</h1>
          <p className="sessions-subtitle">
            Each session is one run of this form. Start as many as you need — one per class, room, or shift.
          </p>
        </div>

        <button type="button" className="session-btn session-btn-start" onClick={startSession}>
          Start Session
        </button>
      </div>

      {activeSessions.length > 0 && (
        <div className="active-sessions-grid">
          {activeSessions.map((session) => (
            <div className="active-session-banner" key={session.id}>
              <span className="active-session-dot" />
              <div className="active-session-info">
                <span className="active-session-title">
                  Code <strong>{session.code}</strong>
                </span>
                <span className="active-session-meta">started {formatDateTime(session.startedAt)}</span>
              </div>
              <button
                type="button"
                className="session-btn session-btn-end"
                onClick={() => endSession(session.id)}
              >
                End
              </button>
            </div>
          ))}
        </div>
      )}

      {sessions.length === 0 ? (
        <div className="sessions-empty">
          <p>No sessions yet. Click "Start Session" to open this form and begin collecting data.</p>
        </div>
      ) : (
        <div className="sessions-container">
          <div className="sessions-stats">
            <div className="stat-card">
              <span className="stat-label">Total Sessions</span>
              <span className="stat-value">{sessions.length}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Active Now</span>
              <span className="stat-value">{activeSessions.length}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Total Responses</span>
              <span className="stat-value">
                {sessions.reduce((sum, s) => sum + s.responses.length, 0)}
              </span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Last Session</span>
              <span className="stat-value">{formatDateTime(orderedSessions[0].startedAt)}</span>
            </div>
          </div>

          <div className="sessions-list">
            <table className="sessions-table">
              <thead>
                <tr>
                  <th>Session #</th>
                  <th>Code</th>
                  <th>Status</th>
                  <th>Started</th>
                  <th>Ended</th>
                  <th>Responses</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {orderedSessions.map((session, index) => (
                  <tr key={session.id}>
                    <td>#{sessions.length - index}</td>
                    <td className="session-code-cell">{session.code}</td>
                    <td>
                      <span className={`session-status session-status-${session.status}`}>
                        {session.status === "active" ? "Active" : "Ended"}
                      </span>
                    </td>
                    <td>{formatDateTime(session.startedAt)}</td>
                    <td>{session.endedAt ? formatDateTime(session.endedAt) : "—"}</td>
                    <td>{session.responses.length}</td>
                    <td>
                      <div className="session-row-actions">
                        {session.status === "active" && (
                          <button
                            type="button"
                            className="end-session-btn"
                            onClick={() => endSession(session.id)}
                          >
                            End
                          </button>
                        )}
                        <button
                          type="button"
                          className="delete-session-btn"
                          title="Delete session"
                          onClick={() => deleteSession(session.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
