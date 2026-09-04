import { useState } from "react";
import { useNavigate } from "react-router-dom";
import useFormStore, { useFormActions } from "../../../store/useFormStore";
import { useSubjects } from "../../features/subjects/hooks/useSubjects";
import { formsApi } from "../../features/forms/services/formsApi";
import { downloadFormAsJson } from "../../features/forms/utils/exportForm";
import "./settings-page.css";

function ToggleRow({ label, description, checked, onChange, children }) {
  return (
    <div className="settings-row">
      <div className="settings-row-text">
        <span className="settings-row-label">{label}</span>
        {description && <span className="settings-row-desc">{description}</span>}
      </div>
      <div className="settings-row-control">
        {children}
        <label className="settings-toggle">
          <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
          <span className="settings-toggle-track" />
        </label>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const settings = useFormStore((s) => s.formSettings);
  const subjectId = useFormStore((s) => s.subjectId);
  const formId = useFormStore((s) => s.formId);
  const formTitle = useFormStore((s) => s.formTitle);
  const { updateFormSettings, setSubjectId } = useFormActions();
  const { subjects } = useSubjects();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(null);

  const handleExport = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const full = await formsApi.get(formId);
      downloadFormAsJson(full);
    } catch (err) {
      setExportError(err.message);
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await formsApi.remove(formId);
      navigate("/dashboard/forms");
    } catch (err) {
      setDeleteError(err.message);
      setDeleting(false);
    }
  };

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h1>Settings</h1>
        <p className="settings-subtitle">Everything here runs locally on this server — no accounts or internet required.</p>
      </div>

      <div className="settings-container">
        <div className="settings-group">
          <span className="settings-group-heading">Organization</span>

          <div className="settings-row">
            <div className="settings-row-text">
              <span className="settings-row-label">Subject</span>
              <span className="settings-row-desc">Group this form under a subject on the dashboard.</span>
            </div>
            <div className="settings-row-control">
              <select
                className="settings-subject-select"
                value={subjectId || ""}
                onChange={(e) => setSubjectId(e.target.value || null)}
              >
                <option value="">No subject</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="settings-group">
          <span className="settings-group-heading">Responses</span>

          <ToggleRow
            label="Allow multiple responses per device"
            description="Let the same device start a new attempt instead of resuming or blocking a repeat."
            checked={settings.allowMultipleResponses}
            onChange={(v) => updateFormSettings({ allowMultipleResponses: v })}
          />

          <p className="settings-note">
            Session codes and time limits are configured per session under Quizzes, not here — a form can be
            reused across many sessions.
          </p>
        </div>

        <div className="settings-group">
          <span className="settings-group-heading">Results</span>

          <ToggleRow
            label="Show score immediately"
            description="Respondents see their score right after submitting."
            checked={settings.showScoreImmediately}
            onChange={(v) => updateFormSettings({ showScoreImmediately: v })}
          />

          <ToggleRow
            label="Reveal correct answers"
            description="Respondents can see which answers were correct after submitting."
            checked={settings.revealCorrectAnswers}
            onChange={(v) => updateFormSettings({ revealCorrectAnswers: v })}
          />
        </div>

        <div className="settings-group">
          <span className="settings-group-heading">Downloads</span>

          <ToggleRow
            label="Include all choices in downloaded answers"
            description="When a respondent downloads their answers, also list every option for multiple-choice questions, not just the one they picked."
            checked={settings.downloadIncludesChoices}
            onChange={(v) => updateFormSettings({ downloadIncludesChoices: v })}
          />
        </div>

        <div className="settings-group">
          <span className="settings-group-heading">Backup</span>

          <div className="settings-row">
            <div className="settings-row-text">
              <span className="settings-row-label">Export this form</span>
              <span className="settings-row-desc">
                Download the questions, settings, and any embedded images as one JSON file — re-import it
                here or on another server to recreate this form.
              </span>
            </div>
            <div className="settings-row-control">
              <button type="button" className="settings-ghost-btn" onClick={handleExport} disabled={exporting}>
                {exporting ? "Exporting…" : "Export"}
              </button>
            </div>
          </div>
          {exportError && <p className="settings-confirm-error">{exportError}</p>}
        </div>

        <div className="settings-group">
          <span className="settings-group-heading">Danger zone</span>

          <div className="settings-row">
            <div className="settings-row-text">
              <span className="settings-row-label">Delete this form</span>
              <span className="settings-row-desc">
                Permanently deletes this form along with every session and response under it.
              </span>
            </div>
            <div className="settings-row-control">
              <button type="button" className="settings-danger-btn" onClick={() => setShowDeleteConfirm(true)}>
                Delete Form
              </button>
            </div>
          </div>
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="settings-confirm-overlay" onClick={() => !deleting && setShowDeleteConfirm(false)}>
          <div className="settings-confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <h2>Delete "{formTitle || "Untitled form"}"?</h2>
            <p>This permanently deletes the form, its questions, and every session and response under it.</p>
            {deleteError && <p className="settings-confirm-error">{deleteError}</p>}
            <div className="settings-confirm-actions">
              <button type="button" className="settings-ghost-btn" onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </button>
              <button type="button" className="settings-danger-btn" onClick={handleDelete} disabled={deleting}>
                {deleting ? "Deleting…" : "Delete Form"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
