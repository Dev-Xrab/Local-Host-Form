// Pure question-type metadata: names, icon keys, and the traits other modules branch on. No React
// and no components, so the form store and any UI (React Native or otherwise) can import it
// without pulling a renderer in. Each UI keeps its own `type -> component` maps.
//
// server/responses/grading.js runs in a separate runtime and can't import from here; it keeps its
// own small predicates, kept in sync with isGradable/isSingleSelect by convention.
import { defaultMatrixRows, defaultMatrixColumns, DEFAULT_MATRIX_SETTINGS } from "./matrixQuestions";

const DEFAULT_SCALE = { min: 1, max: 5, minLabel: "", maxLabel: "" };

// isOptionBased: has an `options` array a respondent picks from.
// isSingleSelect: only one option can ever be correct (vs. checkboxes, which allow many).
// isGradable: can carry an answer key at all (linear_scale/date/time/file_upload can't).
// usesTextAnswerKey: correct answers are free-text variations (`correctAnswers`) rather than
//   option indices (`correctAnswerIndex`).
// isGridBased: a matrix/grid question: a `rows` array plus a shared `options` array (the columns).
const t = (id, label, icon, traits) => ({
  id,
  label,
  icon,
  isOptionBased: false,
  isSingleSelect: false,
  isGradable: false,
  usesTextAnswerKey: false,
  ...traits,
});

export const QUESTION_TYPE_META = {
  short_answer: t("short_answer", "Short answer", "shortAnswer", { isGradable: true, usesTextAnswerKey: true }),
  paragraph: t("paragraph", "Paragraph", "paragraph", { isGradable: true, usesTextAnswerKey: true }),
  multiple_choice: t("multiple_choice", "Multiple choice", "multipleChoice", { isOptionBased: true, isSingleSelect: true, isGradable: true }),
  checkboxes: t("checkboxes", "Checkboxes", "checkboxes", { isOptionBased: true, isGradable: true }),
  dropdown: t("dropdown", "Dropdown", "dropdown", { isOptionBased: true, isSingleSelect: true, isGradable: true }),
  linear_scale: t("linear_scale", "Linear scale", "linearScale", {}),
  date: t("date", "Date", "date", {}),
  time: t("time", "Time", "time", {}),
  file_upload: t("file_upload", "File upload", "fileUpload", {}),
  matrix: t("matrix", "Multiple choice grid", "grid", { isSingleSelect: true, isGridBased: true }),
  matrix_checkbox: t("matrix_checkbox", "Checkbox grid", "grid", { isGridBased: true }),
};

export const QUESTION_TYPES = Object.values(QUESTION_TYPE_META);

export function getQuestionType(type) {
  return QUESTION_TYPE_META[type];
}

export function createQuestionDefaults(type) {
  const def = getQuestionType(type);
  if (def?.isGridBased) {
    return {
      options: defaultMatrixColumns(),
      rows: defaultMatrixRows(),
      scale: { ...DEFAULT_MATRIX_SETTINGS },
    };
  }
  return {
    options: def?.isOptionBased ? ["Option 1"] : [],
    rows: [],
    scale: { ...DEFAULT_SCALE },
  };
}
