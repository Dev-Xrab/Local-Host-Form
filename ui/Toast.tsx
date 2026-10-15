import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { radius, shadow, space } from "./tokens";
import { useTheme } from "./theme";
import { Text } from "./Text";

type ToastTone = "neutral" | "success" | "danger";
interface ToastItem { id: number; message: string; tone: ToastTone }

const ToastContext = createContext<(message: string, tone?: ToastTone) => void>(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const show = useCallback((message: string, tone: ToastTone = "neutral") => {
    const id = nextId.current++;
    setItems((cur) => [...cur.slice(-2), { id, message, tone }]);
    setTimeout(() => setItems((cur) => cur.filter((t) => t.id !== id)), 4000);
  }, []);

  const value = useMemo(() => show, [show]);
  const bar = (tone: ToastTone) => (tone === "success" ? colors.success : tone === "danger" ? colors.danger : colors.textTertiary);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <SafeAreaView pointerEvents="none" style={styles.host} edges={["top"]}>
        {items.map((t) => (
          <View
            key={t.id}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            style={[styles.toast, shadow.md, { backgroundColor: colors.surface, borderColor: colors.border, borderLeftColor: bar(t.tone) }]}
          >
            <Text variant="small">{t.message}</Text>
          </View>
        ))}
      </SafeAreaView>
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  host: { position: "absolute", top: 52, right: 0, alignItems: "flex-end", gap: space[2], padding: space[3], zIndex: 3000 },
  toast: { borderWidth: 1, borderLeftWidth: 3, borderRadius: radius.md, paddingVertical: space[2] + 2, paddingHorizontal: space[4], maxWidth: 420 },
});
