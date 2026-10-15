import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Check, ChevronDown } from "lucide-react-native";
import { radius, size, space } from "./tokens";
import { useTheme } from "./theme";
import { Text } from "./Text";
import { Icon } from "./Icon";
import { Dialog } from "./Dialog";
import { useFocusRing } from "./interactive";

export interface SelectOption<T extends string> { value: T; label: string }

/** A picker that opens a dialog (a bottom sheet on phones), so it behaves the same on every platform. */
export function Select<T extends string>({ label, value, options, onChange, placeholder = "Select…" }: { label?: string; value: T | null; options: SelectOption<T>[]; onChange: (v: T) => void; placeholder?: string }) {
  const { colors } = useTheme();
  const { ring, onFocus, onBlur } = useFocusRing(colors);
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);

  return (
    <View style={styles.wrap}>
      {label ? <Text variant="label">{label}</Text> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label ? `${label}: ${current?.label ?? placeholder}` : undefined}
        onPress={() => setOpen(true)}
        onFocus={onFocus}
        onBlur={onBlur}
        style={[styles.field, { backgroundColor: colors.surface, borderColor: colors.borderStrong }, ring]}
      >
        <Text style={{ flex: 1 }} tone={current ? "default" : "tertiary"} numberOfLines={1}>{current?.label ?? placeholder}</Text>
        <Icon icon={ChevronDown} size={16} />
      </Pressable>
      <Dialog visible={open} title={label ?? "Select"} onClose={() => setOpen(false)} width={360}>
        <View style={{ marginHorizontal: -space[2] }}>
          {options.map((o) => (
            <Pressable
              key={o.value}
              accessibilityRole="menuitem"
              onPress={() => { onChange(o.value); setOpen(false); }}
              style={(s) => [styles.item, (s as { hovered?: boolean }).hovered && { backgroundColor: colors.hover }]}
            >
              <Text style={{ flex: 1 }}>{o.label}</Text>
              {o.value === value ? <Icon icon={Check} size={16} color={colors.text} /> : null}
            </Pressable>
          ))}
        </View>
      </Dialog>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space[1] + 2, alignSelf: "stretch" },
  field: { minHeight: size.control, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space[3], flexDirection: "row", alignItems: "center", gap: space[2] },
  item: { minHeight: size.touch, flexDirection: "row", alignItems: "center", paddingHorizontal: space[3], borderRadius: radius.sm },
});
