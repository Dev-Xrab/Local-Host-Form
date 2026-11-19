import { motion } from "motion/react";
import { ease } from "./primitives";
import { Magnetic, Words } from "./Motion";

export default function FinalCta() {
  return (
    <section className="cta">
      <motion.div className="container cta-inner" initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-10% 0px" }} transition={{ duration: 0.9, ease }}>
        <Words text="Host your next session on your own device." />
        <div className="cta-actions">
          <Magnetic>
            <a href="#download" className="btn btn-primary pill">
              Download
            </a>
          </Magnetic>
          <Magnetic>
            <a href="#setup" className="btn btn-secondary pill">
              Read the setup guide
            </a>
          </Magnetic>
        </div>
      </motion.div>
    </section>
  );
}
