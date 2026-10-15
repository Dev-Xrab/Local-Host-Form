import { useEffect, useMemo, useState } from "react";
import { Modal, Platform, Pressable, ScrollView, View } from "react-native";
import { Check, ChevronRight, Download, Maximize2, Users, X } from "lucide-react-native";
import { sessionsApi } from "../../src/features/sessions/services/sessionsApi";
import { buildRespondentMatrix, formatCellScore } from "../../src/features/sessions/utils/respondentMatrix";
import { formatDateTime } from "../../src/features/sessions/utils/time";
import { groupBySubjects } from "../../src/features/subjects/utils/groupBySubjects";
import { useRoster } from "../../src/features/roster/hooks/useRoster";
import { Badge, Button, Checkbox, EmptyState, Icon, IconButton, Page, PageHeader, SearchField, Section, Spinner, Surface, Text, radius, space, useLayout, useTheme } from "../../ui";
import { useSessions, useSubjects } from "../../lib/data";
import { exportSessions } from "../../lib/exportSessions";
import type { SessionSummary, Subject } from "../../lib/domain";
import type { Student } from "../../lib/roster";
import { ExportDialog } from "../sessions/ExportDialog";
import { RespondentDialog, type RespondentDetail } from "../sessions/RespondentDialog";
import { RosterManager } from "./RosterManager";

interface Cell { id: string; score?: number | null; maxScore?: number | null; submittedAt?: string | null }
interface Row { key: string; name: string; studentId: string; matched: boolean; cells: Record<string, Cell | undefined> }
type Detail = RespondentDetail | "error";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const shortDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "");
const fmt = (v: unknown) => (v === null || v === undefined || v === "" ? null : Array.isArray(v) ? v.join(", ") || null : String(v));

/** One respondent's response to one session as question/answer pairs: the content, not just the fact that it exists. */
function ResponseBlock({ session, response, detail, focused, onOpenFull }: { session: SessionSummary; response: Cell; detail?: Detail; focused: boolean; onOpenFull: () => void }) {
  const { colors } = useTheme();
  const score = formatCellScore(response);
  const pct = response.maxScore ? Math.round(((response.score ?? 0) / response.maxScore) * 1000) / 10 : null;
  return (
    <View style={{ gap: space[2], padding: space[3], borderRadius: radius.md, borderWidth: 1, borderColor: focused ? colors.accent : colors.border, backgroundColor: colors.surface }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: space[2] }}>
        <View style={{ flexShrink: 1 }}>
          <Text variant="bodyStrong">{session.name || "Untitled session"}</Text>
          <Text variant="small" tone="secondary">{session.formTitle}</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2], flexWrap: "wrap" }}>
          {response.submittedAt ? <Text variant="small" tone="secondary">Submitted {formatDateTime(response.submittedAt)}</Text> : null}
          {score ? <Badge label={`${score}${pct != null ? ` · ${pct}%` : ""}`} tone="accent" /> : null}
          <Button label="Open full view" variant="ghost" compact onPress={onOpenFull} />
        </View>
      </View>
      {!detail ? <Text variant="small" tone="secondary">Loading answers…</Text> : detail === "error" ? <Text variant="small" tone="danger">Couldn't load these answers.</Text> : (
        detail.breakdown.map((b, i) => {
          const answer = b.fileUrl ? "File attached" : fmt(b.submittedAnswer);
          const correct = fmt(b.correctAnswer);
          return (
            <View key={b.questionId} style={{ gap: 2, paddingTop: space[2], borderTopWidth: 1, borderTopColor: colors.border }}>
              <Text variant="small" tone="secondary">{i + 1}. {b.title || "Untitled question"}</Text>
              <Text tone={answer ? "default" : "tertiary"}>{answer || "No answer"}</Text>
              {b.gradable ? <Text variant="caption" tone={b.correct ? "success" : "danger"}>{b.correct ? "Correct" : "Incorrect"} · {b.pointsEarned}/{b.points}{!b.correct && correct ? ` · answer: ${correct}` : ""}</Text> : null}
            </View>
          );
        })
      )}
    </View>
  );
}

export function BulkExportScreen() {
  const { colors } = useTheme();
  const { isDesktop, isPhone } = useLayout();
  const { sessions: all, loading } = useSessions();
  const { subjects } = useSubjects();
  const { students, refresh: refreshRoster } = useRoster() as { students: Student[]; refresh: () => Promise<void> };
  const ended = all.filter((s) => s.status === "ended");

  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [showExport, setShowExport] = useState(false);
  const [fullView, setFullView] = useState(false);

  useEffect(() => {
    if (!fullView || Platform.OS !== "web") return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFullView(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullView]);
  const [sessionQuery, setSessionQuery] = useState("");
  const [respondentQuery, setRespondentQuery] = useState("");
  const [bySession, setBySession] = useState<Record<string, unknown[]>>({});
  const [fetching, setFetching] = useState(false);
  const [includeNonRoster, setIncludeNonRoster] = useState(false);
  const [rosterOpen, setRosterOpen] = useState<boolean | null>(null);
  // The respondent whose answers are expanded inline, and which session's chip was clicked.
  const [expanded, setExpanded] = useState<{ rowKey: string; sessionId: string | null } | null>(null);
  const [details, setDetails] = useState<Record<string, Detail>>({});
  const [openFull, setOpenFull] = useState<{ sessionId: string; responseId: string } | null>(null);
  const [fullDetail, setFullDetail] = useState<RespondentDetail | null>(null);

  const searched = ended.filter((s) => `${s.name || ""} ${s.formTitle || ""}`.toLowerCase().includes(sessionQuery.toLowerCase()));
  const sections = groupBySubjects(searched, subjects, (s: SessionSummary) => s.subjectId) as { subject: Subject | null; items: SessionSummary[] }[];
  const chosen = ended.filter((s) => selected.has(s.id));

  // Fetch respondents only for newly selected sessions, so ticking one more doesn't refetch the rest.
  useEffect(() => {
    const missing = chosen.filter((s) => !bySession[s.id]);
    if (missing.length === 0) return;
    let cancelled = false;
    setFetching(true);
    Promise.all(missing.map((s) => sessionsApi.respondents(s.id).then((r: unknown[]) => [s.id, r] as const)))
      .then((pairs) => { if (!cancelled) setBySession((p) => ({ ...p, ...Object.fromEntries(pairs) })); })
      .finally(() => { if (!cancelled) setFetching(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, all]);

  const rows = useMemo(
    () => buildRespondentMatrix({ students, sessions: chosen, respondentsBySession: bySession, includeNonRoster }) as Row[],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [students, selected, all, bySession, includeNonRoster]
  );
  const visible = rows.filter((r) => r.name.toLowerCase().includes(respondentQuery.toLowerCase()));
  const responseCount = rows.reduce((n, r) => n + chosen.filter((s) => r.cells[s.id]).length, 0);
  const possible = rows.length * chosen.length;
  const rate = possible ? Math.round((responseCount / possible) * 100) : 0;
  const hasRoster = students.length > 0;

  const loadDetail = (sessionId: string, responseId: string) => {
    if (details[responseId]) return;
    sessionsApi.respondentDetail(sessionId, responseId).then((d: RespondentDetail) => setDetails((p) => ({ ...p, [responseId]: d }))).catch(() => setDetails((p) => ({ ...p, [responseId]: "error" })));
  };
  const expand = (row: Row, sessionId: string | null = null) => {
    // Clicking the open row's name again closes it; clicking one of its chips just moves the highlight.
    if (expanded?.rowKey === row.key && !sessionId) return setExpanded(null);
    setExpanded({ rowKey: row.key, sessionId });
    chosen.forEach((s) => { const c = row.cells[s.id]; if (c) loadDetail(s.id, c.id); });
  };

  useEffect(() => {
    if (!openFull) { setFullDetail(null); return; }
    let cancelled = false;
    sessionsApi.respondentDetail(openFull.sessionId, openFull.responseId).then((d: RespondentDetail) => !cancelled && setFullDetail(d)).catch(() => !cancelled && setOpenFull(null));
    return () => { cancelled = true; };
  }, [openFull]);

  const toggle = (ids: string[], on: boolean) => setSelected((p) => { const n = new Set(p); ids.forEach((id) => (on ? n.add(id) : n.delete(id))); return n; });

  const doExport = async (format: "excel" | "pdf", { includeAnswers }: { includeAnswers: boolean }) => {
    const data = await Promise.all(chosen.map((s) => sessionsApi.exportData(s.id)));
    await exportSessions(format, data, { matrix: { sessions: chosen, rows }, includeAnswers });
  };

  const chip = (row: Row, s: SessionSummary) => {
    const c = row.cells[s.id];
    if (!c) return <Badge key={s.id} label="No response" />;
    return (
      <Pressable key={s.id} accessibilityRole="button" accessibilityLabel={`Read ${row.name}'s answers for ${s.name}`} onPress={() => expand(row, s.id)} style={{ flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: colors.successSoft }}>
        <Icon icon={Check} size={12} color={colors.success} strokeWidth={3} />
        <Text variant="caption" tone="success">{formatCellScore(c) || "Responded"}</Text>
      </Pressable>
    );
  };

  const picker = (
    <Surface padded={false}>
      <View style={{ padding: space[3], gap: space[2] }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View><Text variant="title">Sessions</Text><Text variant="small" tone="secondary">{chosen.length} of {ended.length} selected</Text></View>
          <View style={{ flexDirection: "row" }}>
            <Button label="Select all" variant="ghost" compact onPress={() => toggle(ended.map((s) => s.id), true)} />
            <Button label="Clear" variant="ghost" compact disabled={selected.size === 0} onPress={() => { setSelected(new Set()); setExpanded(null); }} />
          </View>
        </View>
        <SearchField value={sessionQuery} onChangeText={setSessionQuery} placeholder="Search sessions or forms" />
      </View>
      <ScrollView style={{ maxHeight: isDesktop ? 520 : 320 }} contentContainerStyle={{ paddingHorizontal: space[3], paddingBottom: space[3], gap: space[2] }}>
        {loading ? <Spinner label="Loading sessions" /> : ended.length === 0 ? <Text tone="secondary">No ended sessions yet. Results appear here once a session ends.</Text> : sections.length === 0 ? <Text tone="secondary">{`No sessions match "${sessionQuery}".`}</Text> : sections.map(({ subject, items }) => {
          const ids = items.map((s) => s.id);
          const count = ids.filter((id) => selected.has(id)).length;
          return (
            <View key={subject?.id ?? "unsorted"} style={{ gap: 2 }}>
              <Checkbox label={`${subject?.name ?? "General"} (${items.length})`} checked={count === ids.length} indeterminate={count > 0 && count < ids.length} onChange={() => toggle(ids, count !== ids.length)} />
              <View style={{ paddingLeft: space[5] }}>
                {items.map((s) => <Checkbox key={s.id} label={s.name || "Untitled session"} description={`${s.formTitle} · ${plural(s.submittedCount, "response")}${s.endedAt ? ` · ${shortDate(s.endedAt)}` : ""}`} checked={selected.has(s.id)} onChange={(v) => toggle([s.id], v)} />)}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </Surface>
  );

  const expandedBlocks = (row: Row) => (
    <View style={{ gap: space[2], padding: space[3], backgroundColor: colors.surfaceMuted }}>
      {chosen.filter((s) => row.cells[s.id]).length === 0 ? <Text tone="secondary">{row.name} hasn't responded to any of the selected sessions.</Text> : chosen.filter((s) => row.cells[s.id]).map((s) => (
        <ResponseBlock key={s.id} session={s} response={row.cells[s.id]!} detail={details[row.cells[s.id]!.id]} focused={expanded?.sessionId === s.id} onOpenFull={() => setOpenFull({ sessionId: s.id, responseId: row.cells[s.id]!.id })} />
      ))}
    </View>
  );

  const renderResults = (full: boolean) => (
    <Surface padded={false} style={full ? { borderRadius: 0, borderWidth: 0 } : undefined}>
      <View style={{ padding: space[3], gap: space[3], flexDirection: isPhone ? "column" : "row", alignItems: isPhone ? "stretch" : "center", justifyContent: "space-between" }}>
        <View style={{ flex: isPhone ? undefined : 1, maxWidth: isPhone ? undefined : 300 }}><SearchField value={respondentQuery} onChangeText={setRespondentQuery} placeholder="Search respondents" /></View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[3], flexWrap: "wrap" }}>
          {hasRoster ? <Checkbox label="Include non-roster respondents" checked={includeNonRoster} onChange={setIncludeNonRoster} /> : null}
          {!full && !isPhone ? <IconButton icon={Maximize2} label="Full view" onPress={() => setFullView(true)} /> : null}
          <Button label={`Export ${plural(chosen.length, "session")}`} icon={Download} variant="primary" onPress={() => setShowExport(true)} />
        </View>
      </View>
      {fetching && Object.keys(bySession).length === 0 ? <Spinner label="Loading responses" /> : visible.length === 0 ? (
        <EmptyState title={respondentQuery ? `No respondents match "${respondentQuery}"` : hasRoster && !includeNonRoster ? "No submitted respondents match the roster" : "No submitted responses yet"} body={hasRoster && !includeNonRoster && !respondentQuery ? "Turn on non-roster respondents to see everyone who submitted." : undefined} />
      ) : isPhone ? (
        visible.map((row) => {
          const open = expanded?.rowKey === row.key;
          return (
            <View key={row.key} style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
              <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => expand(row)} style={{ padding: space[3], gap: space[2] }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
                  <View style={{ transform: [{ rotate: open ? "90deg" : "0deg" }] }}><Icon icon={ChevronRight} size={16} /></View>
                  <Text variant="bodyStrong" style={{ flex: 1 }}>{row.name}</Text>
                  {hasRoster && !row.matched ? <Badge label="Not on roster" tone="warning" /> : null}
                </View>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2], paddingLeft: space[5] }}>
                  {chosen.map((s) => <View key={s.id} style={{ gap: 2 }}><Text variant="caption" tone="tertiary" numberOfLines={1} style={{ maxWidth: 140 }}>{s.name || "Untitled"}</Text>{chip(row, s)}</View>)}
                </View>
              </Pressable>
              {open ? expandedBlocks(row) : null}
            </View>
          );
        })
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ flexGrow: 1 }}>
          <View style={{ flexGrow: 1 }}>
            <View style={{ flexDirection: "row", borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceMuted }}>
              <View style={{ flex: 1, minWidth: 240, padding: space[3] }}><Text variant="caption" tone="secondary">Respondent</Text></View>
              {chosen.map((s) => <View key={s.id} style={{ width: 150, padding: space[3] }}><Text variant="caption" tone="secondary" numberOfLines={1}>{s.name || "Untitled session"}</Text><Text variant="caption" tone="tertiary" numberOfLines={1} style={{ fontWeight: "400" }}>{s.formTitle}</Text></View>)}
              <View style={{ width: 110, padding: space[3] }}><Text variant="caption" tone="secondary">Responded</Text></View>
            </View>
            {visible.map((row) => {
              const open = expanded?.rowKey === row.key;
              const done = chosen.filter((s) => row.cells[s.id]).length;
              return (
                <View key={row.key} style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => expand(row)} style={(st) => [{ flex: 1, minWidth: 240, flexDirection: "row", alignItems: "center", gap: space[2], padding: space[3] }, (st as { hovered?: boolean }).hovered && { backgroundColor: colors.hover }]}>
                      <View style={{ transform: [{ rotate: open ? "90deg" : "0deg" }] }}><Icon icon={ChevronRight} size={16} /></View>
                      <View style={{ flex: 1 }}>
                        <Text variant="bodyStrong" numberOfLines={1}>{row.name}</Text>
                        {row.studentId ? <Text variant="caption" tone="tertiary">{row.studentId}</Text> : null}
                      </View>
                      {hasRoster && !row.matched ? <Badge label="Off roster" tone="warning" /> : null}
                    </Pressable>
                    {chosen.map((s) => <View key={s.id} style={{ width: 150, padding: space[3] }}>{chip(row, s)}</View>)}
                    <View style={{ width: 110, padding: space[3] }}><Text variant="small" tone="secondary">{done}/{chosen.length}</Text></View>
                  </View>
                  {open ? expandedBlocks(row) : null}
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}
    </Surface>
  );

  return (
    <Page maxWidth={1240}>
      <PageHeader title="Bulk export" subtitle="Choose ended sessions, see who responded to each, read anyone's answers, and export it all to one Excel workbook." />
      <View style={{ flexDirection: isDesktop ? "row" : "column", gap: space[4], alignItems: "flex-start" }}>
        <View style={{ width: isDesktop ? 340 : undefined, alignSelf: isDesktop ? "flex-start" : "stretch" }}>{picker}</View>
        <View style={{ flex: 1, alignSelf: "stretch", gap: space[4], minWidth: 0 }}>
          <Surface padded={false}>
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: rosterOpen ?? !hasRoster }} onPress={() => setRosterOpen(!(rosterOpen ?? !hasRoster))} style={{ flexDirection: "row", alignItems: "center", gap: space[2], padding: space[3] }}>
              <View style={{ transform: [{ rotate: (rosterOpen ?? !hasRoster) ? "90deg" : "0deg" }] }}><Icon icon={ChevronRight} size={16} /></View>
              <Icon icon={Users} size={16} />
              <Text variant="bodyStrong" style={{ flex: 1 }}>Roster</Text>
              <Badge label={plural(students.length, "student")} />
            </Pressable>
            {(rosterOpen ?? !hasRoster) ? <View style={{ padding: space[3], paddingTop: 0 }}><RosterManager students={students} onChanged={refreshRoster} /></View> : null}
          </Surface>

          {chosen.length === 0 ? (
            <Surface><EmptyState icon={Download} title="Pick sessions to get started" body="Tick one or more sessions. You'll see every respondent, whether they responded to each session, and can open anyone's answers right here." /></Surface>
          ) : (
            <>
              <Surface style={{ flexDirection: "row", flexWrap: "wrap", gap: space[4] }}>
                {[["Respondents", String(rows.length)], ["Sessions", String(chosen.length)], ["Responses", String(responseCount)], ["Response rate", `${rate}%`]].map(([l, v]) => (
                  <View key={l} style={{ flex: 1, minWidth: 100, gap: 2 }}><Text variant="caption" tone="tertiary">{l}</Text><Text variant="heading" style={{ fontVariant: ["tabular-nums"] }}>{v}</Text></View>
                ))}
              </Surface>
              <Section title="Results">{renderResults(false)}</Section>
            </>
          )}
        </View>
      </View>

      <Modal visible={fullView} animationType="fade" onRequestClose={() => setFullView(false)}>
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <View style={{ height: 48, flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: space[4], borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text variant="title" style={{ flex: 1 }}>{`Results · ${plural(chosen.length, "session")} · ${plural(rows.length, "respondent")}`}</Text>
            <IconButton icon={X} label="Exit full view" onPress={() => setFullView(false)} />
          </View>
          <ScrollView style={{ flex: 1 }}>{renderResults(true)}</ScrollView>
        </View>
      </Modal>

      <ExportDialog visible={showExport} summary={`${plural(chosen.length, "session")} · ${plural(rows.length, "respondent")}`} onClose={() => setShowExport(false)} onExport={doExport} />
      <RespondentDialog respondent={fullDetail} onClose={() => setOpenFull(null)} onPrev={null} onNext={null} position={null} />
    </Page>
  );
}
