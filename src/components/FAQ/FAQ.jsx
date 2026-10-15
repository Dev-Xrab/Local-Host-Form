import { useLayoutEffect, useRef, useState } from "react";
import { Icons } from "../icons";
import "./faq.css";

const FAQS = [
  {
    q: "What is Self Host Form?",
    a: "A form and quiz builder that runs on your own computer. You build a form, start a session, students join with a code, and the responses are stored on your machine instead of a third-party service.",
  },
  {
    q: "Is it free?",
    a: "Yes, it's free to run for personal and school use. The source is available to read, but it isn't open source: you can't redistribute or sell it, or modified versions of it, without permission.",
  },
  {
    q: "Is it similar to Google Forms?",
    a: "The basics are the same: build a form, share it, collect responses. The differences are that it runs on your own computer, works over a local network without internet, and is built around live graded sessions with join codes, time limits and exam controls.",
  },
  {
    q: "Which platforms does it run on?",
    a: "The installer is for Windows. Students can answer from any device with a modern browser. There is also an experimental Android build that can host from a phone, with some limits: no public link, and the app must stay open during a session.",
  },
  {
    q: "Where is my data stored?",
    a: "In a local SQLite database on the computer running the app. Nothing is sent to a cloud service unless you choose to connect a Google account.",
  },
  {
    q: "Do students need an account?",
    a: "No. They open the link, scan the QR code or type the session code, enter a name, email or N/A, and answer. Only the host needs a password.",
  },
  {
    q: "What question types are supported?",
    a: "Short answer, paragraph, multiple choice, checkboxes, dropdown, linear scale, date, time, file upload, multiple choice grid and checkbox grid, plus section breaks. There are also 16 templates for common forms.",
  },
  {
    q: "How does grading work?",
    a: "Mark the correct answer and set points on multiple choice, dropdown, checkboxes, short answer or paragraph questions. Text questions accept a list of correct variations. Scores are calculated on the server when a student submits, and the session shows averages and a leaderboard.",
  },
  {
    q: "Can I run timed exams and stop cheating?",
    a: "You can set a time limit per student, require fullscreen, lock the screen with a countdown when a student switches tabs, and restrict copying and printing. These are deterrents that work in the browser and desktop app. They are not a guarantee against a determined cheater.",
  },
  {
    q: "Can I use it for surveys and registrations?",
    a: "Yes. Forms without answer keys simply collect responses, and the templates include event registration, RSVP, job application, time-off request and feedback forms.",
  },
  {
    q: "What if students aren't on my Wi-Fi?",
    a: "In the desktop app you can start a temporary public link with one click. It uses a Cloudflare tunnel, so there's no port forwarding or router setup. Stopping it or closing the app takes the link down, and the host login isn't reachable through it.",
  },
  {
    q: "Can I export results?",
    a: "Yes. Export a session to Excel or PDF, or pick several finished sessions and export them into one Excel workbook, matched against your class roster. Uploaded files are bundled into a ZIP with the workbook.",
  },
  {
    q: "Can multiple teachers manage forms?",
    a: "Not with separate accounts yet. Each installation has a single host password, so sharing access means sharing that login. Per-person accounts and roles aren't built yet.",
  },
  {
    q: "What does the optional Google account do?",
    a: "Signing in with Google lets you import an existing Google Form, with its responses if you want them, and publish forms to your account. It's an optional layer that is currently in beta with limited access. The local app doesn't need it.",
  },
  {
    q: "Can I run it on a server?",
    a: "Yes. The Node and Express server that powers the desktop app can run on its own and serve the web UI, so you can host it on a machine you manage.",
  },
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState(0);
  const wrapRefs = useRef([]);
  const innerRefs = useRef([]);

  useLayoutEffect(() => {
    FAQS.forEach((_, i) => {
      const wrap = wrapRefs.current[i];
      const inner = innerRefs.current[i];
      if (!wrap || !inner) return;
      const value = i === openIndex ? `${inner.scrollHeight}px` : "0px";
      wrap.style.setProperty("max-height", value, "important");
    });
  }, [openIndex]);

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
                  className="faq-answer-wrap"
                  inert={!isOpen}
                  ref={(el) => (wrapRefs.current[i] = el)}
                >
                  <div className="faq-answer" ref={(el) => (innerRefs.current[i] = el)}>
                    <p>{item.a}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
