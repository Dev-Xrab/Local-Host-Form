import ExcelJS from "exceljs";
import { addGridSheet, triggerDownload } from "../../sessions/utils/export";
import { aggregateQuestion, formatPercent } from "./responseAnalytics";

// One row per respondent, one column per answerable question — mirrors the on-screen "By
// Respondent" table but with every answer spelled out instead of just score/status. A question a
// Google structural sync marked removed (see server/forms/questionDiff.js) is still included,
// labeled "(removed)", so a respondent's historical answer to it isn't silently dropped from the
// export.
function buildResponsesGrid(form, responses) {
  const questions = (form.questions || []).filter((q) => q.type !== "section");
  const header = [
    "Respondent",
    "Session",
    "Submitted",
    "Score",
    ...questions.map((q) => (q.removedAt ? `${q.title || "Untitled question"} (removed)` : q.title || "Untitled question")),
  ];

  const rows = responses.map((r) => [
    r.respondentName || "Anonymous",
    r.sessionName || "Untitled session",
    r.submittedAt ? new Date(r.submittedAt).toLocaleString() : "",
    r.maxScore != null ? `${r.score}/${r.maxScore}` : "",
    ...questions.map((q) => {
      const value = r.breakdown?.find((b) => b.questionId === q.id)?.submittedAnswer;
      if (value === null || value === undefined || value === "") return "";
      return Array.isArray(value) ? value.join(", ") : value;
    }),
  ]);

  return [header, ...rows];
}

// One row per (question, option) — or per (question, grid row, column) for grids — using the
// exact same aggregateQuestion the on-screen analytics use, so the exported numbers can never
// drift from what the host sees on screen. Open-ended questions get a single pointer row rather
// than trying to tabulate free text here; their full answers are already in the Responses sheet.
function buildQuestionStatisticsGrid(form, responses) {
  const header = ["Question", "Type", "Grid Row", "Option / Value", "Count", "Percentage", "Summary Stats"];
  const rows = [];
  const questions = (form.questions || []).filter((q) => q.type !== "section" && !q.removedAt);

  questions.forEach((q) => {
    const result = aggregateQuestion(q, responses);

    if (result.kind === "matrix") {
      if (result.rows.length === 0) {
        rows.push([q.title || "Untitled question", q.type, "", "No rows configured", "", "", ""]);
        return;
      }
      result.rows.forEach((row) => {
        if (row.total === 0) {
          rows.push([q.title || "Untitled question", q.type, row.rowLabel, "No answers yet", 0, "", ""]);
          return;
        }
        row.entries.forEach((e) => {
          rows.push([
            q.title || "Untitled question",
            q.type,
            row.rowLabel,
            e.label,
            e.count,
            formatPercent(e.count, row.total),
            "",
          ]);
        });
      });
    } else if (result.kind === "bar" || result.kind === "scale") {
      if (result.entries.length === 0) {
        rows.push([q.title || "Untitled question", q.type, "", "No answers yet", 0, "", ""]);
        return;
      }
      const stats = result.stats
        ? `avg ${result.stats.avg} / median ${result.stats.median} / min ${result.stats.min} / max ${result.stats.max}`
        : "";
      result.entries.forEach((e) => {
        rows.push([
          q.title || "Untitled question",
          q.type,
          "",
          e.label,
          e.count,
          formatPercent(e.count, result.total),
          stats,
        ]);
      });
    } else {
      rows.push([
        q.title || "Untitled question",
        q.type,
        "",
        "Open-ended — see Responses sheet",
        result.total,
        "",
        "",
      ]);
    }
  });

  return [header, ...rows];
}

// Two sheets rather than three ("Responses" and "Question Statistics") — a separate bare
// "Summary" sheet would mostly repeat the info block already on both (title/subject/date/count),
// so it's folded in instead of adding a sheet with little content of its own.
export async function exportFormResponsesToWorkbook(form, responses, subjectName) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Self Host Form";
  wb.created = new Date();

  const infoLines = [
    form.title || "Untitled form",
    subjectName ? `Subject: ${subjectName}` : null,
    `Exported: ${new Date().toLocaleString()}`,
    `Responses: ${responses.length}`,
  ].filter(Boolean);

  addGridSheet(wb, "Responses", buildResponsesGrid(form, responses), { infoLines });
  addGridSheet(wb, "Question Statistics", buildQuestionStatisticsGrid(form, responses), { infoLines });

  const buffer = await wb.xlsx.writeBuffer();
  const filename = `${(form.title || "responses").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60)}-responses-${new Date()
    .toISOString()
    .slice(0, 10)}.xlsx`;
  await triggerDownload(
    buffer,
    filename,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
}
