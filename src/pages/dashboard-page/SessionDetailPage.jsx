import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { sessionsApi } from "../../features/sessions/services/sessionsApi";
import RespondentDetailModal from "../../features/sessions/components/RespondentDetailModal";
import ConfirmModal from "./ConfirmModal";
import { exportSessionsToWorkbook } from "../../features/sessions/utils/export";
import {
  formatClock,
  formatDateTime,
  respondentStatusInfo,
  secondsRemaining,
  STATUS_LABEL,
} from "../../features/sessions/utils/time";
import { Icons } from "./icons";
import { Monogram, initial } from "./Monogram";
import QrCodeThumb from "./QrCodeThumb";
import { useServerOrigin } from "./useServerOrigin";
import "../../features/sessions/components/session.css";

const SESSION_CONFIRM_CONFIG = {
  end: {
    title: "End Session",
    message: "Stop accepting new joins for this session? Respondents already answering keep their own time limit.",
    confirmLabel: "End Session",
    busyLabel: "Ending…",
  },
  reopen: {
    title: "Reopen Session",
    message: "Reopen this session? It will accept new joins again, and scores/answers will be hidden until you end it again.",
    confirmLabel: "Reopen Session",
    busyLabel: "Reopening…",
  },
  delete: {
    title: "Delete Session",
    message: "Delete this session? This can't be undone.",
    confirmLabel: "Delete",
    busyLabel: "Deleting…",
  },
};

function RespondentTimeLeft({ deadlineAt }) {
  const [, forceTick] = useState(0);
  useEffect(() => {
    if (!deadlineAt) return;
    const interval = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(interval);
  }, [deadlineAt]);

  if (!deadlineAt) return <span className="dash-item-meta">No limit</span>;
  return <span className="dash-item-meta">{formatClock(secondsRemaining(deadlineAt))}</span>;
}

export default function SessionDetailPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  const serverOrigin = useServerOrigin();
  const [session, setSession] = useState(null);
  const [respondents, setRespondents] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ready | not-found
  const [actionError, setActionError] = useState(null);
  const [working, setWorking] = useState(false);
  const [query, setQuery] = useState("");
  const [openResponseId, setOpenResponseId] = useState(null);
  const [openDetail, setOpenDetail] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", durationMinutes: "" });
  const [editError, setEditError] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null); // null | "end" | "reopen" | "delete"
  const [togglingEditable, setTogglingEditable] = useState(false);

  const load = useCallback(() => {
    Promise.all([sessionsApi.get(sessionId), sessionsApi.respondents(sessionId)])
      .then(([s, r]) => {
        setSession(s);
        setRespondents(r);
        setStatus("ready");
      })
      .catch(() => setStatus("not-found"));
  }, [sessionId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    if (openResponseId == null) return;
    sessionsApi
      .respondentDetail(sessionId, openResponseId)
      .then(setOpenDetail)
      .catch(() => setOpenDetail(null));
  }, [sessionId, openResponseId]);

  if (status === "loading") return <div className="dash-content"><p className="dash-empty">Loading session…</p></div>;

  if (status === "not-found" || !session) {
    return (
      <>
        <header className="dash-header">
          <Link to="/dashboard/sessions" className="dash-back-link">
            <Icons.arrowLeft />
            Back to Sessions
          </Link>
        </header>
        <div className="dash-content">
          <p className="dash-empty">This session couldn't be found.</p>
        </div>
      </>
    );
  }

  const isDraft = session.status === "draft";
  const isActive = session.status === "active";
  const isEnded = session.status === "ended";

  const runAction = async (fn) => {
    setWorking(true);
    setActionError(null);
    try {
      const updated = await fn();
      setSession(updated);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setWorking(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const data = await sessionsApi.exportData(session.id);
      await exportSessionsToWorkbook([data]);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setExporting(false);
    }
  };

  const handleConfirmSessionAction = async () => {
    if (confirmAction === "end") {
      setSession(await sessionsApi.end(session.id));
    } else if (confirmAction === "reopen") {
      setSession(await sessionsApi.reopen(session.id));
    } else if (confirmAction === "delete") {
      await sessionsApi.remove(session.id);
      navigate("/dashboard/sessions");
      return;
    }
    setConfirmAction(null);
  };

  const handleToggleEditable = async () => {
    setTogglingEditable(true);
    setActionError(null);
    try {
      const updated = await sessionsApi.setEditable(session.id, !session.responsesEditable);
      setSession(updated);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setTogglingEditable(false);
    }
  };

  const startEditing = () => {
    setEditForm({ name: session.name, durationMinutes: session.durationMinutes || "" });
    setEditError(null);
    setEditing(true);
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    try {
      const updated = await sessionsApi.update(session.id, {
        name: editForm.name.trim(),
        durationMinutes: editForm.durationMinutes ? Number(editForm.durationMinutes) : null,
      });
      setSession(updated);
      setEditing(false);
    } catch (err) {
      setEditError(err.message);
    }
  };

  const filtered = respondents.filter((r) =>
    (r.respondentName || "").toLowerCase().includes(query.toLowerCase())
  );
  // The set the < > arrows in the detail modal step through — same rows that are clickable
  // in the table below, in the same order, so paging never lands on one that isn't viewable.
  const viewableRespondents = filtered.filter((r) => isEnded || r.status === "submitted");
  const openIndex = openResponseId ? viewableRespondents.findIndex((r) => r.id === openResponseId) : -1;

  return (
    <>
      <header className="dash-header">
        <Link to="/dashboard/sessions" className="dash-back-link">
          <Icons.arrowLeft />
          Back to Sessions
        </Link>

        <div className="dash-header-row">
          <div>
            <span className="dash-eyebrow">{session.code}</span>
            <h1 className="dash-title">{session.name || "Untitled session"}</h1>
            <p className="dash-subtitle">
              <span className={`session-status-pill session-status-${session.status}`}>
                {STATUS_LABEL[session.status]}
              </span>
              {" · "}
              <Link to={`/forms/${session.formId}`} className="dash-subtitle-link">
                {session.formTitle}
              </Link>
            </p>
          </div>

          <div className="dash-quiz-actions">
            <Link
              to={`/forms/${session.formId}`}
              target="_blank"
              rel="noreferrer"
              className="dash-ghost-btn"
            >
              <Icons.fileText />
              View Form
            </Link>
            {isDraft && (
              <button type="button" className="dash-ghost-btn" disabled={working} onClick={startEditing}>
                Edit
              </button>
            )}
            {isDraft && (
              <button
                type="button"
                className="dash-primary-btn"
                disabled={working}
                onClick={() => runAction(() => sessionsApi.start(session.id))}
              >
                <Icons.play />
                Start Session
              </button>
            )}
            {isActive && (
              <button
                type="button"
                className="dash-ghost-btn dash-danger-btn"
                disabled={working}
                onClick={() => setConfirmAction("end")}
              >
                <Icons.square />
                End Session
              </button>
            )}
            {isEnded && (
              <button
                type="button"
                className="dash-ghost-btn"
                disabled={working}
                onClick={() => setConfirmAction("reopen")}
              >
                <Icons.play />
                Reopen Session
              </button>
            )}
            {respondents.length > 0 && (
              <button type="button" className="dash-ghost-btn" disabled={exporting} onClick={handleExport}>
                <Icons.download />
                {exporting ? "Exporting…" : "Export"}
              </button>
            )}
            <button
              type="button"
              className="dash-ghost-btn dash-danger-btn"
              onClick={() => setConfirmAction("delete")}
            >
              <Icons.trash />
              Delete
            </button>
          </div>
        </div>

        {actionError && <p className="dash-form-error">{actionError}</p>}

        {editing && (
          <form className="dash-card session-edit-card" onSubmit={saveEdit}>
            <label className="dash-form-field">
              <span className="dash-form-label">Session name</span>
              <input
                type="text"
                className="dash-form-input"
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                autoFocus
              />
            </label>
            <label className="dash-form-field">
              <span className="dash-form-label">Time limit per respondent (minutes, optional)</span>
              <input
                type="number"
                min="1"
                className="dash-form-input"
                placeholder="No limit"
                value={editForm.durationMinutes}
                onChange={(e) => setEditForm((f) => ({ ...f, durationMinutes: e.target.value }))}
              />
            </label>
            {editError && <p className="dash-form-error">{editError}</p>}
            <div className="dash-modal-footer">
              <button type="button" className="dash-ghost-btn" onClick={() => setEditing(false)}>
                Cancel
              </button>
              <button type="submit" className="dash-primary-btn">
                Save
              </button>
            </div>
          </form>
        )}

        <div className="dash-toggle-row">
          <button
            type="button"
            className={`dash-toggle ${session.responsesEditable ? "is-on" : ""}`}
            role="switch"
            aria-checked={session.responsesEditable}
            disabled={togglingEditable}
            onClick={handleToggleEditable}
          />
          <span>
            Allow respondents to edit their answer after submitting
            {session.responsesEditable && !isActive && " (only takes effect while the session is active)"}
          </span>
        </div>

        {!isEnded && (
          <div className="share-link-row">
            <span className="share-link-label">Share link</span>
            <code className="share-link-value">{`${serverOrigin}/s/${session.code}`}</code>
            <button
              type="button"
              className="session-btn"
              onClick={() => {
                navigator.clipboard?.writeText(`${serverOrigin}/s/${session.code}`).catch(() => {});
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? "Copied" : "Copy"}
            </button>
            <QrCodeThumb value={`${serverOrigin}/s/${session.code}`} modalTitle="Scan to join session" />
          </div>
        )}
      </header>

      <div className="dash-content">
        <div className="dash-stats-row">
          <div className="dash-card stat-card">
            <span className="dashboard-card-label">Respondents</span>
            <span className="stat-card-value">{respondents.length}</span>
          </div>
          <div className="dash-card stat-card">
            <span className="dashboard-card-label">Submitted</span>
            <span className="stat-card-value">{session.submittedCount}</span>
          </div>
          <div className="dash-card stat-card">
            <span className="dashboard-card-label">In Progress</span>
            <span className="stat-card-value">{session.inProgressCount}</span>
          </div>
          <div className="dash-card stat-card">
            <span className="dashboard-card-label">Time Limit</span>
            <span className="stat-card-value stat-card-value-text">
              {session.durationMinutes ? `${session.durationMinutes} min per respondent` : "No limit"}
            </span>
          </div>
          <div className="dash-card stat-card">
            <span className="dashboard-card-label">Started</span>
            <span className="stat-card-value stat-card-value-text">{formatDateTime(session.startedAt)}</span>
          </div>
          <div className="dash-card stat-card">
            <span className="dashboard-card-label">Ended</span>
            <span className="stat-card-value stat-card-value-text">{formatDateTime(session.endedAt)}</span>
          </div>
        </div>

        <section className="dash-section">
          <div className="dash-section-header">
            <h2>Respondents</h2>
            <div className="dash-search">
              <Icons.search className="dash-search-icon" />
              <input
                type="text"
                placeholder="Search respondents..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>

          {!isEnded && (
            <p className="session-privacy-note">
              A respondent's score and answers become viewable as soon as they submit. Everyone else's
              are available once this session has ended.
            </p>
          )}

          <div className="dash-card respondent-table-wrap">
            {filtered.length === 0 ? (
              <p className="dash-empty">No respondents yet.</p>
            ) : (
              <>
                <div className="respondent-row respondent-row-header">
                  <span>Respondent</span>
                  <span>Status</span>
                  <span>Time Left</span>
                  <span>Submitted</span>
                  <span>Score</span>
                  <span></span>
                </div>

                {filtered.map((r) => {
                  const statusInfo = respondentStatusInfo(r, session);
                  const viewable = isEnded || r.status === "submitted";
                  return (
                  <div
                    className={`respondent-row ${viewable ? "respondent-row-clickable" : ""}`}
                    key={r.id}
                    onClick={() => viewable && setOpenResponseId(r.id)}
                  >
                    <div className="quiz-name-cell">
                      <Monogram label={initial(r.respondentName || "?")} size={26} />
                      <span className="quiz-name">{r.respondentName || "Anonymous"}</span>
                    </div>
                    <span className={`status-pill status-pill-${statusInfo.modifier}`}>
                      {statusInfo.text}
                    </span>
                    {r.status === "in_progress" ? (
                      <RespondentTimeLeft deadlineAt={r.deadlineAt} />
                    ) : (
                      <span className="dash-item-meta">—</span>
                    )}
                    <span className="dash-item-meta">{formatDateTime(r.submittedAt)}</span>
                    <span className="dash-item-meta">
                      {viewable && r.score != null ? `${r.score}/${r.maxScore}` : "—"}
                    </span>
                    {viewable && <span className="respondent-row-open">View →</span>}
                  </div>
                  );
                })}
              </>
            )}
          </div>
        </section>
      </div>

      {openDetail && (
        <RespondentDetailModal
          respondent={openDetail}
          onClose={() => { setOpenResponseId(null); setOpenDetail(null); }}
          onPrev={
            viewableRespondents.length > 1 && openIndex > 0
              ? () => setOpenResponseId(viewableRespondents[openIndex - 1].id)
              : null
          }
          onNext={
            viewableRespondents.length > 1 && openIndex >= 0 && openIndex < viewableRespondents.length - 1
              ? () => setOpenResponseId(viewableRespondents[openIndex + 1].id)
              : null
          }
          position={openIndex >= 0 ? { index: openIndex, total: viewableRespondents.length } : null}
        />
      )}

      {confirmAction && (
        <ConfirmModal
          {...SESSION_CONFIRM_CONFIG[confirmAction]}
          onCancel={() => setConfirmAction(null)}
          onConfirm={handleConfirmSessionAction}
        />
      )}
    </>
  );
}
