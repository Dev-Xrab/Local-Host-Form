import { useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import { groupIntoPages } from "../../src/features/responses/utils/groupIntoPages";
import { SUBMIT, computePath, nextPage } from "../../src/lib/sectionFlow";
import { useLayout } from "../../ui";
import { GText, useGF } from "../../ui/gforms";
import { useFormActions, useFormStore } from "../../lib/formStore";
import { QuestionPager, type Page as PageData } from "./QuestionPager";
import { RespondentTopBar } from "./RespondentFrame";

/**
 * True respondent-facing preview for the builder's Preview mode: the exact QuestionPager a
 * respondent sees, fed from the live in-memory draft. Answers are local state only; nothing is
 * persisted and there is no submit call.
 */
export function PreviewPager() {
  const g = useGF();
  const { isPhone } = useLayout();
  const { setMode } = useFormActions();
  const formTitle = useFormStore((s) => s.formTitle);
  const formDescription = useFormStore((s) => s.formDescription);
  const bannerImage = useFormStore((s) => s.bannerImage);
  const questions = useFormStore((s) => s.questions);
  const showProgress = useFormStore((s) => s.formSettings.showProgressBar !== false);

  const pages = useMemo(() => groupIntoPages(questions) as PageData[], [questions]);
  const [pageIndex, setPageIndex] = useState(0);
  const [history, setHistory] = useState<number[]>([]);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const safe = Math.min(pageIndex, Math.max(pages.length - 1, 0));
  // Same walk the respondent gets, so a form's section links can be tried out before it is shared.
  const target = nextPage(pages, safe, answers) as number | typeof SUBMIT;
  const step = history.length + 1;
  const total = Math.max((computePath(pages, answers) as number[]).length, step);

  if (pages.length === 0 || pages.every((p) => p.questions.length === 0)) {
    return <View style={{ flex: 1, backgroundColor: g.canvas }}><RespondentTopBar title={formTitle} step={1} total={1} saveLabel="Preview only" leaveLabel="Exit preview" onLeave={() => setMode("edit")} /><View style={{ padding: 24 }}><GText secondary style={{ textAlign: "center" }}>Add a question to preview how respondents will see this form.</GText></View></View>;
  }

  return (
    <View style={{ flex: 1, backgroundColor: g.canvas }}>
      <RespondentTopBar title={formTitle} step={step} total={total} showProgress={showProgress} saveLabel="Preview only" leaveLabel="Exit preview" onLeave={() => setMode("edit")} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ alignItems: "center" }}><View style={{ width: "100%", maxWidth: 640, padding: isPhone ? 12 : 16 }}>
      <QuestionPager
        pages={pages}
        currentPageIndex={safe}
        answers={answers}
        onAnswerChange={(id, v) => setAnswers((prev) => ({ ...prev, [id]: v }))}
        onBack={() => { if (history.length) { setPageIndex(history[history.length - 1]); setHistory(history.slice(0, -1)); } }}
        onNext={() => { if (target !== SUBMIT) { setHistory([...history, safe]); setPageIndex(target); } }}
        isLastPage={target === SUBMIT}
        canGoBack={history.length > 0}
        step={step}
        total={total}
        showProgress={showProgress}
        onSubmit={() => {}}
        onClear={() => setAnswers({})}
        formTitle={formTitle}
        formDescription={formDescription}
        bannerImage={bannerImage}
      />
      </View></ScrollView>
    </View>
  );
}
