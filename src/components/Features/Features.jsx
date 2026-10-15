import { Icons } from "../icons";
import "./features.css";

const FEATURES = [
  {
    icon: "questionBank",
    title: "Form builder",
    text: "Short answer, paragraph, multiple choice, checkboxes, dropdown, linear scale, date, time, file upload and two grid types, plus section breaks and 16 ready-made templates.",
  },
  {
    icon: "checkCircle",
    title: "Automatic grading",
    text: "Multiple choice, dropdown, checkboxes, short answer and paragraph questions can be scored automatically, with per-question points and accepted answer variations for text.",
  },
  {
    icon: "users",
    title: "Live sessions",
    text: "Each session gets a join code, link and QR code. Add a per-student time limit enforced by the server, and watch respondents, submissions and average score update live.",
  },
  {
    icon: "trophy",
    title: "Leaderboard",
    text: "Rank a session's respondents by score as submissions arrive, or open any respondent to review their answers question by question.",
  },
  {
    icon: "shield",
    title: "Exam integrity tools",
    text: "Require fullscreen, lock the screen with a countdown when a student switches tabs, and restrict copying and printing. These are deterrents, not a guarantee against a determined cheater.",
  },
  {
    icon: "bank",
    title: "Folders & rosters",
    text: "Organise forms into folders. Keep a class roster with aliases so \"Jon\" and \"Jonathan D.\" match one student across sessions.",
  },
  {
    icon: "upload",
    title: "Bulk export",
    text: "Pick several finished sessions, see who responded to each, and export everything to a single Excel workbook. Uploaded files are bundled into a ZIP.",
  },
  {
    icon: "download",
    title: "Excel & PDF export",
    text: "Export any session's responses to Excel or PDF straight from your machine. Forms can also be exported and imported as files.",
  },
  {
    icon: "network",
    title: "Remote access",
    text: "Students outside your Wi-Fi? Start a temporary public link in one click, with no port forwarding or router setup. Stop it and the link goes down. Desktop app only.",
  },
  {
    icon: "cloud",
    title: "Google Forms import",
    text: "Optionally sign in with Google to import an existing Google Form and its responses, or publish forms to your account. The local app works fully without it.",
  },
  {
    icon: "database",
    title: "Private by default",
    text: "Responses live in a local database on your machine. The host password is created on first launch from the host computer itself, and login attempts are rate-limited.",
  },
  {
    icon: "devices",
    title: "Any device, any theme",
    text: "Students answer from a phone, tablet or laptop. The host interface adapts to each screen size and ships with dark, light and follow-system themes.",
  },
];

export default function Features() {
  return (
    <section id="features" className="section features-section">
      <div className="container">
        <div className="section-head center">
          <p className="eyebrow">Features</p>
          <h2>Built for running real assessments</h2>
          <p>
            A form builder, live sessions, automatic grading, a leaderboard and exports, all
            running on your own computer.
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

      </div>
    </section>
  );
}
