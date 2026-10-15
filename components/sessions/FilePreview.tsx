import { Image } from "react-native";
import { Text } from "../../ui";

/** Inline preview of an uploaded file. Native shows images only; the web build also previews PDF, video and audio (FilePreview.web.tsx). */
export function FilePreview({ url, kind, title }: { url: string; kind: "image" | "pdf" | "video" | "audio" | "other"; title?: string }) {
  if (kind === "image") return <Image source={{ uri: url }} accessibilityLabel={title || "Uploaded file"} resizeMode="contain" style={{ width: "100%", height: 360 }} />;
  return <Text tone="secondary">No preview for this file type. Download it to open.</Text>;
}
