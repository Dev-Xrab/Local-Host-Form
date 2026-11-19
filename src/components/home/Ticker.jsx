import { useRef } from "react";
import { motion, useAnimationFrame, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform, useVelocity } from "motion/react";

const WORDS = ["Quizzes", "Surveys", "Registrations", "Feedback", "Check-ins", "Polls", "Sign-ups", "Assessments"];

const wrap = (min, max, v) => {
  const r = max - min;
  return ((((v - min) % r) + r) % r) + min;
};

// A slow ticker of what it can be used for. It reads the scroll velocity: scrolling speeds it up,
// and scrolling back up reverses it.
export default function Ticker() {
  const reduce = useReducedMotion();
  const base = useMotionValue(0);
  const { scrollY } = useScroll();
  const velocity = useSpring(useVelocity(scrollY), { damping: 50, stiffness: 400 });
  const boost = useTransform(velocity, [-1500, 0, 1500], [-4, 0, 4], { clamp: false });
  const dir = useRef(1);
  const x = useTransform(base, (v) => `${v}%`);

  useAnimationFrame((_, delta) => {
    if (reduce) return;
    if (boost.get() < -0.05) dir.current = -1;
    else if (boost.get() > 0.05) dir.current = 1;
    const move = dir.current * 2.2 * (delta / 1000) * (1 + Math.abs(boost.get()));
    base.set(wrap(-50, 0, base.get() - move));
  });

  return (
    <div className="ticker" aria-hidden="true">
      <motion.div className="ticker-track" style={{ x }}>
        {[0, 1].map((k) => (
          <div className="ticker-set" key={k}>
            {WORDS.map((w) => (
              <span key={w}>
                {w}
                <i />
              </span>
            ))}
          </div>
        ))}
      </motion.div>
    </div>
  );
}
