import { Icons } from "../icons";
import "./trust-section.css";

const POINTS = [
  { icon: "layers", label: "Multiple field types" },
  { icon: "database", label: "Self-hosted by design" },
  { icon: "share", label: "Share with a link" },
  { icon: "chart", label: "Built-in response dashboard" },
];

export default function TrustSection() {
  return (
    <section className="trust-section" aria-label="Product highlights">
      <div className="container trust-inner">
        <p className="trust-heading">A form platform you deploy yourself</p>
        <ul className="trust-list">
          {POINTS.map((point) => {
            const Icon = Icons[point.icon];
            return (
              <li key={point.label}>
                <Icon className="trust-icon" />
                {point.label}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
