import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Icons } from "./icons";
import { FAQS } from "../content";
import { Rise, SectionHead, ease } from "./ui/Section";

export default function Faq() {
  const [open, setOpen] = useState(0);

  return (
    <section id="faq" className="section faq">
      <div className="container faq-inner">
        <SectionHead eyebrow="FAQ" title="Frequently asked questions" align="left">
          Anything not covered here? Email{" "}
          <a className="link" href="mailto:b.d.senin@gmail.com">
            b.d.senin@gmail.com
          </a>
          .
        </SectionHead>

        <Rise className="faq-list">
          {FAQS.map((item, i) => {
            const isOpen = open === i;
            return (
              <div className={`faq-item ${isOpen ? "is-open" : ""}`} key={item.q}>
                <h3>
                  <button
                    type="button"
                    className="faq-q"
                    aria-expanded={isOpen}
                    aria-controls={`faq-panel-${i}`}
                    id={`faq-trigger-${i}`}
                    onClick={() => setOpen(isOpen ? -1 : i)}
                  >
                    <span>{item.q}</span>
                    <motion.span animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.25, ease }}>
                      <Icons.chevronDown className="faq-chevron" />
                    </motion.span>
                  </button>
                </h3>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      id={`faq-panel-${i}`}
                      role="region"
                      aria-labelledby={`faq-trigger-${i}`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease }}
                      style={{ overflow: "hidden" }}
                    >
                      <p className="faq-a">{item.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </Rise>
      </div>
    </section>
  );
}
