import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { Download, FileText, RefreshCw } from "lucide-react-native";
import { formsApi } from "../../src/features/forms/services/formsApi";
import { cloudApi } from "../../src/features/cloud/services/cloudApi";
import { describeCloudError } from "../../src/features/cloud/utils/describeCloudError";
import { aggregateQuestion, percentOf } from "../../src/features/forms/utils/responseAnalytics";
import { Button, Dialog, EmptyState, ListRow, Notice, Page, PageHeader, SearchField, SegmentedControl, Select, Spinner, Surface, Text, space, useLayout, useTheme } from "../../ui";
import { useSubjects } from "../../lib/data";
import { canExportResponses, exportFormResponses } from "../../lib/exportFormResponses";
import { SaveResponsesPrompt, GoogleSyncDialog, type GoogleDiff } from "../forms/CloudDialogs";
import { RespondentDialog, type RespondentDetail } from "../sessions/RespondentDialog";

interface Response extends RespondentDetail { id: string; sessionId: string; sessionName?: string; answers?: Record<string, unknown>; respondentName?: string }
interface FormFull { id: string; subjectId: string | null; googleFormId?: string | null; unsavedResponseCount?: number; questions: Q[] }
interface Q { id: string; type: string; title: string; removedAt?: string | null }
interface SyncResult { checkedResponseCount: number; newResponseCount: number; unchangedResponseCount: number }

// Bar length and label share one number (count / total), so a 40% option is a 40%-long bar, not
// scaled against the biggest option (which made every top bar look full regardless of share).
function BarRows({ entries, total }: { entries: { label: string; count: number }[]; total: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: space[2] }}>
      {entries.map((e) => {
        const pct = percentOf(e.count, total);
        return (
          <View key={e.label} style={{ gap: 3 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: space[2] }}>
              <Text variant="small" style={{ flex: 1 }} numberOfLines={2}>{e.label}</Text>
              <Text variant="small" tone="secondary" style={{ fontVariant: ["tabular-nums"] }}>{e.count} ({pct}%)</Text>
            </View>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.surfaceSunken, overflow: "hidden" }}>
              <View style={{ width: `${Math.min(100, pct)}%`, height: 8, backgroundColor: colors.accent }} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

function QuestionBlock({ question, responses }: { question: Q; responses: Response[] }) {
  const [search, setSearch] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = aggregateQuestion(question, responses);
  const { kind, total } = result;

  return (
    <Surface style={{ gap: space[3] }}>
      <View style={{ gap: 2 }}>
        <Text variant="title">{question.title || "Untitled question"}</Text>
        <Text variant="small" tone="secondary">{total} response{total === 1 ? "" : "s"}{question.type === "checkboxes" ? " · % of respondents, can add up to more than 100%" : ""}</Text>
      </View>
      {kind === "matrix" ? (
        result.rows.length === 0 ? <Text tone="secondary">No rows configured.</Text> : result.rows.map((row: { rowLabel: string; total: number; entries: { label: string; count: number }[] }) => (
          <View key={row.rowLabel} style={{ gap: space[2] }}>
            <Text variant="bodyStrong">{row.rowLabel}</Text>
            {row.total === 0 ? <Text variant="small" tone="secondary">No answers yet.</Text> : <BarRows entries={row.entries} total={row.total} />}
          </View>
        ))
      ) : result.entries.length === 0 ? (
        <Text tone="secondary">No answers yet.</Text>
      ) : kind === "bar" || kind === "scale" ? (
        <>
          {kind === "scale" && result.stats ? (
            <View style={{ flexDirection: "row", gap: space[4], flexWrap: "wrap" }}>
              {(["avg", "median", "min", "max"] as const).map((k) => <Text key={k} variant="small" tone="secondary">{{ avg: "Average", median: "Median", min: "Min", max: "Max" }[k]} <Text variant="small" style={{ fontWeight: "700" }}>{result.stats[k]}</Text></Text>)}
            </View>
          ) : null}
          <BarRows entries={result.entries} total={total} />
        </>
      ) : (
        <>
          {result.entries.length > 5 ? <SearchField value={search} onChangeText={setSearch} placeholder="Search answers" /> : null}
          <View style={{ gap: space[2] }}>
            {(result.entries as string[]).filter((t) => String(t).toLowerCase().includes(search.toLowerCase())).map((t, i) => (
              <View key={i} style={{ padding: space[3], borderRadius: 8, backgroundColor: "transparent", borderWidth: 1, borderColor: "transparent" }}>
                <Text selectable>{t}</Text>
              </View>
            ))}
          </View>
        </>
      )}
    </Surface>
  );
}

export function ResponsesScreen({ formId }: { formId: string }) {
  const { isPhone } = useLayout();
  const { subjects } = useSubjects();
  const [form, setForm] = useState<FormFull | null>(null);
  const [responses, setResponses] = useState<Response[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"respondent" | "question">("respondent");
  const [query, setQuery] = useState("");
  const [sessionFilter, setSessionFilter] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [diff, setDiff] = useState<GoogleDiff | null>(null);
  const [applying, setApplying] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [exporting, setExporting] = useState<"excel" | "pdf" | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [dismissedPrompt, setDismissedPrompt] = useState(false);

  const load = useCallback(() => {
    setState("loading");
    setError(null);
    Promise.all([formsApi.get(formId), formsApi.responses(formId)])
      .then(([f, r]: [FormFull, Response[]]) => { setForm(f); setResponses(r); setState("ready"); })
      .catch((err: Error) => { setError(err.message); setState("error"); });
  }, [formId]);

  useEffect(load, [load]);

  // Check for structural changes first (read-only). Only show the decision dialog when something
  // changed; otherwise go straight to a response-only sync.
  const sync = async () => {
    setSyncing(true);
    setSyncError(null);
    setSyncResult(null);
    try {
      const d = await cloudApi.checkGoogleFormChanges(formId);
      if (d.hasChanges) setDiff(d);
      else { setSyncResult(await cloudApi.applyGoogleFormChanges(formId, "keep-local")); load(); }
    } catch (err) {
      setSyncError(describeCloudError(err));
    } finally {
      setSyncing(false);
    }
  };
  const apply = async (decision: "keep-local" | "sync-from-online") => {
    setApplying(true);
    try {
      setSyncResult(await cloudApi.applyGoogleFormChanges(formId, decision));
      setDiff(null);
      load();
    } catch (err) {
      setSyncError(describeCloudError(err));
    } finally {
      setApplying(false);
    }
  };

  if (state === "loading" && !form) return <Spinner label="Loading responses" fill />;
  if (state === "error" || !form) return <Page><Notice tone="danger" actionLabel="Retry" onAction={load}>{`Couldn't load responses: ${error}`}</Notice></Page>;

  // First-seen order (most recent session first, since responses arrive newest-first), not alphabetical.
  const sessions = [...responses.reduce((m, r) => { if (!m.has(r.sessionId)) m.set(r.sessionId, { id: r.sessionId, name: r.sessionName || "Untitled session", count: 0 }); m.get(r.sessionId)!.count += 1; return m; }, new Map<string, { id: string; name: string; count: number }>()).values()];
  const inSession = sessionFilter === "all" ? responses : responses.filter((r) => r.sessionId === sessionFilter);
  const filtered = inSession.filter((r) => (r.respondentName || "").toLowerCase().includes(query.toLowerCase()));
  const openIndex = openId ? filtered.findIndex((r) => r.id === openId) : -1;
  const answerable = form.questions.filter((q) => q.type !== "section");
  const live = answerable.filter((q) => !q.removedAt);
  const removed = answerable.filter((q) => q.removedAt);
  const selectedName = sessions.find((s) => s.id === sessionFilter)?.name;
  const subjectName = subjects.find((s) => s.id === form.subjectId)?.name;

  const runExport = async (format: "excel" | "pdf") => {
    setExporting(format);
    setExportError(null);
    try {
      await exportFormResponses(format, form, inSession, subjectName);
      setShowExport(false);
    } catch (err) {
      setExportError((err as Error).message);
    } finally {
      setExporting(null);
    }
  };

  return (
    <Page maxWidth={900}>
      <PageHeader
        title="All responses"
        subtitle={sessionFilter === "all" ? `${responses.length} response${responses.length === 1 ? "" : "s"} across every session for this form.` : `${inSession.length} response${inSession.length === 1 ? "" : "s"} from "${selectedName}".`}
        actions={
          <>
            {form.googleFormId ? <Button label={syncing ? "Syncing…" : "Sync from Google"} icon={RefreshCw} loading={syncing} onPress={sync} /> : null}
            <Button label="Export" icon={Download} disabled={inSession.length === 0} onPress={() => setShowExport(true)} />
          </>
        }
      />

      {syncError ? <Notice tone="danger">{syncError}</Notice> : null}
      {syncResult ? <Notice tone="success" actionLabel="Dismiss" onAction={() => setSyncResult(null)}>{`${syncResult.checkedResponseCount} response${syncResult.checkedResponseCount === 1 ? "" : "s"} checked. ${syncResult.newResponseCount === 0 ? "No new responses found." : `${syncResult.newResponseCount} new imported, ${syncResult.unchangedResponseCount} existing unchanged.`}`}</Notice> : null}
      {form.unsavedResponseCount && !dismissedPrompt ? <SaveResponsesPrompt count={form.unsavedResponseCount} onSave={async () => { await cloudApi.saveGoogleResponsesToCloud(formId); load(); }} onDismiss={() => setDismissedPrompt(true)} /> : null}

      <View style={{ flexDirection: isPhone ? "column" : "row", gap: space[3], alignItems: isPhone ? "stretch" : "center", justifyContent: "space-between" }}>
        <SegmentedControl value={view} onChange={setView} options={[{ value: "respondent", label: "By respondent" }, { value: "question", label: "By question" }]} />
        {sessions.length > 0 ? (
          <View style={{ width: isPhone ? undefined : 280 }}>
            <Select value={sessionFilter} onChange={setSessionFilter} options={[{ value: "all", label: `All sessions (${responses.length})` }, ...sessions.map((s) => ({ value: s.id, label: `${s.name} (${s.count})` }))]} />
          </View>
        ) : null}
      </View>

      {responses.length === 0 ? (
        <Surface><EmptyState icon={FileText} title="No submitted responses yet" body="Responses appear here as soon as people submit a session for this form." /></Surface>
      ) : inSession.length === 0 ? (
        <Surface><EmptyState icon={FileText} title={`No responses in "${selectedName}"`} /></Surface>
      ) : view === "respondent" ? (
        <>
          <SearchField value={query} onChangeText={setQuery} placeholder="Search respondents" />
          <Surface padded={false}>
            {filtered.length === 0 ? <EmptyState title={`No respondents match "${query}"`} /> : filtered.map((r, i) => (
              <ListRow
                key={r.id}
                last={i === filtered.length - 1}
                title={r.respondentName || "Anonymous"}
                subtitle={`${r.sessionName || "Untitled session"}${r.submittedAt ? ` · ${new Date(r.submittedAt).toLocaleString()}` : ""}`}
                meta={r.maxScore != null ? `${r.score}/${r.maxScore}` : "—"}
                onPress={() => setOpenId(r.id)}
              />
            ))}
          </Surface>
        </>
      ) : (
        <View style={{ gap: space[3] }}>
          {live.length === 0 ? <Surface><EmptyState title="This form has no answerable questions" /></Surface> : live.map((q) => <QuestionBlock key={q.id} question={q} responses={inSession} />)}
          {removed.length > 0 ? (
            <View style={{ gap: space[3] }}>
              <Text variant="label" tone="secondary">{`${removed.length} removed question${removed.length === 1 ? "" : "s"}, still shown historically`}</Text>
              {removed.map((q) => <QuestionBlock key={q.id} question={q} responses={inSession} />)}
            </View>
          ) : null}
        </View>
      )}

      <RespondentDialog
        respondent={openIndex >= 0 ? filtered[openIndex] : null}
        onClose={() => setOpenId(null)}
        onPrev={openIndex > 0 ? () => setOpenId(filtered[openIndex - 1].id) : null}
        onNext={openIndex >= 0 && openIndex < filtered.length - 1 ? () => setOpenId(filtered[openIndex + 1].id) : null}
        position={openIndex >= 0 ? { index: openIndex, total: filtered.length } : null}
      />
      <GoogleSyncDialog diff={diff} busy={applying} onCancel={() => setDiff(null)} onKeepLocal={() => apply("keep-local")} onSyncFromOnline={() => apply("sync-from-online")} />

      <Dialog
        visible={showExport}
        title="Export responses"
        onClose={() => setShowExport(false)}
        footer={<><Button label="Cancel" variant="ghost" onPress={() => setShowExport(false)} /><Button label={exporting === "pdf" ? "Exporting…" : "Export as PDF"} disabled={!!exporting || !canExportResponses} onPress={() => runExport("pdf")} /><Button label={exporting === "excel" ? "Exporting…" : "Export as Excel"} variant="primary" disabled={!!exporting || !canExportResponses} onPress={() => runExport("excel")} /></>}
      >
        <Text tone="secondary">{`Export ${inSession.length} response${inSession.length === 1 ? "" : "s"}${sessionFilter === "all" ? " across every session" : ` from "${selectedName}"`}.`}</Text>
        {!canExportResponses ? <Notice tone="warning">Exporting is available in the web and desktop apps.</Notice> : null}
        {exportError ? <Notice tone="danger">{exportError}</Notice> : null}
      </Dialog>
    </Page>
  );
}
