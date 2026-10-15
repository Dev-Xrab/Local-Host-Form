import { useEffect, useRef } from "react";
import { Animated, Easing, Platform } from "react-native";
import { Moon, Sun } from "lucide-react-native";
import { IconButton } from "./IconButton";
import { useTheme } from "./theme";

/**
 * One-tap dark/light switch. The icon turns and fades as the theme changes (the colours themselves
 * cross-fade via the `theme-anim` class set in theme.tsx). "System" stays available in Settings.
 */
export function ThemeToggle() {
  const { dark, setMode } = useTheme();
  const spin = useRef(new Animated.Value(0)).current;
  const first = useRef(true);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    spin.setValue(0);
    Animated.timing(spin, { toValue: 1, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== "web" }).start();
  }, [dark, spin]);

  const style = {
    transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ["-90deg", "0deg"] }) }],
    opacity: spin.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }),
  };
  return (
    <Animated.View style={style}>
      <IconButton icon={dark ? Sun : Moon} label={dark ? "Switch to light mode" : "Switch to dark mode"} onPress={() => setMode(dark ? "light" : "dark")} />
    </Animated.View>
  );
}
