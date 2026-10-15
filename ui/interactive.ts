import { useState } from "react";
import { Platform, type ViewStyle } from "react-native";
import type { Colors } from "./tokens";

// Focus rings follow :focus-visible semantics on web: shown for keyboard focus, hidden for mouse
// and touch, so a clicked button doesn't keep a ring around it. Tracked with one pair of global
// listeners, added once.
let keyboardModality = false;
if (Platform.OS === "web" && typeof window !== "undefined") {
  window.addEventListener("keydown", (e) => { if (e.key === "Tab" || e.key.startsWith("Arrow") || e.key === "Enter" || e.key === " ") keyboardModality = true; }, true);
  window.addEventListener("pointerdown", () => { keyboardModality = false; }, true);
}

/** Tracks keyboard focus so every control shows the same visible focus ring on web. */
export function useFocusRing(colors: Colors) {
  const [focused, setFocused] = useState(false);
  const ring = (focused
    ? { outlineWidth: 2, outlineStyle: "solid", outlineColor: colors.focus, outlineOffset: 1 }
    : {}) as ViewStyle;
  return {
    ring,
    onFocus: () => setFocused(Platform.OS !== "web" || keyboardModality),
    onBlur: () => setFocused(false),
  };
}
