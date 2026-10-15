import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { ClipboardList, Plus } from "lucide-react-native";
import { STATUS_LABEL } from "../../../../src/features/sessions/utils/time";
import { Badge, Button, EmptyState, Icon, ListRow, Notice, Page, PageHeader, SearchField, SegmentedControl, Skeleton, Surface, TableHeader, Text, space, useLayout, useTheme } from "../../../../ui";
import { useForms, useSessions } from "../../../../lib/data";
import type { SessionSummary } from "../../../../lib/domain";
import { CreateSessionDialog } from "../../../../components/sessions/CreateSessionDialog";
import { useFocusRing } from "../../../../ui/interactive";

type Filter = "all" | "draft" | "active" | "ended";
const TONE = { draft: "neutral", active: "success", ended: "warning" } as const;

function DesktopRow({ s, last, onOpen }: { s: SessionSummary; last: boolean; onOpen: () => void }) {
  const { colors } = useTheme();
  const { ring, onFocus, onBlur } = useFocusRing(colors);
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={`Open ${s.name || "Untitled session"}`} onPress={onOpen} onFocus={onFocus} onBlur={onBlur}
      style={(st) => [{ flexDirection: "row", alignItems: "center", gap: space[3], minHeight: 56, paddingHorizontal: space[4], borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.border }, (st as { hovered?: boolean }).hovered && { backgroundColor: colors.hover }, ring]}>
      <Icon icon={ClipboardList} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="bodyStrong" numberOfLines={1}>{s.name || "Untitled session"}</Text>
        <Text variant="small" tone="secondary" numberOfLines={1}>{s.formTitle} · {s.code}</Text>
      </View>
      <View style={{ width: 90 }}><Badge label={STATUS_LABEL[s.status]} tone={TONE[s.status]} /></View>
      <View style={{ width: 190 }}><Text variant="small" tone="secondary">{s.submittedCount + s.inProgressCount} joined{s.status !== "draft" ? ` · ${s.submittedCount} submitted` : ""}</Text></View>
      <View style={{ width: 90 }}><Text variant="small" tone="secondary">{s.durationMinutes ? `${s.durationMinutes} min` : "No limit"}</Text></View>
    </Pressable>
  );
}

export default function SessionsPage() {
  const router = useRouter();
  const { isPhone } = useLayout();
  const { sessions, loading, error, refresh } = useSessions();
  const { forms } = useForms();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [creating, setCreating] = useState(false);

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
      <PageHeader title="Sessions" subtitle="Create and run form sessions, and monitor them while they're live." actions={<Button label="Create session" icon={Plus} variant="primary" onPress={() => setCreating(true)} />} />

      <View style={{ flexDirection: isPhone ? "column" : "row", gap: space[3], alignItems: isPhone ? "stretch" : "center", justifyContent: "space-between" }}>
        <SegmentedControl<Filter> value={filter} onChange={setFilter} options={(["all", "draft", "active", "ended"] as Filter[]).map((f) => ({ value: f, label: f === "all" ? "All" : STATUS_LABEL[f], count: count(f) }))} />
        <View style={{ flex: isPhone ? undefined : 1, maxWidth: isPhone ? undefined : 320 }}><SearchField value={query} onChangeText={setQuery} placeholder="Search sessions" /></View>
      </View>

      {loading && sessions.length === 0 ? (
        <Surface><Skeleton height={16} width="50%" /><Skeleton height={16} /></Surface>
      ) : error ? (
        <Notice tone="danger" actionLabel="Retry" onAction={refresh}>{`Couldn't load sessions: ${error}`}</Notice>
      ) : shown.length === 0 ? (
        <Surface><EmptyState icon={ClipboardList} title={searched.length === 0 ? "No sessions yet" : "No sessions match"} body={searched.length === 0 ? "Create one from a form to start collecting responses." : "Try a different search or filter."} actionLabel={searched.length === 0 ? "Create session" : undefined} onAction={searched.length === 0 ? () => setCreating(true) : undefined} /></Surface>
      ) : (
        <Surface padded={false}>
          <TableHeader right={space[4]} columns={[{ label: "", width: 18 }, { label: "Session" }, { label: "Status", width: 90 }, { label: "Participants", width: 190 }, { label: "Time limit", width: 90 }]} />
          {shown.map((s, i) =>
            isPhone ? (
              <ListRow key={s.id} last={i === shown.length - 1} icon={ClipboardList} title={s.name || "Untitled session"} subtitle={`${s.formTitle} · ${s.code} · ${STATUS_LABEL[s.status]}`} meta={`${s.submittedCount + s.inProgressCount}`} onPress={() => open(s.id)} />
            ) : (
              <DesktopRow key={s.id} s={s} last={i === shown.length - 1} onOpen={() => open(s.id)} />
            )
          )}
        </Surface>
      )}

      <CreateSessionDialog visible={creating} forms={forms} onClose={() => setCreating(false)} onCreated={async () => { setCreating(false); await refresh(); }} />
    </Page>
  );
}
