// Loaded lazily so exceljs/jspdf only download when someone actually exports.
export const canExportResponses = true;

export async function exportFormResponses(format: "excel" | "pdf", form: unknown, responses: unknown[], subjectName?: string): Promise<void> {
  if (format === "excel") {
    const { exportFormResponsesToWorkbook } = await import("../src/features/forms/utils/exportResponses");
    await exportFormResponsesToWorkbook(form, responses, subjectName);
  } else {
    const { exportFormResponsesToPdf } = await import("../src/features/forms/utils/exportPdf");
    await exportFormResponsesToPdf(form, responses, subjectName);
  }
}
