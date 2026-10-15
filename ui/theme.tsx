import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Platform, useColorScheme, useWindowDimensions } from "react-native";
import { breakpoints, palette, type Colors } from "./tokens";
import { getItem, setItem } from "../lib/storage";
import { installWebStyles, syncWebTheme } from "../lib/webStyles";

export type ThemeMode = "dark" | "light" | "system";
const STORAGE_KEY = "selfhostform_theme";

interface Theme { colors: Colors; dark: boolean; mode: ThemeMode; setMode: (m: ThemeMode) => void }
const ThemeContext = createContext<Theme>({ colors: palette.dark, dark: true, mode: "dark", setMode: () => {} });

function readMode(): ThemeMode {
  const v = getItem(STORAGE_KEY);
  return v === "light" || v === "system" || v === "dark" ? v : "dark";
}

/** Dark by default (the product's identity); light and follow-system are a setting. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>(readMode);
  const setMode = useCallback((m: ThemeMode) => {
    // Web: turn on the colour cross-fade (see lib/webStyles.ts) for the duration of the switch only, so
    // ordinary updates elsewhere never pick up the transition.
    if (Platform.OS === "web" && typeof document !== "undefined") {
      const root = document.documentElement;
      root.classList.add("theme-anim");
      setTimeout(() => root.classList.remove("theme-anim"), 600);
    }
    setModeState(m);
    setItem(STORAGE_KEY, m);
  }, []);

  useEffect(() => { installWebStyles(); }, []);

  const value = useMemo<Theme>(() => {
    const dark = mode === "system" ? system !== "light" : mode === "dark";
    return { colors: dark ? palette.dark : palette.light, dark, mode, setMode };
  }, [mode, system, setMode]);
  useEffect(() => { syncWebTheme(value.dark, value.colors.bg); }, [value.dark, value.colors.bg]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);

export type Layout = "phone" | "tablet" | "desktop";

/** Coarse layout class. Components pick *different layouts* from this, they don't just shrink. */
export function useLayout(): { layout: Layout; width: number; isPhone: boolean; isDesktop: boolean } {
  const { width } = useWindowDimensions();
  const layout: Layout = width >= breakpoints.desktop ? "desktop" : width >= breakpoints.tablet ? "tablet" : "phone";
  return { layout, width, isPhone: layout === "phone", isDesktop: layout === "desktop" };
}
