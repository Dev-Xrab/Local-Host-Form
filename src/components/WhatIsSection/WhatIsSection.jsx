import { Icons } from "../icons";
import "./what-is-section.css";

const CONTROLS = [
  { icon: "monitor", title: "Deployment", text: "Run the platform on infrastructure you choose, instead of a provider's servers." },
  { icon: "database", title: "Data", text: "Form definitions and responses live in your own database." },
  { icon: "share", title: "Access", text: "Decide how a form is shared and who can reach it." },
  { icon: "layers", title: "Infrastructure", text: "Fits a personal computer, a home server, or organisational hardware." },
  { icon: "sliders", title: "Customisation", text: "Configure fields, timing, and grading to match your workflow." },
  { icon: "bank", title: "Internal workflows", text: "Adapt forms to how your team, class, or organisation already works." },
];

export default function WhatIsSection() {
  return (
    <section id="product" className="section what-is-section">
      <div className="container">
        <div className="section-head center">
          <p className="eyebrow">What is SelfHost Form?</p>
          <h2>A Form Platform You Control</h2>
          <p>
            Traditional hosted form platforms handle hosting and infrastructure for you.
            SelfHost Form gives you the option to run the platform yourself.
          </p>
        </div>

        <div className="whatis-grid">
          {CONTROLS.map((item) => {
            const Icon = Icons[item.icon];
            return (
              <div className="whatis-card" key={item.title}>
                <span className="whatis-icon-wrap">
                  <Icon className="whatis-icon" />
                </span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </div>
            );
          })}
        </div>

        <p className="whatis-resolve">
          It's a form builder first — the self-hosting option is what sets it apart from
          most online form tools.
        </p>
      </div>
    </section>
  );
}
