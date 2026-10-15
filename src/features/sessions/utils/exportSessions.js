import { exportSessionsToWorkbook } from "./export";
import { exportSessionsToPdf } from "./exportSessionsPdf";

// One entry point for "export these sessions" so the session page and Bulk Export offer the same
// two formats and never drift: `format` is "excel" (editable workbook) or "pdf" (print-ready report).
export async function exportSessions(format, sessionExports, { matrix, includeAnswers = true } = {}) {
  if (format === "pdf") {
    await exportSessionsToPdf(sessionExports, { matrix, includeAnswers });
    return;
  }
  await exportSessionsToWorkbook(sessionExports, { matrix });
}
