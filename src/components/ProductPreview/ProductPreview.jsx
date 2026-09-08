import { Icons } from "../icons";
import "./product-preview.css";

const FIELD_TYPES = [
  { icon: "questionBank", label: "Short answer" },
  { icon: "file", label: "Paragraph" },
  { icon: "checkCircle", label: "Multiple choice" },
  { icon: "layers", label: "Checkboxes" },
  { icon: "chevronDown", label: "Dropdown" },
  { icon: "calendar", label: "Date" },
  { icon: "upload", label: "File upload" },
];

const RECENT_RESPONSES = [
  { name: "Ava Chen", answer: "Acme Co." },
  { name: "Marco Diaz", answer: "Bright School" },
  { name: "Priya N.", answer: "Self-employed" },
];

export default function ProductPreview() {
  return (
    <section id="demo" className="section product-preview">
      <div className="container">
        <div className="section-head center">
          <p className="eyebrow">Product preview</p>
          <h2>What the form builder looks like</h2>
          <p>
            An illustrative look at building a form, previewing it, and reviewing the
            responses it collects.
          </p>
        </div>

        <div className="preview-frame">
          <div className="preview-frame-bar">
            <div className="preview-frame-dots">
              <span /> <span /> <span />
            </div>
            <span className="preview-frame-title">Form builder — Event Registration</span>
          </div>

          <div className="preview-frame-body">
            <div className="preview-panel preview-panel-fields">
              <p className="preview-section-label">Add a field</p>
              <ul className="preview-field-list">
                {FIELD_TYPES.map((field) => {
                  const Icon = Icons[field.icon];
                  return (
                    <li key={field.label}>
                      <Icon className="preview-field-icon" />
                      {field.label}
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="preview-panel preview-panel-form">
              <p className="preview-form-heading">Event Registration</p>
              <p className="preview-form-subheading">Let us know if you'll be joining.</p>

              <div className="preview-form-field">
                <span className="preview-form-label">Name</span>
                <span className="preview-form-input" />
              </div>
              <div className="preview-form-field">
                <span className="preview-form-label">Email</span>
                <span className="preview-form-input" />
              </div>
              <div className="preview-form-field is-selected">
                <span className="preview-form-label">Organisation</span>
                <span className="preview-form-input" />
              </div>

              <span className="preview-form-submit">Submit</span>
            </div>

            <div className="preview-panel preview-panel-settings">
              <p className="preview-section-label">Field settings</p>
              <div className="preview-setting-row">
                <span>Field type</span>
                <span className="preview-setting-value">Short answer</span>
              </div>
              <div className="preview-setting-row">
                <span>Required</span>
                <span className="preview-toggle is-on" />
              </div>

              <p className="preview-section-label preview-section-label-spaced">Form settings</p>
              <div className="preview-setting-row">
                <span>Accepting responses</span>
                <span className="preview-toggle is-on" />
              </div>
              <div className="preview-setting-row">
                <span>Allow response editing</span>
                <span className="preview-toggle" />
              </div>
              <div className="preview-setting-row">
                <span>Time limit</span>
                <span className="preview-setting-value">No limit</span>
              </div>
            </div>
          </div>

          <div className="preview-responses-strip">
            <div className="preview-responses-count">
              <span className="preview-responses-number">128</span>
              <span className="preview-responses-label">responses</span>
            </div>
            <ul className="preview-responses-list">
              {RECENT_RESPONSES.map((r) => (
                <li key={r.name}>
                  <span className="preview-response-name">{r.name}</span>
                  <span className="preview-response-answer">{r.answer}</span>
                  <span className="preview-response-status">Submitted</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="preview-caption">
          Illustrative product preview. Interface details may change as the product evolves.
        </p>
      </div>
    </section>
  );
}
