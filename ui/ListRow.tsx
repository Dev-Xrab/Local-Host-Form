import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { space } from "./tokens";
import { useTheme } from "./theme";
import { Icon, type IconComponent } from "./Icon";
import { Text } from "./Text";
import { useFocusRing } from "./interactive";

/** One dense row: optional icon, title + subtitle, right-aligned meta, chevron when pressable. */
export function ListRow({ icon, title, subtitle, meta, trailing, actions, onPress, last }: {
  icon?: IconComponent; title: string; subtitle?: string; meta?: string; trailing?: ReactNode; actions?: ReactNode; onPress?: () => void; last?: boolean;
}) {
  const { colors } = useTheme();
  const { ring, onFocus, onBlur } = useFocusRing(colors);
  const content = (
    <>
      {icon ? <Icon icon={icon} /> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="bodyStrong" numberOfLines={1}>{title}</Text>
        {subtitle ? <Text variant="small" tone="secondary" numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {meta ? <Text variant="small" tone="secondary" numberOfLines={1}>{meta}</Text> : null}
      {trailing}
      {onPress ? <Icon icon={ChevronRight} size={16} color={colors.textTertiary} /> : null}
    </>
  );
  const base = { flexDirection: "row" as const, alignItems: "center" as const, gap: space[3], minHeight: 48, paddingHorizontal: space[4], paddingVertical: space[2], borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.border };
  if (!onPress) return <View style={base}>{content}{actions}</View>;
  // Actions sit beside (not inside) the pressable so nested buttons stay valid, but share one bordered row.
  const row = { flexDirection: "row" as const, alignItems: "center" as const, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.border };
  return (
    <View style={row}>
      <Pressable accessibilityRole="link" onPress={onPress} onFocus={onFocus} onBlur={onBlur} style={(s) => [base, { flex: 1, minWidth: 0, borderBottomWidth: 0 }, (s as { hovered?: boolean }).hovered && { backgroundColor: colors.hover }, ring]}>
        {content}
      </Pressable>
      {actions ? <View style={{ flexDirection: "row", alignItems: "center", paddingRight: space[2] }}>{actions}</View> : null}
    </View>
  );
}
