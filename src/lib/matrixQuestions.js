// Shared helpers for the two grid question types (matrix = "Multiple choice grid", single
// answer per row; matrix_checkbox = "Checkbox grid", multiple answers per row). Rows and
// columns are both stored as {id, label} (columns also carry a numeric `value`, used for
// per-row averages) so edits/reorders never shift what a previously-recorded answer means —
// answers are keyed by these ids, never by array index.
//
// server/responses/grading.js runs in a separate runtime and can't import this file — it
// keeps its own small isEmptyAnswer/submittedAnswerText cases for these types, by convention.

const genId = (prefix) =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? `${prefix}_${crypto.randomUUID()}`
    : `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export function isMatrixQuestion(type) {
  return type === "matrix" || type === "matrix_checkbox";
}

export function isMatrixMultiSelect(type) {
  return type === "matrix_checkbox";
}

export function createMatrixRow(label) {
  return { id: genId("row"), label };
}

export function createMatrixColumn(label, value) {
  return { id: genId("col"), label, value };
}

export function defaultMatrixRows() {
  return [createMatrixRow("Row 1"), createMatrixRow("Row 2"), createMatrixRow("Row 3")];
}

export function defaultMatrixColumns() {
  return [createMatrixColumn("Column 1", 1), createMatrixColumn("Column 2", 2), createMatrixColumn("Column 3", 3)];
}

export const DEFAULT_MATRIX_SETTINGS = { requireAllRows: true };

// Presets are just starting points for the columns list — the creator can still add, remove,
// relabel, or renumber columns afterward. Never referenced by the respondent-facing renderer,
// which only ever reads question.options (the columns actually saved on the question).
export const MATRIX_SCALE_PRESETS = [
  {
    id: "satisfaction_5",
    label: "1–5 Satisfaction",
    columns: [
      { label: "Very dissatisfied", value: 1 },
      { label: "Dissatisfied", value: 2 },
      { label: "Neutral", value: 3 },
      { label: "Satisfied", value: 4 },
      { label: "Very satisfied", value: 5 },
    ],
  },
  {
    id: "agreement_5",
    label: "1–5 Agreement",
    columns: [
      { label: "Strongly disagree", value: 1 },
      { label: "Disagree", value: 2 },
      { label: "Neutral", value: 3 },
      { label: "Agree", value: 4 },
      { label: "Strongly agree", value: 5 },
    ],
  },
  {
    id: "quality_5",
    label: "1–5 Quality",
    columns: [
      { label: "Very poor", value: 1 },
      { label: "Poor", value: 2 },
      { label: "Average", value: 3 },
      { label: "Good", value: 4 },
      { label: "Excellent", value: 5 },
    ],
  },
  {
    id: "rating_10",
    label: "1–10 Rating",
    columns: Array.from({ length: 10 }, (_, i) => ({ label: String(i + 1), value: i + 1 })),
  },
];

export function buildPresetColumns(presetId) {
  const preset = MATRIX_SCALE_PRESETS.find((p) => p.id === presetId);
  if (!preset) return null;
  return preset.columns.map((c) => createMatrixColumn(c.label, c.value));
}

function rowHasAnswer(row, answers, isMultiple) {
  const a = answers[row.id];
  return isMultiple ? Array.isArray(a) && a.length > 0 : a !== undefined && a !== null && a !== "";
}

// required + requireAllRows: every row needs an answer. required + !requireAllRows: at
// least one row needs an answer (mirrors "required" for any other question type — answer
// *something* — while still letting the creator opt out of a full-grid requirement).
export function getMatrixMissingRows(question, value) {
  const rows = Array.isArray(question.rows) ? question.rows : [];
  const answers = value && typeof value === "object" ? value : {};
  const isMultiple = isMatrixMultiSelect(question.type);
  const requireAll = question.scale?.requireAllRows !== false;

  if (requireAll) {
    return rows.filter((row) => !rowHasAnswer(row, answers, isMultiple));
  }
  return rows.some((row) => rowHasAnswer(row, answers, isMultiple)) ? [] : rows;
}

export function matrixRequiredMessage(question) {
  const requireAll = question.scale?.requireAllRows !== false;
  return requireAll ? "Please answer every row." : "Please answer at least one row.";
}
