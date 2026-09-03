import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "./respondent-login.css";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RespondentLogin() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState({});

  function validate() {
    const nextErrors = {};

    if (!name.trim()) {
      nextErrors.name = "Name is required";
    }

    if (!email.trim()) {
      nextErrors.email = "Email is required";
    } else if (!EMAIL_PATTERN.test(email.trim())) {
      nextErrors.email = "Enter a valid email address";
    }

    return nextErrors;
  }

  function handleSubmit(e) {
    e.preventDefault();

    const nextErrors = validate();
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length === 0) {
      navigate("/form");
    }
  }

  return (
    <div className="respondent-login-content">
      <h1>Join as a Responder</h1>
      <p className="respondent-login-subtitle">
        Enter your details to continue to the form.
      </p>

      <form className="respondent-login-form" onSubmit={handleSubmit} noValidate>
        <div className="respondent-login-field">
          <label htmlFor="respondent-name">
            Name <span className="required-mark">*</span>
          </label>
          <input
            id="respondent-name"
            type="text"
            autoComplete="name"
            placeholder="Jane Doe"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={!!errors.name}
            aria-required="true"
            className={errors.name ? "input-error" : ""}
          />
          {errors.name && (
            <span className="respondent-login-error">{errors.name}</span>
          )}
        </div>

        <div className="respondent-login-field">
          <label htmlFor="respondent-email">
            Email <span className="required-mark">*</span>
          </label>
          <input
            id="respondent-email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!errors.email}
            aria-required="true"
            className={errors.email ? "input-error" : ""}
          />
          {errors.email && (
            <span className="respondent-login-error">{errors.email}</span>
          )}
        </div>

        <button type="submit" className="respondent-login-submit">
          Continue
        </button>
      </form>

      <p className="respondent-login-footer">
        Hosting a form instead?{" "}
        <Link to="/host/login">Continue as a Hoster</Link>
      </p>
    </div>
  );
}
