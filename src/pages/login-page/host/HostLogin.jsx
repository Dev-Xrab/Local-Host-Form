import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import useAuthStore, { useAuthActions } from "../../../../store/useAuthStore";
import "./host-login.css";

export default function HostLogin() {
  const navigate = useNavigate();
  const { login } = useAuthActions();
  const isSubmitting = useAuthStore((s) => s.isSubmitting);
  const serverError = useAuthStore((s) => s.error);

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldError, setFieldError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();

    if (!password) {
      setFieldError("Password is required");
      return;
    }
    setFieldError(null);

    const ok = await login(password);
    if (ok) navigate("/dashboard");
  }

  return (
    <div className="host-login-content">
      <h1>Log in as a Hoster</h1>
      <p className="host-login-subtitle">
        Manage your forms, sessions, and results.
      </p>

      <form className="host-login-form" onSubmit={handleSubmit} noValidate>
        <div className="host-login-field">
          <label htmlFor="host-password">Server password</label>
          <div className="host-login-password-wrap">
            <input
              id="host-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={!!fieldError}
              className={fieldError ? "input-error" : ""}
              autoFocus
            />
            <button
              type="button"
              className="host-login-toggle"
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          {fieldError && <span className="host-login-error">{fieldError}</span>}
          {!fieldError && serverError && <span className="host-login-error">{serverError}</span>}
        </div>

        <div className="host-login-row">
          <Link to="/host/recover" className="host-login-link">
            Forgot password?
          </Link>
        </div>

        <button type="submit" className="host-login-submit" disabled={isSubmitting}>
          {isSubmitting ? "Logging in…" : "Log in"}
        </button>
      </form>

      <p className="host-login-footer">
        Filling out a form instead?{" "}
        <Link to="/respondent/login">Continue as a Responder</Link>
      </p>
    </div>
  );
}
