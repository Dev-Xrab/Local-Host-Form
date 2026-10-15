import { useRef } from "react";
import { motion } from "motion/react";
import { Icons } from "./icons";
import { FEATURES } from "../content";
import { SectionHead, ease } from "./ui/Section";

// Bento card with a cursor-following spotlight (pure CSS variables, no re-renders).
function Card({ feature, index }) {
  const ref = useRef(null);
  const Icon = Icons[feature.icon];

  const onMove = (e) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  };

  return (
    <motion.article
      ref={ref}
      onPointerMove={onMove}
      className={`bento-card ${feature.size === "lg" ? "is-wide" : ""}`}
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -60px 0px" }}
      transition={{ duration: 0.55, ease, delay: (index % 3) * 0.07 }}
      whileHover={{ y: -3 }}
    >
      <span className="icon-chip">
        <Icon />
      </span>
      <h3>{feature.title}</h3>
      <p>{feature.text}</p>
    </motion.article>
  );
}

export default function Features() {
  return (
    <section id="features" className="section features">
      <div className="container">
        <SectionHead eyebrow="Features" title="Everything you need to collect answers">
          Build forms, run live sessions, grade answers automatically and export the results, all
          running on your own computer.
        </SectionHead>
        <div className="bento">
          {FEATURES.map((f, i) => (
            <Card key={f.title} feature={f} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
