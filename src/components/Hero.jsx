import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useScroll, useTransform } from "motion/react";
import { Icons } from "./icons";
import { SHOWCASE } from "../content";
import { WINDOWS_DOWNLOAD_URL } from "../constants";
import { ease } from "./ui/Section";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { duration: 0.7, ease } } };

// Tabbed product tour. Auto-advances while on screen until the visitor picks a tab themselves.
function Showcase() {
  const [index, setIndex] = useState(0);
  const [auto, setAuto] = useState(true);
  const wrap = useRef(null);
  const visible = useInView(wrap, { margin: "-20% 0px" });
  const { scrollYProgress } = useScroll({ target: wrap, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [24, -24]);

  useEffect(() => {
    if (!auto || !visible) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % SHOWCASE.length), 5200);
    return () => clearInterval(t);
  }, [auto, visible]);

  const current = SHOWCASE[index];

  return (
    <motion.div className="showcase" ref={wrap} style={{ y }}>
      <div className="showcase-tabs" role="tablist" aria-label="Product screens">
        {SHOWCASE.map((s, i) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={i === index}
            className={i === index ? "is-active" : ""}
            onClick={() => {
              setIndex(i);
              setAuto(false);
            }}
          >
            {i === index && (
              <motion.span
                layoutId="showcase-pill"
                className="showcase-pill"
                transition={{ type: "spring", stiffness: 420, damping: 36 }}
              />
            )}
            <span>{s.tab}</span>
          </button>
        ))}
      </div>

      <div className="showcase-window">
        <div className="frame-bar">
          <span />
          <span />
          <span />
          <em>Self Host Form / {current.tab}</em>
        </div>
        <div className="showcase-screen">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.img
              key={current.id}
              src={current.src}
              alt={current.alt}
              width="1366"
              height="860"
              initial={{ opacity: 0, scale: 1.02 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease }}
            />
          </AnimatePresence>
          {auto && visible && (
            <motion.span
              key={index}
              className="showcase-timer"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 5.2, ease: "linear" }}
            />
          )}
        </div>
      </div>
      <p className="showcase-caption" aria-live="polite">
        {current.caption}
      </p>
    </motion.div>
  );
}

export default function Hero() {
  return (
    <section id="top" className="hero">
      <div className="hero-bg" aria-hidden="true" />
      <div className="container hero-inner">
        <motion.div className="hero-copy" variants={container} initial="hidden" animate="show">
          <motion.p variants={item} className="pill">
            <span className="pill-dot" /> Forms and quizzes you host yourself
          </motion.p>
          <motion.h1 variants={item}>
            Run quizzes and forms from <span className="grad">your own computer.</span>
          </motion.h1>
          <motion.p variants={item} className="hero-sub">
            Build a form or exam, hand students a join code, and watch graded results come in
            live, over your classroom Wi-Fi, with no student accounts and no cloud required.
            Responses are stored on your machine, not a vendor's servers.
          </motion.p>
          <motion.div variants={item} className="hero-ctas">
            <a href={WINDOWS_DOWNLOAD_URL} className="btn btn-primary btn-lg" download>
              <Icons.download className="btn-icon" /> Download for Windows
            </a>
            <a href="#how-it-works" className="btn btn-secondary btn-lg">
              See how it works <Icons.arrowRight className="btn-icon" />
            </a>
          </motion.div>
          <motion.p variants={item} className="hero-note">
            Windows installer · Free for personal and school use
          </motion.p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease, delay: 0.35 }}
          className="hero-visual"
        >
          <Showcase />
        </motion.div>
      </div>
    </section>
  );
}
