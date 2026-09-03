
import "./window-container.css";

export default function WindowContainer({
  component,
  navigationpath = "None",
}) {
  return (
    <div className="role-page-wrapper">
      <div className="role-page-window">
        <div className="role-page-topbar">
          <span className="role-page-dot" />
          <span className="role-page-dot" />
          <span className="role-page-dot" />

          <span className="role-page-breadcrumb">
            StoneArch / {navigationpath}
          </span>
        </div>

        {component}
      </div>
    </div>
  );
}

