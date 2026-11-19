import { useEffect, useRef, useState } from "react";
import { useInView, useReducedMotion } from "motion/react";
import { Icons } from "../icons";
import SectionHead from "./SectionHead";

// Loops "internet up" / "internet down" while the local link keeps carrying answers: the whole
// point of local-first, shown rather than told.
export default function LocalFirst() {
  const ref = useRef(null);
  const inView = useInView(ref, { margin: "-15% 0px" });
  const reduce = useReducedMotion();
  const [online, setOnline] = useState(true);

  useEffect(() => {
    if (!inView || reduce) return;
    const t = setInterval(() => setOnline((v) => !v), 3200);
    return () => clearInterval(t);
  }, [inView, reduce]);

  return (
    <section id="local-first" className="section localfirst inv" ref={ref}>
      <div className="container">
        <SectionHead title="Runs on your network, with or without internet." />

        <div className={`lf ${online ? "is-online" : "is-offline"} ${inView ? "is-in" : ""}`}>
          <div className="lf-node">
            <span className="lf-icon">
              <Icons.devices />
            </span>
            <b>Respondents</b>
          </div>

          <div className="lf-link lf-local" aria-hidden="true">
            <Icons.wifi className="lf-wifi" />
            <span className="lf-wire">
              <i />
              <i />
              <i />
            </span>
          </div>

          <div className="lf-node lf-host">
            <span className="lf-icon">
              <Icons.database />
            </span>
            <b>Host</b>
            <span className="lf-pill">Running</span>
          </div>

          <div className="lf-link lf-cloud" aria-hidden="true">
            <span className="lf-wire dashed">
              <i />
            </span>
            <span className="lf-cut">×</span>
          </div>

          <div className="lf-node lf-net">
            <span className="lf-icon">
              <Icons.cloud />
            </span>
            <b>Internet</b>
            <span className="lf-pill" aria-live="polite">{online ? "Connected" : "Offline"}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
