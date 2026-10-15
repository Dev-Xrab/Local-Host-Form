import { useEffect, useState } from "react";
import { AnimatePresence, motion, useScroll, useSpring } from "motion/react";
import { Icons } from "./icons";
import { NAV_LINKS } from "../content";
import SupportModal from "./Support/SupportModal";
import { ease } from "./ui/Section";

const IDS = NAV_LINKS.map((l) => l.id);

// Highlights the nav link of the section currently crossing the middle of the viewport.
function useScrollSpy(ids) {
  const [active, setActive] = useState(null);
  useEffect(() => {
    const els = ids.map((id) => document.getElementById(id)).filter(Boolean);
    if (!els.length || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(e.target.id);
          else setActive((cur) => (cur === e.target.id ? null : cur));
        });
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [ids]);
  return active;
}

export default function Nav({ base = "" }) {
  const [open, setOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const active = useScrollSpy(IDS);
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 28, mass: 0.3 });

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const close = () => setOpen(false);
  const openSupport = () => {
    close();
    setSupportOpen(true);
  };

  return (
    <>
      <header className={`nav ${scrolled ? "is-scrolled" : ""}`}>
        <motion.div className="nav-progress" style={{ scaleX: progress }} aria-hidden="true" />
        <div className="container nav-inner">
          <a href={`${base}#top`} className="brand" onClick={close}>
            <span className="brand-logo">
              <img src="/logo.png" alt="" width="18" height="18" />
            </span>
            Self Host Form
          </a>

          <nav className="nav-links" aria-label="Primary">
            {NAV_LINKS.map((l) => (
              <a
                key={l.id}
                href={`${base}#${l.id}`}
                className={active === l.id ? "is-active" : ""}
                aria-current={active === l.id ? "location" : undefined}
              >
                {active === l.id && (
                  <motion.span
                    layoutId="nav-pill"
                    className="nav-pill"
                    transition={{ type: "spring", stiffness: 420, damping: 36 }}
                  />
                )}
                <span>{l.label}</span>
              </a>
            ))}
          </nav>

          <div className="nav-actions">
            <button type="button" className="btn btn-ghost" onClick={openSupport}>
              Support
            </button>
            <a href={`${base}#download`} className="btn btn-primary">
              <Icons.download className="btn-icon" /> Download
            </a>
          </div>

          <button
            type="button"
            className="nav-burger"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <Icons.close /> : <Icons.menu />}
          </button>
        </div>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-menu"
            className="mobile-menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <nav aria-label="Mobile">
              {NAV_LINKS.map((l, i) => (
                <motion.a
                  key={l.id}
                  href={`${base}#${l.id}`}
                  onClick={close}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease, delay: 0.04 * i }}
                >
                  <span>{l.label}</span>
                  <Icons.arrowRight />
                </motion.a>
              ))}
              <motion.button
                type="button"
                onClick={openSupport}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease, delay: 0.04 * NAV_LINKS.length }}
              >
                <span>Support the project</span>
                <Icons.arrowRight />
              </motion.button>
            </nav>
            <a href={`${base}#download`} className="btn btn-primary btn-lg btn-block" onClick={close}>
              <Icons.download className="btn-icon" /> Download
            </a>
          </motion.div>
        )}
      </AnimatePresence>

      <SupportModal open={supportOpen} onClose={() => setSupportOpen(false)} />
    </>
  );
}
