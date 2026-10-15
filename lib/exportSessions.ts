// Loaded lazily so exceljs/jspdf only download when someone actually exports.
export const canExport = true;

export async function exportSessions(format: "excel" | "pdf", data: unknown[], opts: { matrix?: unknown; includeAnswers?: boolean } = {}): Promise<void> {
  const mod = await import("../src/features/sessions/utils/exportSessions");
  await mod.exportSessions(format, data, opts);
}
