import ProductFrame from "../ProductFrame/ProductFrame";
import Reveal from "../Reveal/Reveal";
import "./how-it-works.css";

const STEPS = [
  {
    number: "01",
    title: "Build the form",
    text: "Add short answer, paragraph, multiple choice, checkboxes, dropdowns, scales, dates, grids, and file uploads. Mark correct answers on any question where you want automatic grading.",
    image: "/screenshots/form-builder.jpg",
    alt: "Form builder showing a feedback form with a multiple choice, short answer, and linear scale question, and a sidebar listing every available question type",
    label: "Self Host Form / Form Info",
  },
  {
    number: "02",
    title: "Share it your way",
    text: "Start a session and share it with a link, a short join code, or a QR code — respondents scan or type the code and answer, no account needed on their end. Watch who's joined in real time.",
    image: "/screenshots/session-share.jpg",
    alt: "Session screen showing a share link, a QR code to join, and live respondent and submission counts",
    label: "Self Host Form / Sessions",
  },
  {
    number: "03",
    title: "Collect responses",
    text: "Respondents answer on their own device — phone, tablet, or laptop. Timed sessions are enforced by the server, not the browser, and in-progress answers are saved automatically if the page reloads.",
    image: "/screenshots/respondent-view.jpg",
    alt: "The respondent-facing view of a form, showing a multiple choice question, a short answer question, and a linear scale question",
    label: "Self Host Form / Respond",
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="section how-it-works">
      <div className="container">
        <div className="section-head center">
          <p className="eyebrow">How it works</p>
          <h2>The same three steps, on your own network</h2>
          <p>No accounts required to respond — just a link, a code, or a scanned QR.</p>
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
