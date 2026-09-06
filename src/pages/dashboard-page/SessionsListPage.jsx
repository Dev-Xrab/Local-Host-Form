import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useSessions } from "../../features/sessions/hooks/useSessions";
import { sessionsApi } from "../../features/sessions/services/sessionsApi";
import { useForms } from "../../features/forms/hooks/useForms";
import FormSearchSelect from "../../features/sessions/components/FormSearchSelect";
import { STATUS_LABEL } from "../../features/sessions/utils/time";
import { Icons } from "./icons";
import { Monogram, initial } from "./Monogram";
import PageHeader from "./PageHeader";
import Modal from "./Modal";
import "../../features/sessions/components/session.css";

const emptyForm = { name: "", formId: "", durationMinutes: "", responsesEditable: false };

export default function SessionsListPage() {
  const { sessions, loading, error, refresh } = useSessions();
  const { forms } = useForms();

  const [query, setQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);

  useEffect(() => {
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  const filtered = sessions.filter(
    (s) =>
      s.name.toLowerCase().includes(query.toLowerCase()) ||
      s.formTitle.toLowerCase().includes(query.toLowerCase())
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.formId || creating) return;

    setCreating(true);
    setCreateError(null);
    try {
      await sessionsApi.create({
        name: form.name.trim(),
        formId: form.formId,
        durationMinutes: form.durationMinutes ? Number(form.durationMinutes) : null,
        responsesEditable: form.responsesEditable,
      });
      setForm(emptyForm);
      setShowModal(false);
      refresh();
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Sessions"
        subtitle="Create and run form sessions, and monitor them while they're live."
        action={
          <button type="button" className="dash-primary-btn" onClick={() => setShowModal(true)}>
            <Icons.plus />
            Create Session
          </button>
        }
      />

      <div className="dash-content">
        <div className="dash-search dash-page-search">
          <Icons.search className="dash-search-icon" />
          <input
            type="text"
            placeholder="Search sessions..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="dash-card quiz-table-card">
          <div className="quiz-table-header session-table-header">
            <span>Session</span>
            <span>Status</span>
            <span>Respondents</span>
            <span>Time Limit</span>
            <span />
          </div>

          <div className="quiz-table-body quiz-table-body-full">
            {loading ? (
              <p className="dash-empty">Loading sessions…</p>
            ) : error ? (
              <p className="dash-empty">Couldn't load sessions — {error}</p>
            ) : filtered.length === 0 ? (
              <p className="dash-empty">No sessions found.</p>
            ) : (
              filtered.map((session) => (
                <div className="quiz-row session-row" key={session.id}>
                  <div className="quiz-name-cell">
                    <Monogram label={initial(session.name || session.formTitle)} size={32} />
                    <div className="quiz-name-text">
                      <span className="quiz-name">{session.name || "Untitled session"}</span>
                      <span className="quiz-code">{session.formTitle} · {session.code}</span>
                    </div>
                  </div>

                  <span className={`session-status-pill session-status-${session.status}`}>
                    {STATUS_LABEL[session.status]}
                  </span>

                  <span className="quiz-students">
                    {session.submittedCount + session.inProgressCount} joined
                    {session.status !== "draft" && ` · ${session.submittedCount} submitted`}
                  </span>

                  <span className="quiz-time-allotted">
                    {session.durationMinutes ? `${session.durationMinutes} min` : "No limit"}
                  </span>

                  <Link to={`/dashboard/sessions/${session.id}`} className="quiz-open-btn">
                    Open
                    <Icons.arrowRight className="quiz-open-icon" />
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {showModal && (
        <Modal title="Create Session" onClose={() => setShowModal(false)}>
          <form className="dash-form" onSubmit={handleSubmit}>
            <label className="dash-form-field">
              <span className="dash-form-label">Session name</span>
              <input
                type="text"
                className="dash-form-input"
                placeholder="e.g. Midterm Examination"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                autoFocus
              />
            </label>

            <label className="dash-form-field">
              <span className="dash-form-label">Attach form</span>
              <FormSearchSelect
                forms={forms}
                value={form.formId}
                onChange={(formId) => setForm((f) => ({ ...f, formId }))}
              />
            </label>

            <label className="dash-form-field">
              <span className="dash-form-label">Time limit per respondent (minutes, optional)</span>
              <input
                type="number"
                min="1"
                className="dash-form-input"
                placeholder="No limit"
                value={form.durationMinutes}
                onChange={(e) => setForm((f) => ({ ...f, durationMinutes: e.target.value }))}
              />
            </label>

            <label className="dash-form-field dash-form-checkbox-field">
              <input
                type="checkbox"
                checked={form.responsesEditable}
                onChange={(e) => setForm((f) => ({ ...f, responsesEditable: e.target.checked }))}
              />
              <span className="dash-form-label">Allow respondents to edit their answer after submitting</span>
            </label>

            {createError && <p className="dash-form-error">{createError}</p>}

            <div className="dash-modal-footer">
              <button type="button" className="dash-ghost-btn" onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button type="submit" className="dash-primary-btn" disabled={creating || !form.formId}>
                {creating ? "Creating…" : "Create Session"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
