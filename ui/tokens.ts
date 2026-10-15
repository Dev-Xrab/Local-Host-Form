// Single source of truth for the visual language. Screens never use raw colors, sizes or radii.
//
// Direction (inspired by the Supabase dashboard): dark charcoal canvas, panels one step lighter
// with 1px hairline borders, compact 13px type, tiny muted labels, and a single green brand
// accent. Red / amber are reserved for state. A light twin has the same structure and accent.
export const palette = {
  dark: {
    bg: "#141414",
    surface: "#1C1C1C",
    surfaceMuted: "#242424",
    surfaceSunken: "#101010",
    border: "#2A2A2A",
    borderStrong: "#383838",
    text: "#EDEDED",
    textSecondary: "#A0A0A0",
    textTertiary: "#707070",
    primary: "#006239",
    primaryText: "#FFFFFF",
    primaryHover: "#00774A",
    accent: "#3ECF8E",
    accentSoft: "#10281E",
    danger: "#EF5E5E",
    dangerSoft: "#2E1818",
    success: "#3ECF8E",
    successSoft: "#10281E",
    warning: "#F2B24C",
    warningSoft: "#2B2211",
    overlay: "rgba(0,0,0,0.62)",
    hover: "rgba(255,255,255,0.05)",
    pressed: "rgba(255,255,255,0.09)",
    focus: "#3ECF8E",
  },
  light: {
    bg: "#FAFAFA",
    surface: "#FFFFFF",
    surfaceMuted: "#F4F4F5",
    surfaceSunken: "#EDEDEE",
    border: "#E4E4E7",
    borderStrong: "#CFCFD4",
    text: "#171717",
    textSecondary: "#5C5C63",
    textTertiary: "#8A8A92",
    primary: "#0B7A4B",
    primaryText: "#FFFFFF",
    primaryHover: "#096640",
    accent: "#0B7A4B",
    accentSoft: "#E3F5EC",
    danger: "#D2404A",
    dangerSoft: "#FDECEC",
    success: "#0B7A4B",
    successSoft: "#E3F5EC",
    warning: "#9C5F0B",
    warningSoft: "#FBF1DC",
    overlay: "rgba(14,16,20,0.45)",
    hover: "rgba(0,0,0,0.045)",
    pressed: "rgba(0,0,0,0.08)",
    focus: "#0B7A4B",
  },
} as const;

export type Colors = { [K in keyof typeof palette.dark]: string };

export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 24, 6: 32, 7: 48 } as const;
// Studio corners: panels 8, controls 6, chips 4.
export const radius = { sm: 4, md: 6, lg: 8, pill: 999 } as const;

// Dense on purpose: this is a working tool. Medium-weight headings, small body.
export const type = {
  caption: { fontSize: 11, lineHeight: 15, fontWeight: "500" },
  small: { fontSize: 12, lineHeight: 17, fontWeight: "400" },
  body: { fontSize: 13, lineHeight: 19, fontWeight: "400" },
  bodyStrong: { fontSize: 13, lineHeight: 19, fontWeight: "600" },
  label: { fontSize: 12, lineHeight: 17, fontWeight: "600" },
  title: { fontSize: 14, lineHeight: 20, fontWeight: "600" },
  heading: { fontSize: 22, lineHeight: 28, fontWeight: "600" },
  display: { fontSize: 24, lineHeight: 30, fontWeight: "600" },
} as const;
export type TypeVariant = keyof typeof type;

// System stack only: the app must work fully offline on a classroom LAN, so no web font download.
export const fontFamily = 'Inter, -apple-system, "Segoe UI Variable", "Segoe UI", Roboto, system-ui, sans-serif';

export const size = { control: 30, controlLg: 44, controlSm: 28, touch: 44, sidebar: 208, contentMax: 1200, formMax: 720 } as const;

export const breakpoints = { tablet: 768, desktop: 1024 } as const;

export const motion = { fast: 120, base: 180 } as const;

// Depth comes from borders and lifted surfaces, not shadows. Only overlays get one.
export const shadow = {
  sm: {},
  md: { boxShadow: "0 18px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)" },
} as const;
