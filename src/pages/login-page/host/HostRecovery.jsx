import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authApi } from "../../../features/auth/services/authApi";
import "./host-login.css";

export default function HostRecovery() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("loading"); // loading | ready | unavailable
  const [question, setQuestion] = useState(null);

  const [answer, setAnswer] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldError, setFieldError] = useState(null);
  const [serverError, setServerError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    authApi
      .getRecoveryQuestion()
      .then(({ question }) => {
        setQuestion(question);
        setStatus(question ? "ready" : "unavailable");
      })
      .catch(() => setStatus("unavailable"));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setServerError(null);

    if (!answer.trim() || !newPassword) {
      setFieldError("Answer and new password are both required.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setFieldError("New password and confirmation don't match.");
      return;
    }
    setFieldError(null);

    setSubmitting(true);
    try {
      await authApi.recoverPassword(answer.trim(), newPassword);
      setDone(true);
    } catch (err) {
      setServerError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "loading") {
    return <div className="host-login-content" />;
  }

  if (status === "unavailable") {
    return (
      <div className="host-login-content">
        <h1>Password recovery</h1>
        <p className="host-login-subtitle">
          No recovery question has been set up on this server, so it can't verify who you are.
          Ask whoever administers this server to reset it directly, or set one up under
          Settings → Security once logged back in.
        </p>
        <p className="host-login-footer">
          <Link to="/host/login">← Back to login</Link>
        </p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="host-login-content">
        <h1>Password reset</h1>
        <p className="host-login-subtitle">
          Your password has been changed. Log in with your new password.
        </p>
        <button type="button" className="host-login-submit" onClick={() => navigate("/host/login")}>
          Go to login
        </button>
      </div>
    );
  }

  return (
    <div className="host-login-content">
      <h1>Password recovery</h1>
      <p className="host-login-subtitle">Answer your recovery question to set a new password.</p>

      <form className="host-login-form" onSubmit={handleSubmit} noValidate>
        <div className="host-login-field">
          <label htmlFor="recovery-question">{question}</label>
          <input
            id="recovery-question"
            type="text"
            autoComplete="off"
            placeholder="Your answer"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            autoFocus
          />
        </div>

        <div className="host-login-field">
          <label htmlFor="recovery-new-password">New password</label>
          <input
            id="recovery-new-password"
            type="password"
            autoComplete="new-password"
            placeholder="New password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>

        <div className="host-login-field">
          <label htmlFor="recovery-confirm-password">Confirm new password</label>
          <input
            id="recovery-confirm-password"
            type="password"
            autoComplete="new-password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>

        {fieldError && <span className="host-login-error">{fieldError}</span>}
        {!fieldError && serverError && <span className="host-login-error">{serverError}</span>}

        <button type="submit" className="host-login-submit" disabled={submitting}>
          {submitting ? "Resetting…" : "Reset password"}
        </button>
      </form>

      <p className="host-login-footer">
        <Link to="/host/login">← Back to login</Link>
      </p>
    </div>
  );
}
