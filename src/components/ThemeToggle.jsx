import { useEffect, useState } from "react";
import { Icons } from "./icons";

const KEY = "selfhostform_theme";

// Matches the app: follows the system until the visitor picks a side, then remembers it.
// index.html applies the stored/system theme before first paint, so this only mirrors it.
export default function ThemeToggle({ labelled = false }) {
  const [theme, setTheme] = useState("dark");
  useEffect(() => setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark"), []);

  const flip = () => {
    const next = theme === "dark" ? "light" : "dark";
    const root = document.documentElement;
    root.classList.add("theme-anim");
    setTimeout(() => root.classList.remove("theme-anim"), 600);
    root.dataset.theme = next;
    root.style.colorScheme = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* private mode: the toggle still works for this visit */
    }
    setTheme(next);
  };

  const Icon = theme === "dark" ? Icons.sun : Icons.moon;
  const label = theme === "dark" ? "Switch to light theme" : "Switch to dark theme";
  return (
    <button type="button" className={`theme-toggle ${labelled ? "labelled" : ""}`} onClick={flip} aria-label={label} title={label}>
      <Icon />
      {labelled && <span>{theme === "dark" ? "Light theme" : "Dark theme"}</span>}
    </button>
  );
}
