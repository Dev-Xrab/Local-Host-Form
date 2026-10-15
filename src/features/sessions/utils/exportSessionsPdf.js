import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { downloadBytes } from "../../../../lib/downloadBytes";

// PDF counterpart of exportSessionsToWorkbook (export.js): the same session data as a print-ready
// report — a cover with headline numbers, a per-session results table, an optional "who responded"
// matrix (Bulk Export), and optionally every respondent's answers. Black & white to match the app.
const MARGIN = 40;
const INK = [55, 53, 47];
const MUTED = [120, 119, 116];
const RULE = [233, 233, 231];
const PANEL = [247, 247, 245];

const formatAnswer = (value) => {
  if (value === null || value === undefined || value === "") return "No answer";
  return Array.isArray(value) ? value.join(", ") || "No answer" : String(value);
};

const dateTime = (iso) => (iso ? new Date(iso).toLocaleString() : "—");

function ensureSpace(doc, y, needed) {
  if (y + needed <= doc.internal.pageSize.height - 56) return y;
  doc.addPage();
  return MARGIN + 10;
}

function heading(doc, text, y, { size = 13, sub } = {}) {
  y = ensureSpace(doc, y, sub ? 44 : 30);
  doc.setFont(undefined, "bold");
  doc.setFontSize(size);
  doc.setTextColor(...INK);
  doc.text(text, MARGIN, y);
  if (sub) {
    doc.setFont(undefined, "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...MUTED);
    doc.text(sub, MARGIN, y + 14);
    return y + 26;
  }
  return y + 14;
}

const TABLE_STYLE = {
  theme: "grid",
  headStyles: { fillColor: INK, textColor: 255, fontSize: 8.5, fontStyle: "bold" },
  styles: { fontSize: 8.5, cellPadding: 5, lineColor: RULE, lineWidth: 0.5, textColor: INK },
  alternateRowStyles: { fillColor: PANEL },
};

function addFooters(doc, label) {
  const total = doc.internal.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    const { width, height } = doc.internal.pageSize;
    doc.setDrawColor(...RULE);
    doc.line(MARGIN, height - 36, width - MARGIN, height - 36);
    doc.setFontSize(8.5);
    doc.setFont(undefined, "normal");
    doc.setTextColor(...MUTED);
    doc.text(`Self Host Form  ·  ${label}`, MARGIN, height - 22);
    doc.text(`Page ${i} of ${total}`, width - MARGIN, height - 22, { align: "right" });
  }
}

function scoreStats(respondents) {
  const scored = respondents.filter((r) => r.status === "submitted" && r.maxScore);
  if (scored.length === 0) return null;
  const pcts = scored.map((r) => (r.score / r.maxScore) * 100);
  const avg = pcts.reduce((s, n) => s + n, 0) / pcts.length;
  return {
    avg: Math.round(avg * 10) / 10,
    high: Math.round(Math.max(...pcts) * 10) / 10,
    low: Math.round(Math.min(...pcts) * 10) / 10,
  };
}

// `sessionExports` is what GET /api/sessions/:id/export returns, one per session. `matrix`
// ({ sessions, rows }, from respondentMatrix.js) adds the "who responded" table.
export async function exportSessionsToPdf(sessionExports, { matrix, includeAnswers = true } = {}) {
  const wide = (matrix?.sessions.length ?? 0) > 4;
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: wide ? "landscape" : "portrait" });
  const pageW = doc.internal.pageSize.width;
  const single = sessionExports.length === 1;
  const totalRespondents = sessionExports.reduce((n, s) => n + s.respondents.length, 0);
  const title = single ? sessionExports[0].session.name || "Session report" : "Bulk session report";

  // ---- Cover ----
  doc.setFont(undefined, "bold");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text("SELF HOST FORM  ·  RESULTS", MARGIN, 44);
  doc.setFontSize(22);
  doc.setTextColor(...INK);
  doc.text(title, MARGIN, 70);
  doc.setFont(undefined, "normal");
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text(
    [
      single ? sessionExports[0].formTitle : `${sessionExports.length} sessions`,
      `${totalRespondents} respondent${totalRespondents === 1 ? "" : "s"}`,
      `Exported ${new Date().toLocaleString()}`,
    ]
      .filter(Boolean)
      .join("   ·   "),
    MARGIN,
    88
  );
  let y = 116;

  // ---- Overview: one row per session ----
  y = heading(doc, "Overview", y);
  autoTable(doc, {
    ...TABLE_STYLE,
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [["Session", "Form", "Respondents", "Submitted", "Avg score", "Highest", "Lowest"]],
    body: sessionExports.map(({ session, formTitle, respondents }) => {
      const stats = scoreStats(respondents);
      return [
        session.name || "Untitled session",
        formTitle,
        String(respondents.length),
        String(respondents.filter((r) => r.status === "submitted").length),
        stats ? `${stats.avg}%` : "—",
        stats ? `${stats.high}%` : "—",
        stats ? `${stats.low}%` : "—",
      ];
    }),
  });
  y = doc.lastAutoTable.finalY + 26;

  // ---- Who responded (Bulk Export matrix) ----
  if (matrix && matrix.rows.length > 0) {
    y = heading(doc, "Responses by respondent", y, {
      sub: "Whether each respondent submitted a response to each session, with their score where graded.",
    });
    autoTable(doc, {
      ...TABLE_STYLE,
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [["Respondent", "Student ID", ...matrix.sessions.map((s) => s.name || s.formTitle)]],
      body: matrix.rows.map((row) => [
        row.matched ? row.name : `${row.name} (not on roster)`,
        row.studentId || "",
        ...matrix.sessions.map((s) => {
          const r = row.cells[s.id];
          if (!r) return "—";
          return r.score != null && r.maxScore != null ? `${r.score}/${r.maxScore}` : "Responded";
        }),
      ]),
      columnStyles: { 0: { fontStyle: "bold" } },
    });
    y = doc.lastAutoTable.finalY + 26;
  }

  // ---- Per session ----
  sessionExports.forEach(({ session, formTitle, respondents }, index) => {
    // A lone session carries on right under the overview; several each start on a fresh page.
    if (!single || index > 0) {
      doc.addPage();
      y = MARGIN + 10;
    }
    y = heading(doc, session.name || "Untitled session", y, { size: 16, sub: formTitle });

    autoTable(doc, {
      ...TABLE_STYLE,
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [["Respondent", "Status", "Started", "Submitted", "Score", "%"]],
      body: respondents.length
        ? respondents.map((r) => [
            r.respondentName || "Anonymous",
            r.status === "submitted" ? "Submitted" : "In progress",
            dateTime(r.startedAt),
            dateTime(r.submittedAt),
            r.maxScore != null ? `${r.score}/${r.maxScore}` : "—",
            r.percentage != null ? `${r.percentage}%` : "—",
          ])
        : [["No respondents", "", "", "", "", ""]],
      columnStyles: { 0: { fontStyle: "bold" } },
    });
    y = doc.lastAutoTable.finalY + 24;

    if (!includeAnswers) return;

    respondents
      .filter((r) => r.status === "submitted")
      .forEach((r) => {
        y = ensureSpace(doc, y, 90);
        doc.setFont(undefined, "bold");
        doc.setFontSize(11);
        doc.setTextColor(...INK);
        doc.text(r.respondentName || "Anonymous", MARGIN, y);
        if (r.maxScore != null) {
          doc.setFont(undefined, "normal");
          doc.setFontSize(9.5);
          doc.setTextColor(...MUTED);
          doc.text(`Score ${r.score}/${r.maxScore}${r.percentage != null ? ` (${r.percentage}%)` : ""}`, pageW - MARGIN, y, {
            align: "right",
          });
        }
        const graded = r.breakdown.some((b) => b.gradable);
        autoTable(doc, {
          ...TABLE_STYLE,
          startY: y + 8,
          margin: { left: MARGIN, right: MARGIN },
          head: [graded ? ["#", "Question", "Answer", "Result"] : ["#", "Question", "Answer"]],
          body: r.breakdown.map((b, i) => {
            const answer = b.fileUrl ? "File attached" : formatAnswer(b.submittedAnswer);
            if (!graded) return [String(i + 1), b.title || "Untitled question", answer];
            const result = !b.gradable
              ? "—"
              : b.correct
                ? `Correct (${b.pointsEarned}/${b.points})`
                : `Incorrect (${b.pointsEarned}/${b.points}) — ${formatAnswer(b.correctAnswer)}`;
            return [String(i + 1), b.title || "Untitled question", answer, result];
          }),
          columnStyles: graded
            ? { 0: { cellWidth: 22 }, 1: { cellWidth: "auto" }, 2: { cellWidth: "auto" }, 3: { cellWidth: 120 } }
            : { 0: { cellWidth: 22 }, 1: { cellWidth: 200 } },
        });
        y = doc.lastAutoTable.finalY + 22;
      });
  });

  addFooters(doc, title);
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "sessions";
  await downloadBytes(new Uint8Array(doc.output("arraybuffer")), `${base}-${new Date().toISOString().slice(0, 10)}.pdf`, "application/pdf");
}
