import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, Platform, StyleSheet, View } from "react-native";
import { Text, useTheme } from "../ui";

const MIN_VISIBLE_MS = 1900;
const FADE_OUT_MS = 520;
const RINGS = [0, 1, 2];

/**
 * Launch splash: soft green rings ripple out from the logo while it blooms in, the wordmark rises
 * under it and a thin bar fills. Stays for at least MIN_VISIBLE_MS and until `ready` (the first
 * session check), then fades away and unmounts. Skipped entirely under reduced motion.
 */
export function Splash({ ready }: { ready: boolean }) {
  const { colors } = useTheme();
  const native = Platform.OS !== "web";
  const [gone, setGone] = useState(() => Platform.OS === "web" && typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [minElapsed, setMinElapsed] = useState(false);

  const logo = useRef(new Animated.Value(0)).current;
  const word = useRef(new Animated.Value(0)).current;
  const bar = useRef(new Animated.Value(0)).current;
  const exit = useRef(new Animated.Value(0)).current;
  const rings = useRef(RINGS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (gone) return;
    const t = setTimeout(() => setMinElapsed(true), MIN_VISIBLE_MS);
    Animated.parallel([
      Animated.timing(logo, { toValue: 1, duration: 900, easing: Easing.out(Easing.back(1.4)), useNativeDriver: native }),
      Animated.timing(word, { toValue: 1, duration: 800, delay: 450, easing: Easing.out(Easing.cubic), useNativeDriver: native }),
      Animated.timing(bar, { toValue: 1, duration: MIN_VISIBLE_MS - 200, delay: 200, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }),
    ]).start();
    rings.forEach((v, i) =>
      Animated.loop(Animated.timing(v, { toValue: 1, duration: 2400, delay: i * 800, easing: Easing.out(Easing.quad), useNativeDriver: native })).start()
    );
    return () => clearTimeout(t);
  }, [gone, logo, word, bar, rings, native]);

  useEffect(() => {
    if (gone || !ready || !minElapsed) return;
    Animated.timing(exit, { toValue: 1, duration: FADE_OUT_MS, easing: Easing.inOut(Easing.cubic), useNativeDriver: native }).start(() => setGone(true));
  }, [ready, minElapsed, gone, exit, native]);

  if (gone) return null;

  return (
    <Animated.View
      pointerEvents={ready && minElapsed ? "none" : "auto"}
      accessibilityLabel="Loading Self Host Form"
      style={[
        StyleSheet.absoluteFill,
        styles.root,
        { backgroundColor: colors.bg, opacity: exit.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }), transform: [{ scale: exit.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) }] },
      ]}
    >
      <View style={styles.stage}>
        {rings.map((v, i) => (
          <Animated.View
            key={i}
            style={[
              styles.ring,
              {
                borderColor: colors.accent,
                opacity: v.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.35, 0] }),
                transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.5, 2.6] }) }],
              },
            ]}
          />
        ))}
        <Animated.View style={[styles.glow, { backgroundColor: colors.accent, opacity: logo.interpolate({ inputRange: [0, 1], outputRange: [0, 0.12] }) }]} />
        <Animated.View style={{ opacity: logo, transform: [{ scale: logo.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) }, { rotate: logo.interpolate({ inputRange: [0, 1], outputRange: ["-12deg", "0deg"] }) }] }}>
          <Image source={require("../assets/logo.png")} accessibilityLabel="" style={{ width: 72, height: 72, tintColor: colors.text }} />
        </Animated.View>
      </View>

      <Animated.View style={{ alignItems: "center", gap: 6, opacity: word, transform: [{ translateY: word.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }}>
        <Text variant="display" style={{ letterSpacing: 0.4 }}>Self Host Form</Text>
        <Text tone="tertiary" style={{ letterSpacing: 1.2, textTransform: "uppercase", fontSize: 11 }}>Build · Host · Own your data</Text>
      </Animated.View>

      <View style={[styles.track, { backgroundColor: colors.border }]}>
        <Animated.View style={[styles.fill, { backgroundColor: colors.accent, width: bar.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) }]} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: "center", justifyContent: "center", gap: 36, zIndex: 100 },
  stage: { width: 160, height: 160, alignItems: "center", justifyContent: "center" },
  ring: { position: "absolute", width: 120, height: 120, borderRadius: 60, borderWidth: 1.5 },
  glow: { position: "absolute", width: 150, height: 150, borderRadius: 75 },
  track: { width: 140, height: 2, borderRadius: 1, overflow: "hidden" },
  fill: { height: 2, borderRadius: 1 },
});
