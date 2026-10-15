import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { Icons } from "./icons";
import { SectionHead, ease } from "./ui/Section";

// An illustration of a live session, not real data: people join one by one, submit, and the
// leaderboard re-ranks. It mirrors what the Sessions screen in the app shows.
const PEOPLE = [
  { name: "Ana Reyes", score: 5 },
  { name: "Ben Cruz", score: 7 },
  { name: "Carla Santos", score: 5 },
  { name: "Diego Lim", score: 3 },
  { name: "Ella Park", score: 6 },
  { name: "Farah Khan", score: 4 },
];
const MAX = 7;
const JOIN_EVERY = 2; // ticks between people joining
const ANSWER_FOR = 3; // ticks a person spends answering
const LAST = (PEOPLE.length - 1) * JOIN_EVERY + ANSWER_FOR;
const HOLD = 5;

function useTick(running, reduced) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (reduced || !running) return;
    const id = setInterval(() => setTick((t) => (t >= LAST + HOLD ? 0 : t + 1)), 900);
    return () => clearInterval(id);
  }, [running, reduced]);
  // Reduced motion: show the finished state instead of animating.
  return reduced ? LAST : tick;
}

function AnimatedNumber({ value, suffix = "" }) {
  return (
    <span className="num">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -10, opacity: 0 }}
          transition={{ duration: 0.25, ease }}
        >
          {value}
          {suffix}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export default function LiveDemo() {
  const ref = useRef(null);
  const inView = useInView(ref, { margin: "-15% 0px" });
  const reduced = useReducedMotion();
  const tick = useTick(inView, reduced);

  const rows = useMemo(() => {
    return PEOPLE.map((s, i) => {
      const joinedAt = i * JOIN_EVERY;
      const doneAt = joinedAt + ANSWER_FOR;
      const status = tick >= doneAt ? "submitted" : tick >= joinedAt ? "answering" : "waiting";
      return { ...s, status, progress: Math.min(1, Math.max(0, (tick - joinedAt) / ANSWER_FOR)) };
    }).filter((r) => r.status !== "waiting");
  }, [tick]);

  const submitted = rows.filter((r) => r.status === "submitted");
  const sorted = [...rows].sort((a, b) => {
    if (a.status !== b.status) return a.status === "submitted" ? -1 : 1;
    if (a.status === "submitted") return b.score - a.score;
    return PEOPLE.findIndex((s) => s.name === a.name) - PEOPLE.findIndex((s) => s.name === b.name);
  });
  const avg = submitted.length ? Math.round((submitted.reduce((n, r) => n + r.score, 0) / submitted.length / MAX) * 1000) / 10 : 0;

  return (
    <section id="live-demo" className="section demo" ref={ref}>
      <div className="container">
        <SectionHead eyebrow="See it live" title="Watch a session come to life">
          People join with a code, answer, and the leaderboard re-ranks as each submission lands. This
          animation illustrates the Sessions screen with sample names and scores.
        </SectionHead>

        <div className="demo-card">
          <div className="demo-head">
            <div>
              <span className="badge badge-live">
                <span className="pill-dot" /> Active
              </span>
              <h3>Safety Briefing — Morning Shift</h3>
            </div>
            <div className="demo-code">
              <span>Join code</span>
              <strong>AB12CD</strong>
            </div>
          </div>

          <dl className="demo-stats">
            <div>
              <dt>Joined</dt>
              <dd>
                <AnimatedNumber value={rows.length} />
              </dd>
            </div>
            <div>
              <dt>Submitted</dt>
              <dd>
                <AnimatedNumber value={submitted.length} suffix={` / ${rows.length}`} />
              </dd>
            </div>
            <div>
              <dt>Average score</dt>
              <dd>
                <AnimatedNumber value={avg} suffix="%" />
              </dd>
            </div>
          </dl>

          <ul className="demo-board" aria-label="Sample leaderboard">
            <AnimatePresence initial={false}>
              {sorted.map((r) => {
                const rank = r.status === "submitted" ? submitted.filter((x) => x.score > r.score).length + 1 : null;
                return (
                  <motion.li
                    key={r.name}
                    layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ layout: { type: "spring", stiffness: 380, damping: 34 }, duration: 0.35, ease }}
                    className="demo-row"
                  >
                    <span className={`rank ${rank === 1 ? "is-first" : ""}`}>{rank ?? "…"}</span>
                    <span className="demo-name">{r.name}</span>
                    {r.status === "submitted" ? (
                      <span className="demo-score">
                        <span className="demo-bar">
                          <motion.i
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: r.score / MAX }}
                            transition={{ duration: 0.7, ease }}
                          />
                        </span>
                        <b>
                          {r.score}/{MAX}
                        </b>
                      </span>
                    ) : (
                      <span className="demo-score">
                        <span className="demo-bar is-pending">
                          <motion.i animate={{ scaleX: r.progress }} transition={{ duration: 0.9, ease: "linear" }} />
                        </span>
                        <em>Answering</em>
                      </span>
                    )}
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>

          <p className="demo-foot">
            <Icons.users className="btn-icon" /> Sample data for illustration only.
          </p>
        </div>
      </div>
    </section>
  );
}
