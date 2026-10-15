import { useEffect, useRef, type ReactNode } from "react";
import { AccessibilityInfo, Animated, Easing, Platform, type ViewStyle } from "react-native";

/**
 * Soft entrance: content drifts up a few pixels while fading in, slowly decelerating like a feather
 * settling. Skipped when the system asks for reduced motion.
 */
export function FadeIn({ children, delay = 0, distance = 10, duration = 520, style }: { children: ReactNode; delay?: number; distance?: number; duration?: number; style?: ViewStyle }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      if (cancelled) return;
      Animated.timing(progress, { toValue: 1, duration, delay, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== "web" }).start();
    };
    const reduce = Platform.OS === "web" && typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) progress.setValue(1);
    else AccessibilityInfo.isReduceMotionEnabled().then((r) => (r ? progress.setValue(1) : run())).catch(run);
    return () => { cancelled = true; };
  }, [progress, delay, duration]);

  return (
    <Animated.View style={[style, { opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}
