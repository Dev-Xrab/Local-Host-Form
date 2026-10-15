import { ActivityIndicator, Pressable, StyleSheet, View, type PressableProps, type ViewStyle } from "react-native";
import { radius, size, space } from "./tokens";
import { useTheme } from "./theme";
import { Text } from "./Text";
import { Icon, type IconComponent } from "./Icon";
import { useFocusRing } from "./interactive";

export type ButtonVariant = "primary" | "success" | "secondary" | "ghost" | "danger";

interface ButtonProps extends Omit<PressableProps, "children" | "style"> {
  label: string;
  variant?: ButtonVariant;
  icon?: IconComponent;
  loading?: boolean;
  compact?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
}

export function Button({ label, variant = "secondary", icon, loading, compact, fullWidth, disabled, style, ...rest }: ButtonProps) {
  const { colors, dark } = useTheme();
  const { ring, onFocus, onBlur } = useFocusRing(colors);
  const inactive = disabled || loading;

  const palettes = {
    primary: { bg: colors.primary, hover: colors.primaryHover, fg: colors.primaryText, border: dark ? "#3ECF8E66" : colors.primary },
    success: { bg: colors.primary, hover: colors.primaryHover, fg: colors.primaryText, border: dark ? "#3ECF8E66" : colors.primary },
    secondary: { bg: colors.surfaceMuted, hover: colors.pressed, fg: colors.text, border: colors.borderStrong },
    ghost: { bg: "transparent", hover: colors.hover, fg: colors.text, border: "transparent" },
    danger: { bg: colors.danger, hover: colors.danger, fg: "#FFFFFF", border: "transparent" },
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onFocus={onFocus}
      onBlur={onBlur}
      {...rest}
      style={(state) => [
        styles.base,
        {
          minHeight: compact ? 26 : size.control,
          backgroundColor: (state as { hovered?: boolean }).hovered || state.pressed ? palettes.hover : palettes.bg,
          borderColor: palettes.border,
          opacity: inactive ? 0.5 : 1,
        },
        fullWidth && { alignSelf: "stretch" },
        ring,
        style,
      ]}
    >
      <View style={styles.row}>
        {loading ? <ActivityIndicator size="small" color={palettes.fg} /> : icon ? <Icon icon={icon} size={14} color={palettes.fg} /> : null}
        <Text variant="small" style={{ color: palettes.fg, fontWeight: "500" }} numberOfLines={1}>{label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 10, alignItems: "center", justifyContent: "center", alignSelf: "flex-start" },
  row: { flexDirection: "row", alignItems: "center", gap: space[2] },
});
