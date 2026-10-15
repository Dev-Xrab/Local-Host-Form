import { motion } from "motion/react";
import { Icons } from "./icons";
import { WHY } from "../content";
import { SectionHead, ease } from "./ui/Section";

export default function Why() {
  return (
    <section id="product" className="section why">
      <div className="container">
        <SectionHead eyebrow="Why Self Host Form" title="Your network. Your machine. Your data.">
          Hosted form tools keep everyone's answers on someone else's servers. Self Host Form
          runs on a computer you control, so you decide where the data lives and who can reach it.
        </SectionHead>
        <div className="why-grid">
          {WHY.map((w, i) => {
            const Icon = Icons[w.icon];
            return (
              <motion.div
                key={w.title}
                className="why-card"
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "0px 0px -60px 0px" }}
                transition={{ duration: 0.6, ease, delay: i * 0.1 }}
              >
                <span className="icon-chip">
                  <Icon />
                </span>
                <h3>{w.title}</h3>
                <p>{w.text}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
