import { useCallback, useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, ClipboardList, Download, ExternalLink, Play, Square, Trash2, Trophy, Users } from "lucide-react-native";
import { sessionsApi } from "../../../../src/features/sessions/services/sessionsApi";
import { useSync } from "../../../../src/features/cloud/hooks/useSync";
import {
  DURATION_DEFAULT_SECONDS, STATUS_LABEL, durationPartsToSeconds, formatClock, formatDateTime, respondentStatusInfo, secondsRemaining, secondsToDurationParts,
} from "../../../../src/features/sessions/utils/time";
import { Badge, Button, ConfirmDialog, Dialog, EmptyState, IconButton, ListRow, Notice, Page, PageHeader, SearchField, SegmentedControl, Select, SettingRow, Spinner, Surface, Switch, TableHeader, Tabs, Text, TextField, space, useLayout, useTheme } from "../../../../ui";
import { useServerOrigin } from "../../../../lib/useServerOrigin";
import { useTunnel } from "../../../../lib/data";
import { exportSessions } from "../../../../lib/exportSessions";
import { JoinPanel } from "../../../../components/sessions/JoinPanel";
import { ExportDialog } from "../../../../components/sessions/ExportDialog";
import { RespondentDialog, type RespondentDetail } from "../../../../components/sessions/RespondentDialog";
import type { SyncState } from "../../../../components/shell/SyncStatus";
import { useFocusRing } from "../../../../ui/interactive";
import { sessionCodeLabel } from "../../../../lib/text";

interface Session {
  id: string; name: string; code: string; status: "draft" | "active" | "ended"; formId: string; formTitle: string; durationMinutes: number | null;
  responsesEditable: boolean; fullscreenEnabled: boolean; refocusLockSeconds: number | null; startedAt?: string | null; endedAt?: string | null; formIsCloudLinked?: boolean;
}
interface Respondent {
  id: string; respondentName?: string; status: string; deadlineAt?: string | null; submittedAt?: string | null; score?: number | null; maxScore?: number | null;
}
type Filter = "all" | "submitted" | "in_progress";
type Confirm = "end" | "reopen" | "delete" | null;

const CONFIRMS = {
  end: { title: "End session", message: "Stop accepting new joins for this session? Respondents already answering keep their own time limit.", confirmLabel: "End session", destructive: false },
  reopen: { title: "Reopen session", message: "Reopen this session? It will accept new joins again, and scores and answers will be hidden until you end it again.", confirmLabel: "Reopen session", destructive: false },
  delete: { title: "Delete session", message: "Delete this session? This can't be undone.", confirmLabel: "Delete", destructive: true },
} as const;

const STATUS_TONE = { draft: "neutral", active: "success", ended: "warning" } as const;
const PILL_TONE: Record<string, "success" | "warning" | "neutral"> = { submitted: "success", unfinished: "warning", "in-progress": "neutral" };

function TimeLeft({ deadlineAt }: { deadlineAt?: string | null }) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!deadlineAt) return;
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [deadlineAt]);
  if (!deadlineAt) return <Text variant="small" tone="secondary">No limit</Text>;
  return <Text variant="small" tone="secondary" style={{ fontVariant: ["tabular-nums"] }}>{formatClock(secondsRemaining(deadlineAt))}</Text>;
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={{ gap: 2 }}>
      <Text variant="caption" tone="tertiary">{label}</Text>
      <Text variant="heading" style={{ fontVariant: ["tabular-nums"] }}>{value}</Text>
      {sub ? <Text variant="caption" tone="secondary" style={{ fontWeight: "400" }}>{sub}</Text> : null}
    </View>
  );
}

function RespondentHeader() {
  const { colors } = useTheme();
  const { isPhone } = useLayout();
  if (isPhone) return null;
  const h = (label: string, width?: number) => <View style={width ? { width } : { flex: 1 }}><Text variant="caption" tone="tertiary">{label}</Text></View>;
  return (
    <View style={{ flexDirection: "row", gap: space[3], paddingHorizontal: space[4], paddingVertical: space[2], borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surfaceMuted }}>
      {h("Respondent")}{h("Status", 120)}{h("Time left", 80)}{h("Submitted", 170)}{h("Score", 130)}
    </View>
  );
}

function RespondentRow({ r, session, viewable, last, onOpen }: { r: Respondent; session: Session; viewable: boolean; last: boolean; onOpen: () => void }) {
  const { colors } = useTheme();
  const { isPhone } = useLayout();
  const { ring, onFocus, onBlur } = useFocusRing(colors);
  const info = respondentStatusInfo(r, session);
  const pct = viewable && r.maxScore ? Math.round(((r.score ?? 0) / r.maxScore) * 1000) / 10 : null;
  const score = viewable && r.score != null ? `${r.score}/${r.maxScore}` : "—";

  if (isPhone) {
    return <ListRow last={last} title={r.respondentName || "Anonymous"} subtitle={`${info.text}${r.status === "in_progress" ? "" : r.submittedAt ? ` · ${formatDateTime(r.submittedAt)}` : ""}`} meta={score} onPress={viewable ? onOpen : undefined} />;
  }
  return (
    <Pressable
      accessibilityRole={viewable ? "link" : undefined}
      disabled={!viewable}
      onPress={onOpen}
      onFocus={onFocus}
      onBlur={onBlur}
      style={(s) => [{ flexDirection: "row", alignItems: "center", gap: space[3], minHeight: 52, paddingHorizontal: space[4], borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.border }, viewable && (s as { hovered?: boolean }).hovered && { backgroundColor: colors.hover }, ring]}
    >
      <Text variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>{r.respondentName || "Anonymous"}</Text>
      <View style={{ width: 120 }}><Badge label={info.text} tone={PILL_TONE[info.modifier] ?? "neutral"} /></View>
      <View style={{ width: 80 }}>{r.status === "in_progress" ? <TimeLeft deadlineAt={r.deadlineAt} /> : <Text variant="small" tone="tertiary">—</Text>}</View>
      <View style={{ width: 170 }}><Text variant="small" tone="secondary">{formatDateTime(r.submittedAt)}</Text></View>
      <View style={{ width: 130, gap: 3 }}>
        <Text variant="small" style={{ fontWeight: "600" }}>{score}{pct != null ? `  ${pct}%` : ""}</Text>
        {pct != null ? <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.surfaceSunken }}><View style={{ width: `${Math.min(100, pct)}%`, height: 4, borderRadius: 2, backgroundColor: colors.success }} /></View> : null}
      </View>
    </Pressable>
  );
}

/** Competition ranking: equal scores share a rank (1, 2, 2, 4), ties ordered by who submitted first. */
function rankRespondents(rows: Respondent[]) {
  const sorted = [...rows].sort((a, b) => (b.score ?? 0) / (b.maxScore || 1) - (a.score ?? 0) / (a.maxScore || 1) || (b.score ?? 0) - (a.score ?? 0) || String(a.submittedAt ?? "").localeCompare(String(b.submittedAt ?? "")));
  let prev: Respondent | null = null;
  let rank = 0;
  return sorted.map((r, i) => {
    const same = prev && (prev.score ?? 0) === (r.score ?? 0) && (prev.maxScore ?? 0) === (r.maxScore ?? 0);
    if (!same) rank = i + 1;
    prev = r;
    return { r, rank };
  });
}

function Leaderboard({ respondents, onOpen }: { respondents: Respondent[]; onOpen: (id: string) => void }) {
  const { colors } = useTheme();
  const { isPhone } = useLayout();
  const ranked = rankRespondents(respondents.filter((r) => r.status === "submitted" && r.maxScore));
  const medal = (rank: number) => (rank === 1 ? colors.warning : rank === 2 ? colors.textSecondary : rank === 3 ? colors.accent : colors.textTertiary);

  if (ranked.length === 0) {
    return <Surface><EmptyState icon={Trophy} title="No scores yet" body="The leaderboard fills in as respondents submit a form that has scored questions." /></Surface>;
  }
  return (
    <Surface padded={false}>
      {!isPhone ? <TableHeader right={space[4]} columns={[{ label: "Rank", width: 56 }, { label: "Respondent" }, { label: "Submitted", width: 170 }, { label: "Score", width: 150 }]} /> : null}
      {ranked.map(({ r, rank }, i) => {
        const pct = Math.round(((r.score ?? 0) / (r.maxScore as number)) * 1000) / 10;
        return (
          <Pressable
            key={r.id}
            accessibilityRole="link"
            accessibilityLabel={`Rank ${rank}, ${r.respondentName || "Anonymous"}, ${r.score}/${r.maxScore}`}
            onPress={() => onOpen(r.id)}
            style={(st) => [{ flexDirection: "row", alignItems: "center", gap: space[3], minHeight: 52, paddingHorizontal: space[4], borderBottomWidth: i === ranked.length - 1 ? 0 : 1, borderBottomColor: colors.border }, (st as { hovered?: boolean }).hovered && { backgroundColor: colors.hover }]}
          >
            <View style={{ width: isPhone ? 32 : 56 }}>
              <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: medal(rank), backgroundColor: rank <= 3 ? colors.surfaceMuted : "transparent" }}>
                <Text variant="small" style={{ color: medal(rank), fontWeight: "700", fontVariant: ["tabular-nums"] }}>{rank}</Text>
              </View>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text variant="bodyStrong" numberOfLines={1}>{r.respondentName || "Anonymous"}</Text>
              {isPhone ? <Text variant="small" tone="secondary">{formatDateTime(r.submittedAt)}</Text> : null}
            </View>
            {!isPhone ? <View style={{ width: 170 }}><Text variant="small" tone="secondary">{formatDateTime(r.submittedAt)}</Text></View> : null}
            <View style={{ width: isPhone ? 96 : 150, gap: 3 }}>
              <Text variant="small" style={{ fontWeight: "600" }}>{r.score}/{r.maxScore}  {pct}%</Text>
              <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.surfaceSunken }}><View style={{ width: `${Math.min(100, pct)}%`, height: 4, borderRadius: 2, backgroundColor: colors.success }} /></View>
            </View>
          </Pressable>
        );
      })}
    </Surface>
  );
}

export default function SessionDetail() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const router = useRouter();
  const { isDesktop } = useLayout();
  const { colors } = useTheme();
  const origin = useServerOrigin();
  const tunnel = useTunnel();
  const sync = useSync() as unknown as SyncState;

  const [session, setSession] = useState<Session | null>(null);
  const [respondents, setRespondents] = useState<Respondent[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "not-found">("loading");
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<RespondentDetail | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [tab, setTab] = useState<"respondents" | "leaderboard" | "settings">("respondents");
  // Draft of the name / time limit fields; saved explicitly with the "Save changes" button.
  const [general, setGeneral] = useState({ name: "", durationMinutes: "" });
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [syncPrompt, setSyncPrompt] = useState(false);
  const [syncing, setSyncing] = useState(false);
  // Drafts for the countdown field, so typing doesn't fight the input on every keystroke. Committed on blur / unit change.
  const [refocusValue, setRefocusValue] = useState(String(DURATION_DEFAULT_SECONDS));
  const [refocusUnit, setRefocusUnit] = useState<"seconds" | "minutes">("seconds");

  const load = useCallback(() => {
    Promise.all([sessionsApi.get(sessionId), sessionsApi.respondents(sessionId)])
      .then(([s, r]: [Session, Respondent[]]) => { setSession(s); setRespondents(r); setState("ready"); })
      .catch(() => setState("not-found"));
  }, [sessionId]);

  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, [load]);

  // Seeded once per session (by id, not on every poll) so it can't clobber the host mid-edit.
  useEffect(() => {
    if (!session) return;
    const { value, unit } = secondsToDurationParts(session.refocusLockSeconds);
    setRefocusValue(String(value));
    setRefocusUnit(unit as "seconds" | "minutes");
    setGeneral({ name: session.name, durationMinutes: session.durationMinutes ? String(session.durationMinutes) : "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id]);

  useEffect(() => {
    if (openId == null) { setDetail(null); return; }
    sessionsApi.respondentDetail(sessionId, openId).then(setDetail).catch(() => setDetail(null));
  }, [sessionId, openId]);

  if (state === "loading") return <Spinner label="Loading session" fill />;
  if (state === "not-found" || !session) {
    return (
      <Page>
        <Button label="All sessions" icon={ArrowLeft} variant="ghost" compact onPress={() => router.push("/dashboard/sessions" as never)} />
        <Surface><EmptyState icon={ClipboardList} title="Session not found" body="It may have been deleted." actionLabel="Back to sessions" onAction={() => router.replace("/dashboard/sessions" as never)} /></Surface>
      </Page>
    );
  }

  const isDraft = session.status === "draft";
  const isActive = session.status === "active";
  const isEnded = session.status === "ended";
  const backlog = (sync.status?.pendingCount || 0) + (sync.status?.failedCount || 0);
  const canOfferSync = !!session.formIsCloudLinked && !!(sync.status as { connected?: boolean } | null)?.connected && !!(sync.status as { reachable?: boolean } | null)?.reachable && backlog > 0;

  const act = async (fn: () => Promise<Session>) => {
    setWorking(true);
    setError(null);
    try {
      setSession(await fn());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setWorking(false);
    }
  };

  const confirmAction = async () => {
    if (confirm === "end") setSession(await sessionsApi.end(session.id));
    else if (confirm === "reopen") setSession(await sessionsApi.reopen(session.id));
    else if (confirm === "delete") {
      await sessionsApi.remove(session.id);
      router.replace("/dashboard/sessions" as never);
      return;
    }
    setConfirm(null);
  };

  const toggleRefocus = () => {
    const on = !session.refocusLockSeconds;
    act(async () => {
      const updated = await sessionsApi.setRefocusLock(session.id, on ? DURATION_DEFAULT_SECONDS : null);
      if (on) { setRefocusValue(String(DURATION_DEFAULT_SECONDS)); setRefocusUnit("seconds"); }
      return updated;
    });
  };

  // Commits the duration only while the lock is already on: a stray click-away shouldn't turn anything on.
  const commitRefocus = (unit: "seconds" | "minutes" = refocusUnit) => {
    const seconds = durationPartsToSeconds(refocusValue, unit);
    setRefocusValue(String(unit === "minutes" ? seconds / 60 : seconds));
    setRefocusUnit(unit);
    if (!session.refocusLockSeconds || seconds === session.refocusLockSeconds) return;
    act(() => sessionsApi.setRefocusLock(session.id, seconds));
  };

  const generalDirty = general.name.trim() !== session.name || (general.durationMinutes ? Number(general.durationMinutes) : null) !== (session.durationMinutes || null);
  const saveGeneral = async () => {
    setWorking(true);
    setGeneralError(null);
    try {
      const updated = await sessionsApi.update(session.id, { name: general.name.trim(), durationMinutes: general.durationMinutes ? Number(general.durationMinutes) : null });
      setSession(updated);
      setGeneral({ name: updated.name, durationMinutes: updated.durationMinutes ? String(updated.durationMinutes) : "" });
    } catch (err) {
      setGeneralError((err as Error).message);
    } finally {
      setWorking(false);
    }
  };

  const start = () => (canOfferSync ? setSyncPrompt(true) : act(() => sessionsApi.start(session.id)));
  const syncAndStart = async () => {
    setSyncing(true);
    try { await sync.sync(); } catch { /* surfaced by the sidebar sync status; doesn't block starting */ }
    setSyncing(false);
    setSyncPrompt(false);
    act(() => sessionsApi.start(session.id));
  };

  const submitted = respondents.filter((r) => r.status === "submitted");
  const inProgress = respondents.filter((r) => r.status !== "submitted");
  const q = query.toLowerCase();
  const shown = respondents.filter((r) => (r.respondentName || "").toLowerCase().includes(q) && (filter === "all" || (filter === "submitted" ? r.status === "submitted" : r.status !== "submitted")));
  const scored = submitted.filter((r) => r.maxScore);
  const avg = scored.length ? Math.round((scored.reduce((s, r) => s + (r.score ?? 0) / (r.maxScore as number), 0) / scored.length) * 1000) / 10 : null;
  // The set the prev/next arrows step through: same rows that are openable in the list, same order.
  const viewable = shown.filter((r) => isEnded || r.status === "submitted");
  const openIndex = openId ? viewable.findIndex((r) => r.id === openId) : -1;
  const shareUrl = `${origin}/s/${session.code}`;
  const publicUrl = tunnel.status === "connected" && tunnel.url ? `${tunnel.url}/s/${session.code}` : null;

  return (
    <Page>
      <Button label="All sessions" icon={ArrowLeft} variant="ghost" compact onPress={() => router.push("/dashboard/sessions" as never)} />
      <View style={{ gap: space[2] }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
          <Badge label={STATUS_LABEL[session.status]} tone={STATUS_TONE[session.status]} />
          <Text variant="small" tone="secondary" selectable>{sessionCodeLabel(session)}</Text>
        </View>
        <PageHeader
          title={session.name || "Untitled session"}
          subtitle={session.formTitle}
          actions={
            <>
              {isDraft ? <Button label="Start session" icon={Play} variant="success" loading={working} onPress={start} /> : null}
              {isActive ? <Button label="End session" icon={Square} variant="danger" disabled={working} onPress={() => setConfirm("end")} /> : null}
              {isEnded ? <Button label="Reopen session" icon={Play} variant="success" disabled={working} onPress={() => setConfirm("reopen")} /> : null}
              {respondents.length > 0 ? <Button label="Export" icon={Download} onPress={() => setShowExport(true)} /> : null}
              <Button label="Open form" icon={ExternalLink} onPress={() => router.push(`/forms/${session.formId}` as never)} />
              <IconButton icon={Trash2} label="Delete session" tone="danger" onPress={() => setConfirm("delete")} />
            </>
          }
        />
      </View>

      {error ? <Notice tone="danger" actionLabel="Dismiss" onAction={() => setError(null)}>{error}</Notice> : null}

      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "stretch", gap: space[3] }}>
        {[
          { label: "Respondents", value: String(respondents.length), sub: "joined" },
          { label: "Submitted", value: `${submitted.length} / ${respondents.length}`, sub: "finished" },
          { label: "In progress", value: String(inProgress.length), sub: isActive ? "answering now" : "not finished" },
          { label: "Average score", value: avg != null ? `${avg}%` : "—", sub: avg != null ? `${scored.length} graded` : "no grades yet" },
        ].map((t) => (
          <Surface key={t.label} style={{ flexGrow: 1, flexBasis: 130, maxWidth: isDesktop ? 170 : undefined, justifyContent: "center", gap: 0 }}>
            <Stat label={t.label} value={t.value} sub={t.sub} />
          </Surface>
        ))}
        {!isEnded ? (
          <Surface style={{ flexGrow: 4, flexBasis: 440, justifyContent: "center" }}>
            <JoinPanel inline code={session.code} shareUrl={shareUrl} publicUrl={publicUrl} />
          </Surface>
        ) : null}
      </View>

      <Tabs<"respondents" | "leaderboard" | "settings"> value={tab} onChange={setTab} options={[{ value: "respondents", label: "Respondents", count: respondents.length }, { value: "leaderboard", label: "Leaderboard" }, { value: "settings", label: "Settings" }]} />

      {tab === "leaderboard" ? (
        <Leaderboard respondents={respondents} onOpen={setOpenId} />
      ) : tab === "settings" ? (
        <View style={{ gap: space[4] }}>
          <Surface padded={false}>
            <SettingRow label="Form" description="The form this session collects answers for. It is fixed when the session is created so existing responses always match its questions.">
              <Button label={session.formTitle || "Untitled form"} icon={ExternalLink} onPress={() => router.push(`/forms/${session.formId}` as never)} />
            </SettingRow>
            <SettingRow label="Session name" description="Shown to you in the sessions list.">
              <View style={{ width: isDesktop ? 280 : undefined }}><TextField value={general.name} onChangeText={(v) => setGeneral((g) => ({ ...g, name: v }))} accessibilityLabel="Session name" /></View>
            </SettingRow>
            <SettingRow label="Time limit per respondent" description={isActive ? "Minutes. Applies to people who join from now on; anyone already answering keeps their current deadline." : "Minutes. Leave empty for no limit."}>
              <View style={{ width: isDesktop ? 280 : undefined }}><TextField value={general.durationMinutes} onChangeText={(v) => setGeneral((g) => ({ ...g, durationMinutes: v.replace(/\D/g, "") }))} keyboardType="numeric" placeholder="No limit" accessibilityLabel="Time limit in minutes" /></View>
            </SettingRow>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space[3], padding: space[3] }}>
              <Text variant="small" tone={generalError ? "danger" : "tertiary"} style={{ flex: 1 }}>{generalError ?? `Started ${formatDateTime(session.startedAt)} · Ended ${formatDateTime(session.endedAt)}`}</Text>
              <Button label="Discard" variant="ghost" compact disabled={!generalDirty || working} onPress={() => { setGeneral({ name: session.name, durationMinutes: session.durationMinutes ? String(session.durationMinutes) : "" }); setGeneralError(null); }} />
              <Button label="Save changes" variant="primary" compact disabled={!generalDirty} loading={working} onPress={saveGeneral} />
            </View>
          </Surface>

          <Surface padded={false}>
            <SettingRow label="Allow editing after submitting" description={`Respondents can change their answer with their edit code${session.responsesEditable && !isActive ? ". Only takes effect while the session is active" : ""}.`}>
              <Switch label={session.responsesEditable ? "On" : "Off"} checked={session.responsesEditable} disabled={working} onChange={() => act(() => sessionsApi.setEditable(session.id, !session.responsesEditable))} />
            </SettingRow>
            <SettingRow label="Fullscreen when a respondent starts answering" description="The respondent page tries to enter fullscreen when they join or resume. They can still toggle it from the toolbar.">
              <Switch label={session.fullscreenEnabled ? "On" : "Off"} checked={session.fullscreenEnabled} disabled={working} onChange={() => act(() => sessionsApi.setFullscreenEnabled(session.id, !session.fullscreenEnabled))} />
            </SettingRow>
            <SettingRow label="Lock screen when a respondent switches tabs" description="Coming back to the tab holds them on a countdown before the questions reappear." last>
              <View style={{ gap: space[2], alignItems: isDesktop ? "flex-end" : "flex-start" }}>
                <Switch label={session.refocusLockSeconds ? "On" : "Off"} checked={!!session.refocusLockSeconds} disabled={working} onChange={toggleRefocus} />
                {session.refocusLockSeconds ? (
                  <View style={{ flexDirection: "row", gap: space[2] }}>
                    <View style={{ width: 80 }}><TextField value={refocusValue} onChangeText={(v) => setRefocusValue(v.replace(/\D/g, ""))} onBlur={() => commitRefocus()} keyboardType="numeric" accessibilityLabel="Countdown length" /></View>
                    <View style={{ width: 130 }}><Select value={refocusUnit} options={[{ value: "seconds", label: "seconds" }, { value: "minutes", label: "minutes" }]} onChange={(u) => commitRefocus(u)} /></View>
                  </View>
                ) : null}
              </View>
            </SettingRow>
          </Surface>
        </View>
      ) : (
        <View style={{ gap: space[3] }}>
          <View style={{ flexDirection: isDesktop ? "row" : "column", gap: space[3], alignItems: isDesktop ? "center" : "stretch", justifyContent: "space-between" }}>
            <SegmentedControl<Filter> value={filter} onChange={setFilter} options={[{ value: "all", label: "All", count: respondents.length }, { value: "submitted", label: "Submitted", count: submitted.length }, { value: "in_progress", label: "In progress", count: inProgress.length }]} />
            <View style={{ flex: isDesktop ? 1 : undefined, maxWidth: isDesktop ? 320 : undefined }}><SearchField value={query} onChangeText={setQuery} placeholder="Search respondents" /></View>
          </View>
          <Text variant="small" tone="secondary">{isActive ? "Live, refreshes every 5 seconds. " : ""}{!isEnded ? "Scores and answers are viewable as soon as a respondent submits; everyone else's once the session has ended." : ""}</Text>
          <Surface padded={false}>
            {shown.length === 0 ? (
              <EmptyState
                icon={Users}
                title={respondents.length === 0 ? "No respondents yet" : "No respondents match"}
                body={respondents.length === 0 ? (isDraft ? "Start the session, then share the join code or link so people can join." : isActive ? `Share the join code ${session.code} or the link above. People show up here the moment they join.` : "Nobody joined this session.") : "Try a different search or filter."}
              />
            ) : (
              <>
                <RespondentHeader />
                {shown.map((r, i) => <RespondentRow key={r.id} r={r} session={session} last={i === shown.length - 1} viewable={isEnded || r.status === "submitted"} onOpen={() => setOpenId(r.id)} />)}
              </>
            )}
          </Surface>
        </View>
      )}

      <ExportDialog
        visible={showExport}
        summary={`${session.name || "Untitled session"} · ${respondents.length} respondent${respondents.length === 1 ? "" : "s"}`}
        onClose={() => setShowExport(false)}
        onExport={async (format, opts) => { await exportSessions(format, [await sessionsApi.exportData(session.id)], opts); }}
      />
      <RespondentDialog
        respondent={openId ? detail : null}
        onClose={() => setOpenId(null)}
        onPrev={viewable.length > 1 && openIndex > 0 ? () => setOpenId(viewable[openIndex - 1].id) : null}
        onNext={viewable.length > 1 && openIndex >= 0 && openIndex < viewable.length - 1 ? () => setOpenId(viewable[openIndex + 1].id) : null}
        position={openIndex >= 0 ? { index: openIndex, total: viewable.length } : null}
      />
      <ConfirmDialog visible={!!confirm} {...(confirm ? CONFIRMS[confirm] : CONFIRMS.end)} onCancel={() => setConfirm(null)} onConfirm={confirmAction} />

      <Dialog visible={syncPrompt} title="Sync before starting?" onClose={() => setSyncPrompt(false)} footer={<><Button label="Start without syncing" variant="ghost" disabled={syncing} onPress={() => { setSyncPrompt(false); act(() => sessionsApi.start(session.id)); }} /><Button label="Sync and start" variant="primary" loading={syncing} onPress={syncAndStart} /></>}>
        <Text tone="secondary">{`This form is connected to your cloud account, and there ${backlog === 1 ? "is" : "are"} ${backlog} response${backlog === 1 ? "" : "s"} waiting to sync. Sync now, or start the session and sync later from the sidebar.`}</Text>
      </Dialog>
    </Page>
  );
}
