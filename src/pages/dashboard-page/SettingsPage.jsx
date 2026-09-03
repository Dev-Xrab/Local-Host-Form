import { useState } from "react";
import { Icons } from "./icons";
import PageHeader from "./PageHeader";

const TOGGLES = [
  { id: "requireLogin", label: "Require student login", description: "Students must sign in before joining a quiz.", icon: "lock", defaultChecked: true },
  { id: "autoSave", label: "Auto-save drafts", description: "Save form and quiz edits automatically as you type.", icon: "fileText", defaultChecked: true },
  { id: "notifications", label: "Email notifications", description: "Get notified when a quiz session ends.", icon: "bell", defaultChecked: false },
];

export default function SettingsPage() {
  const [serverAddress] = useState("http://localhost:5174");
  const [copied, setCopied] = useState(false);
  const [toggles, setToggles] = useState(
    Object.fromEntries(TOGGLES.map((t) => [t.id, t.defaultChecked]))
  );

  const handleCopy = () => {
    navigator.clipboard?.writeText(serverAddress).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleToggle = (id) => setToggles((prev) => ({ ...prev, [id]: !prev[id] }));

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
          <h2 className="dash-settings-heading">Danger zone</h2>

          <div className="dash-card dash-settings-card">
            <div className="dash-settings-row">
              <div>
                <span className="dash-settings-row-label">Clear all local data</span>
                <span className="dash-settings-row-desc">Removes quizzes, subjects, and forms from this server.</span>
              </div>

              <button type="button" className="dash-ghost-btn dash-danger-btn">
                <Icons.trash />
                Clear data
              </button>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
