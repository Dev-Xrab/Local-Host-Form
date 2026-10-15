import { Platform } from "react-native";

// The web build exports a single static index.html (app.json: output "single"), so app/+html.tsx is
// not used. Global CSS is injected here instead, once, at startup.
const CSS = `
  * { box-sizing: border-box; }
  html, body, div { scroll-behavior: smooth; }
  div { overscroll-behavior: contain; }
  body { -webkit-font-smoothing: antialiased; transition: background-color .4s ease; }
  [role=button], [role=link], [role=tab], input, textarea { transition: background-color .2s ease, border-color .2s ease, box-shadow .2s ease, opacity .2s ease; }
  html.theme-anim *, html.theme-anim *::before, html.theme-anim *::after {
    transition: background-color .4s ease, border-color .4s ease, color .4s ease, fill .4s ease, stroke .4s ease, box-shadow .4s ease !important;
  }
  @media (prefers-reduced-motion: reduce) { * { transition: none !important; } html, body, div { scroll-behavior: auto; } }
`;

export function installWebStyles() {
  if (Platform.OS !== "web" || typeof document === "undefined" || document.getElementById("shf-web-styles")) return;
  const style = document.createElement("style");
  style.id = "shf-web-styles";
  style.textContent = CSS;
  document.head.appendChild(style);
}

/** Keeps the page behind the app (body) and the browser's own widgets in step with the theme. */
export function syncWebTheme(dark: boolean, background: string) {
  if (Platform.OS !== "web" || typeof document === "undefined") return;
  const root = document.documentElement;
  if (dark) root.removeAttribute("data-theme"); else root.setAttribute("data-theme", "light");
  root.style.colorScheme = dark ? "dark" : "light";
  document.body.style.backgroundColor = background;
}
