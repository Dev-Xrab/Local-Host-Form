import { Icons } from "../icons";
import "./features.css";

const FEATURES = [
  {
    icon: "questionBank",
    title: "Form Builder",
    text: "Create forms with short answer, paragraph, multiple choice, checkboxes, dropdown, linear scale, date, time, file upload, and grid/matrix fields.",
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
    text: "Multiple choice, checkboxes, dropdown, and scale fields can be scored automatically, with points and correct answers set per question.",
  },
  {
    icon: "monitor",
    title: "Response Management",
    text: "Review collected submissions and scores from a central dashboard as they come in, not after the fact.",
  },
  {
    icon: "share",
    title: "Sharing",
    text: "Distribute a form with a link, a short code, or a QR code — no account needed to respond.",
  },
  {
    icon: "network",
    title: "Remote Access",
    text: "Respondents outside your Wi-Fi? Start a temporary public link with one click — no port forwarding, router setup, or account required. Stop it and the link stops working.",
  },
  {
    icon: "clock",
    title: "Sessions & Timing",
    text: "For workflows that need it, run a form as a timed, code-based session — the basis for quizzes and live activities.",
  },
  {
    icon: "shield",
    title: "Quiz Integrity",
    text: "Optionally lock a session to fullscreen, detect when a respondent switches tabs or apps, and restrict copying on their screen — deterrents for live assessments, not a guarantee against a determined cheater.",
  },
  {
    icon: "bank",
    title: "Roster & Gradebook",
    text: "Keep a roster of students or members, and let it match respondents by name or alias across sessions to build a real gradebook.",
  },
  {
    icon: "upload",
    title: "Export",
    text: "Export responses and gradebooks to Excel or PDF, or bulk-export an entire subject's sessions at once — no server round trip required.",
  },
];

const COMING_SOON = ["Leaderboards"];

export default function Features() {
  return (
    <section id="features" className="section features-section">
      <div className="container">
        <div className="section-head center">
          <p className="eyebrow">Features</p>
          <h2>What's included</h2>
          <p>
            A form builder, timed sessions, automatic grading, a roster-aware gradebook, and
            exports — all running on the deployment you control.
          </p>
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
