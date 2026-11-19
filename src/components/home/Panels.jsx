import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import Shot from "./Shot";
import { Phone } from "./Device";
import { ease } from "./primitives";
import { Statement, Words } from "./Motion";
import { ActivePing, LiveFeed, TapRipple } from "./Live";

const PANELS = [
  {
    id: "how-it-works",
    title: "Build forms for any kind of session.",
    statement: ["Questions, sections and templates", " for assessments, surveys, registrations and feedback."],
    features: ["11 question types", "Optional answer keys and points", "Section breaks and templates", "Import from a file or Google Forms"],
    shots: ["editor"],
  },
  {
    title: "Share a code, a link or a QR.",
    statement: ["Start a session", " and people join from any browser. Add a time limit if you need one."],
    features: ["Join code, link and QR", "Works over local Wi-Fi", "Optional temporary public link", "Per-person time limit"],
    shots: ["session"],
    overlay: "session",
  },
  {
    title: "Answer from any device.",
    statement: ["No accounts for respondents.", " A name is enough, on a phone, tablet or laptop."],
    features: ["Timer enforced by the server", "Answers survive a page reload", "Fullscreen and refocus lock", "Saved on the device until submitted"],
    shots: ["join", "answer"],
  },
  {
    title: "Make sense of the results.",
    statement: ["Summaries as answers arrive.", " Scores and ranking appear when your form has answer keys."],
    features: ["Per-question summaries", "Respondent details", "Results matrix across sessions", "Excel, PDF and ZIP export"],
    shots: ["results"],
  },
];

function Panel({ p, index }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["5%", "-8%"]);
  const scale = useTransform(scrollYProgress, [0, 0.5], [1.03, 1]);
  const phones = p.shots.length > 1;
  return (
    <section id={p.id} className={`vp ${index % 2 ? "rev" : ""}`} ref={ref}>
      <div className="container vp-grid">
        <Words text={p.title} className="vp-title" />
          <motion.div className={`vp-card ${phones ? "is-phones" : ""}`} initial={{ clipPath: "inset(0 0 100% 0 round 8px)" }} whileInView={{ clipPath: "inset(0 0 0% 0 round 8px)" }} viewport={{ once: true, margin: "0px 0px -8% 0px" }} transition={{ duration: 1.2, ease }}>
            <motion.div className="vp-inner" style={{ y, scale }}>
              {phones ? (
                p.shots.map((s) => (
                  <div className="vp-phone" key={s}>
                    <Phone>
                      <Shot name={s} />
                    </Phone>
                    {s === "answer" && <TapRipple x={20} y={57} />}
                  </div>
                ))
              ) : (
                <>
                  <Shot name={p.shots[0]} />
                  {p.overlay === "session" && <ActivePing />}
                </>
              )}
            </motion.div>
            {p.overlay === "session" && <LiveFeed />}
          </motion.div>
          <motion.aside className="vp-rail" initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "0px 0px -8% 0px" }} transition={{ duration: 0.8, ease, delay: 0.1 }}>
            <Statement parts={p.statement} />
            <p className="vp-label">Features</p>
            <ul className="vp-list">
              {p.features.map((f, i) => (
                <motion.li key={f} initial={{ opacity: 0, x: 16 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, ease, delay: 0.15 + i * 0.09 }}>
                  {f}
                </motion.li>
              ))}
            </ul>
          </motion.aside>
      </div>
    </section>
  );
}

export default function Panels() {
  return (
    <>
      {PANELS.map((p, i) => (
        <Panel key={p.title} p={p} index={i} />
      ))}
    </>
  );
}
