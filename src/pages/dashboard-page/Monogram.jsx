export const initial = (name) => name.trim().charAt(0).toUpperCase() || "?";

export const Monogram = ({ label, size = 36 }) => (
  <span className="dash-monogram" style={{ width: size, height: size, fontSize: size * 0.42 }}>
    {label}
  </span>
);
