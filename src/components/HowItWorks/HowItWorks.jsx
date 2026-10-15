import ProductFrame from "../ProductFrame/ProductFrame";
import Reveal from "../Reveal/Reveal";
import "./how-it-works.css";

const STEPS = [
  {
    number: "01",
    title: "Build the form",
    text: "Pick from 11 question types plus section breaks, or start from one of 16 templates. Mark the correct answer and set points on any question you want graded automatically.",
    image: "/screenshots/form-builder.jpg",
    alt: "Form builder showing a quiz with a multiple choice question, the correct answer marked, a points field, and a sidebar listing every question type",
    label: "Self Host Form / Form builder",
  },
  {
    number: "02",
    title: "Start a session and share the code",
    text: "A session gives your form a join code, a link and a QR code. Set an optional time limit, turn on fullscreen or tab-switch locks, and watch students join in real time.",
    image: "/screenshots/session-share.jpg",
    alt: "Session screen showing the join code, a link and QR code, live respondent counts, an average score and a table of respondents with their status and score",
    label: "Self Host Form / Sessions",
  },
  {
    number: "03",
    title: "Students answer on any device",
    text: "Students enter their name and the code in any modern browser on a phone, tablet or laptop. Time limits are tracked per student and enforced by the server, and in-progress answers survive a page reload.",
    image: "/screenshots/respondent-view.jpg",
    alt: "The student-facing form showing a multiple choice question, a checkbox question and a short answer field, with a countdown timer at the top",
    label: "Self Host Form / Respond",
  },
  {
    number: "04",
    title: "Review scores and export",
    text: "Scores, averages and a leaderboard update as answers come in. When the session ends, export to Excel or PDF, or combine several sessions into one workbook.",
    image: "/screenshots/leaderboard.jpg",
    alt: "Session leaderboard ranking respondents by score, with score bars and submission times",
    label: "Self Host Form / Leaderboard",
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="section how-it-works">
      <div className="container">
        <div className="section-head center">
          <p className="eyebrow">How it works</p>
          <h2>From blank form to graded results in four steps</h2>
          <p>Students never need an account. All they need is a link, a code or a scanned QR.</p>
        </div>

        <div className="how-steps">
          {STEPS.map((step, i) => (
            <Reveal
              as="div"
              className={`how-step ${i % 2 === 1 ? "how-step-reverse" : ""}`}
              key={step.number}
            >
              <div className="how-step-copy">
                <span className="how-step-number">{step.number}</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </div>
              <div className="how-step-visual">
                <ProductFrame src={step.image} alt={step.alt} label={step.label} />
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
