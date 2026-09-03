import { NavLink, Outlet } from "react-router-dom";
import { Icons } from "./icons";
import "./dashboard-page.css";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: "grid", end: true },
  { to: "/dashboard/quizzes", label: "Quizzes", icon: "clipboard" },
  { to: "/dashboard/subjects", label: "Subjects", icon: "book" },
  { to: "/dashboard/forms", label: "Forms", icon: "fileText" },
  { to: "/dashboard/export", label: "Bulk Export", icon: "download" },
  { to: "/dashboard/gradebook", label: "Gradebook", icon: "table" },
  { to: "/dashboard/settings", label: "Settings", icon: "settings" },
];

export default function DashboardLayout() {
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

        <button type="button" className="dash-nav-logout">
          <Icons.logout className="dash-nav-item-icon" />
          Logout
        </button>
      </aside>

      <main className="dash-main">
        <Outlet />
      </main>
    </div>
  );
}
