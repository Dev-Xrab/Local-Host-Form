import { ActivityIndicator, StyleSheet, View, type DimensionValue } from "react-native";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react-native";
import { radius, space } from "./tokens";
import { useTheme } from "./theme";
import { Text } from "./Text";
import { Icon, type IconComponent } from "./Icon";
import { Button } from "./Button";

export function Spinner({ label, fill }: { label?: string; fill?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.center, fill && { flex: 1, justifyContent: "center" }]} accessibilityRole="progressbar" accessibilityLabel={label ?? "Loading"}>
      <ActivityIndicator color={colors.textTertiary} />
      {label ? <Text variant="small" tone="secondary">{label}</Text> : null}
    </View>
  );
}

export function Skeleton({ height = 16, width = "100%" }: { height?: number; width?: DimensionValue }) {
  const { colors } = useTheme();
  return <View style={{ height, width, borderRadius: radius.sm, backgroundColor: colors.surfaceMuted }} />;
}

export function EmptyState({ icon, title, body, actionLabel, onAction }: { icon?: IconComponent; title: string; body?: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <View style={styles.empty}>
      {icon ? <Icon icon={icon} size={22} /> : null}
      <Text variant="title" align="center">{title}</Text>
      {body ? <Text tone="secondary" align="center" style={{ maxWidth: 360 }}>{body}</Text> : null}
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} variant="secondary" style={{ marginTop: space[2], alignSelf: "center" }} /> : null}
    </View>
  );
}

export type NoticeTone = "info" | "success" | "warning" | "danger";

export function Notice({ tone = "info", title, children, actionLabel, onAction }: { tone?: NoticeTone; title?: string; children?: string; actionLabel?: string; onAction?: () => void }) {
  const { colors } = useTheme();
  const t = {
    info: { bg: colors.accentSoft, fg: colors.accent, icon: Info },
    success: { bg: colors.successSoft, fg: colors.success, icon: CheckCircle2 },
    warning: { bg: colors.warningSoft, fg: colors.warning, icon: AlertTriangle },
    danger: { bg: colors.dangerSoft, fg: colors.danger, icon: AlertTriangle },
  }[tone];
  return (
    <View accessibilityRole={tone === "danger" ? "alert" : undefined} style={[styles.notice, { backgroundColor: t.bg }]}>
      <Icon icon={t.icon} size={16} color={t.fg} />
      <View style={{ flex: 1, gap: 2 }}>
        {title ? <Text variant="label">{title}</Text> : null}
        {children ? <Text variant="small" tone="secondary">{children}</Text> : null}
      </View>
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} compact variant="ghost" /> : null}
    </View>
  );
}

export function Badge({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "success" | "warning" | "danger" | "accent" }) {
  const { colors } = useTheme();
  // Small tinted chip, like "Long x5" / "Isolated": soft fill, colored text.
  const t = {
    neutral: [colors.surfaceMuted, colors.textSecondary],
    success: [colors.successSoft, colors.success],
    warning: [colors.warningSoft, colors.warning],
    danger: [colors.dangerSoft, colors.danger],
    accent: [colors.accentSoft, colors.accent],
  }[tone];
  return (
    <View style={{ backgroundColor: t[0], borderRadius: radius.sm, paddingHorizontal: 7, paddingVertical: 2, alignSelf: "flex-start" }}>
      <Text variant="caption" style={{ color: t[1] }}>{label}</Text>
    </View>
  );
}

export function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: 1, backgroundColor: colors.border, alignSelf: "stretch" }} />;
}

const styles = StyleSheet.create({
  center: { alignItems: "center", gap: space[2], padding: space[5] },
  empty: { alignItems: "center", gap: space[2], paddingVertical: space[7], paddingHorizontal: space[4] },
  notice: { flexDirection: "row", alignItems: "center", gap: space[3], padding: space[3], borderRadius: radius.md },
});
