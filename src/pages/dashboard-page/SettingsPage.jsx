import { useState } from "react";
import { useNavigate } from "react-router-dom";
import useAuthStore, { useAuthActions } from "../../../store/useAuthStore";
import { authApi } from "../../features/auth/services/authApi";
import { settingsApi } from "../../features/settings/services/settingsApi";
import { Icons } from "./icons";
import Modal from "./Modal";
import PageHeader from "./PageHeader";

const CLEAR_DATA_CONFIRM_TEXT = "DELETE";

const TOGGLES = [
  { id: "requireLogin", label: "Require student login", description: "Students must sign in before joining a quiz.", icon: "lock", defaultChecked: true },
  { id: "autoSave", label: "Auto-save drafts", description: "Save form and quiz edits automatically as you type.", icon: "fileText", defaultChecked: true },
];

const emptyPasswordForm = { oldPassword: "", newPassword: "", confirmPassword: "" };
const emptyRecoveryForm = { currentPassword: "", question: "", answer: "" };

export default function SettingsPage() {
  const navigate = useNavigate();
  // See DashboardHome's server-card for why this reads window.location.origin instead of
  // a hardcoded address: the same Express process serves this page and the students hitting
  // it, so the page's own origin is always the correct one to share, whatever host/port that is.
  const [serverAddress] = useState(window.location.origin);
  const [copied, setCopied] = useState(false);
  const [toggles, setToggles] = useState(
    Object.fromEntries(TOGGLES.map((t) => [t.id, t.defaultChecked]))
  );

  const isDefaultPassword = useAuthStore((s) => s.isDefaultPassword);
  const hasRecoveryQuestion = useAuthStore((s) => s.hasRecoveryQuestion);
  const { passwordChanged, recoveryQuestionSet } = useAuthActions();
  const [passwordForm, setPasswordForm] = useState(emptyPasswordForm);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const [editingRecovery, setEditingRecovery] = useState(false);
  const [recoveryForm, setRecoveryForm] = useState(emptyRecoveryForm);
  const [recoverySaving, setRecoverySaving] = useState(false);
  const [recoveryError, setRecoveryError] = useState(null);
  const [recoverySuccess, setRecoverySuccess] = useState(false);

  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearConfirmText, setClearConfirmText] = useState("");
  const [clearing, setClearing] = useState(false);
  const [clearError, setClearError] = useState(null);

  const closeClearConfirm = () => {
    setShowClearConfirm(false);
    setClearConfirmText("");
    setClearError(null);
  };

  const handleClearData = async () => {
    if (clearConfirmText !== CLEAR_DATA_CONFIRM_TEXT || clearing) return;
    setClearing(true);
    setClearError(null);
    try {
      await settingsApi.clearData();
      navigate("/dashboard");
    } catch (err) {
      setClearError(err.message);
      setClearing(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard?.writeText(serverAddress).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleToggle = (id) => setToggles((prev) => ({ ...prev, [id]: !prev[id] }));

  const handlePasswordField = (field) => (e) => {
    setPasswordForm((f) => ({ ...f, [field]: e.target.value }));
    setPasswordSuccess(false);
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    if (!passwordForm.oldPassword || !passwordForm.newPassword) {
      setPasswordError("Current and new password are both required.");
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("New password and confirmation don't match.");
      return;
    }

    setPasswordSaving(true);
    try {
      await authApi.changePassword(passwordForm.oldPassword, passwordForm.newPassword);
      passwordChanged();
      setPasswordForm(emptyPasswordForm);
      setPasswordSuccess(true);
    } catch (err) {
      setPasswordError(err.message);
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleRecoveryField = (field) => (e) => {
    setRecoveryForm((f) => ({ ...f, [field]: e.target.value }));
    setRecoverySuccess(false);
  };

  const startEditingRecovery = () => {
    setRecoveryForm(emptyRecoveryForm);
    setRecoveryError(null);
    setEditingRecovery(true);
  };

  const cancelEditingRecovery = () => {
    setEditingRecovery(false);
    setRecoveryForm(emptyRecoveryForm);
    setRecoveryError(null);
  };

  const handleSetRecoveryQuestion = async (e) => {
    e.preventDefault();
    setRecoveryError(null);
    setRecoverySuccess(false);

    if (!recoveryForm.currentPassword || !recoveryForm.question.trim() || !recoveryForm.answer.trim()) {
      setRecoveryError("Your current password, a question, and an answer are all required.");
      return;
    }

    setRecoverySaving(true);
    try {
      await authApi.setRecoveryQuestion(
        recoveryForm.currentPassword,
        recoveryForm.question.trim(),
        recoveryForm.answer.trim()
      );
      recoveryQuestionSet();
      setRecoveryForm(emptyRecoveryForm);
      setRecoverySuccess(true);
      setEditingRecovery(false);
    } catch (err) {
      setRecoveryError(err.message);
    } finally {
      setRecoverySaving(false);
    }
  };

  return (
    <>
      <PageHeader eyebrow="Admin" title="Settings" subtitle="Configure how this server and your account behave." />

      <div className="dash-content">
        <section className="dash-section">
          <h2 className="dash-settings-heading">Server</h2>

          <div className="dash-card dash-settings-card">
            <div className="dash-settings-row">
              <div>
                <span className="dash-settings-row-label">Local server address</span>
                <span className="dash-settings-row-desc">Share this with students on the same network.</span>
              </div>

              <div className="server-address-row dash-settings-address">
                <span className="server-address">{serverAddress}</span>
                <button type="button" className="server-copy-btn" onClick={handleCopy} title="Copy address">
                  {copied ? <Icons.check /> : <Icons.copy />}
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="dash-section">
          <h2 className="dash-settings-heading">Preferences</h2>

          <div className="dash-card dash-settings-card">
            {TOGGLES.map((t, i) => {
              const Icon = Icons[t.icon];
              return (
                <div className={`dash-settings-row ${i > 0 ? "dash-settings-row-bordered" : ""}`} key={t.id}>
                  <div className="dash-settings-row-main">
                    <span className="dash-settings-row-icon">
                      <Icon />
                    </span>
                    <div>
                      <span className="dash-settings-row-label">{t.label}</span>
                      <span className="dash-settings-row-desc">{t.description}</span>
                    </div>
                  </div>

                  <label className="dash-toggle">
                    <input
                      type="checkbox"
                      checked={toggles[t.id]}
                      onChange={() => handleToggle(t.id)}
                    />
                    <span className="dash-toggle-track" />
                  </label>
                </div>
              );
            })}
          </div>
        </section>

        <section className="dash-section">
          <h2 className="dash-settings-heading">Security</h2>

          <div className="dash-card dash-settings-card">
            {isDefaultPassword && (
              <p className="dash-settings-note dash-settings-note-warn">
                You're still using the default password. Set your own below.
              </p>
            )}

            <form className="dash-form dash-password-form" onSubmit={handleChangePassword}>
              <label className="dash-form-field">
                <span className="dash-form-label">Current password</span>
                <input
                  type="password"
                  className="dash-form-input"
                  autoComplete="current-password"
                  value={passwordForm.oldPassword}
                  onChange={handlePasswordField("oldPassword")}
                />
              </label>

              <label className="dash-form-field">
                <span className="dash-form-label">New password</span>
                <input
                  type="password"
                  className="dash-form-input"
                  autoComplete="new-password"
                  value={passwordForm.newPassword}
                  onChange={handlePasswordField("newPassword")}
                />
              </label>

              <label className="dash-form-field">
                <span className="dash-form-label">Confirm new password</span>
                <input
                  type="password"
                  className="dash-form-input"
                  autoComplete="new-password"
                  value={passwordForm.confirmPassword}
                  onChange={handlePasswordField("confirmPassword")}
                />
              </label>

              {passwordError && <p className="dash-form-error">{passwordError}</p>}
              {passwordSuccess && <p className="dash-settings-note dash-settings-note-success">Password updated.</p>}

              <button type="submit" className="dash-primary-btn dash-password-submit" disabled={passwordSaving}>
                {passwordSaving ? "Saving…" : "Change Password"}
              </button>
            </form>
          </div>

          <div className="dash-card dash-settings-card">
            {!hasRecoveryQuestion && (
              <p className="dash-settings-note dash-settings-note-warn">
                No recovery question is set. If you forget your password, you won't be able to
                get back in without editing the database directly — set one below.
              </p>
            )}

            {hasRecoveryQuestion && !editingRecovery && (
              <div className="dash-settings-row">
                <div>
                  <span className="dash-settings-row-label">Recovery question</span>
                  <span className="dash-settings-row-desc">
                    Used on the login screen to reset your password if you forget it.
                  </span>
                </div>
                <button type="button" className="dash-ghost-btn" onClick={startEditingRecovery}>
                  Change
                </button>
              </div>
            )}

            {(!hasRecoveryQuestion || editingRecovery) && (
              <form className="dash-form dash-password-form" onSubmit={handleSetRecoveryQuestion}>
                <label className="dash-form-field">
                  <span className="dash-form-label">Recovery question</span>
                  <input
                    type="text"
                    className="dash-form-input"
                    placeholder="e.g. What was your first pet's name?"
                    value={recoveryForm.question}
                    onChange={handleRecoveryField("question")}
                  />
                </label>

                <label className="dash-form-field">
                  <span className="dash-form-label">Answer</span>
                  <input
                    type="text"
                    className="dash-form-input"
                    autoComplete="off"
                    value={recoveryForm.answer}
                    onChange={handleRecoveryField("answer")}
                  />
                </label>

                <label className="dash-form-field">
                  <span className="dash-form-label">Current password</span>
                  <input
                    type="password"
                    className="dash-form-input"
                    autoComplete="current-password"
                    value={recoveryForm.currentPassword}
                    onChange={handleRecoveryField("currentPassword")}
                  />
                </label>

                {recoveryError && <p className="dash-form-error">{recoveryError}</p>}

                <div className="dash-settings-row">
                  {editingRecovery && (
                    <button type="button" className="dash-ghost-btn" onClick={cancelEditingRecovery}>
                      Cancel
                    </button>
                  )}
                  <button type="submit" className="dash-primary-btn dash-password-submit" disabled={recoverySaving}>
                    {recoverySaving ? "Saving…" : hasRecoveryQuestion ? "Update recovery question" : "Set recovery question"}
                  </button>
                </div>
              </form>
            )}

            {recoverySuccess && (
              <p className="dash-settings-note dash-settings-note-success" style={{ margin: "0 20px 20px" }}>
                Recovery question saved.
              </p>
            )}
          </div>
        </section>

        <section className="dash-section">
          <h2 className="dash-settings-heading">Danger zone</h2>

          <div className="dash-card dash-settings-card">
            <div className="dash-settings-row">
              <div>
                <span className="dash-settings-row-label">Clear all local data</span>
                <span className="dash-settings-row-desc">Removes quizzes, subjects, and forms from this server.</span>
              </div>

              <button
                type="button"
                className="dash-ghost-btn dash-danger-btn"
                onClick={() => setShowClearConfirm(true)}
              >
                <Icons.trash />
                Clear data
              </button>
            </div>
          </div>
        </section>
      </div>

      {showClearConfirm && (
        <Modal title="Clear all local data" onClose={closeClearConfirm}>
          <div className="dash-form">
            <p className="dash-form-label">
              This permanently deletes every quiz, form, question, session, and response on
              this server, along with every subject except "General". This can't be undone.
            </p>

            <label className="dash-form-field">
              <span className="dash-form-label">
                Type <strong>{CLEAR_DATA_CONFIRM_TEXT}</strong> to confirm
              </span>
              <input
                type="text"
                className="dash-form-input"
                value={clearConfirmText}
                onChange={(e) => setClearConfirmText(e.target.value)}
                autoFocus
                autoComplete="off"
              />
            </label>

            {clearError && <p className="dash-form-error">{clearError}</p>}

            <div className="dash-modal-footer">
              <button type="button" className="dash-ghost-btn" onClick={closeClearConfirm}>
                Cancel
              </button>
              <button
                type="button"
                className="dash-ghost-btn dash-danger-btn"
                onClick={handleClearData}
                disabled={clearConfirmText !== CLEAR_DATA_CONFIRM_TEXT || clearing}
              >
                {clearing ? "Clearing…" : "Clear all data"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
