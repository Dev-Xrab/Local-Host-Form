interface ExportQuestion {
  id: string; type: string; title?: string; description?: string; showDescription?: boolean; showImage?: boolean; required?: boolean;
  options?: unknown[]; scale?: object; rows?: unknown[]; imageUrl?: string | null; correctAnswerIndex?: unknown[]; correctAnswers?: unknown[]; points?: number;
}
interface ExportResponse {
  respondentName?: string; sessionName?: string; startedAt?: string | null; submittedAt?: string | null; score?: number | null; maxScore?: number | null; answers?: object;
}
interface FullForm { title?: string; description?: string; settings?: object; bannerImage?: string | null; questions?: ExportQuestion[] }

/**
 * A form's full definition as one portable JSON file. Question images are already inline base64
 * data: URIs, so they travel with the file. Server-specific fields (id, subjectId, timestamps) are
 * dropped since importing always creates a fresh form. `responses` are keyed by the exported
 * question ids so the importer can remap them (see server/forms/routes.js POST /import). In-progress
 * attempts and per-device fields (device id, edit code, sync state) are left out.
 */
export function buildFormExport(form: FullForm, responses?: ExportResponse[]): { filename: string; json: string } {
  const out: Record<string, unknown> = {
    title: form.title || "",
    description: form.description || "",
    settings: form.settings || {},
    bannerImage: form.bannerImage || null,
    questions: (form.questions || []).map((q) => ({
      id: q.id,
      type: q.type,
      title: q.title || "",
      description: q.description || "",
      showDescription: !!q.showDescription,
      showImage: !!q.showImage,
      required: !!q.required,
      options: q.options || [],
      scale: q.scale || {},
      rows: q.rows || [],
      imageUrl: q.imageUrl || null,
      correctAnswerIndex: q.correctAnswerIndex || [],
      correctAnswers: q.correctAnswers || [],
      points: q.points ?? 1,
    })),
  };
  if (responses) {
    out.responses = responses.map((r) => ({
      respondentName: r.respondentName || "",
      sessionName: r.sessionName || "",
      startedAt: r.startedAt || null,
      submittedAt: r.submittedAt || null,
      score: r.score ?? null,
      maxScore: r.maxScore ?? null,
      answers: r.answers || {},
    }));
  }
  return { filename: `${(form.title || "form").trim().replace(/\s+/g, "-").toLowerCase()}.json`, json: JSON.stringify(out, null, 2) };
}
