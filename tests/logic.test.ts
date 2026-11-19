// Run with `npm test`. Covers the pure logic the UI relies on; the screens themselves are
// exercised in the browser (see docs/migration/PLAN.md for what was and wasn't verified).
import { describe, expect, it } from "vitest";
import { buildFormExport } from "../lib/formExport";
import { parseRosterText, rosterToText } from "../lib/roster";
import { QUESTION_TYPES, createQuestionDefaults, getQuestionType } from "../src/lib/questionTypes";
import { getMatrixMissingRows } from "../src/lib/matrixQuestions";
import { groupIntoPages } from "../src/features/responses/utils/groupIntoPages";
import { SUBMIT, computePath, listSections, nextPage, questionsOnPath } from "../src/lib/sectionFlow";
import { questionsOnPath as serverQuestionsOnPath } from "../server/responses/sectionFlow.js";
import { formatDuration, mostMissed, overviewStats, questionAccuracy } from "../src/features/forms/utils/summaryStats";
import { percentOf } from "../src/features/forms/utils/responseAnalytics";

describe("roster text", () => {
  it("parses name, optional id and email, one student per line", () => {
    const rows = parseRosterText("Juan Dela Cruz, 2021-0456, juan@school.edu\nMaria Santos\n\n  ,orphan");
    expect(rows).toEqual([
      { name: "Juan Dela Cruz", studentId: "2021-0456", email: "juan@school.edu" },
      { name: "Maria Santos", studentId: "", email: "" },
    ]);
  });

  it("lets a later line win for the same name, ignoring case", () => {
    const rows = parseRosterText("ana, 1\nANA, 2");
    expect(rows).toHaveLength(1);
    expect(rows[0].studentId).toBe("2");
  });

  it("round-trips through rosterToText without trailing commas", () => {
    expect(rosterToText([{ id: "1", name: "Ana", studentId: "7" }, { id: "2", name: "Ben" }])).toBe("Ana, 7\nBen");
  });
});

describe("form export", () => {
  it("drops server-only fields and keeps the question definition", () => {
    const { filename, json } = buildFormExport({ title: "Mid Term  Quiz", questions: [{ id: "q1", type: "short_answer", title: "Capital?", points: 2 }] });
    const out = JSON.parse(json);
    expect(filename).toBe("mid-term-quiz.json");
    expect(out.questions[0].points).toBe(2);
    expect(out).not.toHaveProperty("id");
    expect(out).not.toHaveProperty("responses");
  });

  it("includes responses only when asked", () => {
    const { json } = buildFormExport({ title: "T", questions: [] }, [{ respondentName: "Ana", score: 1, maxScore: 2, answers: { q1: 0 } }]);
    expect(JSON.parse(json).responses[0].respondentName).toBe("Ana");
  });
  it("carries pinned assessment definitions with response backups", () => {
    const definition = { id: "snapshot-1", provenance: "pinned", title: "Original", questions: [{ id: "q1", type: "multiple_choice", title: "Old wording" }] };
    const { json } = buildFormExport(
      { title: "Edited", questions: [{ id: "q1", type: "multiple_choice", title: "New wording" }] },
      [{ respondentName: "Ana", formSnapshotId: "snapshot-1", answers: { q1: 1 }, score: 1, maxScore: 1 }],
      [definition]
    );
    const backup = JSON.parse(json);
    expect(backup.responses[0].assessmentId).toBe("snapshot-1");
    expect(backup.assessmentDefinitions[0].questions[0].title).toBe("Old wording");
  });
  it("refuses a response backup when a pinned definition is missing", () => {
    expect(() => buildFormExport(
      { title: "Edited", questions: [] },
      [{ formSnapshotId: "missing", answers: {} }],
      []
    )).toThrow("missing its assessment definition");
  });
});

describe("question types", () => {
  it("marks only the gradable types as gradable", () => {
    const gradable = QUESTION_TYPES.filter((t: { isGradable: boolean }) => t.isGradable).map((t: { id: string }) => t.id).sort();
    expect(gradable).toEqual(["checkboxes", "dropdown", "multiple_choice", "paragraph", "short_answer"]);
  });

  it("seeds option-based questions with an option and grid questions with rows and columns", () => {
    expect(createQuestionDefaults("multiple_choice").options).toEqual(["Option 1"]);
    const grid = createQuestionDefaults("matrix");
    expect(grid.rows).toHaveLength(3);
    expect(grid.options).toHaveLength(3);
    expect(getQuestionType("matrix")?.isGridBased).toBe(true);
  });
});

describe("matrix validation", () => {
  const q = { type: "matrix", rows: [{ id: "r1" }, { id: "r2" }], scale: { requireAllRows: true } };
  it("reports every unanswered row when all rows are required", () => {
    expect(getMatrixMissingRows(q, { r1: "c1" }).map((r: { id: string }) => r.id)).toEqual(["r2"]);
  });
  it("needs just one answer when not every row is required", () => {
    expect(getMatrixMissingRows({ ...q, scale: { requireAllRows: false } }, { r1: "c1" })).toHaveLength(0);
  });
});

describe("paging and analytics", () => {
  it("starts a new page at each section and drops an empty leading page", () => {
    const pages = groupIntoPages([{ id: "s1", type: "section", title: "Part A" }, { id: "q1", type: "short_answer" }, { id: "s2", type: "section", title: "Part B" }, { id: "q2", type: "short_answer" }]);
    expect(pages).toHaveLength(2);
    expect(pages[0].title).toBe("Part A");
    expect(pages[1].questions[0].id).toBe("q2");
  });

  it("rounds percentages to one decimal and guards a zero total", () => {
    expect(percentOf(1, 3)).toBe(33.3);
    expect(percentOf(0, 0)).toBe(0);
  });
});

describe("section links", () => {
  // Page 1 asks who the respondent is; "Student" jumps to section C, "Teacher" to section B, and
  // "Guest" submits. Section B ends by sending respondents straight to submit.
  const choice = { id: "who", type: "multiple_choice", options: ["Student", "Teacher", "Guest", "Other"], navigation: { options: ["c", "b", "submit", null] } };
  const form = [
    choice,
    { id: "b", type: "section", title: "B", navigation: { next: "submit" } },
    { id: "qb", type: "short_answer", required: true },
    { id: "c", type: "section", title: "C" },
    { id: "qc", type: "short_answer", required: true },
  ];
  const pages = groupIntoPages(form);

  it("sends a respondent to the section their answer links to", () => {
    expect(nextPage(pages, 0, { who: 0 })).toBe(2);
    expect(nextPage(pages, 0, { who: 1 })).toBe(1);
    expect(nextPage(pages, 0, { who: 2 })).toBe(SUBMIT);
  });

  it("continues to the next section for an unlinked or missing answer", () => {
    expect(nextPage(pages, 0, { who: 3 })).toBe(1);
    expect(nextPage(pages, 0, {})).toBe(1);
  });

  it("follows 'after section' when the section has no answer-based question", () => {
    expect(nextPage(pages, 1, {})).toBe(SUBMIT);
    expect(nextPage(pages, 2, {})).toBe(SUBMIT);
  });

  it("ignores a section's own link when it holds an answer-based question", () => {
    const own = groupIntoPages([{ id: "s", type: "section" }, { ...choice, navigation: { options: [null, null, null, null] } }, { id: "t", type: "section" }, { id: "u", type: "section" }]);
    own[0].next = "u";
    expect(nextPage(own, 0, { who: 0 })).toBe(1);
  });

  it("only walks the pages an answer leads through, and stops on a loop", () => {
    expect(computePath(pages, { who: 0 })).toEqual([0, 2]);
    expect(computePath(pages, { who: 1 })).toEqual([0, 1]);
    const loop = groupIntoPages([{ id: "a", type: "section", navigation: { next: "b" } }, { id: "b", type: "section", navigation: { next: "a" } }]);
    expect(computePath(loop, {})).toEqual([0, 1]);
  });

  it("treats a link to a deleted section as 'continue'", () => {
    const dangling = groupIntoPages([{ ...choice, navigation: { options: ["gone", null, null, null] } }, { id: "b", type: "section" }]);
    expect(nextPage(dangling, 0, { who: 0 })).toBe(1);
  });

  it("numbers sections the way the editor does", () => {
    expect(listSections([{ id: "q", type: "short_answer" }, { id: "s1", type: "section", title: "A" }]).map((s: { number: number }) => s.number)).toEqual([2]);
    expect(listSections([{ id: "s1", type: "section" }, { id: "s2", type: "section" }]).map((s: { number: number }) => s.number)).toEqual([1, 2]);
  });

  it("agrees with the server's copy of the walk", () => {
    for (const answers of [{ who: 0 }, { who: 1 }, { who: 2 }, { who: 3 }, {}]) {
      const ids = (qs: { id: string }[]) => qs.map((q) => q.id);
      expect(ids(serverQuestionsOnPath(form, answers))).toEqual(ids(questionsOnPath(pages, answers)));
    }
  });
});

describe("results summary", () => {
  const at = (day: number, h = 10) => new Date(2026, 10, day, h, 0, 0).toISOString();
  const rs = [
    { id: "1", startedAt: at(1, 10), submittedAt: new Date(2026, 10, 1, 10, 2, 0).toISOString(), score: 5, maxScore: 5, breakdown: [{ questionId: "a", gradable: true, correct: true, submittedAnswer: "x" }, { questionId: "b", gradable: true, correct: true, submittedAnswer: "y" }] },
    { id: "2", startedAt: at(1, 11), submittedAt: new Date(2026, 10, 1, 11, 4, 0).toISOString(), score: 0, maxScore: 5, breakdown: [{ questionId: "a", gradable: true, correct: false, submittedAnswer: "z" }, { questionId: "b", gradable: true, correct: true, submittedAnswer: "y" }] },
    { id: "3", startedAt: at(4, 9), submittedAt: new Date(2026, 10, 4, 9, 3, 0).toISOString(), score: 4, maxScore: 5, breakdown: [{ questionId: "a", gradable: true, correct: false, submittedAnswer: "" }] },
  ];

  it("counts responses, averages completion time and finds the latest", () => {
    const s = overviewStats(rs);
    expect(s.count).toBe(3);
    expect(s.avgSeconds).toBe(Math.round((120 + 240 + 180) / 3));
    expect(s.lastAt).toBe(rs[2].submittedAt);
  });

  it("summarises scores as percentages and buckets a perfect score with 90-100", () => {
    const { scored } = overviewStats(rs);
    expect(scored).toMatchObject({ count: 3, average: 60, median: 80, lowest: 0, highest: 100 });
    expect(scored!.bins[9].count).toBe(1);
    expect(scored!.bins[8].count).toBe(1);
    expect(scored!.bins[0].count).toBe(1);
  });

  it("fills in days with no responses between the first and last", () => {
    expect(overviewStats(rs).perDay.map((d: { count: number }) => d.count)).toEqual([2, 0, 0, 1]);
  });

  it("has no scores or days for an empty or unscored set", () => {
    expect(overviewStats([])).toMatchObject({ count: 0, avgSeconds: null, lastAt: null, scored: null, perDay: [] });
    expect(overviewStats([{ submittedAt: at(1) }]).scored).toBeNull();
  });

  it("measures how many got a question right, ignoring blanks", () => {
    expect(questionAccuracy({ id: "a" }, rs)).toEqual({ answered: 2, correct: 1, percent: 50 });
    expect(questionAccuracy({ id: "none" }, rs)).toBeNull();
    expect(mostMissed([{ id: "a" }, { id: "b" }], rs).map((m: { question: { id: string } }) => m.question.id)).toEqual(["a"]);
  });

  it("formats durations", () => {
    expect(formatDuration(null)).toBe("—");
    expect(formatDuration(45)).toBe("45s");
    expect(formatDuration(125)).toBe("2m 5s");
    expect(formatDuration(3720)).toBe("1h 2m");
  });
});
