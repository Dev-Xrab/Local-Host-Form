import { useState } from "react";
import { Image, Pressable, View } from "react-native";
import { ChevronLeft, ChevronRight, Download, Eye, EyeOff } from "lucide-react-native";
import { mimeOfDataUri, safeBaseName, safeExtensionForDataUri } from "../../src/lib/fileTypes";
import { Button, Dialog, IconButton, Text, radius, space, useTheme } from "../../ui";
import { saveDataUri } from "../../lib/saveFile";
import { FilePreview } from "./FilePreview";

export interface BreakdownItem {
  questionId: string; title?: string; gradable?: boolean; correct?: boolean; points?: number; pointsEarned?: number;
  submittedAnswer?: unknown; correctAnswer?: unknown; fileUrl?: string | null;
}
export interface RespondentDetail {
  respondentName?: string; score?: number | null; maxScore?: number | null; submittedAt?: string | null; editCode?: string | null; breakdown: BreakdownItem[];
}

const format = (v: unknown) => (v === null || v === undefined || v === "" ? null : Array.isArray(v) ? v.join(", ") || null : String(v));

type Kind = "image" | "pdf" | "video" | "audio" | "other";
// Anything that isn't an inline data: URI (e.g. a URL stored before server-side validation) is never
// previewed or fetched, since that would make this machine request an arbitrary address.
function fileKind(uri: string): Kind {
  if (!uri.startsWith("data:")) return "other";
  const mime = mimeOfDataUri(uri);
  if (mime.startsWith("image/")) return "image";
  if (mime === "application/pdf") return "pdf";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "other";
}
// The extension comes from a fixed allowlist, never from the MIME type the respondent's data: URI declares.
const downloadName = (uri: string, title?: string) => `${safeBaseName(title)}.${safeExtensionForDataUri(uri)}`;

export function RespondentDialog({ respondent, onClose, onPrev, onNext, position }: {
  respondent: RespondentDetail | null; onClose: () => void; onPrev: (() => void) | null; onNext: (() => void) | null; position: { index: number; total: number } | null;
}) {
  const { colors } = useTheme();
  const [showCode, setShowCode] = useState(false);
  const [preview, setPreview] = useState<{ url: string; title?: string; kind: Kind } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!respondent) return null;
  const pct = respondent.maxScore != null && respondent.score != null ? Math.round((respondent.score / respondent.maxScore) * 1000) / 10 : null;

  const save = async (url: string, title?: string) => {
    try {
      setError(null);
      await saveDataUri(downloadName(url, title), url);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <>
      <Dialog visible={!preview} title={respondent.respondentName || "Respondent"} onClose={onClose} width={640}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space[2] }}>
          <View>
            <Text variant="display">{respondent.score ?? "—"}<Text variant="title" tone="secondary">{respondent.maxScore != null ? ` / ${respondent.maxScore}` : ""}</Text></Text>
            <Text variant="small" tone="secondary">{pct != null ? `${pct}%` : "Not graded"}{respondent.submittedAt ? ` · Submitted ${new Date(respondent.submittedAt).toLocaleString()}` : ""}</Text>
          </View>
          {onPrev || onNext ? (
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <IconButton icon={ChevronLeft} label="Previous respondent" disabled={!onPrev} onPress={() => onPrev?.()} />
              {position ? <Text variant="small" tone="secondary">{position.index + 1} / {position.total}</Text> : null}
              <IconButton icon={ChevronRight} label="Next respondent" disabled={!onNext} onPress={() => onNext?.()} />
            </View>
          ) : null}
        </View>

        {respondent.editCode ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
            <Text variant="small" tone="secondary">Edit code</Text>
            <Text variant="bodyStrong" selectable>{showCode ? respondent.editCode : "•".repeat(respondent.editCode.length)}</Text>
            <IconButton icon={showCode ? EyeOff : Eye} label={showCode ? "Hide edit code" : "Show edit code"} onPress={() => setShowCode((v) => !v)} />
          </View>
        ) : null}
        {error ? <Text variant="small" tone="danger">{error}</Text> : null}

        {respondent.breakdown.map((b, i) => {
          const answer = format(b.submittedAnswer);
          const correct = format(b.correctAnswer);
          const kind = b.fileUrl ? fileKind(b.fileUrl) : "other";
          return (
            <View key={b.questionId} style={{ gap: space[2], paddingTop: space[3], borderTopWidth: 1, borderTopColor: colors.border }}>
              <View style={{ flexDirection: "row", gap: space[2], alignItems: "flex-start" }}>
                <Text variant="label" tone="tertiary" style={{ minWidth: 20 }}>{i + 1}</Text>
                <Text variant="bodyStrong" style={{ flex: 1 }}>{b.title || "Untitled question"}</Text>
                {b.gradable ? <Text variant="small" tone={b.correct ? "success" : "danger"}>{b.correct ? "Correct" : "Incorrect"} · {b.pointsEarned}/{b.points}</Text> : null}
              </View>
              {b.fileUrl ? (
                <View style={{ gap: space[2], alignItems: "flex-start" }}>
                  {kind === "image" ? (
                    <Pressable accessibilityRole="button" accessibilityLabel="View full size" onPress={() => setPreview({ url: b.fileUrl!, title: b.title, kind })}>
                      <Image source={{ uri: b.fileUrl }} accessibilityLabel={b.title || "Uploaded file"} resizeMode="cover" style={{ width: 160, height: 110, borderRadius: radius.md }} />
                    </Pressable>
                  ) : null}
                  <View style={{ flexDirection: "row", gap: space[2] }}>
                    {kind !== "other" ? <Button label="Preview" icon={Eye} compact onPress={() => setPreview({ url: b.fileUrl!, title: b.title, kind })} /> : null}
                    <Button label="Download" icon={Download} compact onPress={() => save(b.fileUrl!, b.title)} />
                  </View>
                </View>
              ) : (
                <View style={{ padding: space[3], borderRadius: radius.md, backgroundColor: colors.surfaceMuted }}>
                  <Text tone={answer ? "default" : "tertiary"}>{answer || "No answer"}</Text>
                </View>
              )}
              {b.gradable && !b.correct && correct ? <Text variant="small" tone="secondary">Correct answer: <Text variant="small" style={{ fontWeight: "700" }}>{correct}</Text></Text> : null}
            </View>
          );
        })}
      </Dialog>

      <Dialog visible={!!preview} title={preview?.title || "Attachment"} onClose={() => setPreview(null)} width={760} footer={preview ? <Button label="Download" icon={Download} onPress={() => save(preview.url, preview.title)} /> : undefined}>
        {preview ? <FilePreview url={preview.url} kind={preview.kind} title={preview.title} /> : null}
      </Dialog>
    </>
  );
}
