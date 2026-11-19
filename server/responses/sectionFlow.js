// Server-side copy of src/lib/sectionFlow.js plus the page grouping from
// src/features/responses/utils/groupIntoPages.js: this runtime can't import client code, so the
// two are kept in sync by convention (tests/logic.test.ts checks they agree).
//
// Which questions count for a response depends on the path the respondent took: a question in a
// section that the answers skipped is neither required nor scored.

const SUBMIT = "submit";

const hasAnswerNavigation = (q) =>
  (q.type === "multiple_choice" || q.type === "dropdown") && Array.isArray(q.navigation?.options);

const answered = (v) => v !== undefined && v !== null && v !== "";

function groupPages(questions) {
  const pages = [{ id: "page-0", title: "", description: "", next: null, questions: [] }];
  for (const q of questions) {
    if (q.type === "section") {
      pages.push({ id: q.id, title: q.title || "", description: q.description || "", next: q.navigation?.next ?? null, questions: [] });
    } else {
      pages[pages.length - 1].questions.push(q);
    }
  }
  if (pages.length > 1 && !pages[0].title && !pages[0].description && pages[0].questions.length === 0) pages.shift();
  return pages;
}

function nextPage(pages, index, answers) {
  const page = pages[index];
  const fallthrough = index + 1 < pages.length ? index + 1 : SUBMIT;
  if (!page) return SUBMIT;

  let target = null;
  let answerDriven = false;
  for (const q of page.questions) {
    if (!hasAnswerNavigation(q)) continue;
    answerDriven = true;
    const picked = answers[q.id];
    if (!answered(picked)) continue;
    const jump = q.navigation.options[Number(picked)];
    if (jump) target = jump;
  }
  if (!answerDriven) target = page.next ?? null;

  if (target === SUBMIT) return SUBMIT;
  if (target) {
    const i = pages.findIndex((p) => p.id === target);
    if (i !== -1) return i;
  }
  return fallthrough;
}

export function computePath(pages, answers) {
  const path = [];
  const seen = new Set();
  let i = pages.length ? 0 : SUBMIT;
  while (i !== SUBMIT && !seen.has(i)) {
    path.push(i);
    seen.add(i);
    i = nextPage(pages, i, answers);
  }
  return path;
}

/** Answerable questions the respondent reached, given a form's full, ordered question list. */
export function questionsOnPath(allQuestions, answers) {
  const pages = groupPages(allQuestions);
  return computePath(pages, answers).flatMap((i) => pages[i].questions);
}
