import { Icons } from "../icons";
import "./trust-section.css";

const POINTS = [
  { icon: "checkCircle", label: "Auto-graded quizzes" },
  { icon: "qrCode", label: "Join by code, link or QR" },
  { icon: "wifiOff", label: "Works on local Wi-Fi" },
  { icon: "download", label: "Excel & PDF export" },
];

export default function TrustSection() {
  return (
    <section className="trust-section" aria-label="Product highlights">
      <div className="container trust-inner">
        <p className="trust-heading">Everything a classroom assessment needs, on your own machine</p>
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
