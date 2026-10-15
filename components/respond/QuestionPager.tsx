import { memo, useMemo, type ReactNode } from "react";
import { Image, View } from "react-native";
import { Button, Surface, Text, space, useTheme } from "../../ui";
import type { Question } from "../../lib/formStore";
import { RESPONDENT_FIELDS } from "./fields";

export interface Page { id: string; title: string; description: string; questions: Question[] }

interface AnswerQuestionProps {
  question: Question;
  index: number;
  value: unknown;
  onChange: (v: unknown) => void;
  error?: string;
}

const AnswerQuestionImpl = ({ question, index, value, onChange, error }: AnswerQuestionProps) => {
  const Field = RESPONDENT_FIELDS[question.type];
  const { colors } = useTheme();
  return (
    <View nativeID={`answer-${question.id}`}>
      <Surface style={{ gap: space[3], borderColor: error ? colors.danger : colors.border }}>
        <View style={{ flexDirection: "row", gap: space[3] }}>
          <Text variant="label" tone="tertiary" style={{ minWidth: 20 }}>{index + 1}</Text>
          <Text variant="title" style={{ flex: 1 }} accessibilityRole="header">
            {question.title || "Untitled question"}
            {question.required ? <Text variant="title" tone="danger" accessibilityLabel="required"> *</Text> : null}
          </Text>
        </View>
        {question.description ? <Text tone="secondary">{question.description}</Text> : null}
        {question.imageUrl ? <Image source={{ uri: question.imageUrl }} accessibilityLabel="" resizeMode="contain" style={{ width: "100%", height: 220 }} /> : null}
        {Field ? <Field question={question} value={value} onChange={onChange} error={error} /> : null}
        {error ? <Text variant="small" tone="danger" accessibilityRole="alert">{error}</Text> : null}
      </Surface>
    </View>
  );
};
export const AnswerQuestion = memo(AnswerQuestionImpl);

interface Props {
  pages: Page[];
  currentPageIndex: number;
  answers: Record<string, unknown>;
  onAnswerChange: (id: string, value: unknown) => void;
  fieldErrors?: Record<string, string | undefined>;
  onBack: () => void;
  onNext: () => void;
  isLastPage: boolean;
  onSubmit: () => void;
  submitting?: boolean;
  submitLabel?: string;
  formTitle: string;
  formDescription?: string;
  bannerImage?: string | null;
  headerExtra?: ReactNode;
  footerNotice?: ReactNode;
}

/**
 * The shared "answer one page of questions, then Back/Next" unit. Used by the real respondent flow
 * (wired to the server) and by the builder's live preview (wired to local state only): same
 * component, same fidelity, different data source. It knows nothing about the API.
 */
export function QuestionPager(p: Props) {
  const { colors } = useTheme();
  const page = p.pages[p.currentPageIndex];

  const numbers = useMemo(() => {
    const map = new Map<string, number>();
    let n = 0;
    for (const pg of p.pages) for (const q of pg.questions) map.set(q.id, n++);
    return map;
  }, [p.pages]);

  if (!page) return null;
  const multiPage = p.pages.length > 1;
  const pct = ((p.currentPageIndex + 1) / p.pages.length) * 100;

  return (
    <View style={{ gap: space[4] }}>
      {multiPage ? (
        <View accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: p.pages.length, now: p.currentPageIndex + 1 }} style={{ gap: 4 }}>
          <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.surfaceSunken, overflow: "hidden" }}>
            <View style={{ width: `${pct}%`, height: 4, backgroundColor: colors.primary }} />
          </View>
          <Text variant="caption" tone="tertiary">Page {p.currentPageIndex + 1} of {p.pages.length}</Text>
        </View>
      ) : null}

      {p.currentPageIndex === 0 ? (
        <Surface padded={false}>
          {p.bannerImage ? <Image source={{ uri: p.bannerImage }} accessibilityLabel="" resizeMode="cover" style={{ width: "100%", height: 140 }} /> : null}
          <View style={{ padding: space[4], gap: space[1] }}>
            <Text variant="heading" accessibilityRole="header">{p.formTitle || "Untitled form"}</Text>
            {p.formDescription ? <Text tone="secondary">{p.formDescription}</Text> : null}
          </View>
        </Surface>
      ) : null}

      {p.headerExtra}

      {page.title || page.description ? (
        <View style={{ gap: 2 }}>
          {page.title ? <Text variant="title" accessibilityRole="header">{page.title}</Text> : null}
          {page.description ? <Text tone="secondary">{page.description}</Text> : null}
        </View>
      ) : null}

      <View style={{ gap: space[3] }}>
        {page.questions.map((q) => (
          <AnswerQuestion key={q.id} question={q} index={numbers.get(q.id) ?? 0} value={p.answers[q.id]} onChange={(v) => p.onAnswerChange(q.id, v)} error={p.fieldErrors?.[q.id]} />
        ))}
        {page.questions.length === 0 ? <Text tone="secondary">This section has no questions.</Text> : null}
      </View>

      {p.footerNotice}

      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Button label="Back" variant="ghost" disabled={p.currentPageIndex === 0} onPress={p.onBack} />
        {p.isLastPage ? (
          <Button label={p.submitLabel ?? "Submit"} variant="primary" loading={p.submitting} onPress={p.onSubmit} />
        ) : (
          <Button label="Next" variant="primary" onPress={p.onNext} />
        )}
      </View>
    </View>
  );
}
