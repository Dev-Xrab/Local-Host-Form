import type { LucideIcon } from "lucide-react-native";
import { useTheme } from "./theme";

export type IconComponent = LucideIcon;

export function Icon({ icon: Glyph, size = 18, color, strokeWidth = 1.75 }: { icon: IconComponent; size?: number; color?: string; strokeWidth?: number }) {
  const { colors } = useTheme();
  return <Glyph size={size} color={color ?? colors.textSecondary} strokeWidth={strokeWidth} />;
}
