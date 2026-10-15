import ExcelJS from "exceljs";
import JSZip from "jszip";
import { safeExtensionForDataUri } from "../../../lib/fileTypes";
import { downloadBytes } from "../../../../lib/downloadBytes";

const sanitizeSheetName = (name) => name.replace(/[:\\/?*[\]]/g, "").trim().slice(0, 31) || "Sheet";
const slug = (name) => (name || "").trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") || "x";

// Excel sheet names must be unique (and <=31 chars) within a workbook — used to keep each
// session's answer grid on its own sheet even when two sessions share a name.
function uniqueSheetName(base, usedNames) {
  const clean = sanitizeSheetName(base);
  if (!usedNames.has(clean)) {
    usedNames.add(clean);
    return clean;
  }
  let i = 2;
  let candidate;
  do {
    const suffix = ` (${i})`;
    candidate = `${clean.slice(0, 31 - suffix.length)}${suffix}`;
    i++;
  } while (usedNames.has(candidate));
  usedNames.add(candidate);
  return candidate;
}

// Allowlisted extension only — see src/lib/fileTypes.js.
function fileExtensionFromDataUri(dataUri) {
  return safeExtensionForDataUri(dataUri);
}

function dataUriToBytes(dataUri) {
  const base64 = dataUri.split(",")[1] || "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// StoneArch's own dark accent (#37352f) and a light neutral for banding — matches the app's own
// visual language (dashboard-page.css) rather than a generic spreadsheet look.
const HEADER_FILL = "FF37352F";
const HEADER_FONT = "FFFFFFFF";
const BAND_FILL = "FFF7F7F5";
const BORDER_COLOR = "FFE9E9E7";
const THIN_BORDER = { style: "thin", color: { argb: BORDER_COLOR } };

// Bold white-on-dark header row, a frozen top row so it stays visible while scrolling, and
// column widths sized from actual content instead of Excel's default fixed 8.43 — the concrete
// "professional format" gap the plain header-only sheet had before.
function styleHeaderRow(row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: HEADER_FONT } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    cell.alignment = { vertical: "middle" };
    cell.border = { bottom: THIN_BORDER };
  });
  row.height = 20;
}

function autoSizeColumns(sheet, grid, { min = 10, max = 48 } = {}) {
  const widths = [];
  grid.forEach((row) => {
    row.forEach((value, i) => {
      const len = String(value ?? "").length;
      widths[i] = Math.max(widths[i] || min, Math.min(max, len + 2));
    });
  });
  widths.forEach((w, i) => {
    sheet.getColumn(i + 1).width = w;
  });
}

// Exported for reuse by any other client-side XLSX export in the app —
// one shared "professional format" look (dark header, banded rows, sized columns) instead of
// each export screen reinventing its own styling. `infoLines` (form title / subject / export
// date / response count, etc.) renders as a small bold block above the header row instead of
// leaving every export as a bare column-headers-only sheet.
export function addGridSheet(wb, sheetName, grid, { bandedFrom, skipBandRows = 0, infoLines = [] } = {}) {
  const sheet = wb.addWorksheet(sheetName);

  infoLines.forEach((line, i) => {
    const row = sheet.addRow([line]);
    row.font = { bold: true, size: i === 0 ? 13 : 11, color: { argb: "FF37352F" } };
  });
  if (infoLines.length) sheet.addRow([]);

  const headerRowIndex = sheet.rowCount + 1;
  grid.forEach((row) => sheet.addRow(row));
  styleHeaderRow(sheet.getRow(headerRowIndex));
  autoSizeColumns(sheet, grid);
  sheet.views = [{ state: "frozen", ySplit: headerRowIndex }];

  // Light row banding from the row after the header on, and a thin border under every cell —
  // makes a wide answers grid (many respondent columns) far easier to scan than an unstyled sheet.
  // skipBandRows carves out N rows right after the header (e.g. a "Correct Answer"/"Points"
  // answer key) that should read as fixed reference rows, not part of the striped data below.
  const bandStart = bandedFrom ?? headerRowIndex + skipBandRows;
  for (let r = bandStart + 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = { bottom: THIN_BORDER };
      if ((r - bandStart) % 2 === 0) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BAND_FILL } };
      }
    });
  }
  return sheet;
}

// One respondent per row, one question per column — matches the shape most graders expect from
// a form export (Google Forms' own response sheet works the same way): scroll down to see more
// respondents, scroll right to see more questions. A question's correct answer/points apply to
// every respondent, not to one row, so they get two small header-adjacent rows of their own
// ("Correct Answer" / "Points") rather than a per-respondent column, and are only included at
// all when at least one question on this form is actually gradable.
//
// A file-upload answer isn't text — its raw value is a data: URI (see grading.js). exceljs can
// embed real images, but a general file (pdf, video, arbitrary upload) still can't live in a
// cell — so the actual bytes are pulled out into `fileEntries` (to be zipped up alongside the
// workbook) and the cell holds that file's path within the zip, so a grader can find it from
// the sheet.
function buildAnswersGrid(sheetFolder, respondents, fileEntries) {
  if (respondents.length === 0) return { grid: [["No respondents"]], metaRowCount: 0 };

  const questions = respondents[0].breakdown.map((b) => ({
    title: b.title || "Untitled question",
    correctAnswer: b.gradable ? b.correctAnswer ?? "" : "",
    points: b.gradable ? b.points ?? "" : "",
  }));

  const formatAnswer = (value) => {
    if (value === null || value === undefined || value === "") return "";
    return Array.isArray(value) ? value.join(", ") : value;
  };

  const header = ["Respondent", ...questions.map((q) => q.title)];
  const hasGradable = questions.some((q) => q.correctAnswer !== "" || q.points !== "");
  const metaRows = hasGradable
    ? [
        ["Correct Answer", ...questions.map((q) => q.correctAnswer)],
        ["Points", ...questions.map((q) => q.points)],
      ]
    : [];

  const rows = respondents.map((r, ri) => [
    r.respondentName || "Anonymous",
    ...questions.map((q, i) => {
      const b = r.breakdown[i];
      if (b?.fileUrl) {
        const ext = fileExtensionFromDataUri(b.fileUrl);
        const path = `files/${sheetFolder}/${slug(r.respondentName)}-${ri + 1}-q${i + 1}.${ext}`;
        fileEntries.push({ path, bytes: dataUriToBytes(b.fileUrl) });
        return path;
      }
      return formatAnswer(b?.submittedAnswer);
    }),
  ]);

  return { grid: [header, ...metaRows, ...rows], metaRowCount: metaRows.length };
}

// Browser/Electron: a normal download. Phone: written to cache and handed to the share sheet.
export function triggerDownload(data, filename, mime) {
  return downloadBytes(data, filename, mime);
}

// Reuses the same client-side XLSX generation approach as the rest of the app (no server-side
// export infra exists or is needed) — one workbook: a results summary sheet (one row per
// respondent) plus one answers-grid sheet per session (one row per question, one column per
// respondent). When any answer includes an uploaded file, the workbook is bundled into a .zip
// together with those files (under files/<session>/...) instead of downloading a bare .xlsx,
// since the file itself — not just a "File attached" label — needs to actually be handed over.
// `matrix` (optional, { sessions, rows } from features/sessions/utils/respondentMatrix.js) adds a
// leading "Responses" sheet mirroring the Bulk Export table: one row per respondent, one column per
// session, saying whether they responded (and their score, when the session was graded).
export async function exportSessionsToWorkbook(sessionExports, { matrix } = {}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Self Host Form";
  wb.created = new Date();

  const usedSheetNames = new Set();
  const fileEntries = [];

  const summaryHeader = [
    "Session",
    "Form",
    "Respondent",
    "Status",
    "Started At",
    "Submitted At",
    "Score",
    "Total Points",
    "Percentage",
  ];
  const summaryRows = [];

  sessionExports.forEach(({ session, formTitle, respondents }) => {
    respondents.forEach((r) => {
      summaryRows.push([
        session.name || "Untitled session",
        formTitle,
        r.respondentName,
        r.status === "submitted" ? "Submitted" : "In Progress",
        r.startedAt ? new Date(r.startedAt).toLocaleString() : "",
        r.submittedAt ? new Date(r.submittedAt).toLocaleString() : "",
        r.score ?? "",
        r.maxScore ?? "",
        r.percentage != null ? `${r.percentage}%` : "",
      ]);
    });
  });

  const infoLines = [
    sessionExports.length === 1 ? sessionExports[0].session.name || "Session export" : "Bulk session export",
    `Sessions: ${sessionExports.length}`,
    `Respondents: ${summaryRows.length}`,
    `Exported: ${new Date().toLocaleString()}`,
  ];

  if (matrix && matrix.rows.length > 0) {
    const matrixHeader = ["Respondent", "Student ID", "Roster Status", ...matrix.sessions.map((s) => s.name || s.formTitle)];
    const matrixRows = matrix.rows.map((row) => [
      row.name,
      row.studentId || "",
      row.matched ? "Roster" : "Not on roster",
      ...matrix.sessions.map((s) => {
        const response = row.cells[s.id];
        if (!response) return "No response";
        return response.score != null && response.maxScore != null
          ? `Responded (${response.score}/${response.maxScore})`
          : "Responded";
      }),
    ]);
    addGridSheet(wb, uniqueSheetName("Responses", usedSheetNames), [matrixHeader, ...matrixRows], {
      infoLines: [
        "Responses by respondent",
        `Sessions: ${matrix.sessions.length}`,
        `Respondents: ${matrix.rows.length}`,
        `Exported: ${new Date().toLocaleString()}`,
      ],
    });
  }

  addGridSheet(wb, uniqueSheetName("Results", usedSheetNames), [summaryHeader, ...summaryRows], { infoLines });

  sessionExports.forEach(({ session, formTitle, respondents }) => {
    const sheetName = uniqueSheetName(session.name || formTitle || "Answers", usedSheetNames);
    const { grid, metaRowCount } = buildAnswersGrid(slug(sheetName), respondents, fileEntries);
    const sheet = addGridSheet(wb, sheetName, grid, {
      infoLines: [session.name || "Untitled session", formTitle || ""],
      skipBandRows: metaRowCount,
    });
    // Bold the "Correct Answer"/"Points" rows so they read as a fixed answer key, not just two
    // more respondent rows (banding already skips them via skipBandRows above).
    if (metaRowCount > 0) {
      const headerRowIndex = sheet.rowCount - grid.length + 1;
      for (let r = headerRowIndex + 1; r <= headerRowIndex + metaRowCount; r++) {
        sheet.getRow(r).font = { bold: true, color: { argb: "FF37352F" } };
      }
    }
  });

  const nameHint = sessionExports.length === 1 ? sessionExports[0].session.name : "sessions";
  const baseFilename = `${sanitizeSheetName(nameHint || "export").toLowerCase().replace(/\s+/g, "-")}-${new Date()
    .toISOString()
    .slice(0, 10)}`;

  const xlsxBuffer = await wb.xlsx.writeBuffer();

  if (fileEntries.length === 0) {
    await triggerDownload(xlsxBuffer, `${baseFilename}.xlsx`, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    return;
  }

  const zip = new JSZip();
  zip.file(`${baseFilename}.xlsx`, xlsxBuffer);
  fileEntries.forEach(({ path, bytes }) => zip.file(path, bytes));

  const zipBytes = await zip.generateAsync({ type: "uint8array" });
  await triggerDownload(zipBytes, `${baseFilename}.zip`, "application/zip");
}
