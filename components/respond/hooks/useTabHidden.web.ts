import { useEffect } from "react";

/** Calls `onHidden` the moment the tab becomes hidden (the respondent switched away). */
export function useTabHidden(enabled: boolean, onHidden: () => void): void {
  useEffect(() => {
    if (!enabled) return;
    const handler = () => { if (document.visibilityState === "hidden") onHidden(); };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [enabled, onHidden]);
}
