// Browser-style window around a product screenshot.
export default function Frame({ src, alt, label, className = "" }) {
  return (
    <figure className={`frame ${className}`}>
      <div className="frame-bar">
        <span />
        <span />
        <span />
        {label && <em>Self Host Form / {label}</em>}
      </div>
      <img src={src} alt={alt} loading="lazy" width="1366" height="860" />
    </figure>
  );
}
