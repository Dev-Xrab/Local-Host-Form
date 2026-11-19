import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

// Web document shell: lets the app's own scroll containers own scrolling and applies the
// saved color scheme before React mounts.
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <title>Self-Host Form — Forms on your own server</title>
        <meta name="description" content="Create forms, run live sessions and review responses on a server you control." />
        <ScrollViewStyleReset />
        <script dangerouslySetInnerHTML={{ __html: `try{var m=localStorage.getItem("selfhostform_theme");var l=m==="light"||((!m||m==="system")&&matchMedia("(prefers-color-scheme: light)").matches);document.documentElement.setAttribute("data-theme",l?"light":"dark");document.documentElement.style.colorScheme=l?"light":"dark"}catch(e){document.documentElement.setAttribute("data-theme","light")}` }} />
        <style dangerouslySetInnerHTML={{ __html: `
          body { background:#FAFAF9; -webkit-font-smoothing:antialiased; }
          html[data-theme=dark] body { background:#121212; }
          body { transition: background-color .4s ease; }
          html.theme-anim *, html.theme-anim *::before, html.theme-anim *::after { transition: background-color .4s ease, border-color .4s ease, color .4s ease, fill .4s ease, stroke .4s ease, box-shadow .4s ease !important; }
          * { box-sizing: border-box; }
          [role=button], [role=link], [role=tab], input, textarea { transition: background-color .2s ease, border-color .2s ease, box-shadow .2s ease, opacity .2s ease; }
          [id^="answer-"]:focus-within { outline: 2px solid currentColor; outline-offset: 2px; }
          [id^="matrix-label-"] { position: sticky; left: 0; z-index: 1; }
          @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
        ` }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
