import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { Maximize2 } from "lucide-react-native";
import { responsesApi } from "../../src/features/responses/services/responsesApi";
import { getDeviceId } from "../../src/features/responses/utils/deviceId";
import { groupIntoPages } from "../../src/features/responses/utils/groupIntoPages";
import { shufflePages } from "../../src/features/responses/utils/shuffle";
import { formatClock, secondsRemaining } from "../../src/features/sessions/utils/time";
import { getMatrixMissingRows, isMatrixQuestion, matrixRequiredMessage } from "../../src/lib/matrixQuestions";
import { Button, ConfirmDialog, Spinner, Text, space, useLayout, useTheme } from "../../ui";
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

const NAME_KEY = "stonearch_respondent_name";
const ANSWERS_PREFIX = "stonearch_respondent_answers_";

type Answers = Record<string, unknown>;
interface JoinPayload {
  responseId: string; status?: string; session: { refocusLockSeconds?: number; fullscreenEnabled?: boolean } & DoneResult["session"];
  refocusLockedUntil?: string | null; form: { title: string; description: string; bannerImage?: string | null; questions: Question[]; settings?: { blurOnDisconnect?: boolean; restrictCopying?: boolean; shuffleQuestions?: boolean } };
  deadlineAt?: string | null; answers?: Answers;
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
function loadDraft(responseId: string): { answers: Answers; pageIndex: number } {
  try {
    const raw = getItem(ANSWERS_PREFIX + responseId);
    if (!raw) return { answers: {}, pageIndex: 0 };
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && "answers" in parsed) return { answers: parsed.answers || {}, pageIndex: parsed.pageIndex || 0 };
    return { answers: parsed || {}, pageIndex: 0 };
  } catch {
    return { answers: {}, pageIndex: 0 };
  }
}
const saveDraft = (id: string, answers: Answers, pageIndex: number) => setItem(ANSWERS_PREFIX + id, JSON.stringify({ answers, pageIndex }));
const clearDraft = (id: string) => removeItem(ANSWERS_PREFIX + id);

export function RespondScreen({ code }: { code: string }) {
  const router = useRouter();
  const { colors } = useTheme();
  const { isPhone } = useLayout();
  const fullscreen = useFullscreen();

  const [status, setStatus] = useState<"loading" | "not-found" | "join" | "answering" | "done">("loading");
  const [info, setInfo] = useState<SessionInfo | null>(null);
  const [meta, setMeta] = useState<JoinPayload["session"] | null>(null);
  const [name, setName] = useState(() => getItem(NAME_KEY) || "");
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
  const pages = useMemo(() => {
    const grouped = groupIntoPages(form ? form.questions : []) as Page[];
    return shuffle ? (shufflePages(grouped, responseId) as Page[]) : grouped;
  }, [form, shuffle, responseId]);

  const loadInfo = useCallback(() => {
    responsesApi.getSessionByCode(code).then((i: SessionInfo) => { setInfo(i); setStatus((p) => (p === "loading" ? "join" : p)); }).catch(() => setStatus("not-found"));
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
    const draft = loadDraft(p.responseId);
    const has = Object.keys(draft.answers).length > 0;
    setAnswers(has ? draft.answers : p.answers || {});
    setPageIndex(has ? draft.pageIndex : 0);
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
    join({ name: name.trim() }, setJoining, setJoinError, () => setItem(NAME_KEY, name.trim()));
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

  useEffect(() => {
    if (status === "answering" && responseId) saveDraft(responseId, answers, pageIndex);
  }, [status, responseId, answers, pageIndex]);

  // After a validation failure jumps to an earlier page, scroll to the offending field once that page has rendered.
  useEffect(() => {
    if (!scrollToId || Platform.OS !== "web") return;
    const id = scrollToId;
    setScrollToId(null);
    requestAnimationFrame(() => document.getElementById(`answer-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }, [scrollToId, pageIndex]);

  const submit = async ({ timedOut = false } = {}) => {
    setSubmitState("submitting");
    setSubmitError(null);
    try {
      const res = await responsesApi.submit(responseId, { answers, timedOut, deviceId: getDeviceId() });
      clearDraft(responseId!);
      setResult(res);
      setAutoSubmitted(timedOut);
      setStatus("done");
      fullscreen.exit();
    } catch (e) {
      const err = e as ApiError;
      setSubmitState("error");
      if (err.status === 400 && err.body?.missingQuestionIds) {
        setFieldErrors(Object.fromEntries(err.body.missingQuestionIds.map((id) => [id, requiredMessage(byId[id])])));
        setSubmitError("Some required questions are missing an answer.");
      } else setSubmitError(err.message);
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

  // Safety net for untimed responses: notice the host ending the session while this respondent is still answering.
  useEffect(() => {
    if (status !== "answering" || !responseId || deadlineAt) return;
    const t = setInterval(() => {
      responsesApi.getResponse(responseId, getDeviceId()).then((p: JoinPayload) => {
        if (p.session.status === "ended" && submitStateRef.current === "idle") submitRef.current({ timedOut: true });
      }).catch(() => {});
    }, 8000);
    return () => clearInterval(t);
  }, [status, responseId, deadlineAt]);

  const setAnswer = useCallback((id: string, value: unknown) => {
    setAnswers((p) => ({ ...p, [id]: value }));
    setFieldErrors((p) => (p[id] ? { ...p, [id]: undefined } : p));
  }, []);

  // "Next" validates only the page being looked at, same batching Google Forms uses.
  const next = () => {
    const missing = (pages[pageIndex]?.questions || []).filter((q) => q.required && isEmpty(q, answers[q.id]));
    if (missing.length) {
      setFieldErrors((p) => ({ ...p, ...Object.fromEntries(missing.map((q) => [q.id, requiredMessage(q)])) }));
      setScrollToId(missing[0].id);
      return;
    }
    setPageIndex((i) => Math.min(pages.length - 1, i + 1));
  };

  // The authoritative last check before submitting: covers someone who went back and cleared an answer.
  const submitClick = () => {
    const missing = answerable.filter((q) => q.required && isEmpty(q, answers[q.id]));
    if (missing.length) {
      setFieldErrors(Object.fromEntries(missing.map((q) => [q.id, requiredMessage(q)])));
      const target = pages.findIndex((p) => p.questions.some((q) => q.id === missing[0].id));
      if (target !== -1) setPageIndex(target);
      setScrollToId(missing[0].id);
      return;
    }
    submit();
  };

  const leave = () => { fullscreen.exit(); router.replace("/"); };

  // Per-form "blur on disconnect": only relevant where the server is needed (join screen and answering).
  const guardEnabled = !!(form?.settings?.blurOnDisconnect ?? info?.blurOnDisconnect) && (status === "join" || status === "answering");
  const online = useServerConnection(guardEnabled);
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

  if (status === "join" && info) {
    return (
      <View style={{ flex: 1 }}>
        <View ref={columnRef} style={{ flex: 1 }}>
          <JoinView
            info={info} name={name} onName={setName} joining={joining} error={joinError} onJoin={handleJoin} onLeave={() => router.replace("/")}
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
        reopening={reopening}
        reopenError={reopenError}
      />
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View ref={columnRef} style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: isPhone ? space[3] : space[5], height: 48, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <Button label="Leave" variant="ghost" compact style={{ alignSelf: "center" }} onPress={() => (status === "answering" ? setConfirmExit(true) : leave())} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
            {fullscreen.supported ? <Button label={fullscreen.isFullscreen ? "Exit fullscreen" : "Fullscreen"} icon={Maximize2} variant="ghost" compact style={{ alignSelf: "center" }} onPress={fullscreen.toggle} /> : null}
            {secondsLeft !== null ? (
              <View accessibilityRole="timer" style={{ paddingHorizontal: space[3], paddingVertical: 4, borderRadius: 999, backgroundColor: secondsLeft <= 60 ? colors.dangerSoft : colors.surfaceMuted }}>
                <Text variant="label" tone={secondsLeft <= 60 ? "danger" : "default"} style={{ fontVariant: ["tabular-nums"] }}>{formatClock(secondsLeft)}</Text>
              </View>
            ) : null}
          </View>
        </View>
        <ScrollView contentContainerStyle={{ alignItems: "center" }} keyboardShouldPersistTaps="handled">
          <View style={{ width: "100%", maxWidth: 680, padding: isPhone ? space[4] : space[5] }}>
            {answerable.length === 0 || !form ? (
              <Text tone="secondary" align="center">This form doesn't have any questions yet.</Text>
            ) : (
              <QuestionPager
                pages={pages}
                currentPageIndex={pageIndex}
                answers={answers}
                onAnswerChange={setAnswer}
                fieldErrors={fieldErrors}
                onBack={() => setPageIndex((i) => Math.max(0, i - 1))}
                onNext={next}
                isLastPage={pageIndex === pages.length - 1}
                onSubmit={submitClick}
                submitting={submitState === "submitting"}
                formTitle={form.title}
                formDescription={form.description}
                bannerImage={form.bannerImage}
                footerNotice={submitError ? <Text variant="small" tone="danger" accessibilityRole="alert">{submitError}</Text> : null}
              />
            )}
          </View>
        </ScrollView>
      </View>

      <ConfirmDialog visible={confirmExit} title="Leave quiz?" message="Your progress may be lost if you leave before submitting." confirmLabel="Leave" destructive={false} onCancel={() => setConfirmExit(false)} onConfirm={leave} />
      {blocked ? <ConnectionOverlay /> : null}
      {!blocked && refocusCountdown > 0 ? <RefocusLockOverlay secondsLeft={refocusCountdown} /> : null}
      {needsGate ? <FullscreenGateOverlay onEnter={fullscreen.toggle} /> : null}
    </View>
  );
}
