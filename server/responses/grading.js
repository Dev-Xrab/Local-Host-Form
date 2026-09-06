const CHOICE_TYPES = new Set(["multiple_choice", "dropdown"]);

const normalize = (s) => String(s ?? "").trim().toLowerCase();
const pointsOf = (question) => Math.max(0, Number(question.points) || 0) || 1;

function isEmptyAnswer(question, value) {
  if (value === undefined || value === null) return true;
  switch (question.type) {
    case "checkboxes":
      return !Array.isArray(value) || value.length === 0;
    case "linear_scale":
      return typeof value !== "number" && typeof value !== "string";
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
  return String(value);
}

// Per-question review for forms that opt in to showing it: what the respondent submitted
// (including an uploaded image's raw data: URI, and the question's own reference image if it
// had one, so both can be shown back to them for context), plus correct/incorrect and the
// accepted answer for questions that are actually gradable.
export function buildAnswerReview(questions, answers) {
  return questions
    .filter((q) => q.type !== "section")
    .map((q) => {
      const gradable = isGradable(q);
      const value = answers[q.id];
      return {
        questionId: q.id,
        title: q.title,
        questionImageUrl: q.imageUrl || null,
        submittedAnswer: submittedAnswerText(q, value),
        fileUrl: q.type === "file_upload" && value ? value : null,
        gradable,
        correct: gradable ? isCorrect(q, value) : null,
        correctAnswer: gradable ? correctAnswerText(q) : null,
      };
    });
}

// A respondent's own question+answer summary (their own download/copy) — independent of
// whether grading/correct-answer disclosure is enabled, since this is just "what I answered".
export function buildRespondentSummary(questions, answers, { includeChoices = false } = {}) {
  return questions
    .filter((q) => q.type !== "section")
    .map((q) => ({
      title: q.title,
      type: q.type,
      submittedAnswer: submittedAnswerText(q, answers[q.id]) ?? "No answer",
      choices: includeChoices && q.options?.length ? q.options : null,
    }));
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
        fileUrl: q.type === "file_upload" && value ? value : null,
        correctAnswer: gradable ? correctAnswerText(q) : null,
        gradable,
        correct: gradable ? isCorrect(q, answers[q.id]) : null,
        points: gradable ? pointsOf(q) : null,
        pointsEarned: gradable ? (isCorrect(q, answers[q.id]) ? pointsOf(q) : 0) : null,
      };
    });
}
