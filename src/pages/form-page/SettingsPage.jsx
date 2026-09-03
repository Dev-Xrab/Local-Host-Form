import useFormStore, { useFormActions } from "../../../store/useFormStore";
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
  const settings = useFormStore((s) => s.formSettings);
  const { updateFormSettings } = useFormActions();

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h1>Settings</h1>
        <p className="settings-subtitle">Everything here runs locally on this server — no accounts or internet required.</p>
      </div>

      <div className="settings-container">
        <div className="settings-group">
          <span className="settings-group-heading">Responses</span>

          <ToggleRow
            label="Require a session code"
            description="Respondents must enter a code from an active session to submit."
            checked={settings.requireSessionCode}
            onChange={(v) => updateFormSettings({ requireSessionCode: v })}
          />

          <ToggleRow
            label="Allow multiple responses per device"
            description="Let the same device submit this form more than once in a session."
            checked={settings.allowMultipleResponses}
            onChange={(v) => updateFormSettings({ allowMultipleResponses: v })}
          />
        </div>

        <div className="settings-group">
          <span className="settings-group-heading">Timer</span>

          <ToggleRow
            label="Set a time limit"
            description={
              settings.timerEnabled
                ? "Respondents are auto-submitted once the timer runs out."
                : "Respondents can take as long as they need."
            }
            checked={settings.timerEnabled}
            onChange={(v) => updateFormSettings({ timerEnabled: v })}
          >
            {settings.timerEnabled && (
              <input
                type="number"
                min="1"
                className="settings-timer-input"
                value={settings.timerMinutes}
                onChange={(e) =>
                  updateFormSettings({ timerMinutes: Math.max(1, Number(e.target.value) || 1) })
                }
              />
            )}
            {settings.timerEnabled && <span className="settings-timer-unit">min</span>}
          </ToggleRow>
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
      </div>
    </div>
  );
}
