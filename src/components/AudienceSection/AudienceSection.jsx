import { Icons } from "../icons";
import "./audience-section.css";

const AUDIENCES = [
  {
    icon: "users",
    title: "For Individuals",
    text: "Simple forms for personal projects and data collection.",
  },
  {
    icon: "bank",
    title: "For Schools",
    text: "Surveys, registration, assessments, and classroom activities.",
  },
  {
    icon: "layers",
    title: "For Organisations",
    text: "Internal forms, feedback, applications, and data collection.",
  },
  {
    icon: "database",
    title: "For Developers",
    text: "A self-hosted form platform that can fit into controlled environments.",
  },
  {
    icon: "questionBank",
    title: "For Researchers",
    text: "Questionnaires and structured response collection.",
  },
];

export default function AudienceSection() {
  return (
    <section className="section audience-section">
      <div className="container">
        <div className="section-head center">
          <p className="eyebrow">Who it's for</p>
          <h2>Built for Different Kinds of Work</h2>
        </div>

        <div className="audience-grid">
          {AUDIENCES.map((a) => {
            const Icon = Icons[a.icon];
            return (
              <div className="audience-card" key={a.title}>
                <span className="audience-icon-wrap">
                  <Icon className="audience-icon" />
                </span>
                <h3>{a.title}</h3>
                <p>{a.text}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
