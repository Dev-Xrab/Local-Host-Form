import { useId, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { FAQS } from "../../content";
import { Icons } from "../icons";
import { ease } from "./primitives";
import SectionHead from "./SectionHead";

function Item({ q, a, open, onToggle }) {
  const id = useId();
  return (
    <li className={`faq-item ${open ? "is-open" : ""}`}>
      <h3>
        <button type="button" aria-expanded={open} aria-controls={id} onClick={onToggle}>
          <span>{q}</span>
          <Icons.plus className="faq-plus" />
        </button>
      </h3>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div id={id} role="region" className="faq-a" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.35, ease }}>
            <p>{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

export default function Faq() {
  const [open, setOpen] = useState(0);
  return (
    <section id="faq" className="section faq">
      <div className="container faq-inner">
        <SectionHead title="Questions." />
        <ul className="faq-list">
          {FAQS.map((f, i) => (
            <Item key={f.q} {...f} open={open === i} onToggle={() => setOpen(open === i ? -1 : i)} />
          ))}
        </ul>
      </div>
    </section>
  );
}
