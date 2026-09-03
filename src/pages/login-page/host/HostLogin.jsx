import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "./host-login.css";

export default function HostLogin() {
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});

  function validate() {
    const nextErrors = {};

    if (!identifier.trim()) {
      nextErrors.identifier = "Email or username is required";
    }

    if (!password) {
      nextErrors.password = "Password is required";
    }

    return nextErrors;
  }

  function handleSubmit(e) {
    e.preventDefault();

    const nextErrors = validate();
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length === 0) {
      navigate("/dashboard");
    }
  }

  return (
    <div className="host-login-content">
      <h1>Log in as a Hoster</h1>
      <p className="host-login-subtitle">
        Manage your forms, sessions, and results.
      </p>

      <form className="host-login-form" onSubmit={handleSubmit} noValidate>
        <div className="host-login-field">
          <label htmlFor="host-identifier">Email or username</label>
          <input
            id="host-identifier"
            type="text"
            autoComplete="username"
            placeholder="you@example.com"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            aria-invalid={!!errors.identifier}
            className={errors.identifier ? "input-error" : ""}
          />
          {errors.identifier && (
            <span className="host-login-error">{errors.identifier}</span>
          )}
        </div>

        <div className="host-login-field">
          <label htmlFor="host-password">Password</label>
          <div className="host-login-password-wrap">
            <input
              id="host-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={!!errors.password}
              className={errors.password ? "input-error" : ""}
            />
            <button
              type="button"
              className="host-login-toggle"
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          {errors.password && (
            <span className="host-login-error">{errors.password}</span>
          )}
        </div>

        <div className="host-login-row">
          <Link to="/host/forgot-password" className="host-login-link">
            Forgot password?
          </Link>
        </div>

        <button type="submit" className="host-login-submit">
          Log in
        </button>
      </form>

      <p className="host-login-footer">
        Filling out a form instead?{" "}
        <Link to="/respondent/login">Continue as a Responder</Link>
      </p>
    </div>
  );
}
