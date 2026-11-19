import { useRef } from "react";
import { useInView } from "motion/react";
import { motion, useScroll, useSpring } from "motion/react";
import SectionHead from "./SectionHead";
import { Icons } from "../icons";
import { ease } from "./primitives";

const STEPS = [
  { title: "Install the app", text: "Download the installer for your system from the Install section and open it. Windows and macOS builds are not signed yet, so the first launch shows a warning." },
  { title: "Sign in as Host", text: "On the first screen choose Host and set a host password. This can only be done on the host computer itself." },
  { title: "Add a recovery question", text: "Open Settings and add one now, so you can reset the host password later. Recovery also only works from the host computer." },
  { title: "Build a form", text: "Start from scratch, a template or an import. Press Save, then Preview it the way a respondent will see it." },
  { title: "Create and start a session", text: "Pick the form, name the session and set an optional time limit. Start it to get the join code, link and QR." },
  { title: "Share and run it", text: "People on your Wi-Fi open the link or type the code. For people outside your network, turn on the public link in Settings." },
  { title: "End it and export", text: "End the session, check the ranking, then export to Excel or PDF so you have your own copy." },
];

const NOTES = [
  { tag: "Keep it on", title: "The host computer has to stay on", text: "The desktop app blocks sleep while it is open. Still plug the laptop in and stay on Wi-Fi for the whole session." },
  { tag: "Test first", title: "Do a trial run", text: "Join with a few real devices on the same network before the live session, not during it." },
  { tag: "Network", title: "The local link works on your network only", text: "Anyone outside it needs the public link. It is temporary: it stops when you stop it or close the app, and it is desktop only." },
  { tag: "Integrity", title: "Session controls are deterrents", text: "Fullscreen and refocus lock help, but a browser cannot fully lock a device. Supervise high-stakes tests." },
  { tag: "Password", title: "Do not lose the host password", text: "Set a recovery question. There are no separate user accounts yet: everyone who manages forms shares the one login." },
  { tag: "Your data", title: "Responses live on this device", text: "Export results after each session and keep backups. Google Drive sync is optional." },
];

function Step({ s, i }) {
  const ref = useRef(null);
  const reached = useInView(ref, { margin: "0px 0px -55% 0px", once: true });
  return (
    <motion.li ref={ref} className={reached ? "is-reached" : ""} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "0px 0px -12% 0px" }} transition={{ duration: 0.7, ease }}>
      <span className="tut-n">{String(i + 1).padStart(2, "0")}</span>
      <div>
        <h3>{s.title}</h3>
        <p>{s.text}</p>
      </div>
    </motion.li>
  );
}

export default function Tutorial() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 70%", "end 60%"] });
  const line = useSpring(scrollYProgress, { stiffness: 140, damping: 28, mass: 0.3 });

  return (
    <section id="setup" className="section tutorial">
      <div className="container">
        <SectionHead title="From install to your first live session." />
        <div className="tut">
          <ol className="tut-steps" ref={ref}>
            <span className="tut-rail" aria-hidden="true">
              <motion.i style={{ scaleY: line }} />
            </span>
            {STEPS.map((s, i) => (
              <Step key={s.title} s={s} i={i} />
            ))}
          </ol>

          <motion.aside className="remember" initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "0px 0px -10% 0px" }} transition={{ duration: 0.8, ease }} aria-labelledby="remember-title">
            <header>
              <Icons.alertTriangle />
              <div>
                <p className="mono-label">Before a live session</p>
                <h3 id="remember-title">Remember this</h3>
              </div>
            </header>
            <ul>
              {NOTES.map((n) => (
                <li key={n.title}>
                  <span className="remember-tag">{n.tag}</span>
                  <h4>{n.title}</h4>
                  <p>{n.text}</p>
                </li>
              ))}
            </ul>
          </motion.aside>
        </div>
      </div>
    </section>
  );
}
