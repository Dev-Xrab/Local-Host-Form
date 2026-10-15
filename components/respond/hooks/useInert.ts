import type { RefObject } from "react";
import type { View } from "react-native";

/** Makes a subtree non-interactive and unfocusable while an overlay covers it (web only; native overlays already capture touches). */
export function useInert(_ref: RefObject<View | null>, _inert: boolean): void {}
