import { StyleSheet, TextInput, View } from "react-native";
import { Search, X } from "lucide-react-native";
import { fontFamily, radius, size, space } from "./tokens";
import { useTheme } from "./theme";
import { Icon } from "./Icon";
import { IconButton } from "./IconButton";

export function SearchField({ value, onChangeText, placeholder = "Search" }: { value: string; onChangeText: (v: string) => void; placeholder?: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.wrap, { backgroundColor: colors.surface, borderColor: colors.borderStrong }]}>
      <Icon icon={Search} size={16} color={colors.textTertiary} />
      <TextInput
        accessibilityLabel={placeholder}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        returnKeyType="search"
        style={[styles.input, { color: colors.text, fontFamily }, { outlineStyle: "none" } as object]}
      />
      {value ? <IconButton icon={X} label="Clear search" onPress={() => onChangeText("")} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", gap: space[2], minHeight: size.control, borderWidth: 1, borderRadius: radius.md, paddingLeft: space[3], paddingRight: 2 },
  input: { flex: 1, fontSize: 14, lineHeight: 20, paddingVertical: 6 },
});
