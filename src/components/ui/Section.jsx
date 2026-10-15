import { motion } from "motion/react";

export const ease = [0.16, 1, 0.3, 1];

// Fade-and-rise used for every block that enters on scroll. One shared shape keeps the whole
// page moving the same way.
export function Rise({ as = "div", delay = 0, y = 18, className, children, ...rest }) {
  const Tag = motion[as];
  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -80px 0px" }}
      transition={{ duration: 0.6, ease, delay }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export function SectionHead({ eyebrow, title, children, align = "center" }) {
  return (
    <Rise className={`section-head ${align === "center" ? "center" : ""}`}>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h2>{title}</h2>
      {children && <p>{children}</p>}
    </Rise>
  );
}
