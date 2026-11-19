import { useState } from "react";
import { Pressable, View } from "react-native";
import { Moon, Sun } from "lucide-react-native";
import { Icon } from "./Icon";
import { Text } from "./Text";
import { radius, size, space } from "./tokens";
import { useFocusRing } from "./interactive";
import { useTheme } from "./theme";

export function ThemeToggle() {
  const { dark, setMode, colors } = useTheme();
  const [hovered, setHovered] = useState(false);
  const { ring, onFocus, onBlur } = useFocusRing(colors);
  const label = dark ? "Switch to light mode" : "Switch to dark mode";
  return (
    <View style={{ position: "relative" }}>
      <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityHint="Changes the appearance of the app" onPress={() => setMode(dark ? "light" : "dark")} onHoverIn={() => setHovered(true)} onHoverOut={() => setHovered(false)} onFocus={onFocus} onBlur={onBlur}
        style={(state) => [{ width: size.touch, height: size.touch, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: state.pressed ? colors.pressed : hovered ? colors.hover : colors.surface, alignItems: "center", justifyContent: "center" }, ring]}>
        <Icon icon={dark ? Sun : Moon} size={19} color={colors.text} />
      </Pressable>
      {hovered ? <View pointerEvents="none" style={{ position: "absolute", top: 50, right: 0, zIndex: 10, paddingHorizontal: space[3], paddingVertical: space[2], borderRadius: radius.md, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.borderStrong, minWidth: 150 }}><Text variant="small">{label}</Text></View> : null}
    </View>
  );
}
