// Single source of truth for the visual language. Screens never use raw colors, sizes or radii.
//
// Neutral self-hosted workspace: readable type and monochrome actions.
export const palette = {
  dark: {
    bg: "#121212",
    surface: "#1A1A1A",
    surfaceMuted: "#232323",
    surfaceSunken: "#151515",
    border: "#2A2A2A",
    borderStrong: "#77716D",
    text: "#F5F5F4",
    textBody: "#D6D3D1",
    textSecondary: "#A8A29E",
    textTertiary: "#A8A29E",
    primary: "#F5F5F4",
    primaryText: "#171717",
    primaryHover: "#E5E5E4",
    accent: "#F5F5F4",
    accentSoft: "#2A2A2A",
    danger: "#E9A3A0",
    dangerSoft: "#282222",
    success: "#9EC7A9",
    successSoft: "#202923",
    warning: "#E5BD83",
    warningSoft: "#2B2720",
    overlay: "rgba(0,0,0,0.62)",
    hover: "rgba(255,255,255,0.05)",
    pressed: "rgba(255,255,255,0.09)",
    focus: "#F5F5F4",
  },
  light: {
    bg: "#FAFAF9",
    surface: "#FFFFFF",
    surfaceMuted: "#F5F5F4",
    surfaceSunken: "#EFEEEC",
    border: "#E7E5E4",
    borderStrong: "#928D89",
    text: "#171717",
    textBody: "#44403C",
    textSecondary: "#6B6560",
    textTertiary: "#6B6560",
    primary: "#171717",
    primaryText: "#FFFFFF",
    primaryHover: "#303030",
    accent: "#171717",
    accentSoft: "#F0EFED",
    danger: "#A73532",
    dangerSoft: "#F8EEED",
    success: "#276B47",
    successSoft: "#EEF5EF",
    warning: "#82570D",
    warningSoft: "#F8F2E8",
    overlay: "rgba(14,16,20,0.45)",
    hover: "rgba(0,0,0,0.045)",
    pressed: "rgba(0,0,0,0.08)",
    focus: "#171717",
  },
} as const;

export type Colors = { [K in keyof typeof palette.dark]: string };

export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 24, 6: 32, 7: 48 } as const;
// Studio corners: panels 8, controls 6, chips 4.
export const radius = { sm: 4, md: 4, lg: 8, pill: 999 } as const;

// Readable working-tool typography, using the local system stack for offline operation.
export const type = {
  caption: { fontSize: 13, lineHeight: 19, fontWeight: "500" },
  small: { fontSize: 14, lineHeight: 21, fontWeight: "400" },
  body: { fontSize: 15, lineHeight: 23, fontWeight: "400" },
  bodyStrong: { fontSize: 15, lineHeight: 23, fontWeight: "600" },
  label: { fontSize: 14, lineHeight: 21, fontWeight: "600" },
  title: { fontSize: 18, lineHeight: 26, fontWeight: "600" },
  heading: { fontSize: 25, lineHeight: 33, fontWeight: "600" },
  display: { fontSize: 32, lineHeight: 40, fontWeight: "700" },
} as const;
export type TypeVariant = keyof typeof type;

// System stack only: the app must work fully offline on a local network, so no web font download.
export const fontFamily = 'Inter, -apple-system, "Segoe UI Variable", "Segoe UI", Roboto, system-ui, sans-serif';

export const size = { control: 48, controlLg: 48, controlSm: 40, touch: 44, sidebar: 224, contentMax: 1200, formMax: 720 } as const;

export const breakpoints = { tablet: 768, desktop: 1024 } as const;

export const motion = { fast: 120, base: 180 } as const;

// Depth comes from borders and lifted surfaces, not shadows. Only overlays get one.
export const shadow = {
  sm: {},
  md: { boxShadow: "0 18px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)" },
} as const;
