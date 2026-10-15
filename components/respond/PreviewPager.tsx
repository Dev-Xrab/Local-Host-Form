import { useMemo, useState } from "react";
import { groupIntoPages } from "../../src/features/responses/utils/groupIntoPages";
import { Badge, Page, Text } from "../../ui";
import { useFormStore } from "../../lib/formStore";
import { QuestionPager, type Page as PageData } from "./QuestionPager";

/**
 * True respondent-facing preview for the builder's Preview mode: the exact QuestionPager a
 * respondent sees, fed from the live in-memory draft. Answers are local state only; nothing is
 * persisted and there is no submit call.
 */
export function PreviewPager() {
  const formTitle = useFormStore((s) => s.formTitle);
  const formDescription = useFormStore((s) => s.formDescription);
  const bannerImage = useFormStore((s) => s.bannerImage);
  const questions = useFormStore((s) => s.questions);

  const pages = useMemo(() => groupIntoPages(questions) as PageData[], [questions]);
  const [pageIndex, setPageIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const safe = Math.min(pageIndex, Math.max(pages.length - 1, 0));

  if (pages.length === 0 || pages.every((p) => p.questions.length === 0)) {
    return <Page maxWidth={680}><Text tone="secondary" align="center">Add a question to preview how respondents will see this form.</Text></Page>;
  }

  return (
    <Page maxWidth={680}>
      <Badge label="Preview: answers here aren't saved" tone="accent" />
      <QuestionPager
        pages={pages}
        currentPageIndex={safe}
        answers={answers}
        onAnswerChange={(id, v) => setAnswers((prev) => ({ ...prev, [id]: v }))}
        onBack={() => setPageIndex((i) => Math.max(0, i - 1))}
        onNext={() => setPageIndex((i) => Math.min(pages.length - 1, i + 1))}
        isLastPage={safe === pages.length - 1}
        onSubmit={() => {}}
        formTitle={formTitle}
        formDescription={formDescription}
        bannerImage={bannerImage}
      />
    </Page>
  );
}
