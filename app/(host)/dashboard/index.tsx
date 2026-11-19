import { useEffect, useState, type ReactNode } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { ChevronRight, FileText, MoreVertical } from "lucide-react-native";
import { STATUS_LABEL, formatRelative } from "../../../src/features/sessions/utils/time";
import { useSync } from "../../../src/features/cloud/hooks/useSync";
import { Notice, useLayout } from "../../../ui";
import { GButton, GText, useGF } from "../../../ui/gforms";
import { useForms, useSessions, useTunnel } from "../../../lib/data";
import * as Clipboard from "expo-clipboard";
import { sessionCodeLabel } from "../../../lib/text";
import { apiFetch } from "../../../lib/http";
import { useServerOrigin } from "../../../lib/useServerOrigin";
import type { FormSummary, SessionSummary } from "../../../lib/domain";
import { type SyncState } from "../../../components/shell/SyncStatus";

type Activity = { type: string; targetId: string; label: string; occurredAt: string };
const activityNames: Record<string, string> = {
  form_created: "Form created", form_updated: "Form updated", folder_created: "Folder created", folder_updated: "Folder updated",
  session_created: "Session created", session_started: "Session started", session_ended: "Session ended", response_submitted: "Response submitted",
};

function Heading({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return <View style={{ minHeight: 40, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}><GText size={16} weight="500" accessibilityRole="header">{title}</GText>{action && onAction ? <GButton label={action} onPress={onAction} /> : null}</View>;
}

function Panel({ children }: { children: ReactNode }) {
  const g = useGF();
  return <View style={{ backgroundColor: g.card, borderWidth: 1, borderColor: g.border, borderRadius: 8, overflow: "hidden" }}>{children}</View>;
}

function Row({ title, detail, meta, badge, onPress, last }: { title: string; detail?: string; meta?: string; badge?: string; onPress: () => void; last?: boolean }) {
  const g = useGF();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${title}. ${detail ?? ""}${meta ? `. ${meta}` : ""}`} onPress={onPress}
      style={(s) => [{ minHeight: 60, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, paddingHorizontal: 16, borderBottomWidth: last ? 0 : 1, borderBottomColor: g.border, backgroundColor: (s as { hovered?: boolean }).hovered ? g.hover : "transparent" }]}>
      <View style={{ flex: 1, minWidth: 0 }}><GText size={14} weight="500" numberOfLines={1}>{title}</GText>{detail ? <GText size={12} secondary numberOfLines={1}>{detail}</GText> : null}</View>
      {badge ? <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: badge === "Active" ? g.successSoft : g.cardAlt }}><GText size={11} weight="500" color={badge === "Active" ? g.success : g.textSecondary}>{badge}</GText></View> : null}
      {meta ? <GText size={12} secondary>{meta}</GText> : null}
      <ChevronRight size={16} color={g.textSecondary} />
    </Pressable>
  );
}

/** Google Forms "recent forms" card: mini-form thumbnail on top, title and meta below. */
function FormCard({ form, onPress }: { form: FormSummary; onPress: () => void }) {
  const g = useGF();
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={`Open ${form.title || "Untitled form"}`} onPress={onPress}
      style={(s) => [{ borderRadius: 8, borderWidth: 1, backgroundColor: g.card, overflow: "hidden", borderColor: (s as { hovered?: boolean }).hovered ? g.borderStrong : g.border }]}>
      <View style={{ height: 112, backgroundColor: g.page, padding: 16, paddingBottom: 0 }}>
        <View style={{ flex: 1, backgroundColor: g.card, borderTopLeftRadius: 4, borderTopRightRadius: 4, borderWidth: 1, borderBottomWidth: 0, borderColor: g.border, overflow: "hidden" }}>
          <View style={{ height: 6, backgroundColor: g.accent }} />
          <View style={{ padding: 10, gap: 6 }}>
            <GText size={11} weight="500" numberOfLines={2}>{form.title || "Untitled form"}</GText>
            <View style={{ height: 4, width: "85%", borderRadius: 2, backgroundColor: g.border }} />
            <View style={{ height: 4, width: "60%", borderRadius: 2, backgroundColor: g.border }} />
          </View>
        </View>
      </View>
      <View style={{ padding: 12, gap: 6, borderTopWidth: 1, borderTopColor: g.border }}>
        <GText size={14} weight="500" numberOfLines={1}>{form.title || "Untitled form"}</GText>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <FileText size={14} color={g.accent} />
          <GText size={12} secondary numberOfLines={1} style={{ flex: 1 }}>{form.responseCount} {form.responseCount === 1 ? "response" : "responses"} · {formatRelative(form.updatedAt, { short: true })}</GText>
          <MoreVertical size={14} color={g.textSecondary} />
        </View>
      </View>
    </Pressable>
  );
}

function StatStrip({ items }: { items: { label: string; value: string; onPress: () => void }[] }) {
  const g = useGF();
  const { isPhone } = useLayout();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", backgroundColor: g.card, borderWidth: 1, borderColor: g.border, borderRadius: 8, overflow: "hidden" }}>
      {items.map((it, i) => (
        <Pressable key={it.label} accessibilityRole="button" accessibilityLabel={`${it.label}: ${it.value}`} onPress={it.onPress}
          style={(s) => [{ flexBasis: isPhone ? "50%" : "25%", flexGrow: 1, paddingVertical: 14, paddingHorizontal: 20, gap: 2, borderLeftWidth: !isPhone && i > 0 || (isPhone && i % 2 === 1) ? 1 : 0, borderTopWidth: isPhone && i > 1 ? 1 : 0, borderColor: g.border, backgroundColor: (s as { hovered?: boolean }).hovered ? g.hover : "transparent" }]}>
          <GText size={24} weight="500" style={{ fontVariant: ["tabular-nums"], lineHeight: 30 }}>{it.value}</GText>
          <GText size={12} secondary>{it.label}</GText>
        </Pressable>
      ))}
    </View>
  );
}

const GRID = (min: number, gap = 16) => ({ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${min}px, 1fr))`, gap } as object);

export default function DashboardHome() {
  const router = useRouter();
  const g = useGF();
  const { width, isPhone } = useLayout();
  const wide = width >= 1000;
  const { forms, error: formsError } = useForms();
  const { sessions, refresh } = useSessions();
  const sync = useSync() as unknown as SyncState;
  const origin = useServerOrigin();
  const tunnel = useTunnel();
  const [copied, setCopied] = useState(false);
  const copyOrigin = async () => { try { await Clipboard.setStringAsync(origin); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard unavailable */ } };
  const syncLabel = ({ checking: "Checking…", disconnected: "Not connected", offline: "Offline", online: "Connected", syncing: "Syncing…", synced: "Up to date", error: "Needs attention" } as Record<string, string>)[sync.phase] ?? "—";
  const [activity, setActivity] = useState<Activity[]>([]);
  const [activityError, setActivityError] = useState(false);
  const [weekStart] = useState(() => Date.now() - 7 * 24 * 60 * 60 * 1000);
  const go = (href: string) => router.push(href as never);

  useEffect(() => {
    const load = async () => {
      try { const response = await apiFetch("/api/activity"); if (!response.ok) throw new Error(); setActivity(await response.json()); setActivityError(false); }
      catch { setActivityError(true); }
    };
    void load();
    const timer = setInterval(() => { void refresh(); void load(); }, 5000);
    return () => clearInterval(timer);
  }, [refresh]);

  const live = sessions.filter((session: SessionSummary) => session.status === "active");
  const recentSessions = [...sessions].sort((a: SessionSummary, b: SessionSummary) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "")).slice(0, 5);
  const sortedForms = [...forms].sort((a: FormSummary, b: FormSummary) => b.updatedAt.localeCompare(a.updatedAt));
  const shownForms = sortedForms.slice(0, 12);
  const weeklyResponses = activity.filter((item) => item.type === "response_submitted" && new Date(item.occurredAt).getTime() >= weekStart).length;
  const pending = (sync.status?.pendingCount ?? 0) + (sync.status?.failedCount ?? 0);
  const sessionRows = [...live, ...recentSessions.filter((session: SessionSummary) => session.status !== "active")].slice(0, 5);
  const activityPath = (item: Activity) => item.type.startsWith("form_") ? `/forms/${item.targetId}` : item.type.startsWith("folder_") ? `/dashboard/subjects/${item.targetId}` : `/dashboard/sessions/${item.targetId}`;
  const pad = isPhone ? 16 : 24;

  return <View style={{ flex: 1, backgroundColor: g.page }}>
    <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
      <View style={{ width: "100%", maxWidth: 1100, alignSelf: "center", padding: pad, paddingVertical: 32, gap: 32 }}>
        {formsError ? <Notice tone="danger" actionLabel="Open forms" onAction={() => go("/dashboard/forms")}>{`Could not reach the local server: ${formsError}`}</Notice> : null}

        <View style={{ gap: 12 }}>
          <Heading title="Server status" action="Manage" onAction={() => go("/dashboard/settings")} />
          <Panel>
            <View style={{ flexDirection: wide ? "row" : "column", alignItems: wide ? "center" : "stretch", justifyContent: "space-between", gap: 12, padding: 20, borderBottomWidth: 1, borderBottomColor: g.border }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, minWidth: 0, flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: formsError ? g.errorSoft : g.successSoft }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: formsError ? g.error : g.success }} />
                  <GText size={12} weight="600" color={formsError ? g.error : g.success}>{formsError ? "Unreachable" : "Operational"}</GText>
                </View>
                <GText size={14} selectable numberOfLines={1} style={{ flex: 1, minWidth: 0 }}>{origin}</GText>
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <GButton variant="outlined" label={copied ? "Copied" : "Copy address"} onPress={copyOrigin} />
              </View>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {[
                { label: "Access", value: tunnel.status === "connected" ? "Public link active" : "Local network only" },
                { label: "Cloud sync", value: syncLabel },
                { label: "Last synced", value: sync.status?.lastSyncedAt ? formatRelative(sync.status.lastSyncedAt) : "Never" },
                { label: "Pending changes", value: sync.phase === "disconnected" ? "—" : String(pending) },
              ].map((m, i) => (
                <View key={m.label} style={{ flexBasis: wide ? "25%" : "50%", flexGrow: 1, padding: 16, paddingHorizontal: 20, gap: 2, borderLeftWidth: wide ? (i > 0 ? 1 : 0) : (i % 2 ? 1 : 0), borderTopWidth: !wide && i > 1 ? 1 : 0, borderColor: g.border }}>
                  <GText size={12} secondary>{m.label}</GText>
                  <GText size={14} weight="500">{m.value}</GText>
                </View>
              ))}
            </View>
          </Panel>
        </View>

        <StatStrip items={[
          { label: "Live sessions", value: String(live.length), onPress: () => go("/dashboard/sessions") },
          { label: "Forms", value: String(forms.length), onPress: () => go("/dashboard/forms") },
          { label: "Responses this week", value: activityError ? "—" : `${weeklyResponses}${activity.length === 100 ? "+" : ""}`, onPress: () => go("/dashboard/export") },
          { label: "Pending sync", value: sync.phase === "disconnected" ? "—" : String(pending), onPress: () => go("/dashboard/settings") },
        ]} />

        <View style={{ gap: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <GText size={16} weight="500" accessibilityRole="header">Recent forms</GText>
          </View>
          {shownForms.length ? (
            <View style={GRID(200)}>
              {shownForms.map((form) => <FormCard key={form.id} form={form} onPress={() => go(`/forms/${form.id}`)} />)}
            </View>
          ) : (
            <Panel><View style={{ padding: 32, alignItems: "center", gap: 8 }}>
              <GText size={16} weight="500">No forms yet</GText>
              <GText secondary style={{ textAlign: "center" }}>Create your first form from the Forms page.</GText>
            </View></Panel>
          )}
        </View>

        <View style={{ flexDirection: wide ? "row" : "column", alignItems: "flex-start", gap: 24 }}>
          <View style={{ flex: 3, minWidth: 0, alignSelf: "stretch", gap: 12 }}>
            <Heading title="Sessions" action="All sessions" onAction={() => go("/dashboard/sessions")} />
            <Panel>
              {sessionRows.length ? sessionRows.map((session: SessionSummary, i) => <Row key={session.id} last={i === sessionRows.length - 1} title={session.name || "Untitled session"} detail={`${session.formTitle} · ${sessionCodeLabel(session)}`} badge={STATUS_LABEL[session.status]} meta={`${session.inProgressCount + session.submittedCount} joined`} onPress={() => go(`/dashboard/sessions/${session.id}`)} />) : <View style={{ padding: 24, alignItems: "flex-start", gap: 12 }}><GText size={14} secondary>No sessions yet. Start one when your form is ready.</GText><GButton variant="outlined" label="Start session" onPress={() => go("/dashboard/sessions?create=1")} /></View>}
            </Panel>
          </View>
          <View style={{ flex: 2, minWidth: 0, alignSelf: "stretch", gap: 12 }}>
            <Heading title="Recent activity" />
            <Panel>
              {activity.length ? activity.slice(0, 5).map((item, index, arr) => <Row key={`${item.targetId}-${item.occurredAt}-${index}`} last={index === arr.length - 1} title={activityNames[item.type] || "Activity"} detail={item.label || "Untitled"} meta={new Date(item.occurredAt).toLocaleDateString()} onPress={() => go(activityPath(item))} />) : <View style={{ padding: 24 }}><GText size={14} secondary>{activityError ? "Activity is unavailable. Check the local server." : "Your recent work will appear here."}</GText></View>}
            </Panel>
          </View>
        </View>
      </View>
    </ScrollView>
  </View>;
}
