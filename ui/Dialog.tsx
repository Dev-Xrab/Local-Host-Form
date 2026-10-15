import { useEffect, useState, type ReactNode } from "react";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { X } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { radius, shadow, space } from "./tokens";
import { useLayout, useTheme } from "./theme";
import { Text } from "./Text";
import { Button } from "./Button";
import { IconButton } from "./IconButton";

interface DialogProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  children?: ReactNode;
  /** Buttons rendered in the footer; the last one is the primary action. */
  footer?: ReactNode;
  width?: number;
}

/** Centered dialog on tablet/desktop, bottom sheet on phones. Escape closes on web. */
export function Dialog({ visible, title, onClose, children, footer, width = 440 }: DialogProps) {
  const { colors } = useTheme();
  const { isPhone } = useLayout();
  // A numeric cap: a percentage here would resolve against this auto-height wrapper, i.e. the panel itself.
  const { height: windowHeight } = useWindowDimensions();
  const maxHeight = Math.round(windowHeight * (isPhone ? 0.92 : 0.88));

  useEffect(() => {
    if (!visible || Platform.OS !== "web") return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, onClose]);

  return (
    <Modal visible={visible} transparent animationType={isPhone ? "slide" : "fade"} onRequestClose={onClose} statusBarTranslucent>
      <Pressable accessibilityLabel="Close dialog" onPress={onClose} style={[styles.backdrop, { backgroundColor: colors.overlay, justifyContent: isPhone ? "flex-end" : "center" }]}>
        <SafeAreaView edges={["bottom"]} style={isPhone ? styles.sheetWrap : styles.centerWrap}>
          <Pressable
            accessibilityRole="none"
            onPress={(e) => e.stopPropagation()}
            style={[
              styles.panel,
              shadow.md,
              { backgroundColor: colors.surface, borderColor: colors.border },
              isPhone ? styles.sheet : { width, maxWidth: "92%" },
              { maxHeight },
            ]}
          >
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
              <Text variant="title" style={{ flex: 1 }} accessibilityRole="header">{title}</Text>
              <IconButton icon={X} label="Close" onPress={onClose} />
            </View>
            <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">{children}</ScrollView>
            {footer ? <View style={[styles.footer, { borderTopColor: colors.border }]}>{footer}</View> : null}
          </Pressable>
        </SafeAreaView>
      </Pressable>
    </Modal>
  );
}

interface ConfirmProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  /** May throw: the dialog stays open and shows the message, so a failed delete isn't silent. */
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export function ConfirmDialog({ visible, title, message, confirmLabel = "Delete", destructive = true, onConfirm, onCancel }: ConfirmProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      visible={visible}
      title={title}
      onClose={onCancel}
      footer={
        <>
          <Button label="Cancel" onPress={onCancel} variant="ghost" />
          <Button label={confirmLabel} onPress={confirm} variant={destructive ? "danger" : "primary"} loading={busy} />
        </>
      }
    >
      <Text tone="secondary">{message}</Text>
      {error ? <Text variant="small" tone="danger" accessibilityRole="alert">{error}</Text> : null}
    </Dialog>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: "center" },
  centerWrap: { width: "100%", alignItems: "center" },
  sheetWrap: { width: "100%" },
  panel: { borderWidth: 1, borderRadius: radius.lg, overflow: "hidden" },
  sheet: { width: "100%", borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottomWidth: 0 },
  header: { flexDirection: "row", alignItems: "center", paddingLeft: space[4], paddingRight: space[2], paddingVertical: space[1], minHeight: 48, borderBottomWidth: 1 },
  body: { padding: space[4], gap: space[3] },
  footer: { flexDirection: "row", justifyContent: "flex-end", gap: space[2], padding: space[3], borderTopWidth: 1 },
});
