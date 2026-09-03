export default function PageHeader({ eyebrow, title, subtitle, action }) {
  return (
    <header className="dash-header dash-header-row">
      <div>
        <span className="dash-eyebrow">{eyebrow}</span>
        <h1 className="dash-title">{title}</h1>
        <p className="dash-subtitle">{subtitle}</p>
      </div>
      {action}
    </header>
  );
}
