// Numbers behind the Results > Summary tab (the counterpart of Google Forms' Summary): overall
// response statistics, the score distribution of a quiz, responses over time, and how many people
// got each question right. Pure so the screen and the tests share it; per-question answer tallies
// live in responseAnalytics.js.

const median = (sorted) => {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
};
const round1 = (n) => Math.round(n * 10) / 10;

/** Local calendar day (YYYY-MM-DD) of an ISO timestamp, so "today" in the chart means the host's today. */
export function dayKey(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Overall figures for a set of submitted responses.
 * `scored` is present only when some responses carry a score; percentages are of each response's own
 * maximum, so versions of a quiz with different totals stay comparable.
 */
export function overviewStats(responses) {
  const submitted = responses.filter((r) => r.submittedAt);

  const durations = submitted
    .map((r) => (r.startedAt ? (Date.parse(r.submittedAt) - Date.parse(r.startedAt)) / 1000 : NaN))
    .filter((s) => Number.isFinite(s) && s >= 0);
  const avgSeconds = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null;

  const lastAt = submitted.reduce((latest, r) => (!latest || r.submittedAt > latest ? r.submittedAt : latest), null);

  const percents = submitted
    .filter((r) => r.maxScore != null && r.maxScore > 0 && r.score != null)
    .map((r) => (r.score / r.maxScore) * 100);
  let scored = null;
  if (percents.length) {
    const sorted = [...percents].sort((a, b) => a - b);
    // Ten buckets of 10 points; a perfect 100 belongs with 90-100, not in a bucket of its own.
    const bins = Array.from({ length: 10 }, (_, i) => ({ from: i * 10, to: i * 10 + 10, count: 0 }));
    sorted.forEach((p) => { bins[Math.min(9, Math.floor(p / 10))].count += 1; });
    scored = {
      count: percents.length,
      average: round1(percents.reduce((a, b) => a + b, 0) / percents.length),
      median: round1(median(sorted)),
      lowest: round1(sorted[0]),
      highest: round1(sorted[sorted.length - 1]),
      bins,
    };
  }

  const perDayMap = new Map();
  submitted.forEach((r) => { const k = dayKey(r.submittedAt); perDayMap.set(k, (perDayMap.get(k) || 0) + 1); });
  // Every day from the first response to the last (empty days included), capped to the newest 30,
  // so a gap reads as a gap instead of two bars sitting side by side.
  const perDay = [];
  if (perDayMap.size) {
    const keys = [...perDayMap.keys()].sort();
    const start = new Date(`${keys[0]}T00:00:00`);
    const end = new Date(`${keys[keys.length - 1]}T00:00:00`);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const k = dayKey(d.toISOString());
      perDay.push({ day: k, count: perDayMap.get(k) || 0 });
    }
  }

  return { count: submitted.length, avgSeconds, lastAt, scored, perDay: perDay.slice(-30) };
}

/** How many of the people who answered a gradable question got it right (from each response's breakdown). */
export function questionAccuracy(question, responses) {
  let answered = 0;
  let correct = 0;
  let gradable = false;
  responses.forEach((r) => {
    const b = r.breakdown?.find((x) => x.questionId === question.id);
    if (!b || !b.gradable) return;
    gradable = true;
    if (b.submittedAnswer === null || b.submittedAnswer === undefined || b.submittedAnswer === "") return;
    answered += 1;
    if (b.correct) correct += 1;
  });
  return gradable && answered > 0 ? { answered, correct, percent: round1((correct / answered) * 100) } : null;
}

/** Quiz questions ordered from most to least missed, for the "most missed" list. */
export function mostMissed(questions, responses, limit = 5) {
  return questions
    .map((q) => ({ question: q, accuracy: questionAccuracy(q, responses) }))
    .filter((x) => x.accuracy && x.accuracy.percent < 100)
    .sort((a, b) => a.accuracy.percent - b.accuracy.percent)
    .slice(0, limit);
}

export function formatDuration(seconds) {
  if (seconds == null) return "—";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return s ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}
