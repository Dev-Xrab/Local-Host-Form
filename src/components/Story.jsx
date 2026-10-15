import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView } from "motion/react";
import { STEPS } from "../content";
import { SectionHead, ease } from "./ui/Section";
import Frame from "./ui/Frame";

// One step of the walkthrough. On wide screens the step text scrolls past while the shared
// sticky viewer swaps screenshots; on narrow screens each step carries its own screenshot.
function Step({ step, active, onEnter }) {
  const ref = useRef(null);
  const inView = useInView(ref, { margin: "-45% 0px -45% 0px" });
  useEffect(() => {
    if (inView) onEnter();
  }, [inView, onEnter]);

  return (
    <article ref={ref} className={`story-step ${active ? "is-active" : ""}`}>
      <span className="story-number">{step.number}</span>
      <h3>{step.title}</h3>
      <p>{step.text}</p>
      <div className="story-inline">
        <Frame src={step.image} alt={step.alt} label={step.label} />
      </div>
    </article>
  );
}

export default function Story() {
  const [active, setActive] = useState(0);
  const current = STEPS[active];

  return (
    <section id="how-it-works" className="section story">
      <div className="container">
        <SectionHead eyebrow="How it works" title="From blank form to graded results in four steps">
          Students never need an account. All they need is a link, a code or a scanned QR.
        </SectionHead>

        <div className="story-grid">
          <div className="story-steps">
            {STEPS.map((s, i) => (
              <Step key={s.number} step={s} active={i === active} onEnter={() => setActive(i)} />
            ))}
          </div>

          <div className="story-sticky" aria-hidden="true">
            <div className="story-progress">
              {STEPS.map((s, i) => (
                <span key={s.number} className={i <= active ? "is-on" : ""} />
              ))}
            </div>
            <div className="story-viewer">
              <div className="frame-bar">
                <span />
                <span />
                <span />
                <em>Self Host Form / {current.label}</em>
              </div>
              <div className="story-screen">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.img
                    key={current.number}
                    src={current.image}
                    alt=""
                    width="1366"
                    height="860"
                    initial={{ opacity: 0, y: 16, scale: 0.985 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.55, ease }}
                  />
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
