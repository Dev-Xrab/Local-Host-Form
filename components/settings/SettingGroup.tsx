import { useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import { ChevronDown } from "lucide-react-native";
import { Icon, Text, space, useTheme } from "../../ui";

/** A titled row that opens to reveal more settings, like the grouped rows in Google Forms. */
export function SettingGroup({ title, description, children, last, defaultOpen = false }: { title: string; description: string; children: ReactNode; last?: boolean; defaultOpen?: boolean }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View style={{ borderBottomWidth: last && !open ? 0 : 1, borderBottomColor: colors.border }}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen((v) => !v)} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space[3], padding: space[4] }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="bodyStrong">{title}</Text>
          <Text variant="small" tone="secondary">{description}</Text>
        </View>
        <View style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}><Icon icon={ChevronDown} size={20} /></View>
      </Pressable>
      {open ? <View style={{ backgroundColor: colors.surfaceMuted, borderTopWidth: 1, borderTopColor: colors.border }}>{children}</View> : null}
    </View>
  );
}
