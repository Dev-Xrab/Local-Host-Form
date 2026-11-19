import { useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";
import SectionHead from "./SectionHead";
import { Icons } from "../icons";
import { CountUp, ease } from "./primitives";

// Each tile is a small live picture of the feature. Loops only run while the tile is on screen.
function Tile({ n, title, note, className = "", children, delay = 0 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { margin: "-10% 0px" });
  return (
    <motion.article ref={ref} className={`tile ${className} ${inView ? "is-in" : ""}`} initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "0px 0px -60px 0px" }} transition={{ duration: 0.7, ease, delay }}>
      <span className="tile-n">{n}</span>
      <div className="tile-art" aria-hidden="true">
        {children}
      </div>
      <h3>{title}</h3>
      <p>{note}</p>
    </motion.article>
  );
}

const TYPES = ["Short answer", "Paragraph", "Multiple choice", "Checkboxes", "Dropdown", "Linear scale", "Date", "Time", "File upload", "Choice grid", "Checkbox grid"];

function Types() {
  const rows = [TYPES.slice(0, 6), TYPES.slice(6)];
  return (
    <div className="tp">
      {rows.map((row, r) => (
        <div key={r} className={`tp-row ${r ? "rev" : ""}`}>
          {[0, 1].map((k) => (
            <div key={k} className="tp-set">
              {row.map((t, i) => (
                <span key={t} style={{ "--i": i + r * 6 }}>
                  {t}
                </span>
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function Grade() {
  return (
    <div className="gr">
      <p className="gr-q">Which option is correct?</p>
      {["Option A", "Option B", "Option C"].map((o, i) => (
        <div key={o} className={`gr-opt ${i === 1 ? "is-key" : ""}`}>
          <span className="gr-radio" />
          <span>{o}</span>
          {i === 1 && <Icons.check className="gr-ok" />}
        </div>
      ))}
      <b className="gr-score">
        +<CountUp to={2} duration={0.8} /> pts
      </b>
    </div>
  );
}

function Timer({ live }) {
  const reduce = useReducedMotion();
  const [t, setT] = useState(9 * 60 + 42);
  useEffect(() => {
    if (!live || reduce) return;
    const id = setInterval(() => setT((v) => (v <= 9 * 60 + 12 ? 9 * 60 + 42 : v - 1)), 1000);
    return () => clearInterval(id);
  }, [live, reduce]);
  const frac = (9 * 60 + 42 - t) / 30;
  return (
    <div className="tm">
      <svg viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="50" className="tm-track" />
        <circle cx="60" cy="60" r="50" className="tm-run" pathLength="100" style={{ strokeDashoffset: frac * 8 }} />
      </svg>
      <b className="mono">
        {String(Math.floor(t / 60)).padStart(2, "0")}:{String(t % 60).padStart(2, "0")}
      </b>
      <span>Server-timed</span>
    </div>
  );
}

function Controls() {
  return (
    <ul className="cx">
      {["Require fullscreen", "Lock on tab switch", "Restrict copying"].map((l, i) => (
        <li key={l} style={{ "--i": i }}>
          <Icons.lock className="cx-ic" />
          <span>{l}</span>
          <i className="sw" />
        </li>
      ))}
    </ul>
  );
}

const PEOPLE = [
  ["Ada L.", [92, 88, 95, 97]],
  ["Grace H.", [88, 91, 90, 94]],
  ["Alan T.", [67, 72, 70, 81]],
  ["Linus T.", [55, 61, 64, 70]],
];

function Matrix() {
  return (
    <div className="mx">
      <div className="mx-row mx-head">
        <span />
        {["S1", "S2", "S3", "S4"].map((w) => (
          <b key={w}>{w}</b>
        ))}
      </div>
      {PEOPLE.map(([name, scores], r) => (
        <div key={name} className="mx-row">
          <span className="mx-name">
            <i>{name.split(" ").map((p) => p[0]).join("")}</i>
            {name}
          </span>
          {scores.map((s, c) => (
            <em key={c} className="mx-cell" style={{ "--d": `${(r * 4 + c) * 0.12}s`, "--s": s }}>
              {s}
            </em>
          ))}
        </div>
      ))}
    </div>
  );
}

function Export() {
  return (
    <div className="ex">
      {[["XLSX", "results.xlsx"], ["PDF", "session.pdf"], ["ZIP", "uploads.zip"]].map(([k, f], i) => (
        <span key={k} className="ex-file" style={{ "--i": i }}>
          <Icons.file />
          <b>{k}</b>
          <em>{f}</em>
        </span>
      ))}
    </div>
  );
}

function Folders() {
  return (
    <div className="fo">
      {[["Math", 4], ["Events", 7], ["Team", 3]].map(([f, c], i) => (
        <span key={f} className="fo-row" style={{ "--i": i }}>
          <Icons.folder />
          <b>{f}</b>
          <em>{c} forms</em>
        </span>
      ))}
    </div>
  );
}

function PublicLink({ live }) {
  const reduce = useReducedMotion();
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!live || reduce) return;
    const id = setInterval(() => setOn((v) => !v), 2600);
    return () => clearInterval(id);
  }, [live, reduce]);
  return (
    <div className="pb">
      <span className={`switch ${on ? "is-on" : ""}`}>
        <i />
      </span>
      <span className="pb-link mono">
        <Icons.globe />
        <span className={on ? "is-on" : ""}>trycloudflare.com/…</span>
      </span>
      <span className="pb-state">{on ? "Public link running" : "Local network only"}</span>
    </div>
  );
}

function Live({ children }) {
  const ref = useRef(null);
  const live = useInView(ref, { margin: "-10% 0px" });
  return (
    <div ref={ref} className="live">
      {children(live)}
    </div>
  );
}

export default function Capabilities() {
  return (
    <section id="features" className="section capabilities">
      <div className="container">
        <SectionHead title="Everything you need to run a session." />
        <div className="tiles">
          <Tile n="01" className="span2" title="11 question types" note="Plus section breaks and ready-made templates.">
            <Types />
          </Tile>
          <Tile n="02" title="Optional grading" note="Answer keys and points, for quizzes and tests." delay={0.05}>
            <Grade />
          </Tile>
          <Tile n="03" title="Timed per person" note="Enforced by the server." delay={0.1}>
            <Live>{(l) => <Timer live={l} />}</Live>
          </Tile>
          <Tile n="04" title="Session controls" note="Fullscreen, refocus lock and copy limits." delay={0.05}>
            <Controls />
          </Tile>
          <Tile n="05" className="span2" title="Results matrix" note="Participants against sessions, in one table." delay={0.1}>
            <Matrix />
          </Tile>
          <Tile n="06" title="Export" note="Excel, PDF and ZIP." delay={0.05}>
            <Export />
          </Tile>
          <Tile n="07" className="span2" title="Folders and participant list" note="Keep forms organized and match the same person across sessions." delay={0.05}>
            <Folders />
          </Tile>
          <Tile n="08" className="span2" title="Public link" note="Optional and temporary. Desktop app only." delay={0.1}>
            <Live>{(l) => <PublicLink live={l} />}</Live>
          </Tile>
        </div>
      </div>
    </section>
  );
}
