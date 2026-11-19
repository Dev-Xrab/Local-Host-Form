// Whether a form is a quiz (points, answer keys, scores). The host's explicit choice wins; forms
// saved before the setting existed count as quizzes when any question already has an answer key.
// server/responses/grading.js keeps its own copy (isQuizForm), kept in sync by convention.
const hasKey = (q) =>
  (Array.isArray(q.correctAnswerIndex) && q.correctAnswerIndex.length > 0) ||
  (Array.isArray(q.correctAnswers) && q.correctAnswers.length > 0);

export function isQuiz(settings, questions) {
  if (typeof settings?.isQuiz === "boolean") return settings.isQuiz;
  return (questions || []).some((q) => !q.removedAt && q.type !== "section" && hasKey(q));
}
