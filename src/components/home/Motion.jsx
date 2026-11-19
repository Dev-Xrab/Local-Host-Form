import { Fragment, useRef } from "react";
import { motion, useScroll, useSpring, useTransform } from "motion/react";
import { ease } from "./primitives";

// Heading that rises word by word when it scrolls into view. The visible heading element owns the
// scroll trigger (a clipped child would never count as "in view"); the words follow as variants.
export function Words({ text, className = "", as = "h2", delay = 0 }) {
  const Tag = motion[as];
  return (
    <Tag className={className} aria-label={text} initial="hidden" whileInView="show" viewport={{ once: true, margin: "0px 0px -8% 0px" }} transition={{ staggerChildren: 0.05, delayChildren: delay }}>
      {text.split(" ").map((w, i) => (
        <Fragment key={`${w}${i}`}>
          <span className="wd" aria-hidden="true">
            <motion.span variants={{ hidden: { y: "115%" }, show: { y: 0, transition: { duration: 0.85, ease } } }}>{w}</motion.span>
          </span>{" "}
        </Fragment>
      ))}
    </Tag>
  );
}

function Word({ progress, from, to, strong, children }) {
  const opacity = useTransform(progress, [from, to], [0.2, 1]);
  return (
    <motion.span className={strong ? "sw-strong" : ""} style={{ opacity }}>
      {children}{" "}
    </motion.span>
  );
}

// Statement that fills in word by word as you scroll past it.
export function Statement({ parts }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 88%", "start 40%"] });
  const words = parts.flatMap((p, k) => p.split(" ").filter(Boolean).map((w) => ({ w, strong: k === 0 })));
  return (
    <p className="vp-statement" ref={ref}>
      {words.map(({ w, strong }, i) => (
        <Word key={`${w}${i}`} progress={scrollYProgress} from={(i / words.length) * 0.85} to={(i / words.length) * 0.85 + 0.15} strong={strong}>
          {w}
        </Word>
      ))}
    </p>
  );
}

// Nudges its child toward the pointer. Small on purpose.
export function Magnetic({ children, strength = 0.22 }) {
  const ref = useRef(null);
  const x = useSpring(0, { stiffness: 220, damping: 16, mass: 0.4 });
  const y = useSpring(0, { stiffness: 220, damping: 16, mass: 0.4 });
  return (
    <motion.span
      ref={ref}
      className="mag"
      style={{ x, y }}
      onPointerMove={(e) => {
        const r = ref.current.getBoundingClientRect();
        x.set((e.clientX - (r.left + r.width / 2)) * strength);
        y.set((e.clientY - (r.top + r.height / 2)) * strength);
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      {children}
    </motion.span>
  );
}
