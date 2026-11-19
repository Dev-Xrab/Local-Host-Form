import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { Maximize2 } from "lucide-react-native";
import { responsesApi } from "../../src/features/responses/services/responsesApi";
import { getDeviceId } from "../../src/features/responses/utils/deviceId";
import { groupIntoPages } from "../../src/features/responses/utils/groupIntoPages";
import { shufflePages } from "../../src/features/responses/utils/shuffle";
import { SUBMIT, computePath, nextPage, questionsOnPath } from "../../src/lib/sectionFlow";
import { secondsRemaining } from "../../src/features/sessions/utils/time";
import { getMatrixMissingRows, isMatrixQuestion, matrixRequiredMessage } from "../../src/lib/matrixQuestions";
import { ConfirmDialog, Spinner, Text, space, useLayout } from "../../ui";
import { GButton, GCard, GText, useGF } from "../../ui/gforms";
import type { Question } from "../../lib/formStore";
import { downloadAnswers } from "../../lib/downloadAnswers";
import { getItem, removeItem, setItem } from "../../lib/storage";
import { QuestionPager, type Page } from "./QuestionPager";
import { ConnectionOverlay, FullscreenGateOverlay, RefocusLockOverlay } from "./Overlays";
import { DoneView, JoinView, Message, type DoneResult, type SessionInfo } from "./RespondViews";
import { useCopyProtection } from "./hooks/useCopyProtection";
import { useFullscreen } from "./hooks/useFullscreen";
import { useInert } from "./hooks/useInert";
import { useServerConnection } from "./hooks/useServerConnection";
import { useTabHidden } from "./hooks/useTabHidden";
import { RespondentTopBar } from "./RespondentFrame";

const NAME_KEY = "stonearch_respondent_name";
const EMAIL_KEY = "stonearch_respondent_email";
const ANSWERS_PREFIX = "stonearch_respondent_answers_";

type Answers = Record<string, unknown>;
interface JoinPayload {
  responseId: string; status?: string; session: { refocusLockSeconds?: number; fullscreenEnabled?: boolean } & DoneResult["session"];
  refocusLockedUntil?: string | null; form: { title: string; description: string; bannerImage?: string | null; questions: Question[]; settings?: { blurOnDisconnect?: boolean; restrictCopying?: boolean; shuffleQuestions?: boolean; showProgressBar?: boolean; disableAutosave?: boolean } };
  deadlineAt?: string | null; answers?: Answers; definitionId?: string | null;
}
type ApiError = Error & { status?: number; body?: { missingQuestionIds?: string[] } };

const isEmpty = (q: Question, value: unknown) => {
  if (value === undefined || value === null) return true;
  if (q.type === "checkboxes") return !Array.isArray(value) || value.length === 0;
  if (isMatrixQuestion(q.type)) return (getMatrixMissingRows(q, value) as unknown[]).length > 0;
  return String(value).trim() === "";
};
const requiredMessage = (q?: Question) => (q && isMatrixQuestion(q.type) ? matrixRequiredMessage(q) : "This question is required.");

// In-progress answers (and the page the respondent was on) are mirrored to storage under the
// response's own id, so a refresh mid-quiz restores exactly where they left off. Older entries
// (from before paging) are just the flat answers object; duck-typed so those still resume.
// `history` is the pages visited before the current one: with section links the way back isn't
// simply "the previous page". Older drafts lack it and get it rebuilt from the answers.
function loadDraft(responseId: string): { answers: Answers; pageIndex: number; history?: number[]; pageId?: string; historyIds?: string[] } {
  try {
    const raw = getItem(ANSWERS_PREFIX + responseId);
    if (!raw) return { answers: {}, pageIndex: 0 };
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && "answers" in parsed) return { answers: parsed.answers || {}, pageIndex: parsed.pageIndex || 0, history: Array.isArray(parsed.history) ? parsed.history : undefined, pageId: typeof parsed.pageId === "string" ? parsed.pageId : undefined, historyIds: Array.isArray(parsed.historyIds) ? parsed.historyIds : undefined };
    return { answers: parsed || {}, pageIndex: 0 };
  } catch {
    return { answers: {}, pageIndex: 0 };
  }
}
// The pages walked through before reaching `page`, according to `path`.
const historyBefore = (path: number[], page: number) => { const k = path.indexOf(page); return k > 0 ? path.slice(0, k) : []; };
// Pages are also saved by id: the host may add or remove a section between visits, and an index alone
// would then point at a different page (or past the end).
const saveDraft = (id: string, answers: Answers, pageIndex: number, history: number[], pages: Page[]) => setItem(ANSWERS_PREFIX + id, JSON.stringify({ answers, pageIndex, history, pageId: pages[pageIndex]?.id, historyIds: history.map((i) => pages[i]?.id) }));
const clearDraft = (id: string) => removeItem(ANSWERS_PREFIX + id);

export function RespondScreen({ code }: { code: string }) {
  const router = useRouter();
  const g = useGF();
  const { isPhone } = useLayout();
  const fullscreen = useFullscreen();

  const [status, setStatus] = useState<"loading" | "not-found" | "unavailable" | "join" | "answering" | "done">("loading");
  const [info, setInfo] = useState<SessionInfo | null>(null);
  const [meta, setMeta] = useState<JoinPayload["session"] | null>(null);
  const [name, setName] = useState(() => getItem(NAME_KEY) || "");
  const [email, setEmail] = useState(() => getItem(EMAIL_KEY) || "");
  const [another, setAnother] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editCode, setEditCode] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [reopenError, setReopenError] = useState<string | null>(null);

  const [responseId, setResponseId] = useState<string | null>(null);
  const [form, setForm] = useState<JoinPayload["form"] | null>(null);
  const [deadlineAt, setDeadlineAt] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});
  const [pageIndex, setPageIndex] = useState(0);
  const [history, setHistory] = useState<number[]>([]);
  const [definitionId, setDefinitionId] = useState<string | null>(null);
  const [formUpdated, setFormUpdated] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [scrollToId, setScrollToId] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<"idle" | "submitting" | "error">("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<DoneResult | null>(null);
  const [autoSubmitted, setAutoSubmitted] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const submitStateRef = useRef(submitState);
  useEffect(() => { submitStateRef.current = submitState; }, [submitState]);

  const answerable = useMemo(() => (form ? form.questions.filter((q) => q.type !== "section") : []), [form]);
  const byId = useMemo(() => Object.fromEntries(answerable.map((q) => [q.id, q])), [answerable]);
  const shuffle = !!form?.settings?.shuffleQuestions && !!responseId;
  // The flow (which page follows which) always runs on the form's own order; only what a page shows is shuffled.
  const flowPages = useMemo(() => groupIntoPages(form ? form.questions : []) as Page[], [form]);
  const pages = useMemo(() => (shuffle ? (shufflePages(flowPages, responseId) as Page[]) : flowPages), [flowPages, shuffle, responseId]);
  const path = useMemo(() => computePath(flowPages, answers) as number[], [flowPages, answers]);
  const target = useMemo(() => nextPage(flowPages, pageIndex, answers) as number | typeof SUBMIT, [flowPages, pageIndex, answers]);
  const step = history.length + 1;
  const total = Math.max(path.length, step);

  const loadInfo = useCallback(() => {
    responsesApi.getSessionByCode(code).then((i: SessionInfo) => { setInfo(i); setStatus((p) => (p === "loading" || p === "unavailable" ? "join" : p)); }).catch((err: ApiError) => setStatus(err.status === 404 ? "not-found" : "unavailable"));
  }, [code]);

  const [refocusUntil, setRefocusUntil] = useState<number | null>(null);
  const [refocusCountdown, setRefocusCountdown] = useState(0);

  const applyJoin = useCallback((p: JoinPayload) => {
    setResponseId(p.responseId);
    // Carries session-level settings that stay relevant once answering is reached, including on a
    // silent same-device resume that never touches `info`.
    setMeta(p.session);
    // Anchored to the server-held timestamp from when this tab last went hidden, so a reload during
    // the countdown can't skip the rest of it.
    setRefocusUntil(p.refocusLockedUntil ? new Date(p.refocusLockedUntil).getTime() : null);
    if (p.status === "submitted") {
      clearDraft(p.responseId);
      setResult(p as unknown as DoneResult);
      setStatus("done");
      return;
    }
    setForm(p.form);
    setDeadlineAt(p.deadlineAt ?? null);
    // A local draft (this device, still mid-attempt) wins; otherwise use what the server has, which
    // is the case when editing a submitted response, possibly from another device.
    // With autosave off for this form, nothing was ever kept on the device, so there is nothing to restore.
    const draft = p.form.settings?.disableAutosave ? { answers: {}, pageIndex: 0 } as ReturnType<typeof loadDraft> : loadDraft(p.responseId);
    const has = Object.keys(draft.answers).length > 0;
    setAnswers(has ? draft.answers : p.answers || {});
    const nowPages = groupIntoPages(p.form.questions) as Page[];
    const indexOfId = (id?: string) => (id ? nowPages.findIndex((pg) => pg.id === id) : -1);
    let startPage = has ? (draft.pageId ? indexOfId(draft.pageId) : draft.pageIndex) : 0;
    if (startPage < 0 || startPage >= nowPages.length) startPage = 0;
    setPageIndex(startPage);
    setHistory(!has ? [] : draft.historyIds
      ? draft.historyIds.map(indexOfId).filter((i) => i >= 0)
      : (draft.history ?? historyBefore(computePath(nowPages, draft.answers) as number[], startPage)).filter((i) => i < nowPages.length));
    setDefinitionId(p.definitionId ?? null);
    setFormUpdated(false);
    setReviewing(false);
    // A response reopened for editing starts clean. Without this, the "submitting" state left over
    // from the earlier submit kept the Submit button spinning and disabled.
    setSubmitState("idle");
    setSubmitError(null);
    setFieldErrors({});
    setStatus("answering");
  }, []);

  // Before asking for a name, try a silent resume: this device may already have a response for this
  // session (joined via the combined sign-in screen, or from an earlier visit to this link).
  useEffect(() => {
    let cancelled = false;
    responsesApi.join(code, { deviceId: getDeviceId() }).then((p: JoinPayload) => { if (!cancelled) applyJoin(p); }).catch(() => { if (!cancelled) loadInfo(); });
    return () => { cancelled = true; };
  }, [code, applyJoin, loadInfo]);

  // While waiting on a session that hasn't started, poll so the join screen unlocks the moment the host starts it.
  useEffect(() => {
    if (status !== "join" || info?.status !== "draft") return;
    const t = setInterval(loadInfo, 4000);
    return () => clearInterval(t);
  }, [status, info?.status, loadInfo]);

  const join = async (payload: Record<string, unknown>, setBusy: (b: boolean) => void, setErr: (e: string | null) => void, afterOk?: () => void) => {
    setBusy(true);
    setErr(null);
    try {
      applyJoin(await responsesApi.join(code, { ...payload, deviceId: getDeviceId() }));
      afterOk?.();
    } catch (err) {
      setErr((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // Must run synchronously inside the click, before any await: the browser only honors a fullscreen request from a user gesture.
  const handleJoin = () => {
    if (info?.fullscreenEnabled) fullscreen.enter();
    join({ name: name.trim(), email: email.trim() }, setJoining, setJoinError, () => { setItem(NAME_KEY, name.trim()); if (email.trim()) setItem(EMAIL_KEY, email.trim()); });
  };
  const handleEditCode = () => {
    if (info?.fullscreenEnabled) fullscreen.enter();
    join({ editCode: editCode.trim() }, setSubmittingEdit, setEditError);
  };
  const handleEditFromDone = async () => {
    if (result?.session?.fullscreenEnabled) fullscreen.enter();
    setReopening(true);
    setReopenError(null);
    try {
      applyJoin(await responsesApi.editResponse(responseId, getDeviceId()));
    } catch (err) {
      setReopenError((err as Error).message);
    } finally {
      setReopening(false);
    }
  };

  // "Submit another response": starts a fresh attempt for the same person on this device.
  const handleAnother = async () => {
    setAnother(true);
    try {
      const fresh = await responsesApi.join(code, { name: name.trim(), email: email.trim(), deviceId: getDeviceId() });
      clearDraft(responseId!);
      setResult(null);
      setAutoSubmitted(false);
      applyJoin(fresh);
    } catch (err) {
      setReopenError((err as Error).message);
      setStatus("done");
    } finally {
      setAnother(false);
    }
  };

  useEffect(() => {
    if (status === "answering" && responseId && !form?.settings?.disableAutosave) saveDraft(responseId, answers, pageIndex, history, flowPages);
  }, [status, responseId, answers, pageIndex, history, flowPages, form?.settings?.disableAutosave]);

  // After a validation failure jumps to an earlier page, scroll to the offending field once that page has rendered.
  useEffect(() => {
    if (!scrollToId || Platform.OS !== "web") return;
    const id = scrollToId;
    setScrollToId(null);
    requestAnimationFrame(() => { const el = document.getElementById(`answer-${id}`); el?.scrollIntoView({ behavior: "smooth", block: "center" }); el?.setAttribute("tabindex", "-1"); el?.focus(); });
  }, [scrollToId, pageIndex]);

  const submit = async ({ timedOut = false } = {}) => {
    if (submitStateRef.current === "submitting") return;
    const retrying = submitStateRef.current === "error";
    submitStateRef.current = "submitting";
    setSubmitState("submitting");
    setSubmitError(null);
    try {
      // A previous request may have reached the host even if its acknowledgment was lost.
      if (retrying && responseId) {
        const current = await responsesApi.getResponse(responseId, getDeviceId()) as JoinPayload;
        if (current.status === "submitted") {
          clearDraft(responseId);
          setResult(current as unknown as DoneResult);
          setSubmitState("idle");
          setStatus("done");
          fullscreen.exit();
          return;
        }
      }
      const res = await responsesApi.submit(responseId, { answers, timedOut, deviceId: getDeviceId() });
      clearDraft(responseId!);
      setResult(res);
      setAutoSubmitted(timedOut);
      setSubmitState("idle");
      setStatus("done");
      fullscreen.exit();
    } catch (e) {
      const err = e as ApiError;
      if (!err.status || err.status === 409) {
        try {
          const current = await responsesApi.getResponse(responseId, getDeviceId()) as JoinPayload;
          if (current.status === "submitted") {
            clearDraft(responseId!);
            setResult(current as unknown as DoneResult);
            setSubmitState("idle");
            setStatus("done");
            fullscreen.exit();
            return;
          }
        } catch { /* Keep the local draft and offer retry. */ }
      }
      setSubmitState("error");
      if (err.status === 400 && err.body?.missingQuestionIds) {
        setFieldErrors(Object.fromEntries(err.body.missingQuestionIds.map((id) => [id, requiredMessage(byId[id])])));
        setSubmitError("Some required questions are missing an answer.");
      } else setSubmitError(err.status ? err.message : "Could not confirm submission with the host. Your answers remain on this device. Reconnect and try Submit again.");
    } finally {
      submitStateRef.current = "idle";
    }
  };
  const submitRef = useRef(submit);
  useEffect(() => { submitRef.current = submit; });

  // The timer is always derived from THIS respondent's server-provided deadline, never a locally
  // stored duration, so it stays correct across refresh and can't be tampered with client-side.
  useEffect(() => {
    if (status !== "answering" || !deadlineAt) return;
    const tick = () => {
      const remaining = secondsRemaining(deadlineAt) ?? 0;
      setSecondsLeft(remaining);
      if (remaining <= 0 && (submitStateRef.current === "idle" || submitStateRef.current === "error")) submitRef.current({ timedOut: true });
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [status, deadlineAt]);

  // The host may edit the form while someone is answering. Keep what they've typed, swap in the new
  // questions, and put them back on the same page (by id) if it still exists.
  const live = useRef({ flowPages, pageIndex, history, definitionId });
  useEffect(() => { live.current = { flowPages, pageIndex, history, definitionId }; });
  const applyUpdatedForm = useCallback((p: JoinPayload) => {
    const { flowPages: before, pageIndex: at, history: trail } = live.current;
    const after = groupIntoPages(p.form.questions) as Page[];
    const remap = (i: number) => { const id = before[i]?.id; return id ? after.findIndex((pg) => pg.id === id) : -1; };
    const moved = remap(at);
    setForm(p.form);
    setPageIndex(moved >= 0 ? moved : 0);
    setHistory(moved >= 0 ? trail.map(remap).filter((i) => i >= 0) : []);
    setDefinitionId(p.definitionId ?? null);
    setFieldErrors({});
    setFormUpdated(true);
  }, []);

  // Polls while answering: notices the host ending an untimed session, and edits to the form.
  useEffect(() => {
    if (status !== "answering" || !responseId) return;
    const t = setInterval(() => {
      responsesApi.getResponse(responseId, getDeviceId()).then((p: JoinPayload) => {
        if (submitStateRef.current !== "idle") return;
        if (!deadlineAt && p.session.status === "ended") submitRef.current({ timedOut: true });
        else if (p.status === "in_progress" && p.definitionId && p.definitionId !== live.current.definitionId) applyUpdatedForm(p);
      }).catch(() => {});
    }, 8000);
    return () => clearInterval(t);
  }, [status, responseId, deadlineAt, applyUpdatedForm]);

  const setAnswer = useCallback((id: string, value: unknown) => {
    setAnswers((p) => ({ ...p, [id]: value }));
    setFieldErrors((p) => (p[id] ? { ...p, [id]: undefined } : p));
    setSubmitError(null);
  }, []);

  // Jumps straight to a page (review "Edit", a failed validation), keeping Back consistent with the path to it.
  const goToPage = (i: number) => { setHistory(historyBefore(path, i)); setPageIndex(i); };

  // "Next" validates only the page being looked at, same batching Google Forms uses.
  const next = () => {
    const missing = (pages[pageIndex]?.questions || []).filter((q) => q.required && isEmpty(q, answers[q.id]));
    if (missing.length) {
      setFieldErrors((p) => ({ ...p, ...Object.fromEntries(missing.map((q) => [q.id, requiredMessage(q)])) }));
      setSubmitError(`${missing.length} required ${missing.length === 1 ? "question needs" : "questions need"} an answer before you continue.`);
      setScrollToId(missing[0].id);
      return;
    }
    if (target === SUBMIT) { submitClick(); return; }
    setHistory((h) => [...h, pageIndex]);
    setPageIndex(target);
  };
  const back = () => {
    if (!history.length) return;
    setPageIndex(history[history.length - 1]);
    setHistory(history.slice(0, -1));
  };

  // The authoritative last check before submitting: covers someone who went back and cleared an answer.
  // Only questions on the path the answers lead through count; sections that were skipped are not required.
  const submitClick = () => {
    const missing = (questionsOnPath(flowPages, answers) as Question[]).filter((q) => q.required && isEmpty(q, answers[q.id]));
    if (missing.length) {
      setFieldErrors(Object.fromEntries(missing.map((q) => [q.id, requiredMessage(q)])));
      setSubmitError(`${missing.length} required ${missing.length === 1 ? "question needs" : "questions need"} an answer before submission.`);
      const found = pages.findIndex((p) => p.questions.some((q) => q.id === missing[0].id));
      if (found !== -1) goToPage(found);
      setReviewing(false);
      setScrollToId(missing[0].id);
      return;
    }
    if (meta?.responsesEditable && !reviewing) { setReviewing(true); return; }
    submit();
  };

  const leave = () => { fullscreen.exit(); router.replace("/"); };

  // Per-form "blur on disconnect": only relevant where the server is needed (join screen and answering).
  const guardEnabled = !!(form?.settings?.blurOnDisconnect ?? info?.blurOnDisconnect) && (status === "join" || status === "answering");
  const online = useServerConnection(status === "join" || status === "answering");
  const blocked = guardEnabled && !online;

  // Session setting: a countdown after switching away from the tab and back. A viewing delay only;
  // it does not pause or extend the quiz deadline.
  const lockSeconds = meta?.refocusLockSeconds || 0;
  const onHidden = useCallback(() => {
    setRefocusUntil(Date.now() + lockSeconds * 1000);
    responsesApi.startRefocusLock(responseId, getDeviceId()).catch(() => {});
  }, [lockSeconds, responseId]);
  useTabHidden(status === "answering" && lockSeconds > 0 && !!responseId, onHidden);

  useEffect(() => {
    if (!refocusUntil) { setRefocusCountdown(0); return; }
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((refocusUntil - Date.now()) / 1000));
      setRefocusCountdown(remaining);
      if (remaining <= 0) setRefocusUntil(null);
    };
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [refocusUntil]);

  // Session setting: the answering screen must stay fullscreen. Reactive to the real state, so a
  // reload or Esc lands back on this gate rather than silently continuing without it.
  const needsGate = status === "answering" && !!meta?.fullscreenEnabled && fullscreen.supported && !fullscreen.isFullscreen && !blocked && refocusCountdown <= 0;

  useCopyProtection(!!(form?.settings?.restrictCopying ?? info?.restrictCopying) && status !== "loading" && status !== "not-found");

  const columnRef = useRef<View>(null);
  useInert(columnRef, blocked || refocusCountdown > 0 || needsGate);

  if (status === "loading") return <Spinner label="Loading" fill />;
  if (status === "not-found") return <Message tone="danger" text="That code isn't valid." />;
  if (status === "unavailable") return <View style={{ flex: 1, backgroundColor: g.canvas, alignItems: "center", justifyContent: "center", gap: space[3], padding: space[4] }}><GText size={22}>Cannot reach the host</GText><GText secondary style={{ textAlign: "center" }}>Check your connection to the host's network, then try again.</GText><GButton variant="filled" label="Retry" onPress={loadInfo} /></View>;

  if (status === "join" && info) {
    return (
      <View style={{ flex: 1 }}>
        <View ref={columnRef} style={{ flex: 1 }}>
          <JoinView
            info={info} name={name} onName={setName} email={email} onEmail={setEmail} joining={joining} error={joinError} onJoin={handleJoin} onLeave={() => router.replace("/")}
            showEdit={showEdit} onShowEdit={() => setShowEdit(true)} editCode={editCode} onEditCode={setEditCode} editError={editError} submittingEdit={submittingEdit} onSubmitEdit={handleEditCode}
          />
        </View>
        {blocked ? <ConnectionOverlay /> : null}
      </View>
    );
  }

  if (status === "done") {
    return (
      <DoneView
        result={result}
        autoSubmitted={autoSubmitted}
        titles={Object.fromEntries(answerable.map((q) => [q.id, q.title]))}
        onDone={() => router.replace("/")}
        downloading={downloading}
        onDownload={async () => {
          setDownloading(true);
          try {
            await downloadAnswers({ formTitle: result?.formTitle, respondentName: name.trim(), sessionName: result?.session?.name, submittedAt: new Date(), score: result?.score, maxScore: result?.maxScore, answers: result?.answers });
          } finally {
            setDownloading(false);
          }
        }}
        onEdit={handleEditFromDone}
        onAnother={handleAnother}
        anotherBusy={another}
        reopening={reopening}
        reopenError={reopenError}
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: g.canvas }}>
      <View ref={columnRef} style={{ flex: 1 }}>
        <RespondentTopBar title={form?.title || "Form"} step={reviewing ? total + 1 : step} total={total + (meta?.responsesEditable ? 1 : 0)} secondsLeft={secondsLeft} showProgress={form?.settings?.showProgressBar !== false} saveLabel={submitState === "submitting" ? "Submitting…" : form?.settings?.disableAutosave ? "Autosave is off" : "Saved on this device"} onLeave={() => setConfirmExit(true)} extra={fullscreen.supported && !isPhone ? <GButton label={fullscreen.isFullscreen ? "Exit fullscreen" : "Fullscreen"} icon={<Maximize2 size={14} color={g.accent} />} onPress={fullscreen.toggle} /> : null} />
        <ScrollView contentContainerStyle={{ alignItems: "center" }} keyboardShouldPersistTaps="handled">
          <View style={{ width: "100%", maxWidth: 640, padding: isPhone ? 12 : 16 }}>
            {formUpdated ? <View accessibilityRole="alert" style={{ padding: 12, marginBottom: 12, backgroundColor: g.accentSoft, borderRadius: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}><GText size={13} style={{ flex: 1 }}>The host updated this form. Your answers are kept.</GText><GButton label="Dismiss" onPress={() => setFormUpdated(false)} /></View> : null}
            {!online ? <View accessibilityRole="alert" style={{ padding: 12, marginBottom: 12, backgroundColor: g.errorSoft, borderRadius: 8 }}><GText size={13} color={g.error}>Connection lost. Answers remain on this device. Reconnecting…</GText></View> : null}
            {answerable.length === 0 || !form ? (
              <GText secondary style={{ textAlign: "center" }}>This form doesn't have any questions yet.</GText>
            ) : reviewing ? (
              <View style={{ gap: 12 }}>
                <GCard accent><View style={{ padding: 24, gap: 8 }}><GText size={28} accessibilityRole="header">Review your response</GText><GText secondary>Check your answers before sending them to the host.</GText></View></GCard>
                {path.map((i) => { const pg = pages[i]; return <View key={pg.id} style={{ backgroundColor: g.card, borderWidth: 1, borderColor: g.border, borderRadius: 8, padding: 24, gap: 12 }}><GText size={16} weight="500">{pg.title || `Section ${i + 1}`}</GText>{pg.questions.map((q) => { const miss = q.required && isEmpty(q, answers[q.id]); return <View key={q.id} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}><View style={{ flex: 1 }}><GText size={14}>{q.title || "Untitled question"}</GText><GText size={12} color={miss ? g.error : g.textSecondary}>{isEmpty(q, answers[q.id]) ? q.required ? "Required answer missing" : "No answer" : "Answered"}</GText></View><GButton label="Edit" onPress={() => { goToPage(i); setReviewing(false); setScrollToId(q.id); }} /></View>; })}</View>; })}
                {submitError ? <GText size={12} color={g.error} accessibilityRole="alert">{submitError}</GText> : null}
                <View style={{ flexDirection: "row", gap: 8, paddingBottom: 24 }}><GButton variant="outlined" label="Back" onPress={() => setReviewing(false)} /><GButton variant="filled" label="Submit response" loading={submitState === "submitting"} onPress={submitClick} /></View>
              </View>
            ) : (
              <QuestionPager
                pages={pages}
                currentPageIndex={pageIndex}
                answers={answers}
                onAnswerChange={setAnswer}
                fieldErrors={fieldErrors}
                onBack={back}
                onNext={next}
                isLastPage={target === SUBMIT}
                canGoBack={history.length > 0}
                showProgress={form.settings?.showProgressBar !== false}
                step={step}
                total={total}
                onSubmit={submitClick}
                onClear={() => { setAnswers((prev) => { const next = { ...prev }; for (const q of pages[pageIndex]?.questions || []) delete next[q.id]; return next; }); setFieldErrors({}); setSubmitError(null); }}
                submitting={submitState === "submitting"}
                formTitle={form.title}
                formDescription={form.description}
                bannerImage={form.bannerImage}
                footerNotice={submitState === "submitting" ? <GText size={13} secondary accessibilityLiveRegion="polite">Submitting… Waiting for the host to confirm your response.</GText> : submitError ? <View accessibilityRole="alert" style={{ padding: 16, backgroundColor: g.errorSoft, borderWidth: 1, borderColor: g.error, borderRadius: 8, gap: 4 }}><GText size={14} weight="500" color={g.error}>{submitError}</GText>{Object.entries(fieldErrors).filter(([, message]) => !!message).map(([id]) => <GButton key={id} label={byId[id]?.title || "Go to required question"} onPress={() => { const found = pages.findIndex((pg) => pg.questions.some((q) => q.id === id)); if (found >= 0) goToPage(found); setReviewing(false); setScrollToId(id); }} />)}</View> : null}
              />
            )}
          </View>
        </ScrollView>
      </View>

      <ConfirmDialog visible={confirmExit} title="Leave this form?" message="Your progress may be lost if you leave before submitting." confirmLabel="Leave" destructive={false} onCancel={() => setConfirmExit(false)} onConfirm={leave} />
      {blocked ? <ConnectionOverlay /> : null}
      {!blocked && refocusCountdown > 0 ? <RefocusLockOverlay secondsLeft={refocusCountdown} /> : null}
      {needsGate ? <FullscreenGateOverlay onEnter={fullscreen.toggle} /> : null}
    </View>
  );
}
