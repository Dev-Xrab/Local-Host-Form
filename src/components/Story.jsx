import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView } from "motion/react";
import { STEPS } from "../content";
import { SectionHead, ease } from "./ui/Section";
import Frame from "./ui/Frame";
import Lightbox from "./ui/Lightbox";

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
      <div className="story-card">
        <span className="story-number">{step.number}</span>
        <h3>{step.title}</h3>
        <p>{step.text}</p>
        <div className="story-inline">
          <Frame src={step.image} alt={step.alt} label={step.label} />
        </div>
      </div>
    </article>
  );
}

export default function Story() {
  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState(null);
  const current = STEPS[active];

  return (
    <section id="how-it-works" className="section story">
      <div className="story-orbs" aria-hidden="true">
        <motion.span
          className="orb orb-a"
          animate={{ x: [0, 60, -20, 0], y: [0, 40, 80, 0] }}
          transition={{ duration: 28, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.span
          className="orb orb-b"
          animate={{ x: [0, -70, 30, 0], y: [0, -50, 20, 0] }}
          transition={{ duration: 34, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
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

          <div className="story-sticky">
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
              <button
                type="button"
                className="story-screen zoomable"
                aria-label={`Enlarge ${current.label} screenshot`}
                onClick={() => setZoom({ src: current.image, alt: current.alt })}
              >
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.img
                    key={current.number}
                    src={current.image}
                    alt={current.alt}
                    width="1366"
                    height="860"
                    initial={{ opacity: 0, y: 16, scale: 0.985 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.55, ease }}
                  />
                </AnimatePresence>
              </button>
            </div>
          </div>
        </div>
      </div>
      <Lightbox image={zoom} onClose={() => setZoom(null)} />
    </section>
  );
}
