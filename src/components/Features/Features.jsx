import { Icons } from "../icons";
import "./features.css";

const FEATURES = [
  {
    icon: "questionBank",
    title: "Form Builder",
    text: "Create forms with short answer, paragraph, multiple choice, checkboxes, dropdown, linear scale, date, time, and file upload fields.",
  },
  {
    icon: "chart",
    title: "Response Collection",
    text: "Collect submissions and see them appear as respondents complete a form.",
  },
  {
    icon: "layers",
    title: "Form Management",
    text: "Create, edit, organise, import, and export your forms, grouped by subject.",
  },
  {
    icon: "database",
    title: "Self-Hosting",
    text: "Deploy the platform on infrastructure you control — a personal computer or a server.",
  },
  {
    icon: "sliders",
    title: "Customisation",
    text: "Set required fields, correct answers, time limits, and response-editing rules per form.",
  },
  {
    icon: "checkCircle",
    title: "Automatic Grading",
    text: "Multiple choice, checkboxes, dropdown, and scale fields can be scored automatically.",
  },
  {
    icon: "monitor",
    title: "Response Management",
    text: "Review collected submissions and scores from a central dashboard.",
  },
  {
    icon: "share",
    title: "Sharing",
    text: "Distribute a form with a link, a short code, or a QR code — no account needed to respond.",
  },
  {
    icon: "clock",
    title: "Sessions & Timing",
    text: "For workflows that need it, run a form as a timed, code-based session — the basis for quizzes and live activities.",
  },
];

const COMING_SOON = ["Leaderboards", "Roster import/export"];

export default function Features() {
  return (
    <section id="features" className="section features-section">
      <div className="container">
        <div className="section-head center">
          <p className="eyebrow">Features</p>
          <h2>Everything you need to run a form platform</h2>
          <p>Build a form, share it, and manage what comes back — on infrastructure you choose.</p>
        </div>

        <div className="features-grid">
          {FEATURES.map((feature) => {
            const Icon = Icons[feature.icon];
            return (
              <div className="feature-card" key={feature.title}>
                <span className="feature-icon-wrap">
                  <Icon className="feature-icon" />
                </span>
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </div>
            );
          })}
        </div>

        <p className="features-coming-soon">
          <span>Coming soon:</span> {COMING_SOON.join(" · ")}
        </p>
      </div>
    </section>
  );
}
