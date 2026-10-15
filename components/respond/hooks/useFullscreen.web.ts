import { useCallback, useEffect, useState } from "react";

type FsDoc = Document & { webkitFullscreenElement?: Element; msFullscreenElement?: Element; webkitExitFullscreen?: () => Promise<void>; msExitFullscreen?: () => Promise<void> };
type FsEl = HTMLElement & { webkitRequestFullscreen?: () => Promise<void>; msRequestFullscreen?: () => Promise<void> };

const active = () => { const d = document as FsDoc; return !!(d.fullscreenElement || d.webkitFullscreenElement || d.msFullscreenElement); };

// Entering fullscreen must happen synchronously inside a user gesture (a click): browsers reject
// the request otherwise. Both directions are best-effort: some browsers (iPhone Safari, embedded
// webviews) don't support the API at all, and that must never block the respondent from answering.
export function enterFullscreen() {
  try {
    if (active()) return;
    const el = document.documentElement as FsEl;
    (el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen)?.call(el)?.catch?.(() => {});
  } catch {
    // best-effort only
  }
}

export function exitFullscreen() {
  try {
    if (!active()) return;
    const d = document as FsDoc;
    (d.exitFullscreen || d.webkitExitFullscreen || d.msExitFullscreen)?.call(d)?.catch?.(() => {});
  } catch {
    // best-effort only
  }
}

/**
 * Reflects the real fullscreen state. It can be lost for reasons outside our own calls (Esc/F11,
 * a native file picker, a silent resume that never entered it), so a toolbar button must always
 * offer a real way back in rather than assume a request made earlier is still in effect.
 */
export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const update = () => setIsFullscreen(active());
    update();
    const events = ["fullscreenchange", "webkitfullscreenchange", "MSFullscreenChange"];
    events.forEach((e) => document.addEventListener(e, update));
    return () => events.forEach((e) => document.removeEventListener(e, update));
  }, []);
  // Leaving the respondent screen by any route must not strand the respondent in fullscreen.
  useEffect(() => () => exitFullscreen(), []);

  const toggle = useCallback(() => (active() ? exitFullscreen() : enterFullscreen()), []);
  return { supported: true, isFullscreen, enter: enterFullscreen, exit: exitFullscreen, toggle };
}
