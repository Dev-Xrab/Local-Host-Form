import { FACTS } from "../content";

// Slow marquee, pauses on hover. CSS-driven so it stays smooth and honours prefers-reduced-motion.
export default function FactStrip() {
  const row = [...FACTS, ...FACTS];
  return (
    <section className="facts" aria-label="Product highlights">
      <ul className="facts-track">
        {row.map((f, i) => (
          <li key={i} aria-hidden={i >= FACTS.length ? "true" : undefined}>
            <span className="facts-dot" />
            {f}
          </li>
        ))}
      </ul>
    </section>
  );
}
