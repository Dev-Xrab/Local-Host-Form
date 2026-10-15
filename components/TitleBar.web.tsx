import { useEffect, useState, type CSSProperties } from "react";
import { useTheme } from "../ui";

interface ElectronAPI {
  isElectron?: boolean;
  isWindowMaximized: () => Promise<boolean>;
  onWindowMaximizedChange: (cb: (v: boolean) => void) => (() => void) | void;
  minimizeWindow: () => void;
  toggleMaximizeWindow: () => void;
  closeWindow: () => void;
}
const api = (): ElectronAPI | undefined => (window as unknown as { electronAPI?: ElectronAPI }).electronAPI;

const HEIGHT = 32;

// Renders nothing unless running inside the frameless Electron window (electron/main.js sets
// frame:false and electron/preload.cjs exposes window.electronAPI). A normal browser tab keeps its
// own chrome. DOM elements are used directly because -webkit-app-region has no RN equivalent.
export function TitleBar() {
  const { colors } = useTheme();
  const electron = typeof window !== "undefined" ? api() : undefined;
  const isElectron = !!electron?.isElectron;
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    const a = api();
    if (!a?.isElectron) return;
    a.isWindowMaximized().then(setMaximized);
    return a.onWindowMaximizedChange(setMaximized) || undefined;
  }, []);

  if (!isElectron) return null;

  const drag = { WebkitAppRegion: "drag" } as CSSProperties;
  const noDrag = { WebkitAppRegion: "no-drag" } as CSSProperties;
  const btn: CSSProperties = { ...noDrag, width: 46, height: HEIGHT, border: 0, background: "transparent", color: colors.textSecondary, cursor: "default", display: "grid", placeItems: "center" };

  return (
    <div style={{ height: HEIGHT, display: "flex", background: colors.surface, borderBottom: `1px solid ${colors.border}`, flexShrink: 0 }}>
      <div style={{ ...drag, flex: 1, display: "flex", alignItems: "center", paddingLeft: 12, fontSize: 12, fontWeight: 600, color: colors.textSecondary, fontFamily: "inherit" }} onDoubleClick={() => electron?.toggleMaximizeWindow()}>
        Self Host Form
      </div>
      <button type="button" aria-label="Minimize window" style={btn} onClick={() => electron?.minimizeWindow()}>
        <svg width="12" height="12" viewBox="0 0 12 12"><line x1="2" y1="6" x2="10" y2="6" stroke="currentColor" /></svg>
      </button>
      <button type="button" aria-label={maximized ? "Restore window" : "Maximize window"} style={btn} onClick={() => electron?.toggleMaximizeWindow()}>
        <svg width="12" height="12" viewBox="0 0 12 12">
          {maximized ? <><rect x="3.5" y="2" width="6.5" height="6.5" fill="none" stroke="currentColor" /><path d="M2 3.5V10H8.5" fill="none" stroke="currentColor" /></> : <rect x="2" y="2" width="8" height="8" fill="none" stroke="currentColor" />}
        </svg>
      </button>
      <button type="button" aria-label="Close window" style={btn} onClick={() => electron?.closeWindow()}>
        <svg width="12" height="12" viewBox="0 0 12 12"><line x1="2" y1="2" x2="10" y2="10" stroke="currentColor" /><line x1="10" y1="2" x2="2" y2="10" stroke="currentColor" /></svg>
      </button>
    </div>
  );
}
