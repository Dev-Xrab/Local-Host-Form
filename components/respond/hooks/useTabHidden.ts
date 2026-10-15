import { useEffect } from "react";
import { AppState } from "react-native";

/** Calls `onHidden` when the app goes to the background. (The web build uses the page-visibility API.) */
export function useTabHidden(enabled: boolean, onHidden: () => void): void {
  useEffect(() => {
    if (!enabled) return;
    const sub = AppState.addEventListener("change", (s) => { if (s !== "active") onHidden(); });
    return () => sub.remove();
  }, [enabled, onHidden]);
}
