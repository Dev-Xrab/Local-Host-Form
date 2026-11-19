// Section navigation, modelled on Google Forms' "Go to section based on answer" and "After
// section N" settings. Pure, so the builder, the respondent screen and the tests share it.
//
// A target is `null` (continue to the next section), `SUBMIT` (finish the form) or a section id.
// Where a target lives:
//   - a multiple choice / dropdown question: `navigation.options[i]` is where picking option i goes
//   - a section: `navigation.next` is where the section goes once it is finished
// A section that contains an answer-based question ignores its own `next`, as Google Forms does:
// the answer decides, and an answer with no jump just continues to the next section.
//
// server/responses/sectionFlow.js runs in a separate runtime and keeps its own copy of the page
// walk, kept in sync by convention (tests/logic.test.ts checks the two agree).

export const SUBMIT = "submit";

export const supportsAnswerNavigation = (type) => type === "multiple_choice" || type === "dropdown";

export const hasAnswerNavigation = (q) =>
  !!q && supportsAnswerNavigation(q.type) && Array.isArray(q.navigation?.options);

const answered = (v) => v !== undefined && v !== null && v !== "";

/** Where to go after `pages[index]`: a page index, or SUBMIT when the form is finished. */
export function nextPage(pages, index, answers) {
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

/** Page indexes the respondent walks through with these answers, starting at the first page. */
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

/** True when any section or question in these pages redirects the flow. */
export const formHasNavigation = (pages) =>
  pages.some((p) => !!p.next || p.questions.some(hasAnswerNavigation));

/** The questions on the path, i.e. the ones that count for required checks and scoring. */
export function questionsOnPath(pages, answers) {
  return computePath(pages, answers).flatMap((i) => pages[i].questions);
}

/** Label for a target: "Continue to next section", "Submit form" or "Go to section 3 (Title)". */
export function describeTarget(target, sections) {
  if (target === SUBMIT) return "Submit form";
  if (!target) return "Continue to next section";
  const i = sections.findIndex((s) => s.id === target);
  if (i === -1) return "Continue to next section";
  return `Go to section ${sections[i].number}${sections[i].title ? ` (${sections[i].title})` : ""}`;
}

/** Sections in form order, numbered like the editor does (the leading untitled page is Section 1). */
export function listSections(questions) {
  let number = questions[0]?.type === "section" ? 0 : 1;
  return questions.filter((q) => q.type === "section").map((q) => ({ id: q.id, title: q.title || "", number: ++number }));
}

/** The section an item sits in: itself for a section, the nearest section above it for a question, else null. */
export function sectionIdOf(questions, id) {
  let current = null;
  for (const q of questions) {
    if (q.type === "section") current = q.id;
    if (q.id === id) return current;
  }
  return null;
}
