import { downloadAnswersAsPdf } from "../src/features/responses/utils/downloadAnswers";

export const canDownloadAnswers = true;
export async function downloadAnswers(args: unknown): Promise<void> {
  await downloadAnswersAsPdf(args as never);
}
