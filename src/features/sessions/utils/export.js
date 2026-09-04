import * as XLSX from "xlsx";
import JSZip from "jszip";

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

function fileExtensionFromDataUri(dataUri) {
  const mime = /^data:([^;]+);base64,/.exec(dataUri || "")?.[1] || "";
  return mime.split("/")[1]?.split("+")[0] || "bin";
}

function dataUriToBytes(dataUri) {
  const base64 = dataUri.split(",")[1] || "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// One question per row, one respondent per column — easier to scan/compare answers across
// a class than the old normalized (respondent, question) row-per-pair layout. Every
// respondent in a session answers the same form, so breakdown order/length lines up
// question-for-question across respondents (including ones who never submitted, whose
// unanswered questions just come back blank).
//
// A file-upload answer isn't text — its raw value is a data: URI (see grading.js). The free
// xlsx library used here can't embed real image/file objects into a sheet, so instead the
// actual bytes are pulled out into `fileEntries` (to be zipped up alongside the workbook) and
// the cell holds that file's path within the zip, so a grader can find it from the sheet.
function buildAnswersGrid(sheetFolder, respondents, fileEntries) {
  if (respondents.length === 0) return [["No respondents"]];

  const questions = respondents[0].breakdown.map((b) => ({
    title: b.title || "Untitled question",
    correctAnswer: b.gradable ? b.correctAnswer ?? "" : "",
    points: b.gradable ? b.points ?? "" : "",
  }));

  const formatAnswer = (value) => {
    if (value === null || value === undefined || value === "") return "";
    return Array.isArray(value) ? value.join(", ") : value;
  };

  const header = ["Question", "Correct Answer", "Points", ...respondents.map((r) => r.respondentName || "Anonymous")];
  const rows = questions.map((q, i) => [
    q.title,
    q.correctAnswer,
    q.points,
    ...respondents.map((r, ri) => {
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

  return [header, ...rows];
}

// Reuses the same client-side XLSX generation approach as the rest of the app (no server-side
// export infra exists or is needed) — one workbook: a results summary sheet (one row per
// respondent) plus one answers-grid sheet per session (one row per question, one column per
// respondent). When any answer includes an uploaded file, the workbook is bundled into a .zip
// together with those files (under files/<session>/...) instead of downloading a bare .xlsx,
// since the file itself — not just a "File attached" label — needs to actually be handed over.
export async function exportSessionsToWorkbook(sessionExports) {
  const wb = XLSX.utils.book_new();
  const usedSheetNames = new Set();
  const fileEntries = [];

  const summaryRows = [];

  sessionExports.forEach(({ session, formTitle, respondents }) => {
    respondents.forEach((r) => {
      summaryRows.push({
        Session: session.name || "Untitled session",
        Form: formTitle,
        Respondent: r.respondentName,
        Status: r.status === "submitted" ? "Submitted" : "In Progress",
        "Started At": r.startedAt ? new Date(r.startedAt).toLocaleString() : "",
        "Submitted At": r.submittedAt ? new Date(r.submittedAt).toLocaleString() : "",
        Score: r.score ?? "",
        "Total Points": r.maxScore ?? "",
        "Percentage": r.percentage != null ? `${r.percentage}%` : "",
      });
    });
  });

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), uniqueSheetName("Results", usedSheetNames));

  sessionExports.forEach(({ session, formTitle, respondents }) => {
    const sheetName = uniqueSheetName(session.name || formTitle || "Answers", usedSheetNames);
    const grid = buildAnswersGrid(slug(sheetName), respondents, fileEntries);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(grid), sheetName);
  });

  const nameHint = sessionExports.length === 1 ? sessionExports[0].session.name : "sessions";
  const baseFilename = `${sanitizeSheetName(nameHint || "export").toLowerCase().replace(/\s+/g, "-")}-${new Date()
    .toISOString()
    .slice(0, 10)}`;

  if (fileEntries.length === 0) {
    XLSX.writeFile(wb, `${baseFilename}.xlsx`);
    return;
  }

  const zip = new JSZip();
  zip.file(`${baseFilename}.xlsx`, XLSX.write(wb, { type: "array", bookType: "xlsx" }));
  fileEntries.forEach(({ path, bytes }) => zip.file(path, bytes));

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${baseFilename}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
