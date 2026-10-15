import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

// Web document shell: lets the app's own scroll containers own scrolling, and sets the page
// background per color scheme so there's no white flash in dark mode.
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <title>Self Host Form</title>
        <ScrollViewStyleReset />
        <script dangerouslySetInnerHTML={{ __html: `try{var m=localStorage.getItem("selfhostform_theme");if(m==="light"||(m==="system"&&matchMedia("(prefers-color-scheme: light)").matches))document.documentElement.setAttribute("data-theme","light")}catch(e){}` }} />
        <style dangerouslySetInnerHTML={{ __html: `
          body { background:#141414; -webkit-font-smoothing:antialiased; }
          html[data-theme=light] body { background:#FAFAFA; }
          body { transition: background-color .4s ease; }
          html.theme-anim *, html.theme-anim *::before, html.theme-anim *::after { transition: background-color .4s ease, border-color .4s ease, color .4s ease, fill .4s ease, stroke .4s ease, box-shadow .4s ease !important; }
          * { box-sizing: border-box; }
          [role=button], [role=link], [role=tab], input, textarea { transition: background-color .2s ease, border-color .2s ease, box-shadow .2s ease, opacity .2s ease; }
          @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
        ` }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
