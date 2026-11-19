import { useRef } from "react";
import { motion, useMotionValue, useScroll, useSpring, useTransform } from "motion/react";
import { Magnetic } from "./Motion";
import { Icons } from "../icons";
import { Brands } from "../brandIcons";
import { ease } from "./primitives";
import { usePlatform } from "../../hooks/usePlatform";
import { ANDROID_DOWNLOAD_URL, LINUX_DOWNLOAD_URL, MAC_DOWNLOAD_URL, WINDOWS_DOWNLOAD_URL } from "../../constants";

const PLATFORMS = {
  windows: { label: "Windows", href: WINDOWS_DOWNLOAD_URL },
  mac: { label: "macOS", href: MAC_DOWNLOAD_URL },
  linux: { label: "Linux", href: LINUX_DOWNLOAD_URL },
};

const USES = ["For classrooms and training", "For events and communities", "For teams and organizations"];

const RUNS = [
  { name: "Windows", icon: Brands.windows },
  { name: "macOS", icon: Brands.apple },
  { name: "Linux", icon: Brands.linux },
  { name: "Android", icon: Brands.android },
  { name: "Google Drive", icon: Icons.cloud, note: "optional" },
  { name: "Excel and PDF", icon: Icons.file },
];

export default function Hero() {
  const platform = usePlatform();
  const main = PLATFORMS[platform];
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const exit = useSpring(scrollYProgress, { stiffness: 110, damping: 26, mass: 0.4 });
  const markScale = useTransform(exit, [0, 1], [1, 1.7]);
  const markFade = useTransform(exit, [0, 0.8], [1, 0.1]);
  const textY = useTransform(exit, [0, 1], [0, -70]);
  const usesY = useTransform(exit, [0, 1], [0, -130]);
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const rotY = useSpring(useTransform(px, [-1, 1], [-16, 16]), { stiffness: 120, damping: 18 });
  const rotX = useSpring(useTransform(py, [-1, 1], [14, -14]), { stiffness: 120, damping: 18 });
  const onMove = (e) => {
    px.set((e.clientX / window.innerWidth) * 2 - 1);
    py.set((e.clientY / window.innerHeight) * 2 - 1);
  };

  return (
    <section id="top" className="hero" ref={ref}>
      <div className="container hero-grid" onPointerMove={onMove}>
        <motion.div className="hero-left" style={{ y: textY }}>
          <h1>
            {["Forms, sessions,", "and results. Yours."].map((line, i) => (
              <span className="mask" key={line}>
                <motion.span initial={{ y: "110%" }} animate={{ y: 0 }} transition={{ duration: 1, ease, delay: 0.1 + i * 0.12 }}>
                  {line}
                </motion.span>
              </span>
            ))}
          </h1>
          <motion.p className="hero-sub" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease, delay: 0.5 }}>
            Build forms, run live sessions and review results on a server you control.
          </motion.p>
          <motion.div className="hero-ctas" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease, delay: 0.62 }}>
            <Magnetic>
              <a href={main.href} className="btn btn-primary pill" download>
                Download for {main.label}
              </a>
            </Magnetic>
            <Magnetic>
              <a href="#how-it-works" className="btn btn-secondary pill">
                See how it works
              </a>
            </Magnetic>
          </motion.div>
        </motion.div>

        <motion.div className="hero-mark" aria-hidden="true" style={{ scale: markScale, opacity: markFade }}>
          <i className="hero-halo" />
          <i className="ripple" />
          <i className="ripple" />
          <i className="ripple" />
          <motion.div className="hero-tilt" style={{ rotateX: rotX, rotateY: rotY, transformPerspective: 900 }}>
            <i className="logo-mask hero-logo" />
          </motion.div>
        </motion.div>

        <motion.ul className="hero-uses" style={{ y: usesY }}>
          {USES.map((u, i) => (
            <motion.li key={u} initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, ease, delay: 0.8 + i * 0.12 }}>
              {u}
            </motion.li>
          ))}
        </motion.ul>
      </div>

      <div className="container runs" aria-label="Runs on">
        <ul>
          {RUNS.map(({ name, icon: Icon, note }, i) => (
            <motion.li key={name} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease, delay: 1 + i * 0.08 }}>
              <Icon />
              <span>{name}</span>
              {note && <em>{note}</em>}
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  );
}
