// Single source of truth for per-question response analytics — used by the on-screen "By
// Question" view (AllResponsesPage.jsx) and by both export formats (Excel/PDF, see
// exportResponses.js), so a chart and its exported numbers can never drift apart.

const CHOICE_TYPES = new Set(["multiple_choice", "dropdown", "checkboxes"]);

// An empty checkboxes answer arrives as `[]` (and an untouched grid row as `""`/`[]`), which is
// "no answer" — counting it as answered inflated every percentage's denominator.
function isAnswered(raw) {
  if (raw === undefined || raw === null || raw === "") return false;
  if (Array.isArray(raw)) return raw.length > 0;
  return true;
}

// The one percentage formula for the on-screen bars and both export formats. Rounded to one
// decimal so 1 of 3 reads 33.3%, not a rounded-off 33%, and a bar's length (count / total) is the
// same number its label prints.
export function percentOf(count, total) {
  return total ? Math.round((count / total) * 1000) / 10 : 0;
}

export function formatPercent(count, total) {
  return `${percentOf(count, total)}%`;
}

function median(sortedValues) {
  const mid = Math.floor(sortedValues.length / 2);
  return sortedValues.length % 2 === 0
    ? (sortedValues[mid - 1] + sortedValues[mid]) / 2
    : sortedValues[mid];
}

function computeScaleStats(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((s, n) => s + n, 0);
  return {
    avg: Math.round((sum / values.length) * 10) / 10,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    median: Math.round(median(sorted) * 10) / 10,
  };
}

// Tallies option-level counts from the RAW stored answer (an option index, or an array of
// indices for checkboxes) rather than the breakdown's already-comma-joined display text, so a
// checkboxes question's options can be counted individually — matching Google Forms' own
// per-question response summary (a bar per option, not per combination of options).
function aggregateChoice(question, responses) {
  // Seeded with every option currently on the question — not just ones some response happens to
  // reference — so an option added after responses were collected still shows up (at 0), the way
  // Google Forms lists every current choice rather than only ones with at least one answer.
  const counts = new Map((question.options || []).map((label) => [label, 0]));
  let total = 0;
  responses.forEach((r) => {
    const raw = r.answers?.[question.id];
    if (!isAnswered(raw)) return;
    total += 1;
    const labels =
      question.type === "checkboxes"
        ? (Array.isArray(raw) ? raw : []).map((i) => question.options?.[Number(i)] ?? String(i))
        : [question.options?.[Number(raw)] ?? String(raw)];
    labels.forEach((label) => counts.set(label, (counts.get(label) || 0) + 1));
  });
  const entries = [...counts.entries()].map(([label, count]) => ({ label, count }));
  return { kind: "bar", total, entries };
}

// Linear scale answers are the numeric value itself (not an option index), so the distribution
// bars are built straight from the raw values, sorted numerically — plus summary stats Google
// Forms-style analytics always show for a scale question.
function aggregateScale(question, responses) {
  const values = [];
  responses.forEach((r) => {
    const raw = r.answers?.[question.id];
    if (raw === undefined || raw === null || raw === "") return;
    const num = Number(raw);
    if (!Number.isNaN(num)) values.push(num);
  });
  const counts = new Map();
  values.forEach((v) => counts.set(String(v), (counts.get(String(v)) || 0) + 1));
  const entries = [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => Number(a.label) - Number(b.label));
  return { kind: "scale", total: values.length, entries, stats: computeScaleStats(values) };
}

// A date/time question only earns a distribution chart when multiple respondents actually landed
// on the same value (repeats exist) — otherwise every answer is distinct and a "bar per value"
// view is just as unreadable as a bar chart per open-ended text answer, so it falls back to a list.
function aggregateDateTime(question, responses) {
  const counts = new Map();
  let total = 0;
  responses.forEach((r) => {
    const raw = r.answers?.[question.id];
    if (raw === undefined || raw === null || raw === "") return;
    total += 1;
    counts.set(String(raw), (counts.get(String(raw)) || 0) + 1);
  });
  const hasRepeats = counts.size > 1 && counts.size < total;
  if (hasRepeats) {
    const entries = [...counts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => a.label.localeCompare(b.label));
    return { kind: "bar", total, entries };
  }
  return aggregateList(question, responses);
}

// Each grid row is analyzed independently (its own option/column counts), the way Google Forms
// breaks down a multiple-choice/checkbox grid — rows and columns are {id,label} pairs, so a
// reordered or renamed option never shifts which answers it represents.
function aggregateMatrix(question, responses) {
  const rows = question.rows || [];
  const cols = question.options || [];
  const isCheckbox = question.type === "matrix_checkbox";

  const rowStats = rows.map((row) => {
    const counts = new Map();
    let rowTotal = 0;
    responses.forEach((r) => {
      const raw = r.answers?.[question.id]?.[row.id];
      if (!isAnswered(raw)) return;
      const vals = isCheckbox ? (Array.isArray(raw) ? raw : []) : [raw];
      if (vals.length === 0) return;
      rowTotal += 1;
      vals.forEach((colId) => {
        const label = cols.find((c) => c.id === colId)?.label ?? String(colId);
        counts.set(label, (counts.get(label) || 0) + 1);
      });
    });
    return {
      rowLabel: row.label || "Untitled row",
      total: rowTotal,
      entries: cols.map((c) => ({ label: c.label, count: counts.get(c.label) || 0 })),
    };
  });

  const total = responses.filter((r) => {
    const raw = r.answers?.[question.id];
    return raw && Object.keys(raw).length > 0;
  }).length;

  return { kind: "matrix", total, rows: rowStats };
}

function aggregateList(question, responses) {
  const entries = responses
    .map((r) => r.breakdown.find((b) => b.questionId === question.id)?.submittedAnswer)
    .filter((v) => v !== null && v !== undefined && v !== "");
  return { kind: "list", total: entries.length, entries };
}

// Charts are only used where they're actually meaningful (choice/scale/repeating date-time
// questions and analyzable grids) — open-ended text and one-off date/time answers stay as a
// plain, searchable list, never a bar chart with one bar per unique answer.
export function aggregateQuestion(question, responses) {
  if (CHOICE_TYPES.has(question.type)) return aggregateChoice(question, responses);
  if (question.type === "linear_scale") return aggregateScale(question, responses);
  if (question.type === "date" || question.type === "time") return aggregateDateTime(question, responses);
  if (question.type === "matrix" || question.type === "matrix_checkbox") return aggregateMatrix(question, responses);
  return aggregateList(question, responses);
}
