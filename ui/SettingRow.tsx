import type { ReactNode } from "react";
import { View } from "react-native";
import { space } from "./tokens";
import { useTheme, useLayout } from "./theme";
import { Text } from "./Text";

/** Label and explanation on the left, control on the right. On phones (or when `stacked`) the control drops below the text. */
export function SettingRow({ label, description, children, last, stacked }: { label: string; description?: string; children: ReactNode; last?: boolean; stacked?: boolean }) {
  const { colors } = useTheme();
  const { isPhone: narrow } = useLayout();
  // `stacked` rows always put the control under the text: for wide or variable-width controls.
  const isPhone = narrow || !!stacked;
  return (
    <View
      style={{
        flexDirection: isPhone ? "column" : "row", alignItems: isPhone ? "stretch" : "center", justifyContent: "space-between", gap: space[3],
        padding: space[4], borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.border,
      }}
    >
      <View style={isPhone ? { gap: 2 } : { flex: 1, minWidth: 200, gap: 2 }}>
        <Text variant="bodyStrong">{label}</Text>
        {description ? <Text variant="small" tone="secondary">{description}</Text> : null}
      </View>
      <View style={isPhone ? { alignItems: "flex-start" } : { alignItems: "flex-end", flexShrink: 1, minWidth: 0, maxWidth: "55%" }}>{children}</View>
    </View>
  );
}
