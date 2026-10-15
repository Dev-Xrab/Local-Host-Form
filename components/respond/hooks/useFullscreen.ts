// Fullscreen is a browser/desktop feature. On native the session setting is simply not applicable.
export function useFullscreen() {
  return { supported: false, isFullscreen: false, enter: () => {}, exit: () => {}, toggle: () => {} };
}
