import type { ReactNode } from "react";
import { Image, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AlertTriangle, Clock3 } from "lucide-react-native";
import { formatClock } from "../../src/features/sessions/utils/time";
import { ThemeToggle, useLayout } from "../../ui";
import { GButton, GText, useGF } from "../../ui/gforms";

/** The same focused frame is used for manual join, direct links and the submission receipt. */
export function RespondentFrame({ children, onLeave }: { children: ReactNode; onLeave?: () => void }) {
  const g = useGF();
  const { isPhone } = useLayout();
  return <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: g.canvas }}>
    <View style={{ minHeight: 56, backgroundColor: g.topbar, borderBottomWidth: 1, borderBottomColor: g.border, paddingHorizontal: isPhone ? 16 : 24, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Image source={require("../../assets/logo.png")} accessibilityLabel="" style={{ width: 22, height: 22, tintColor: g.accent }} /><GText size={15} weight="500">Self-Host Form</GText></View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><ThemeToggle />{onLeave ? <GButton label="Leave" onPress={onLeave} /> : null}</View>
    </View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, alignItems: "center", paddingHorizontal: isPhone ? 12 : 16, paddingVertical: isPhone ? 12 : 24 }}><View style={{ width: "100%", maxWidth: 640 }}>{children}</View></ScrollView>
  </SafeAreaView>;
}

export function RespondentTopBar({ title, step, total, secondsLeft, saveLabel, onLeave, leaveLabel = "Leave", extra, showProgress = true }: { title: string; step: number; total: number; showProgress?: boolean; secondsLeft?: number | null; saveLabel?: string; onLeave?: () => void; leaveLabel?: string; extra?: ReactNode }) {
  const g = useGF();
  const { isPhone } = useLayout();
  const low = secondsLeft != null && secondsLeft <= 300;
  const pct = total > 0 ? Math.min(100, (step / total) * 100) : 0;
  return <View style={{ backgroundColor: g.topbar, borderBottomWidth: 1, borderBottomColor: g.border }}>
    <View style={{ minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingHorizontal: isPhone ? 16 : 24, maxWidth: 1120, width: "100%", alignSelf: "center" }}>
      <View style={{ flex: 1, minWidth: 0 }}><GText size={15} weight="500" numberOfLines={1}>{title || "Untitled form"}</GText><GText size={12} secondary>{showProgress ? (total > 1 ? `Page ${step} of ${total}` : "Single page") : ""}{saveLabel ? `${showProgress ? " · " : ""}${saveLabel}` : ""}</GText></View>
      {secondsLeft != null ? <View accessibilityRole="timer" accessibilityLabel={`${formatClock(secondsLeft)} remaining${low ? ". Less than five minutes left" : ""}`} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, minHeight: 36, borderRadius: 18, backgroundColor: low ? g.errorSoft : g.accentSoft }}>{low ? <AlertTriangle size={16} color={g.error} /> : <Clock3 size={16} color={g.accent} />}<GText size={14} weight="500" color={low ? g.error : g.accent} style={{ fontVariant: ["tabular-nums"] }}>{formatClock(secondsLeft)}</GText></View> : null}
      {extra}
      {onLeave ? <GButton label={leaveLabel} onPress={onLeave} /> : null}
    </View>
    {showProgress ? <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: total, now: step }} style={{ height: 3, backgroundColor: g.border }}><View style={{ width: `${pct}%`, height: 3, backgroundColor: g.accent }} /></View> : null}
  </View>;
}
