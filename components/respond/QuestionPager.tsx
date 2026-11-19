import { memo, useMemo, type ReactNode } from "react";
import { Image, View } from "react-native";
import { AlertCircle } from "lucide-react-native";
import type { Question } from "../../lib/formStore";
import { GButton, GCard, GText, useGF } from "../../ui/gforms";
import { RESPONDENT_FIELDS } from "./fields";

export interface Page { id: string; title: string; description: string; next?: string | null; questions: Question[] }
interface AnswerQuestionProps { question: Question; index: number; value: unknown; onChange: (v: unknown) => void; error?: string }

/** Google Forms question card: title with red asterisk, helper text, field, inline required error. */
const AnswerQuestionImpl = ({ question, value, onChange, error }: AnswerQuestionProps) => {
  const Field = RESPONDENT_FIELDS[question.type];
  const g = useGF();
  return <View nativeID={`answer-${question.id}`} style={{ backgroundColor: g.card, borderWidth: 1, borderColor: error ? g.error : g.border, borderRadius: 8, padding: 24, gap: 16 }}>
    <View style={{ gap: 4 }}>
      <GText size={16} weight="400" accessibilityRole="header">{question.title || "Untitled question"}{question.required ? <GText size={16} color={g.error}> *</GText> : null}</GText>
      {question.description ? <GText size={12} secondary>{question.description}</GText> : null}
    </View>
    {question.imageUrl ? <Image source={{ uri: question.imageUrl }} accessibilityLabel="Question image" resizeMode="contain" style={{ width: "100%", height: 220 }} /> : null}
    {Field ? <Field question={question} value={value} onChange={onChange} error={error} /> : null}
    {error ? <View accessibilityRole="alert" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><AlertCircle size={18} color={g.error} /><GText size={12} color={g.error}>{error}</GText></View> : null}
  </View>;
};
export const AnswerQuestion = memo(AnswerQuestionImpl);

interface Props {
  pages: Page[]; currentPageIndex: number; answers: Record<string, unknown>;
  onAnswerChange: (id: string, value: unknown) => void; fieldErrors?: Record<string, string | undefined>;
  onBack: () => void; onNext: () => void; isLastPage: boolean; onSubmit: () => void; onClear?: () => void;
  submitting?: boolean; submitLabel?: string; formTitle: string; formDescription?: string;
  bannerImage?: string | null; headerExtra?: ReactNode; footerNotice?: ReactNode;
  /** With section links the visited pages aren't a plain sequence: the flow supplies its own step, total and Back rule. */
  step?: number; total?: number; canGoBack?: boolean;
  /** Hides the page counter and bar when the host turned the progress bar off. */
  showProgress?: boolean;
}

/** One renderer for the real respondent flow and the editor's local Preview. */
export function QuestionPager(p: Props) {
  const g = useGF();
  const page = p.pages[p.currentPageIndex];
  const numbers = useMemo(() => {
    const map = new Map<string, number>();
    let n = 0;
    for (const pg of p.pages) for (const q of pg.questions) map.set(q.id, n++);
    return map;
  }, [p.pages]);
  const anyRequired = useMemo(() => p.pages.some((pg) => pg.questions.some((q) => q.required)), [p.pages]);
  if (!page) return null;
  const step = p.step ?? p.currentPageIndex + 1;
  const total = p.total ?? p.pages.length;
  const multi = total > 1 && p.showProgress !== false;
  const pct = Math.min(100, (step / total) * 100);
  return <View style={{ gap: 12 }}>
    {p.currentPageIndex === 0 ? <GCard accent>
      {p.bannerImage ? <Image source={{ uri: p.bannerImage }} accessibilityLabel="Form banner" resizeMode="cover" style={{ width: "100%", aspectRatio: 3.5 }} /> : null}
      <View style={{ padding: 24, gap: 12 }}>
        <GText size={32} accessibilityRole="header" style={{ lineHeight: 40 }}>{p.formTitle || "Untitled form"}</GText>
        {p.formDescription ? <GText size={14} secondary>{p.formDescription}</GText> : null}
        {anyRequired ? <View style={{ borderTopWidth: 1, borderTopColor: g.border, paddingTop: 12 }}><GText size={14} color={g.error}>* Indicates required question</GText></View> : null}
      </View>
    </GCard> : null}
    {p.headerExtra}
    {page.title || page.description ? <GCard accent>
      <View style={{ padding: 24, gap: 8 }}>
        {page.title ? <GText size={22} accessibilityRole="header">{page.title}</GText> : null}
        {page.description ? <GText size={14} secondary>{page.description}</GText> : null}
      </View>
    </GCard> : null}
    {page.questions.map((q) => <AnswerQuestion key={q.id} question={q} index={numbers.get(q.id) ?? 0} value={p.answers[q.id]} onChange={(v) => p.onAnswerChange(q.id, v)} error={p.fieldErrors?.[q.id]} />)}
    {page.questions.length === 0 ? <GCard><View style={{ padding: 24 }}><GText secondary>This section has no questions.</GText></View></GCard> : null}
    {p.footerNotice}
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", paddingTop: 4 }}>
      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
        {(p.canGoBack ?? p.currentPageIndex > 0) ? <GButton variant="outlined" label="Back" onPress={p.onBack} /> : null}
        {p.isLastPage ? <GButton variant="filled" label={p.submitLabel ?? "Submit"} loading={p.submitting} onPress={p.onSubmit} /> : <GButton variant="filled" label="Next" onPress={p.onNext} />}
      </View>
      {multi ? <View style={{ flex: 1, minWidth: 120, maxWidth: 220, gap: 4 }}><GText size={12} secondary style={{ textAlign: "center" }}>Page {step} of {total}</GText><View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: total, now: step }} style={{ height: 4, borderRadius: 2, backgroundColor: g.border }}><View style={{ width: `${pct}%`, height: 4, borderRadius: 2, backgroundColor: g.accent }} /></View></View> : null}
      {p.onClear ? <GButton label="Clear form" onPress={p.onClear} /> : <View />}
    </View>
    <GText size={12} secondary style={{ textAlign: "center", paddingTop: 16, paddingBottom: 24 }}>Never submit passwords through this form.</GText>
  </View>;
}
