import { Pressable, StyleSheet, View } from "react-native";
import { Check, Minus } from "lucide-react-native";
import { radius, space } from "./tokens";
import { useTheme } from "./theme";
import { Text } from "./Text";
import { useFocusRing } from "./interactive";

interface Base {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  description?: string;
  indeterminate?: boolean;
}

function Row({ role, shape, label, checked, onChange, disabled, description, indeterminate }: Base & { role: "checkbox" | "radio" | "switch"; shape: "box" | "circle" | "switch" }) {
  const { colors } = useTheme();
  const { ring, onFocus, onBlur } = useFocusRing(colors);
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityState={{ checked: indeterminate ? "mixed" : checked, disabled }}
      disabled={disabled}
      onPress={() => onChange(role === "radio" ? true : !checked)}
      onFocus={onFocus}
      onBlur={onBlur}
      style={[styles.row, { opacity: disabled ? 0.5 : 1 }, ring]}
    >
      {shape === "switch" ? (
        <View style={[styles.track, { backgroundColor: checked ? colors.accent : colors.borderStrong }]}>
          <View style={[styles.thumb, { backgroundColor: "#fff", transform: [{ translateX: checked ? 16 : 0 }] }]} />
        </View>
      ) : (
        <View
          style={[
            styles.mark,
            {
              borderRadius: shape === "circle" ? radius.pill : 4,
              borderColor: checked || indeterminate ? colors.accent : colors.borderStrong,
              backgroundColor: (checked || indeterminate) && shape === "box" ? colors.primary : colors.surface,
            },
          ]}
        >
          {indeterminate && shape === "box" ? <Minus size={13} color={colors.primaryText} strokeWidth={3} /> : checked && shape === "box" ? <Check size={13} color={colors.primaryText} strokeWidth={3} /> : null}
          {checked && shape === "circle" ? <View style={[styles.dot, { backgroundColor: colors.accent }]} /> : null}
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text>{label}</Text>
        {description ? <Text variant="small" tone="secondary">{description}</Text> : null}
      </View>
    </Pressable>
  );
}

export const Checkbox = (p: Base) => <Row {...p} role="checkbox" shape="box" />;
export const Radio = (p: Base) => <Row {...p} role="radio" shape="circle" />;
export const Switch = (p: Base) => <Row {...p} role="switch" shape="switch" />;

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space[3], minHeight: 36, paddingVertical: 4, borderRadius: radius.sm },
  mark: { width: 18, height: 18, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  dot: { width: 8, height: 8, borderRadius: radius.pill },
  track: { width: 36, height: 20, borderRadius: radius.pill, padding: 2, justifyContent: "center" },
  thumb: { width: 16, height: 16, borderRadius: radius.pill },
});
