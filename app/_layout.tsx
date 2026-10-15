import "../lib/runtimePolyfills";
import { useEffect } from "react";
import { Slot } from "expo-router";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import useAuthStore, { useAuthActions } from "../store/useAuthStore";
import { Splash } from "../components/Splash";
import { TitleBar } from "../components/TitleBar";
import { ThemeProvider, ToastProvider, useTheme } from "../ui";

function Frame() {
  const { colors } = useTheme();
  const { checkSession } = useAuthActions();
  const isChecking = useAuthStore((s) => s.isChecking);

  // Resolves needsSetup / authenticated once; RequireAuth-style gating and the login screen wait on it.
  useEffect(() => {
    checkSession();
  }, [checkSession]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <TitleBar />
      <View style={{ flex: 1 }}>
        <Slot />
      </View>
      <Splash ready={!isChecking} />
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ToastProvider>
          <Frame />
        </ToastProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
