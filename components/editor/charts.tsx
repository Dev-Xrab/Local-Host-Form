import { View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { GText, useGF } from "../../ui/gforms";

/** Muted, distinguishable colours that read on both the light and the dark theme. */
export const CHART_COLORS = ["#4F7CAC", "#E08E45", "#5BA37A", "#8E6BBF", "#D2605A", "#3FA7A3", "#C9A227", "#8C8C8C"];
export const sliceColor = (i: number) => CHART_COLORS[i % CHART_COLORS.length];

/** A donut: one arc per entry, drawn as stroke segments of a single circle. Empty entries take no arc. */
export function Donut({ entries, size = 170 }: { entries: { label: string; count: number }[]; size?: number }) {
  const g = useGF();
  const total = entries.reduce((s, e) => s + e.count, 0);
  const stroke = size * 0.22;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} accessibilityLabel={`Pie chart of ${total} answers`}>
      <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={g.border} strokeWidth={stroke} />
      {total > 0 ? entries.map((e, i) => {
        if (!e.count) return null;
        const len = (e.count / total) * c;
        // A single full-circle slice has no gap to draw; otherwise leave a 1px gap between slices.
        const dash = entries.filter((x) => x.count).length === 1 ? len : Math.max(0, len - 1);
        const node = <Circle key={e.label + i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={sliceColor(i)} strokeWidth={stroke} strokeDasharray={`${dash} ${c - dash}`} strokeDashoffset={-offset} transform={`rotate(-90 ${size / 2} ${size / 2})`} />;
        offset += len;
        return node;
      }) : null}
    </Svg>
  );
}

/** Vertical columns with a value above each and a label below; used for scales, scores and time. */
export function Columns({ items, height = 140, color, highlight }: { items: { label: string; value: number }[]; height?: number; color?: string; highlight?: (i: number) => boolean }) {
  const g = useGF();
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: items.length > 14 ? 3 : 8, height: height + 40 }}>
      {items.map((it, i) => (
        <View key={it.label + i} style={{ flex: 1, minWidth: 0, alignItems: "center", justifyContent: "flex-end", height: "100%", gap: 4 }}>
          <GText size={11} secondary>{it.value || ""}</GText>
          <View style={{ width: "100%", maxWidth: 56, height: Math.max(it.value ? 3 : 0, (it.value / max) * height), borderTopLeftRadius: 3, borderTopRightRadius: 3, backgroundColor: highlight?.(i) ? g.success : color ?? CHART_COLORS[0] }} />
          <GText size={11} secondary numberOfLines={1}>{it.label}</GText>
        </View>
      ))}
    </View>
  );
}

/** Horizontal bars, one per entry; the bar's length and printed percentage are the same number. */
export function HBars({ entries, total, correct }: { entries: { label: string; count: number }[]; total: number; correct?: Set<string> }) {
  const g = useGF();
  return (
    <View style={{ gap: 10 }}>
      {entries.map((e, i) => {
        const pct = total ? Math.round((e.count / total) * 1000) / 10 : 0;
        const right = correct?.has(e.label);
        return (
          <View key={e.label + i} style={{ gap: 4 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
              <GText size={13} style={{ flex: 1 }} numberOfLines={2} color={right ? g.success : undefined}>{e.label}{right ? "  ✓" : ""}</GText>
              <GText size={13} secondary style={{ fontVariant: ["tabular-nums"] }}>{e.count} ({pct}%)</GText>
            </View>
            <View style={{ height: 10, borderRadius: 5, backgroundColor: g.cardAlt, overflow: "hidden" }}>
              <View style={{ width: `${Math.min(100, pct)}%`, height: 10, backgroundColor: right ? g.success : sliceColor(0) }} />
            </View>
          </View>
        );
      })}
    </View>
  );
}
