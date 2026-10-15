import { useEffect } from "react";

// Keys that, with Ctrl/Cmd held, copy, cut, select everything, print or save the page.
const BLOCKED_SHORTCUTS = new Set(["c", "x", "a", "p", "s"]);

// A respondent still has to type, and copy/select within, their OWN answer, so text inputs are
// exempt from everything except the page-content protections.
const isEditable = (el: EventTarget | Element | null) => {
  const e = el as HTMLElement | null;
  return !!e && (e.tagName === "INPUT" || e.tagName === "TEXTAREA" || e.isContentEditable);
};

/**
 * Discourages copying the questions off the respondent page: no right-click menu, no text
 * selection/drag, no Ctrl/Cmd + C/X/A/P/S outside answer fields, and the clipboard is wiped on
 * Print Screen. A deterrent, not security: a browser can't stop photos, dev tools or a determined
 * user. Opt-in per form (restrictCopying). While enabled, <body> carries `copy-protected`.
 */
export function useCopyProtection(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    const style = document.createElement("style");
    style.textContent = "body.copy-protected :not(input):not(textarea){-webkit-user-select:none;user-select:none}@media print{body.copy-protected{display:none!important}}";
    document.head.appendChild(style);
    document.body.classList.add("copy-protected");

    const block = (e: Event) => e.preventDefault();
    const onContextMenu = (e: Event) => { if (!isEditable(e.target)) e.preventDefault(); };
    const onCopyCut = (e: ClipboardEvent) => {
      if (isEditable(document.activeElement)) return;
      e.preventDefault();
      e.clipboardData?.setData("text/plain", "");
    };
    const onSelectStart = (e: Event) => { if (!isEditable(e.target)) e.preventDefault(); };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "PrintScreen") return e.preventDefault();
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && BLOCKED_SHORTCUTS.has(k)) {
        // Print and save are blocked everywhere; copy/cut/select-all only outside answer fields.
        if (k === "p" || k === "s" || !isEditable(document.activeElement)) e.preventDefault();
      }
    };
    // The OS copies the screenshot regardless of preventDefault, so overwrite the clipboard right after.
    const onKeyUp = (e: KeyboardEvent) => { if (e.key === "PrintScreen") navigator.clipboard?.writeText("").catch(() => {}); };

    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("copy", onCopyCut);
    document.addEventListener("cut", onCopyCut);
    document.addEventListener("selectstart", onSelectStart);
    document.addEventListener("dragstart", block);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    return () => {
      style.remove();
      document.body.classList.remove("copy-protected");
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("copy", onCopyCut);
      document.removeEventListener("cut", onCopyCut);
      document.removeEventListener("selectstart", onSelectStart);
      document.removeEventListener("dragstart", block);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
    };
  }, [enabled]);
}
