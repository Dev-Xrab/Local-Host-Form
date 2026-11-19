const CHOICE_TYPES = new Set(["multiple_choice", "dropdown"]);

// Only an inline data: URI is ever handed to a page as a file to show/download — a plain URL
// (possible in responses stored before uploads were validated server-side) would otherwise make
// the host's browser fetch an address a respondent chose.
const fileUrlOf = (question, value) =>
  question.type === "file_upload" && typeof value === "string" && value.startsWith("data:") ? value : null;

const normalize = (s) => String(s ?? "").trim().toLowerCase();
const pointsOf = (question) => Math.max(0, Number(question.points) || 0) || 1;

// A matrix row counts as answered if it has a value (matrix_checkbox: a non-empty array;
// matrix: any selected column id). Kept in sync with src/lib/matrixQuestions.js's
// getMatrixMissingRows by convention — this file can't import client code (see top comment).
function matrixRowAnswered(row, answers, isMultiple) {
  const a = answers[row.id];
  return isMultiple ? Array.isArray(a) && a.length > 0 : a !== undefined && a !== null && a !== "";
}

function isEmptyAnswer(question, value) {
  if (value === undefined || value === null) return true;
  switch (question.type) {
    case "checkboxes":
      return !Array.isArray(value) || value.length === 0;
    case "linear_scale":
      return typeof value !== "number" && typeof value !== "string";
    case "matrix":
    case "matrix_checkbox": {
      const rows = Array.isArray(question.rows) ? question.rows : [];
      if (rows.length === 0) return true;
      const answers = value && typeof value === "object" ? value : {};
      const isMultiple = question.type === "matrix_checkbox";
      const requireAll = question.scale?.requireAllRows !== false;
      return requireAll
        ? rows.some((r) => !matrixRowAnswered(r, answers, isMultiple))
        : rows.every((r) => !matrixRowAnswered(r, answers, isMultiple));
    }
    default:
      return String(value).trim() === "";
  }
}

// Server-side is the source of truth: never trust the client's own required-field checks.
export function findMissingRequiredQuestions(questions, answers) {
  return questions.filter(
    (q) => q.type !== "section" && q.required && isEmptyAnswer(q, answers[q.id])
  );
}

// Whether the form is a quiz: the host's explicit choice, or for forms saved before that setting
// existed, whether any question carries an answer key.
export function isQuizForm(form) {
  if (typeof form.settings?.isQuiz === "boolean") return form.settings.isQuiz;
  return (form.questions || []).some((q) => !q.removedAt && isGradable(q));
}

function isGradable(question) {
  if (CHOICE_TYPES.has(question.type)) return question.correctAnswerIndex?.length > 0;
  if (question.type === "checkboxes") return question.correctAnswerIndex?.length > 0;
  if (["short_answer", "paragraph"].includes(question.type)) return question.correctAnswers?.length > 0;
  return false;
}

function isCorrect(question, value) {
  if (CHOICE_TYPES.has(question.type)) {
    return Number(value) === question.correctAnswerIndex[0];
  }
  if (question.type === "checkboxes") {
    const given = Array.isArray(value) ? [...value].map(Number).sort() : [];
    const correct = [...question.correctAnswerIndex].sort();
    return given.length === correct.length && given.every((v, i) => v === correct[i]);
  }
  if (["short_answer", "paragraph"].includes(question.type)) {
    const givenNormalized = normalize(value);
    return question.correctAnswers.some((a) => normalize(a) === givenNormalized);
  }
  return false;
}

// The single authoritative scorer — used at submission time AND for recalculation when
// a question's correct answer or point value changes later. Always evaluated against
// whatever the current form definition is; a deleted question is simply no longer graded.
export function scoreResponse(questions, answers) {
  const gradable = questions.filter(isGradable);
  if (gradable.length === 0) return { score: null, maxScore: null };

  const score = gradable.reduce(
    (sum, q) => sum + (isCorrect(q, answers[q.id]) ? pointsOf(q) : 0),
    0
  );
  const maxScore = gradable.reduce((sum, q) => sum + pointsOf(q), 0);
  return { score, maxScore };
}

function correctAnswerText(question) {
  if (CHOICE_TYPES.has(question.type)) {
    return question.options[question.correctAnswerIndex[0]] ?? "";
  }
  if (question.type === "checkboxes") {
    return question.correctAnswerIndex.map((i) => question.options[i]).filter(Boolean).join(", ");
  }
  return question.correctAnswers[0] ?? "";
}

// Stored answers are raw values (an option's index, a data: URI for a file, ...) — this
// resolves them to what a human should actually see in the host-facing breakdown/export.
function submittedAnswerText(question, value) {
  if (value === undefined || value === null || value === "") return null;
  if (CHOICE_TYPES.has(question.type)) {
    return question.options[Number(value)] ?? null;
  }
  if (question.type === "checkboxes") {
    const indices = Array.isArray(value) ? value : [];
    return indices.map((i) => question.options[Number(i)]).filter(Boolean).join(", ") || null;
  }
  if (question.type === "file_upload") {
    return "File attached";
  }
  if (question.type === "matrix" || question.type === "matrix_checkbox") {
    const rows = Array.isArray(question.rows) ? question.rows : [];
    const columns = Array.isArray(question.options) ? question.options : [];
    const colLabel = (colId) => columns.find((c) => c.id === colId)?.label ?? colId;
    const answers = value && typeof value === "object" ? value : {};
    if (rows.length === 0) return null;
    return rows
      .map((row) => {
        const a = answers[row.id];
        const answerText = Array.isArray(a)
          ? a.map(colLabel).join(", ") || "No answer"
          : a !== undefined && a !== null && a !== ""
          ? colLabel(a)
          : "No answer";
        return `${row.label}: ${answerText}`;
      })
      .join("; ");
  }
  return String(value);
}

// Per-question review for forms that opt in to showing it: what the respondent submitted
// (including an uploaded image's raw data: URI, and the question's own reference image if it
// had one, so both can be shown back to them for context), plus correct/incorrect and the
// accepted answer for questions that are actually gradable.
export function buildAnswerReview(questions, answers, { showCorrect = true, showMissed = true, showPoints = false } = {}) {
  return questions
    .filter((q) => q.type !== "section")
    .map((q) => {
      const gradable = isGradable(q);
      const value = answers[q.id];
      const right = gradable ? isCorrect(q, value) : null;
      return {
        questionId: q.id,
        title: q.title,
        questionImageUrl: q.imageUrl || null,
        submittedAnswer: submittedAnswerText(q, value),
        fileUrl: fileUrlOf(q, value),
        gradable,
        // What the respondent may learn is a host choice: which questions were missed, the right
        // answers, and the point values are each released separately.
        correct: gradable && (showMissed || showCorrect) ? right : null,
        correctAnswer: gradable && showCorrect ? correctAnswerText(q) : null,
        points: gradable && showPoints ? pointsOf(q) : null,
        pointsEarned: gradable && showPoints ? (right ? pointsOf(q) : 0) : null,
      };
    });
}

// A respondent's own question+answer summary (their own download/copy) — independent of
// whether grading/correct-answer disclosure is enabled, since this is just "what I answered".
export function buildRespondentSummary(questions, answers, { includeChoices = false } = {}) {
  return questions
    .filter((q) => q.type !== "section")
    .map((q) => {
      // Matrix columns are {id, label, value} objects, not plain strings like every other
      // option-based type's `options` — reduce to labels so this reads the same as any
      // other question's choice list.
      const isMatrix = q.type === "matrix" || q.type === "matrix_checkbox";
      const choiceLabels = isMatrix ? (q.options || []).map((c) => c.label) : q.options;
      return {
        title: q.title,
        type: q.type,
        submittedAnswer: submittedAnswerText(q, answers[q.id]) ?? "No answer",
        choices: includeChoices && choiceLabels?.length ? choiceLabels : null,
        fileUrl: q.type === "file_upload" ? fileUrlOf(q, answers[q.id]) : null,
        fileName: q.type === "file_upload" ? uploadedFileName(answers[q.id]) : null,
      };
    });
}

function uploadedFileName(value) {
  if (typeof value !== "string") return null;
  const hex = /^data:[^;,]+;name=([0-9a-f]+);base64,/i.exec(value)?.[1];
  if (!hex || hex.length % 2) return null;
  try {
    const bytes = new Uint8Array(hex.match(/../g).map((part) => parseInt(part, 16)));
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes).slice(0, 255);
  } catch { return null; }
}

// Full per-question breakdown for the host-facing detailed respondent view: every
// answerable question (graded or not), what was submitted, what was correct, and points.
export function buildFullBreakdown(questions, answers) {
  return questions
    .filter((q) => q.type !== "section")
    .map((q) => {
      const gradable = isGradable(q);
      const value = answers[q.id];
      return {
        questionId: q.id,
        title: q.title,
        type: q.type,
        submittedAnswer: submittedAnswerText(q, value),
        // Raw data: URI so the host can actually view/download what was uploaded —
        // submittedAnswer above stays a human label since the full value is too large for it.
        fileUrl: fileUrlOf(q, value),
        correctAnswer: gradable ? correctAnswerText(q) : null,
        gradable,
        correct: gradable ? isCorrect(q, answers[q.id]) : null,
        points: gradable ? pointsOf(q) : null,
        pointsEarned: gradable ? (isCorrect(q, answers[q.id]) ? pointsOf(q) : 0) : null,
      };
    });
}
