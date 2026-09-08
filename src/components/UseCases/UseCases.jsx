import { Icons } from "../icons";
import "./use-cases.css";

const USE_CASES = [
  { icon: "chart", title: "Surveys", text: "Collect opinions, feedback, and research responses." },
  { icon: "share", title: "Registration", text: "Collect participant information for events and activities." },
  { icon: "file", title: "Applications", text: "Create structured application and submission workflows." },
  { icon: "users", title: "Feedback", text: "Gather feedback from customers, users, employees, or participants." },
  { icon: "checkCircle", title: "Assessments", text: "Create tests, evaluations, and knowledge checks." },
  { icon: "bank", title: "Internal Forms", text: "Create forms for organisations and internal processes." },
  { icon: "questionBank", title: "Research", text: "Build questionnaires and collect structured data." },
  { icon: "clock", title: "Quizzes", text: "Run interactive quizzes and assessments." },
];

export default function UseCases() {
  return (
    <section id="use-cases" className="section use-cases">
      <div className="container">
        <div className="section-head center">
          <p className="eyebrow">Built for more than forms</p>
          <h2>One Platform. Many Workflows.</h2>
          <p>The same form builder adapts to whatever you're collecting.</p>
        </div>

        <div className="use-cases-grid">
          {USE_CASES.map((uc) => {
            const Icon = Icons[uc.icon];
            return (
              <div className="use-case-card" key={uc.title}>
                <Icon className="use-case-icon" />
                <div>
                  <h3>{uc.title}</h3>
                  <p>{uc.text}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
