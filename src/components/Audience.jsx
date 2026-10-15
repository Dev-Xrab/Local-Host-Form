import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AUDIENCES } from "../content";
import { SectionHead, ease } from "./ui/Section";

export default function Audience() {
  const [id, setId] = useState(AUDIENCES[0].id);
  const current = AUDIENCES.find((a) => a.id === id);

  return (
    <section id="who-its-for" className="section audience">
      <div className="container">
        <SectionHead eyebrow="Who it's for" title="Built for people who run their own assessments">
          If you collect answers from a room full of people, this is for you.
        </SectionHead>

        <div className="audience-card">
          <div className="audience-tabs" role="tablist" aria-label="Audiences">
            {AUDIENCES.map((a) => (
              <button
                key={a.id}
                type="button"
                role="tab"
                id={`aud-tab-${a.id}`}
                aria-selected={a.id === id}
                aria-controls="aud-panel"
                className={a.id === id ? "is-active" : ""}
                onClick={() => setId(a.id)}
              >
                {a.id === id && (
                  <motion.span
                    layoutId="aud-pill"
                    className="aud-pill"
                    transition={{ type: "spring", stiffness: 420, damping: 36 }}
                  />
                )}
                <span>{a.title}</span>
              </button>
            ))}
          </div>

          <div id="aud-panel" role="tabpanel" aria-labelledby={`aud-tab-${id}`} className="audience-panel">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.28, ease }}
              >
                <h3>{current.title}</h3>
                <p>{current.text}</p>
                <ul className="chips">
                  {current.examples.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
