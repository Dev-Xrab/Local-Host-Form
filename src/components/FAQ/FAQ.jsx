import { useState } from "react";
import { Icons } from "../icons";
import "./faq.css";

const FAQS = [
  {
    q: "What is SelfHost Form?",
    a: "A form builder you run yourself. You create a form, share it, and collect and manage the responses from your own deployment instead of a third-party's hosted service.",
  },
  {
    q: "Is SelfHost Form similar to Google Forms?",
    a: "Conceptually, yes — build a form, share a link, collect responses. The main difference is that you run the platform on your own infrastructure instead of using a provider's hosted service.",
  },
  {
    q: "What does self-hosted mean?",
    a: "It means the software runs on infrastructure you choose — a personal computer or a server you manage — rather than a provider's servers. It describes where the platform runs, not whether a network connection is needed to reach it.",
  },
  {
    q: "Where is my form data stored?",
    a: "In the database of the deployment you run. By default that's a local database on the machine hosting the platform, not a third-party cloud service.",
  },
  {
    q: "Can I run SelfHost Form on my own computer?",
    a: "Yes. It's built to run as a desktop application on your own computer, with its own local server and database.",
  },
  {
    q: "Can I deploy it on a server?",
    a: "The platform includes a Node.js server component that can run independently of the desktop app, so it can also be deployed on a server you manage.",
  },
  {
    q: "Do respondents need an account?",
    a: "No. Respondents just enter a name to submit a form. An account is only needed to create and manage forms.",
  },
  {
    q: "What types of forms can I create?",
    a: "Forms can include short answer, paragraph, multiple choice, checkboxes, dropdown, linear scale, date, time, and file upload fields.",
  },
  {
    q: "Can I create quizzes and assessments?",
    a: "Yes. Multiple choice, checkboxes, dropdown, and linear scale fields can have correct answers for automatic scoring, and a form can be run as a timed session — quizzes are one use case built on the same form builder.",
  },
  {
    q: "Can I use it for surveys and research?",
    a: "Yes. The same builder works for open-ended and choice-based questions without needing a scored or timed session.",
  },
  {
    q: "Can multiple people manage forms?",
    a: "Each deployment currently has a single shared host password rather than individual accounts, so \"multiple people managing forms\" today means sharing that one login — separate per-person accounts and roles aren't available yet.",
  },
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section id="faq" className="section faq-section">
      <div className="container faq-container">
        <div className="section-head">
          <p className="eyebrow">FAQ</p>
          <h2>Frequently asked questions</h2>
        </div>

        <div className="faq-list">
          {FAQS.map((item, i) => {
            const isOpen = openIndex === i;
            return (
              <div className={`faq-item ${isOpen ? "is-open" : ""}`} key={item.q}>
                <h3>
                  <button
                    type="button"
                    className="faq-question"
                    aria-expanded={isOpen}
                    aria-controls={`faq-panel-${i}`}
                    id={`faq-trigger-${i}`}
                    onClick={() => setOpenIndex(isOpen ? -1 : i)}
                  >
                    {item.q}
                    <Icons.chevronDown className="faq-chevron" />
                  </button>
                </h3>
                <div
                  id={`faq-panel-${i}`}
                  role="region"
                  aria-labelledby={`faq-trigger-${i}`}
                  className="faq-answer"
                  hidden={!isOpen}
                >
                  <p>{item.a}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
