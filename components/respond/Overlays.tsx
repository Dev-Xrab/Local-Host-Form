import type { ReactNode } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Maximize2 } from "lucide-react-native";
import { Button, Icon, Surface, Text, space, useTheme } from "../../ui";

function Cover({ label, opaque, children }: { label: string; opaque?: boolean; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityRole="alert"
      accessibilityLabel={label}
      accessibilityLiveRegion="assertive"
      style={[StyleSheet.absoluteFill, styles.cover, { backgroundColor: opaque ? colors.bg : colors.overlay, zIndex: 100 }, !opaque && ({ backdropFilter: "blur(8px)" } as object)]}
    >
      <Surface style={{ maxWidth: 380, alignItems: "center", gap: space[3] }}>{children}</Surface>
    </View>
  );
}

/** Blurs and locks the screen while this device can't reach the server. Typed answers stay in state and are there when it clears. */
export function ConnectionOverlay() {
  return (
    <Cover label="Connection lost">
      <ActivityIndicator />
      <Text variant="title">Connection lost</Text>
      <Text tone="secondary" align="center">Can't reach the server. Stay on this page: your answers are kept, and this screen clears on its own as soon as you're back online.</Text>
    </Cover>
  );
}

/** Fully hides the questions for a few seconds after the respondent switched away and came back (session setting). It doesn't pause the quiz timer. */
export function RefocusLockOverlay({ secondsLeft }: { secondsLeft: number }) {
  return (
    <Cover label="Welcome back" opaque>
      <Text variant="display">{secondsLeft}</Text>
      <Text variant="title">Welcome back</Text>
      <Text tone="secondary" align="center">You switched away from this tab. Your questions will be back in a moment.</Text>
    </Cover>
  );
}

/** Shown while the session requires fullscreen but the tab isn't in it. The Fullscreen API only grants it from a real click, so this can't auto-skip. */
export function FullscreenGateOverlay({ onEnter }: { onEnter: () => void }) {
  return (
    <Cover label="Fullscreen required" opaque>
      <Icon icon={Maximize2} size={28} />
      <Text variant="title">Fullscreen required</Text>
      <Text tone="secondary" align="center">This session requires fullscreen while you're answering. Continue to re-enter it.</Text>
      <Button label="Continue in fullscreen" variant="primary" onPress={onEnter} />
    </Cover>
  );
}

const styles = StyleSheet.create({ cover: { alignItems: "center", justifyContent: "center", padding: space[4] } });
