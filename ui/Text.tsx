import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from "react-native";
import { fontFamily, type as scale, type Colors, type TypeVariant } from "./tokens";
import { useTheme } from "./theme";

export type TextTone = "default" | "secondary" | "tertiary" | "danger" | "success" | "warning" | "accent" | "inverse";

export interface TextProps extends RNTextProps {
  variant?: TypeVariant;
  tone?: TextTone;
  align?: TextStyle["textAlign"];
}

const toneColor = (c: Colors, tone: TextTone) =>
  ({ default: c.text, secondary: c.textSecondary, tertiary: c.textTertiary, danger: c.danger, success: c.success, warning: c.warning, accent: c.accent, inverse: c.primaryText })[tone];

export function Text({ variant = "body", tone = "default", align, style, ...rest }: TextProps) {
  const { colors } = useTheme();
  const v = scale[variant];
  return (
    <RNText
      {...rest}
      style={[{ fontFamily, fontSize: v.fontSize, lineHeight: v.lineHeight, fontWeight: v.fontWeight as TextStyle["fontWeight"], color: toneColor(colors, tone), textAlign: align }, style]}
    />
  );
}
