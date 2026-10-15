import { useEffect, type RefObject } from "react";
import type { View } from "react-native";

export function useInert(ref: RefObject<View | null>, inert: boolean): void {
  useEffect(() => {
    const el = ref.current as unknown as (HTMLElement & { inert?: boolean }) | null;
    if (!el) return;
    el.inert = inert;
    return () => { el.inert = false; };
  }, [ref, inert]);
}
