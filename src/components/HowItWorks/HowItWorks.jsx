import { Icons } from "../icons";
import "./how-it-works.css";

const STEPS = [
  {
    number: "01",
    icon: "questionBank",
    title: "Build",
    text: "Create your form using the form builder.",
  },
  {
    number: "02",
    icon: "share",
    title: "Share",
    text: "Share the form through a link or your deployment's access method.",
  },
  {
    number: "03",
    icon: "file",
    title: "Collect",
    text: "Respondents submit their answers.",
  },
  {
    number: "04",
    icon: "layers",
    title: "Manage",
    text: "Review and manage submissions from your dashboard.",
  },
  {
    number: "05",
    icon: "chart",
    title: "Analyse",
    text: "View response data and use it for your workflow.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="section how-it-works">
      <div className="container">
        <div className="section-head center">
          <p className="eyebrow">How it works</p>
          <h2>From building to results in five steps</h2>
          <p>No accounts required to respond — just a link.</p>
        </div>

        <ol className="steps-list">
          {STEPS.map((step) => {
            const Icon = Icons[step.icon];
            return (
              <li className="step-card" key={step.number}>
                <span className="step-number">{step.number}</span>
                <span className="step-icon-wrap">
                  <Icon className="step-icon" />
                </span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
