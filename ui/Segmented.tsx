import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { radius, space } from "./tokens";
import { useTheme } from "./theme";
import { Text } from "./Text";
import { useFocusRing } from "./interactive";

export interface Option<T extends string> { value: T; label: string; count?: number }

function Item({ label, selected, onPress, count, variant }: { label: string; selected: boolean; onPress: () => void; count?: number; variant: "segment" | "tab" }) {
  const { colors } = useTheme();
  const { ring, onFocus, onBlur } = useFocusRing(colors);
  const tab = variant === "tab";
  return (
    <Pressable
      accessibilityRole={tab ? "tab" : "button"}
      accessibilityState={{ selected }}
      onPress={onPress}
      onFocus={onFocus}
      onBlur={onBlur}
      style={(state) => [
        tab ? styles.tab : styles.segment,
        tab && { borderBottomColor: selected ? colors.accent : "transparent" },
        !tab && { borderWidth: 1, borderColor: selected ? colors.borderStrong : "transparent", backgroundColor: selected ? colors.surfaceMuted : "transparent" },
        !selected && (state as { hovered?: boolean }).hovered && { backgroundColor: colors.hover },
        ring,
      ]}
    >
      <Text variant="label" tone={selected ? "default" : "secondary"}>{label}</Text>
      {count != null ? <Text variant="caption" tone="tertiary" style={{ backgroundColor: colors.surfaceMuted, borderRadius: 4, paddingHorizontal: 5 }}>{count}</Text> : null}
    </Pressable>
  );
}

export function SegmentedControl<T extends string>({ options, value, onChange }: { options: Option<T>[]; value: T; onChange: (v: T) => void }) {
  return (
    <View accessibilityRole="radiogroup" style={styles.track}>
      {options.map((o) => <Item key={o.value} variant="segment" label={o.label} count={o.count} selected={o.value === value} onPress={() => onChange(o.value)} />)}
    </View>
  );
}

export function Tabs<T extends string>({ options, value, onChange }: { options: Option<T>[]; value: T; onChange: (v: T) => void }) {
  const { colors } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.tabs, { borderBottomColor: colors.border }]} contentContainerStyle={{ gap: space[4] }} accessibilityRole="tablist">
      {options.map((o) => <Item key={o.value} variant="tab" label={o.label} count={o.count} selected={o.value === value} onPress={() => onChange(o.value)} />)}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: "row", alignSelf: "flex-start", gap: space[1], flexWrap: "wrap" },
  segment: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: space[3], minHeight: 30, borderRadius: radius.md },
  tabs: { flexGrow: 0, borderBottomWidth: 1 },
  tab: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 40, borderBottomWidth: 2, marginBottom: -1 },
});
