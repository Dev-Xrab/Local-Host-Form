import { useRef } from "react";
import { motion, useInView } from "motion/react";
import { Icons } from "./icons";
import { SELF_POINTS } from "../content";
import { Rise, ease } from "./ui/Section";

const NODES = [
  { icon: "users", title: "Respondent", sub: "Joins with a code" },
  { icon: "layers", title: "Self Host Form", sub: "The app" },
  { icon: "monitor", title: "Your computer or network", sub: "Where it runs" },
  { icon: "database", title: "Local database", sub: "Forms & responses" },
];

function Diagram() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -20% 0px" });
  return (
    <div
      ref={ref}
      className="arch"
      role="img"
      aria-label="Diagram: a respondent connects to Self Host Form, which runs on your computer or network, backed by a local database"
    >
      {NODES.map((n, i) => {
        const Icon = Icons[n.icon];
        return (
          <div className="arch-step" key={n.title}>
            <motion.div
              className={`arch-node ${i === 1 ? "is-app" : ""}`}
              initial={{ opacity: 0, scale: 0.9, y: 12 }}
              animate={inView ? { opacity: 1, scale: 1, y: 0 } : undefined}
              transition={{ duration: 0.5, ease, delay: i * 0.25 }}
            >
              <span className="icon-chip">
                <Icon />
              </span>
              <strong>{n.title}</strong>
              <span>{n.sub}</span>
            </motion.div>
            {i < NODES.length - 1 && (
              <span className="arch-link" aria-hidden="true">
                <motion.i
                  initial={{ scaleY: 0, scaleX: 0 }}
                  animate={inView ? { scaleY: 1, scaleX: 1 } : undefined}
                  transition={{ duration: 0.4, ease, delay: i * 0.25 + 0.2 }}
                />
                <motion.b
                  className="arch-dot"
                  animate={inView ? { opacity: [0, 1, 1, 0], x: [0, 0, 0, 0] } : undefined}
                  transition={{ duration: 2.4, repeat: Infinity, delay: 1.2 + i * 0.5, ease: "easeInOut" }}
                />
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function SelfHost() {
  return (
    <section id="self-hosting" className="section selfhost">
      <div className="container selfhost-inner">
        <div className="selfhost-copy">
          <Rise>
            <p className="eyebrow">Self-hosting</p>
            <h2>Your forms. Your computer. Your control.</h2>
            <p className="lead">
              A hosted form service stores every response on the provider's servers. Self Host Form
              runs on a computer you own, so everyone's answers sit in a local database next to
              the app that collected them.
            </p>
          </Rise>
          <ul className="check-list">
            {SELF_POINTS.map((p, i) => (
              <Rise as="li" key={p} delay={0.08 * i}>
                <Icons.checkCircle className="check-icon" />
                <span>{p}</span>
              </Rise>
            ))}
          </ul>
          <Rise className="note">
            <strong>To be precise:</strong> self-hosted describes where the software runs, not whether
            a network is required. Respondents still need to reach your computer, whether that's over
            local Wi-Fi with no internet at all, or through the optional public link.
          </Rise>
          <Rise className="note note-dev">
            <strong>For developers and IT teams:</strong> it's a Node and Express server with SQLite
            that serves the web UI, so besides the desktop app you can run it standalone on a machine
            you manage.
          </Rise>
          <Rise className="callout">
            <Icons.shield className="callout-icon" />
            <p>
              <strong>There's no default password.</strong> On first launch the app asks you to create
              the host password, and that setup step only works from the host computer itself, so no
              one else on the network can claim it first. You can also add a recovery question for
              forgotten passwords.
            </p>
          </Rise>
        </div>
        <Diagram />
      </div>
    </section>
  );
}
