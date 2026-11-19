import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { ease } from "./primitives";

const EVENTS = [
  ["Maria Santos", "joined"],
  ["James Okafor", "joined"],
  ["Maria Santos", "submitted"],
  ["Priya Nair", "joined"],
  ["James Okafor", "submitted"],
  ["Liam Chen", "joined"],
  ["Priya Nair", "submitted"],
  ["Sofia Rossi", "joined"],
];

// Join and submit events dropping in over the session screen, the way the host sees them live.
export function LiveFeed() {
  const ref = useRef(null);
  const inView = useInView(ref, { margin: "-10% 0px" });
  const reduce = useReducedMotion();
  const [n, setN] = useState(3);
  useEffect(() => {
    if (!inView || reduce) return;
    const id = setInterval(() => setN((v) => v + 1), 2300);
    return () => clearInterval(id);
  }, [inView, reduce]);
  const items = [n, n - 1, n - 2].map((k) => ({ k, ev: EVENTS[k % EVENTS.length] }));
  return (
    <div className="live-feed" ref={ref} aria-hidden="true">
      <AnimatePresence initial={false} mode="popLayout">
        {items.map(({ k, ev }, i) => (
          <motion.div key={k} layout className="live-item" style={{ opacity: 1 - i * 0.28 }} initial={{ opacity: 0, y: -14, scale: 0.96 }} animate={{ opacity: 1 - i * 0.28, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }} transition={{ duration: 0.6, ease }}>
            <i className={ev[1] === "joined" ? "is-join" : "is-done"} />
            <b>{ev[0]}</b> {ev[1]}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export const ActivePing = () => <i className="active-ping" aria-hidden="true" />;
export const TapRipple = ({ x, y }) => <i className="tap" style={{ left: `${x}%`, top: `${y}%` }} aria-hidden="true" />;
