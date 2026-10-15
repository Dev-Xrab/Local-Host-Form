// The respondent's own PDF copy is drawn on a canvas, so it's available on web and desktop only.
export const canDownloadAnswers = false;
export async function downloadAnswers(_args: unknown): Promise<void> {
  throw new Error("Downloading answers is only available in the web and desktop apps for now.");
}
