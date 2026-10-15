import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { downloadBytes } from "../../../../lib/downloadBytes";
import { aggregateQuestion, formatPercent } from "./responseAnalytics";

const MARGIN = 40;
const BRAND = [55, 53, 47]; // #37352f, matches the app's Notion-inspired accent
const MUTED = [120, 119, 116]; // #787774

function addHeader(doc, form, subjectName, responseCount) {
  doc.setFontSize(18);
  doc.setFont(undefined, "bold");
  doc.text(form.title || "Untitled form", MARGIN, 50);

  doc.setFontSize(10);
  doc.setFont(undefined, "normal");
  doc.setTextColor(...MUTED);
  const infoLine = [
    subjectName ? `Subject: ${subjectName}` : null,
    `Exported: ${new Date().toLocaleString()}`,
    `Responses: ${responseCount}`,
  ]
    .filter(Boolean)
    .join("   ·   ");
  doc.text(infoLine, MARGIN, 68);
  doc.setTextColor(0, 0, 0);
  return 96;
}

// Run once after all content is drawn — total page count isn't known until then, and jsPDF lets
// you go back to any earlier page with setPage() to stamp its footer.
function addFooters(doc) {
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const { width, height } = doc.internal.pageSize;
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTED);
    doc.text("Self Host Form", MARGIN, height - 24);
    doc.text(`Page ${i} of ${pageCount}`, width - MARGIN, height - 24, { align: "right" });
    doc.setTextColor(0, 0, 0);
  }
}

function ensureSpace(doc, y, needed) {
  if (y + needed <= doc.internal.pageSize.height - 50) return y;
  doc.addPage();
  return MARGIN;
}

// Renders one question's analytics as a small heading + a table shaped to match its kind (see
// responseAnalytics.js aggregateQuestion) — the exact same numbers the on-screen "By Question"
// view and the Excel export show, never recomputed differently here.
function addQuestionSection(doc, question, responses, y) {
  const result = aggregateQuestion(question, responses);
  y = ensureSpace(doc, y, 60);

  doc.setFontSize(11);
  doc.setFont(undefined, "bold");
  doc.text(question.title || "Untitled question", MARGIN, y);
  doc.setFont(undefined, "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(`${result.total} response${result.total === 1 ? "" : "s"}`, MARGIN, y + 13);
  doc.setTextColor(0, 0, 0);
  y += 22;

  let head;
  let body;

  if (result.kind === "matrix") {
    head = [["Row", "Option", "Count", "%"]];
    body = [];
    result.rows.forEach((row) => {
      if (row.total === 0) {
        body.push([row.rowLabel, "No answers yet", "", ""]);
        return;
      }
      row.entries.forEach((e) => {
        body.push([row.rowLabel, e.label, String(e.count), formatPercent(e.count, row.total)]);
      });
    });
    if (body.length === 0) body = [["No rows configured", "", "", ""]];
  } else if (result.kind === "bar" || result.kind === "scale") {
    head = [["Option / Value", "Count", "%"]];
    body = result.entries.length
      ? result.entries.map((e) => [e.label, String(e.count), formatPercent(e.count, result.total)])
      : [["No answers yet", "", ""]];
    if (result.kind === "scale" && result.stats) {
      body.push([
        `Average ${result.stats.avg}  ·  Median ${result.stats.median}  ·  Min ${result.stats.min}  ·  Max ${result.stats.max}`,
        "",
        "",
      ]);
    }
  } else {
    head = [["Response"]];
    body = result.entries.length ? result.entries.slice(0, 20).map((v) => [String(v)]) : [["No answers yet"]];
    if (result.entries.length > 20) {
      body.push([`… and ${result.entries.length - 20} more — see the Excel export for the full list.`]);
    }
  }

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head,
    body,
    theme: "grid",
    headStyles: { fillColor: BRAND, fontSize: 8.5 },
    styles: { fontSize: 8.5, cellPadding: 5 },
  });

  return doc.lastAutoTable.finalY + 18;
}

// Title / subject / export info -> response summary -> per-question analytics -> a detailed
// per-respondent table, each on its own logical section with proper margins and automatic page
// breaks (autoTable repeats its header row across a page split, so a long question list or
// response table never overflows unreadably onto one page).
export async function exportFormResponsesToPdf(form, responses, subjectName) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  let y = addHeader(doc, form, subjectName, responses.length);

  const scored = responses.filter((r) => r.maxScore);
  const avgPct = scored.length
    ? Math.round(
        (scored.reduce((sum, r) => sum + r.score / r.maxScore, 0) / scored.length) * 1000
      ) / 10
    : null;

  doc.setFontSize(13);
  doc.setFont(undefined, "bold");
  doc.text("Response Summary", MARGIN, y);
  y += 10;
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [["Total Responses", "Average Score"]],
    body: [[String(responses.length), avgPct != null ? `${avgPct}%` : "—"]],
    theme: "grid",
    headStyles: { fillColor: BRAND },
    styles: { fontSize: 9 },
  });
  y = doc.lastAutoTable.finalY + 26;

  const questions = (form.questions || []).filter((q) => q.type !== "section" && !q.removedAt);
  if (questions.length > 0) {
    doc.setFontSize(13);
    doc.setFont(undefined, "bold");
    doc.text("Question Analytics", MARGIN, y);
    y += 16;
    questions.forEach((q) => {
      y = addQuestionSection(doc, q, responses, y);
    });
  }

  y = ensureSpace(doc, y, 80);
  doc.setFontSize(13);
  doc.setFont(undefined, "bold");
  doc.text("Detailed Responses", MARGIN, y);
  y += 10;
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [["Respondent", "Session", "Submitted", "Score"]],
    body: responses.length
      ? responses.map((r) => [
          r.respondentName || "Anonymous",
          r.sessionName || "Untitled session",
          r.submittedAt ? new Date(r.submittedAt).toLocaleString() : "—",
          r.maxScore != null ? `${r.score}/${r.maxScore}` : "—",
        ])
      : [["No responses yet", "", "", ""]],
    theme: "striped",
    headStyles: { fillColor: BRAND },
    styles: { fontSize: 9 },
  });

  addFooters(doc);
  const filename = `${(form.title || "responses").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60)}-responses-${new Date()
    .toISOString()
    .slice(0, 10)}.pdf`;
  await downloadBytes(new Uint8Array(doc.output("arraybuffer")), filename, "application/pdf");
}
