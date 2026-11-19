import { useEffect, useRef, useState } from "react";
import { animate, useInView, useReducedMotion } from "motion/react";

export const ease = [0.16, 1, 0.3, 1];

// Counts from `from` to `to` when it scrolls into view (or immediately for reduced motion).
export function CountUp({ to, from = 0, duration = 1.4, delay = 0, suffix = "", className }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const [v, setV] = useState(reduce ? to : from);
  useEffect(() => {
    if (!inView || reduce) return;
    const c = animate(from, to, { duration, delay, ease, onUpdate: (x) => setV(Math.round(x)) });
    return () => c.stop();
  }, [inView, to, from, duration, delay, reduce]);
  return (
    <span ref={ref} className={className}>
      {v}
      {suffix}
    </span>
  );
}
