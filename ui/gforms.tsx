import { forwardRef, useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, TextInput, View, type TextInputProps, type TextStyle, type ViewStyle } from "react-native";
import { Check } from "lucide-react-native";
import { fontFamily } from "./tokens";
import { useTheme } from "./theme";
import { Text, type TextProps } from "./Text";

/** Google Forms layout, drawn in the app's own black-and-white theme. */
export const gfPalette = {
  light: {
    page: "#FAFAF9", canvas: "#F5F5F4", card: "#FFFFFF", cardAlt: "#F5F5F4", border: "#E7E5E4", borderStrong: "#928D89",
    text: "#171717", textSecondary: "#6B6560", placeholder: "#928D89",
    accent: "#171717", accentText: "#FFFFFF", accentSoft: "#F0EFED", bar: "#171717",
    error: "#A73532", errorSoft: "#F8EEED", success: "#276B47", successSoft: "#EEF5EF",
    hover: "rgba(0,0,0,0.045)", pressed: "rgba(0,0,0,0.08)", topbar: "#FFFFFF", shadow: "0 1px 2px rgba(0,0,0,.18), 0 1px 3px 1px rgba(0,0,0,.08)",
  },
  dark: {
    page: "#121212", canvas: "#121212", card: "#1A1A1A", cardAlt: "#232323", border: "#2A2A2A", borderStrong: "#77716D",
    text: "#F5F5F4", textSecondary: "#A8A29E", placeholder: "#77716D",
    accent: "#F5F5F4", accentText: "#171717", accentSoft: "#2A2A2A", bar: "#F5F5F4",
    error: "#E9A3A0", errorSoft: "#282222", success: "#9EC7A9", successSoft: "#202923",
    hover: "rgba(255,255,255,0.05)", pressed: "rgba(255,255,255,0.09)", topbar: "#1A1A1A", shadow: "0 1px 2px rgba(0,0,0,.5), 0 1px 3px 1px rgba(0,0,0,.35)",
  },
} as const;
export type GF = { [K in keyof typeof gfPalette.light]: string };

export function useGF(): GF & { dark: boolean } {
  const { dark } = useTheme();
  return { ...(dark ? gfPalette.dark : gfPalette.light), dark };
}

export const GF_FONT = fontFamily;

/** Text that always uses the Google Forms text colours. */
export function GText({ size = 14, weight = "400", color, secondary, style, ...rest }: TextProps & { size?: number; weight?: TextStyle["fontWeight"]; color?: string; secondary?: boolean }) {
  const g = useGF();
  return <Text {...rest} style={[{ fontSize: size, lineHeight: Math.round(size * 1.45), fontWeight: weight, color: color ?? (secondary ? g.textSecondary : g.text) }, style]} />;
}

/** White card on the lavender canvas. */
export function GCard({ children, style, accent }: { children: ReactNode; style?: ViewStyle; accent?: boolean }) {
  const g = useGF();
  return (
    <View style={[{ backgroundColor: g.card, borderWidth: 1, borderColor: g.border, borderRadius: 8, overflow: "hidden" }, style]}>
      {accent ? <View style={{ height: 10, backgroundColor: g.accent }} /> : null}
      {children}
    </View>
  );
}

/** Pill/flat button as used across Google Forms. */
export function GButton({ label, onPress, variant = "text", icon, disabled, loading, style }: { label: string; onPress?: () => void; variant?: "filled" | "outlined" | "text"; icon?: ReactNode; disabled?: boolean; loading?: boolean; style?: ViewStyle }) {
  const g = useGF();
  const filled = variant === "filled";
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      disabled={disabled || loading} onPress={onPress}
      style={(s) => [{ minHeight: 36, paddingHorizontal: filled ? 24 : 16, borderRadius: 4, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, alignSelf: "flex-start", opacity: disabled ? 0.5 : 1,
        backgroundColor: filled ? ((s as { hovered?: boolean }).hovered ? g.accent : g.accent) : (s as { hovered?: boolean }).hovered ? g.accentSoft : "transparent",
        borderWidth: variant === "outlined" ? 1 : 0, borderColor: g.border }, filled && (s as { hovered?: boolean }).hovered && ({ boxShadow: g.shadow } as object), style]}
    >
      {loading ? <ActivityIndicator size="small" color={filled ? g.accentText : g.accent} /> : icon}
      <Text style={{ fontFamily, fontSize: 14, fontWeight: "500", letterSpacing: 0.25, color: filled ? g.accentText : g.accent }}>{label}</Text>
    </Pressable>
  );
}

/** Round icon-only button (toolbars, option remove, etc). */
export function GIconButton({ children, label, onPress, disabled, size = 40, style }: { children: ReactNode; label: string; onPress?: () => void; disabled?: boolean; size?: number; style?: ViewStyle }) {
  const g = useGF();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress}
      style={(s) => [{ width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.35 : 1, backgroundColor: (s as { hovered?: boolean }).hovered ? g.hover : (s as { pressed?: boolean }).pressed ? g.pressed : "transparent" }, style]}>
      {children}
    </Pressable>
  );
}

/** Radio circle / checkbox square marker, drawn the Material way. */
export function GMark({ shape, checked, size = 20, correct }: { shape: "radio" | "check"; checked?: boolean; size?: number; correct?: boolean }) {
  const g = useGF();
  const color = checked ? (correct ? g.success : g.accent) : g.borderStrong;
  if (shape === "radio") return <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: color, alignItems: "center", justifyContent: "center" }}>{checked ? <View style={{ width: size / 2, height: size / 2, borderRadius: size / 4, backgroundColor: color }} /> : null}</View>;
  return <View style={{ width: size - 2, height: size - 2, borderRadius: 2, borderWidth: 2, borderColor: color, backgroundColor: checked ? color : "transparent", alignItems: "center", justifyContent: "center" }}>{checked ? <Check size={size - 6} color={correct ? "#fff" : g.accentText} strokeWidth={3.5} /> : null}</View>;
}

/** Choice row for respondents: marker + label, whole row is the hit target. */
export function GChoice({ shape, checked, label, onPress, disabled }: { shape: "radio" | "check"; checked: boolean; label: string; onPress: () => void; disabled?: boolean }) {
  const g = useGF();
  return (
    <Pressable accessibilityRole={shape === "radio" ? "radio" : "checkbox"} accessibilityState={{ checked, disabled }} accessibilityLabel={label} disabled={disabled} onPress={onPress}
      style={(s) => [{ flexDirection: "row", alignItems: "center", gap: 14, minHeight: 40, paddingVertical: 6, paddingHorizontal: 4, borderRadius: 4, backgroundColor: (s as { hovered?: boolean }).hovered ? g.hover : "transparent" }]}>
      <GMark shape={shape} checked={checked} />
      <Text style={{ flex: 1, fontFamily, fontSize: 14, lineHeight: 20, color: g.text }}>{label}</Text>
    </Pressable>
  );
}

interface LineInputProps extends Omit<TextInputProps, "style"> {
  fontSize?: number; weight?: TextStyle["fontWeight"]; autoGrow?: boolean; boxed?: boolean; invalid?: boolean;
  /** Show the underline only when focused/hovered (editor chrome) instead of always (respondent answers). */
  quiet?: boolean; width?: number | string;
}

/** Google Forms' signature input: no box, an underline that turns purple on focus. */
export const GLineInput = forwardRef<TextInput, LineInputProps>(function GLineInput({ fontSize = 14, weight = "400", autoGrow, multiline, invalid, quiet, boxed, width, onFocus, onBlur, onContentSizeChange, editable = true, ...rest }, ref) {
  const g = useGF();
  const [focus, setFocus] = useState(false);
  const [hover, setHover] = useState(false);
  const [h, setH] = useState<number>();
  const grow = autoGrow || multiline;
  const line = invalid ? g.error : focus ? g.accent : quiet ? (hover ? g.border : "transparent") : g.border;
  return (
    <View style={{ width: (width ?? "100%") as never }} {...({ onMouseEnter: () => setHover(true), onMouseLeave: () => setHover(false) } as object)}>
      <TextInput
        ref={ref} editable={editable} multiline={grow} scrollEnabled={grow ? false : undefined} placeholderTextColor={g.placeholder}
        accessibilityLabel={rest.accessibilityLabel ?? rest.placeholder}
        onFocus={(e) => { setFocus(true); onFocus?.(e); }} onBlur={(e) => { setFocus(false); onBlur?.(e); }}
        onContentSizeChange={(e) => { if (grow) setH(e.nativeEvent.contentSize.height); onContentSizeChange?.(e); }}
        {...rest}
        style={{
          fontFamily, fontSize, lineHeight: Math.round(fontSize * 1.45), fontWeight: weight, color: g.text, paddingVertical: boxed ? 12 : 8, paddingHorizontal: boxed ? 12 : 0,
          borderBottomWidth: focus ? 2 : 1, borderBottomColor: line, outlineStyle: "none", outlineWidth: 0,
          ...(boxed ? { backgroundColor: g.cardAlt, borderTopLeftRadius: 4, borderTopRightRadius: 4 } : null),
          ...(grow ? { overflow: "hidden", resize: "none", ...(h ? { height: Math.max(h, Math.round(fontSize * 1.45) + (boxed ? 24 : 16)) } : null) } : null),
        } as object}
      />
    </View>
  );
});
