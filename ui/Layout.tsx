import { Children, isValidElement, type ReactNode } from "react";
import { ScrollView, StyleSheet, View, type ViewStyle } from "react-native";
import { radius, size, space } from "./tokens";
import { useLayout, useTheme } from "./theme";
import { Text } from "./Text";
import { FadeIn } from "./FadeIn";

/**
 * Scrolling page. A <PageHeader> child is lifted out into a full-width band with a hairline under
 * it (like a dashboard page header); everything else sits in a centered, max-width column.
 */
export function Page({ children, maxWidth = size.contentMax }: { children: ReactNode; maxWidth?: number }) {
  const { isPhone } = useLayout();
  const { colors } = useTheme();
  const kids = Children.toArray(children);
  const headerAt = kids.findIndex((k) => isValidElement(k) && k.type === PageHeader);
  const header = headerAt >= 0 ? kids[headerAt] : null;
  const rest = headerAt >= 0 ? kids.filter((_, i) => i !== headerAt) : kids;
  const gutter = isPhone ? space[4] : space[6];
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, alignItems: "center" }} keyboardShouldPersistTaps="handled">
      {header ? (
        <View style={{ alignSelf: "stretch", alignItems: "center", borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.bg }}>
          <FadeIn distance={6} duration={420} style={{ width: "100%", maxWidth }}><View style={{ paddingHorizontal: gutter, paddingVertical: isPhone ? space[4] : space[5] }}>{header}</View></FadeIn>
        </View>
      ) : null}
      <FadeIn delay={60} style={{ width: "100%", maxWidth }}>
        <View style={{ paddingHorizontal: gutter, paddingVertical: isPhone ? space[4] : space[5], gap: space[5] }}>{rest}</View>
      </FadeIn>
    </ScrollView>
  );
}

/** Page title row. Lifted into the header band by <Page>; actions wrap below the title on phones. */
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  const { isPhone } = useLayout();
  return (
    <View style={{ flexDirection: isPhone ? "column" : "row", alignItems: isPhone ? "stretch" : "center", justifyContent: "space-between", gap: space[3] }}>
      <View style={{ flexShrink: 1, gap: 2 }}>
        <Text variant="heading" accessibilityRole="header">{title}</Text>
        {subtitle ? <Text tone="secondary">{subtitle}</Text> : null}
      </View>
      {actions ? <View style={{ flexDirection: "row", gap: space[2], flexWrap: "wrap" }}>{actions}</View> : null}
    </View>
  );
}

/** Column header strip for a Surface-wrapped list, so rows read as a table. Hidden on phones, where rows stack. */
export function TableHeader({ columns, right = space[2] }: { columns: { label: string; width?: number; flex?: number }[]; right?: number }) {
  const { colors } = useTheme();
  const { isPhone } = useLayout();
  if (isPhone) return null;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space[3], height: 32, paddingLeft: space[4], paddingRight: right, backgroundColor: colors.surfaceMuted, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      {columns.map((c, i) => (
        <View key={i} style={c.width ? { width: c.width } : { flex: c.flex ?? 1 }}>
          <Text variant="caption" tone="tertiary" style={{ textTransform: "uppercase", letterSpacing: 0.6 }}>{c.label}</Text>
        </View>
      ))}
    </View>
  );
}

/** A single bordered surface. Don't nest these. */
export function Surface({ children, style, padded = true }: { children: ReactNode; style?: ViewStyle; padded?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={[{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, overflow: "hidden" }, padded && { padding: space[4], gap: space[3] }, style]}>
      {children}
    </View>
  );
}

/**
 * Titled group. With `split`, desktop shows the title/description in a left column and the content
 * on the right (settings-page style); phones and tablets stack them.
 */
export function Section({ title, description, children, split }: { title: string; description?: string; children: ReactNode; split?: boolean }) {
  const { isDesktop } = useLayout();
  const head = (
    <View style={{ gap: 2, ...(split && isDesktop ? { width: 260 } : null) }}>
      <Text variant="title" accessibilityRole="header">{title}</Text>
      {description ? <Text variant="small" tone="secondary">{description}</Text> : null}
    </View>
  );
  if (split && isDesktop) {
    return (
      <View style={{ flexDirection: "row", gap: space[6], alignItems: "flex-start" }}>
        {head}
        <View style={{ flex: 1, gap: space[3] }}>{children}</View>
      </View>
    );
  }
  return <View style={styles.section}>{head}{children}</View>;
}

export const Row = ({ children, gap = space[3], wrap }: { children: ReactNode; gap?: number; wrap?: boolean }) => (
  <View style={{ flexDirection: "row", alignItems: "center", gap, flexWrap: wrap ? "wrap" : "nowrap" }}>{children}</View>
);

const styles = StyleSheet.create({ section: { gap: space[3] } });
