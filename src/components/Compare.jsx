import { motion } from "motion/react";
import { Icons } from "./icons";
import { COMPARISON } from "../content";
import { SectionHead, ease } from "./ui/Section";

export default function Compare() {
  return (
    <section className="section compare">
      <div className="container">
        <SectionHead eyebrow="Comparison" title="Hosted form tools vs. Self Host Form">
          A general comparison of approach, not a claim about any specific product.
        </SectionHead>

        <div className="compare-wrap">
          <table className="compare-table">
            <thead>
              <tr>
                <th scope="col">
                  <span className="visually-hidden">Dimension</span>
                </th>
                <th scope="col">Typical hosted form tool</th>
                <th scope="col" className="is-us">
                  Self Host Form
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map(([label, them, us], i) => (
                <motion.tr
                  key={label}
                  initial={{ opacity: 0, x: -12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "0px 0px -40px 0px" }}
                  transition={{ duration: 0.45, ease, delay: i * 0.05 }}
                >
                  <th scope="row">{label}</th>
                  <td>{them}</td>
                  <td className="is-us">
                    <Icons.checkCircle className="check-icon" />
                    {us}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
