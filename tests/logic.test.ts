// Run with `npm test`. Covers the pure logic the UI relies on; the screens themselves are
// exercised in the browser (see docs/migration/PLAN.md for what was and wasn't verified).
import { describe, expect, it } from "vitest";
import { buildFormExport } from "../lib/formExport";
import { parseRosterText, rosterToText } from "../lib/roster";
import { QUESTION_TYPES, createQuestionDefaults, getQuestionType } from "../src/lib/questionTypes";
import { getMatrixMissingRows } from "../src/lib/matrixQuestions";
import { groupIntoPages } from "../src/features/responses/utils/groupIntoPages";
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
