import { useMemo, useState } from "react";
import { View } from "react-native";
import { aggregateQuestion } from "../../src/features/forms/utils/responseAnalytics";
import { formatDuration, mostMissed, overviewStats, questionAccuracy } from "../../src/features/forms/utils/summaryStats";
import { GButton, GCard, GText, useGF } from "../../ui/gforms";
import { useLayout } from "../../ui";
import { Columns, Donut, HBars, sliceColor } from "./charts";

export interface SummaryQuestion { id: string; type: string; title: string; options?: unknown[]; scale?: { min: number; max: number }; correctAnswerIndex?: number[] }
export interface SummaryResponse { id: string; startedAt?: string | null; submittedAt?: string | null; score?: number | null; maxScore?: number | null; answers?: Record<string, unknown>; breakdown?: { questionId: string; gradable?: boolean; correct?: boolean | null; submittedAnswer?: unknown }[] }

const pad = { padding: 20, gap: 14 } as const;

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <View style={{ flex: 1, minWidth: 120, gap: 2 }}>
      <GText size={12} secondary>{label}</GText>
      <GText size={24}>{value}</GText>
      {hint ? <GText size={12} secondary>{hint}</GText> : null}
    </View>
  );
}

function Overview({ responses, quiz }: { responses: SummaryResponse[]; quiz: boolean }) {
  const { isPhone } = useLayout();
  const s = useMemo(() => overviewStats(responses), [responses]);
  return (
    <>
      <GCard accent>
        <View style={pad}>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 10 }}>
            <GText size={28}>{s.count}</GText>
            <GText size={16} secondary>{s.count === 1 ? "response" : "responses"}</GText>
          </View>
          <View style={{ flexDirection: isPhone ? "column" : "row", gap: 16, flexWrap: "wrap" }}>
            <Stat label="Average time to complete" value={formatDuration(s.avgSeconds)} />
            <Stat label="Latest response" value={s.lastAt ? new Date(s.lastAt).toLocaleDateString() : "—"} hint={s.lastAt ? new Date(s.lastAt).toLocaleTimeString() : undefined} />
            {quiz && s.scored ? <Stat label="Average score" value={`${s.scored.average}%`} hint={`Median ${s.scored.median}% · ${s.scored.lowest}–${s.scored.highest}%`} /> : null}
          </View>
        </View>
      </GCard>

      {quiz && s.scored ? (
        <GCard>
          <View style={pad}>
            <GText size={16} weight="500">Scores</GText>
            <GText size={13} secondary>How many respondents landed in each range, as a share of the points available.</GText>
            <Columns items={s.scored.bins.map((b) => ({ label: `${b.from}–${b.to}`, value: b.count }))} />
          </View>
        </GCard>
      ) : null}

      {s.perDay.length > 0 ? (
        <GCard>
          <View style={pad}>
            <GText size={16} weight="500">Responses over time</GText>
            <GText size={13} secondary>Submissions per day{s.perDay.length >= 30 ? ", last 30 days" : ""}.</GText>
            <Columns items={s.perDay.map((d) => ({ label: s.perDay.length > 8 ? d.day.slice(8) : d.day.slice(5), value: d.count }))} color={sliceColor(2)} />
          </View>
        </GCard>
      ) : null}
    </>
  );
}

function MostMissed({ questions, responses }: { questions: SummaryQuestion[]; responses: SummaryResponse[] }) {
  const g = useGF();
  const items: { question: SummaryQuestion; accuracy: { percent: number; correct: number; answered: number } | null }[] = useMemo(() => mostMissed(questions, responses), [questions, responses]);
  if (!items.length) return null;
  return (
    <GCard>
      <View style={pad}>
        <GText size={16} weight="500">Most missed questions</GText>
        {items.map(({ question, accuracy }) => (
          <View key={question.id} style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
            <GText size={14} style={{ flex: 1 }} numberOfLines={2}>{question.title || "Untitled question"}</GText>
            <GText size={13} color={g.error} style={{ fontVariant: ["tabular-nums"] }}>{accuracy!.percent}% correct ({accuracy!.correct}/{accuracy!.answered})</GText>
          </View>
        ))}
      </View>
    </GCard>
  );
}

function QuestionSummary({ question, responses, quiz }: { question: SummaryQuestion; responses: SummaryResponse[]; quiz: boolean }) {
  const g = useGF();
  const [all, setAll] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = useMemo(() => aggregateQuestion(question as never, responses as never), [question, responses]);
  const accuracy = quiz ? questionAccuracy(question, responses) : null;
  const singleChoice = question.type === "multiple_choice" || question.type === "dropdown";
  const correct = useMemo(() => new Set(quiz ? (question.correctAnswerIndex || []).map((i) => String(question.options?.[i] ?? "")) : []), [quiz, question]);

  let body;
  if (result.kind === "matrix") {
    body = result.rows.length === 0 ? <GText secondary>No rows configured.</GText> : (
      <View style={{ gap: 18 }}>{result.rows.map((row: { rowLabel: string; total: number; entries: { label: string; count: number }[] }) => (
        <View key={row.rowLabel} style={{ gap: 8 }}><GText size={14} weight="500">{row.rowLabel}</GText>{row.total === 0 ? <GText size={13} secondary>No answers yet.</GText> : <HBars entries={row.entries} total={row.total} />}</View>
      ))}</View>
    );
  } else if (result.total === 0) {
    body = <GText secondary>No answers yet.</GText>;
  } else if (result.kind === "scale") {
    const { min = 1, max = 5 } = question.scale || {};
    const counts = new Map<string, number>(result.entries.map((e: { label: string; count: number }) => [e.label, e.count]));
    const items = Array.from({ length: Math.max(0, max - min + 1) }, (_, i) => ({ label: String(min + i), value: counts.get(String(min + i)) || 0 }));
    body = (
      <View style={{ gap: 10 }}>
        {result.stats ? <GText size={13} secondary>Average <GText size={13} weight="700">{result.stats.avg}</GText> · Median <GText size={13} weight="700">{result.stats.median}</GText> · Range {result.stats.min}–{result.stats.max}</GText> : null}
        <Columns items={items} color={sliceColor(0)} />
      </View>
    );
  } else if (result.kind === "bar" && singleChoice) {
    const visible = result.entries as { label: string; count: number }[];
    body = (
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 24 }}>
        <Donut entries={visible} />
        <View style={{ flex: 1, minWidth: 200, gap: 8 }}>
          {visible.map((e, i) => (
            <View key={e.label + i} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: sliceColor(i) }} />
              <GText size={13} style={{ flex: 1 }} numberOfLines={2} color={correct.has(e.label) ? g.success : undefined}>{e.label}{correct.has(e.label) ? "  ✓" : ""}</GText>
              <GText size={13} secondary style={{ fontVariant: ["tabular-nums"] }}>{e.count} ({result.total ? Math.round((e.count / result.total) * 1000) / 10 : 0}%)</GText>
            </View>
          ))}
        </View>
      </View>
    );
  } else if (result.kind === "bar") {
    body = <HBars entries={result.entries} total={result.total} correct={correct.size ? correct : undefined} />;
  } else {
    const list = result.entries as string[];
    const shown = all ? list : list.slice(0, 5);
    body = (
      <View style={{ gap: 8 }}>
        {shown.map((t, i) => <View key={i} style={{ backgroundColor: g.cardAlt, borderRadius: 4, paddingHorizontal: 12, paddingVertical: 8 }}><GText size={14} selectable>{t}</GText></View>)}
        {list.length > 5 ? <GButton label={all ? "Show fewer" : `Show all ${list.length} responses`} onPress={() => setAll((v) => !v)} /> : null}
      </View>
    );
  }

  return (
    <GCard>
      <View style={pad}>
        <View style={{ gap: 2 }}>
          <GText size={16}>{question.title || "Untitled question"}</GText>
          <GText size={12} secondary>
            {result.total} {result.total === 1 ? "response" : "responses"}
            {question.type === "checkboxes" ? " · each bar is a share of respondents, so they can add up to over 100%" : ""}
          </GText>
        </View>
        {accuracy ? <GText size={13} color={accuracy.percent >= 50 ? g.success : g.error}>{accuracy.percent}% answered correctly ({accuracy.correct} of {accuracy.answered})</GText> : null}
        {body}
      </View>
    </GCard>
  );
}

/** Results > Summary: an overview, then a chart for every question, like the Summary tab in Google Forms. */
export function ResponseSummary({ questions, responses, quiz }: { questions: SummaryQuestion[]; responses: SummaryResponse[]; quiz: boolean }) {
  return (
    <View style={{ gap: 12 }}>
      <Overview responses={responses} quiz={quiz} />
      {quiz ? <MostMissed questions={questions} responses={responses} /> : null}
      {questions.map((q) => <QuestionSummary key={q.id} question={q} responses={responses} quiz={quiz} />)}
    </View>
  );
}
