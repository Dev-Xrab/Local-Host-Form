import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ClipboardList, Plus } from "lucide-react-native";
import { STATUS_LABEL } from "../../../../src/features/sessions/utils/time";
import { Badge, Button, EmptyState, Icon, ListRow, Notice, Page, PageHeader, SearchField, SegmentedControl, Skeleton, Surface, TableHeader, Text, space, useLayout, useTheme } from "../../../../ui";
import { useForms, useSessions } from "../../../../lib/data";
import type { SessionSummary } from "../../../../lib/domain";
import { CreateSessionDialog } from "../../../../components/sessions/CreateSessionDialog";
import { useFocusRing } from "../../../../ui/interactive";
import { sessionCodeLabel } from "../../../../lib/text";

type Filter = "all" | "draft" | "active" | "ended";
const TONE = { draft: "neutral", active: "success", ended: "warning" } as const;

function DesktopRow({ s, last, onOpen }: { s: SessionSummary; last: boolean; onOpen: () => void }) {
  const { colors } = useTheme();
  const { ring, onFocus, onBlur } = useFocusRing(colors);
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={`Open ${s.name || "Untitled session"}`} onPress={onOpen} onFocus={onFocus} onBlur={onBlur}
      style={(st) => [{ flexDirection: "row", alignItems: "center", gap: space[3], minHeight: 72, paddingHorizontal: space[3], borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.border }, (st as { hovered?: boolean }).hovered && { backgroundColor: colors.hover }, ring]}>
      <Icon icon={ClipboardList} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="bodyStrong" numberOfLines={1}>{s.name || "Untitled session"}</Text>
        <Text variant="small" tone="secondary" numberOfLines={1}>{s.formTitle} · {sessionCodeLabel(s)}</Text>
      </View>
      <View style={{ width: 90 }}><Badge label={STATUS_LABEL[s.status]} tone={TONE[s.status]} /></View>
      <View style={{ width: 190 }}><Text variant="small" tone="secondary">{s.submittedCount + s.inProgressCount} joined{s.status !== "draft" ? ` · ${s.submittedCount} submitted` : ""}</Text></View>
      <View style={{ width: 90 }}><Text variant="small" tone="secondary">{s.durationMinutes ? `${s.durationMinutes} min` : "No limit"}</Text></View>
    </Pressable>
  );
}

export default function SessionsPage() {
  const router = useRouter();
  const { colors } = useTheme();
  const { create, formId } = useLocalSearchParams<{ create?: string; formId?: string }>();
  const { isPhone } = useLayout();
  const { sessions, loading, error, refresh } = useSessions();
  const { forms } = useForms();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [creating, setCreating] = useState(create === "1");

  useEffect(() => { if (create === "1") setCreating(true); }, [create]);

  useEffect(() => {
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [refresh]);

  const q = query.toLowerCase();
  const searched = sessions.filter((s) => (s.name || "").toLowerCase().includes(q) || (s.formTitle || "").toLowerCase().includes(q));
  const shown = filter === "all" ? searched : searched.filter((s) => s.status === filter);
  const count = (f: Filter) => (f === "all" ? searched.length : searched.filter((s) => s.status === f).length);
  const open = (id: string) => router.push(`/dashboard/sessions/${id}` as never);

  return (
    <Page>
      <PageHeader title="Sessions" subtitle="Prepare, share and follow live sessions from one place." actions={<Button label="New session" icon={Plus} variant="primary" onPress={() => setCreating(true)} />} />

      <View style={{ flexDirection: "row", gap: isPhone ? space[2] : space[5], paddingVertical: space[4], borderBottomWidth: 1, borderColor: colors.border }}>
        <View style={{ flex: 1, minWidth: 0 }}><Text variant="caption" tone="tertiary">{isPhone ? "Live" : "Live now"}</Text><Text variant="heading">{sessions.filter((s) => s.status === "active").length}</Text></View>
        <View style={{ flex: 1, minWidth: 0 }}><Text variant="caption" tone="tertiary">{isPhone ? "Draft" : "Ready to start"}</Text><Text variant="heading">{sessions.filter((s) => s.status === "draft").length}</Text></View>
        <View style={{ flex: 1, minWidth: 0 }}><Text variant="caption" tone="tertiary">Finished</Text><Text variant="heading">{sessions.filter((s) => s.status === "ended").length}</Text></View>
      </View>

      <View style={{ flexDirection: isPhone ? "column" : "row", gap: space[3], alignItems: isPhone ? "stretch" : "center", justifyContent: "space-between" }}>
        <SegmentedControl<Filter> value={filter} onChange={setFilter} options={(["all", "draft", "active", "ended"] as Filter[]).map((f) => ({ value: f, label: f === "all" ? "All" : STATUS_LABEL[f], count: count(f) }))} />
        <View style={{ flex: isPhone ? undefined : 1, maxWidth: isPhone ? undefined : 320 }}><SearchField value={query} onChangeText={setQuery} placeholder="Search sessions" /></View>
      </View>

      {loading && sessions.length === 0 ? (
        <Surface><Skeleton height={16} width="50%" /><Skeleton height={16} /></Surface>
      ) : error ? (
        <Notice tone="danger" actionLabel="Retry" onAction={refresh}>{`Couldn't load sessions: ${error}`}</Notice>
      ) : shown.length === 0 ? (
        <Surface><EmptyState icon={ClipboardList} title={searched.length === 0 ? "No sessions yet" : "No sessions match"} body={searched.length === 0 ? "Choose New session above when you are ready to collect responses." : "Try a different search or filter."} /></Surface>
      ) : (
        <View style={{ borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border }}>
          <TableHeader right={space[4]} columns={[{ label: "", width: 18 }, { label: "Session" }, { label: "Status", width: 90 }, { label: "Participants", width: 190 }, { label: "Time limit", width: 90 }]} />
          {shown.map((s, i) =>
            isPhone ? (
              <ListRow key={s.id} last={i === shown.length - 1} icon={ClipboardList} title={s.name || "Untitled session"} subtitle={`${s.formTitle} · ${sessionCodeLabel(s)} · ${STATUS_LABEL[s.status]}`} meta={`${s.submittedCount + s.inProgressCount}`} onPress={() => open(s.id)} />
            ) : (
              <DesktopRow key={s.id} s={s} last={i === shown.length - 1} onOpen={() => open(s.id)} />
            )
          )}
        </View>
      )}

      <CreateSessionDialog visible={creating} forms={forms} initialFormId={formId} onClose={() => { setCreating(false); if (create === "1") router.replace("/dashboard/sessions" as never); }} onCreated={async () => { setCreating(false); await refresh(); if (create === "1") router.replace("/dashboard/sessions" as never); }} />
    </Page>
  );
}
