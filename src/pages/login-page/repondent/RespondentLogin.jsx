import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { responsesApi } from "../../../features/responses/services/responsesApi";
import { getDeviceId } from "../../../features/responses/utils/deviceId";
import "./respondent-login.css";
import logo from "../../../../src/images/logo.png";

const NAME_STORAGE_KEY = "stonearch_respondent_name";

export default function RespondentLogin() {
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState(() => {
    try {
      return localStorage.getItem(NAME_STORAGE_KEY) || "";
    } catch {
      return "";
    }
  });
  const [sessionCode, setSessionCode] = useState("");
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  function validate() {
    const nextErrors = {};
    if (!identifier.trim()) nextErrors.identifier = "Identifier is required";
    if (!sessionCode.trim()) nextErrors.sessionCode = "Session code is required";
    return nextErrors;
  }

  // This one page does what used to take three: enter an identifier, enter the
  // session code, and join — instead of a separate code-entry page followed by
  // RespondForm asking for a name again, we join directly here and land on the
  // form already answering (RespondForm resolves the rest via this same device id).
  async function handleSubmit(e) {
    e.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const code = sessionCode.trim().toUpperCase();
    setSubmitting(true);
    try {
      await responsesApi.join(code, { name: identifier.trim(), deviceId: getDeviceId() });
      try {
        localStorage.setItem(NAME_STORAGE_KEY, identifier.trim());
      } catch {
        // best-effort convenience only
      }
      navigate(`/s/${code}`);
    } catch (err) {
      setErrors({ sessionCode: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="respondent-login-content">
      <img
              src={logo}
              alt="Host login illustration"
              className="host-login-illustration"
              style={{ width: "50px", height: "50px", paddingBottom: "10px" }}
            />
      <h1>Join as a Responder</h1>
      <p className="respondent-login-subtitle">
        Enter your details to continue to the form.
      </p>

      <form className="respondent-login-form" onSubmit={handleSubmit} noValidate>
        <div className="respondent-login-field">
          <label htmlFor="respondent-identifier">
            Identifier <span className="required-mark">*</span>
          </label>
          <input
            id="respondent-identifier"
            type="text"
            autoComplete="name"
            placeholder="Name, Email, or N/A"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            aria-invalid={!!errors.identifier}
            aria-required="true"
            className={errors.identifier ? "input-error" : ""}
          />
          {errors.identifier && (
            <span className="respondent-login-error">{errors.identifier}</span>
          )}
        </div>

        <div className="respondent-login-field">
          <label htmlFor="respondent-session-code">
            Session Code <span className="required-mark">*</span>
          </label>
          <input
            id="respondent-session-code"
            type="text"
            autoComplete="off"
            placeholder="e.g. AB12CD"
            value={sessionCode}
            onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
            aria-invalid={!!errors.sessionCode}
            aria-required="true"
            className={errors.sessionCode ? "input-error" : ""}
            maxLength={8}
          />
          {errors.sessionCode && (
            <span className="respondent-login-error">{errors.sessionCode}</span>
          )}
        </div>

        <button type="submit" className="respondent-login-submit" disabled={submitting}>
          {submitting ? "Joining…" : "Continue"}
        </button>
      </form>

      <p className="respondent-login-footer">
        Hosting a form instead?{" "}
        <Link to="/host/login">Continue as a Hoster</Link>
      </p>
    </div>
  );
}
