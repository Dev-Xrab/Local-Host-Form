import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import useAuthStore, { useAuthActions } from "../../../store/useAuthStore";
import { Icons } from "./icons";
import "./dashboard-page.css";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: "grid", end: true },
  { to: "/dashboard/sessions", label: "Sessions", icon: "clipboard" },
  { to: "/dashboard/subjects", label: "Subjects", icon: "book" },
  { to: "/dashboard/forms", label: "Forms", icon: "fileText" },
  { to: "/dashboard/export", label: "Bulk Export", icon: "download" },
  { to: "/dashboard/gradebook", label: "Gradebook", icon: "table" },
  { to: "/dashboard/settings", label: "Settings", icon: "settings" },
];

export default function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuthActions();
  const hasRecoveryQuestion = useAuthStore((s) => s.hasRecoveryQuestion);
  const onSettingsPage = location.pathname === "/dashboard/settings";

  const handleLogout = async () => {
    await logout();
    navigate("/host/login");
  };

  return (
    <div className="dash">
      <aside className="dash-nav">
        <div className="dash-nav-brand">
          <span className="dash-nav-logo">◆</span>
          StoneArch
        </div>

        <nav className="dash-nav-list">
          {NAV_ITEMS.map((item) => {
            const Icon = Icons[item.icon];
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `dash-nav-item ${isActive ? "dash-nav-item-active" : ""}`}
              >
                <Icon className="dash-nav-item-icon" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <button type="button" className="dash-nav-logout" onClick={handleLogout}>
          <Icons.logout className="dash-nav-item-icon" />
          Logout
        </button>
      </aside>

      <main className="dash-main">
        {!hasRecoveryQuestion && !onSettingsPage && (
          <div className="dash-recovery-banner">
            <span>
              You haven't set a recovery question yet — without one, a forgotten password can't
              be reset.
            </span>
            <NavLink to="/dashboard/settings">Set it up</NavLink>
          </div>
        )}
        <Outlet />
      </main>
    </div>
  );
}
