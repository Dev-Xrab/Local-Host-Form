import "./product-frame.css";

// Wraps a real screenshot of the app in the same three-dot "window chrome" the app itself
// uses for its own role/login screens (see WindowContainer in the main app) — a deliberate
// echo so the marketing site and the product feel like one thing, not a template around a demo.
export default function ProductFrame({ src, alt, label, className = "" }) {
  return (
    <figure className={`product-frame ${className}`}>
      <div className="product-frame-bar">
        <span className="product-frame-dot" />
        <span className="product-frame-dot" />
        <span className="product-frame-dot" />
        {label && <span className="product-frame-label">{label}</span>}
      </div>
      <div className="product-frame-viewport">
        <img src={src} alt={alt} loading="lazy" />
      </div>
    </figure>
  );
}
