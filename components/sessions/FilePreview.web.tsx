/** Browser build: previews images, PDFs, video and audio inline from their data: URIs. */
export function FilePreview({ url, kind, title }: { url: string; kind: "image" | "pdf" | "video" | "audio" | "other"; title?: string }) {
  const box = { width: "100%", maxHeight: "70vh", border: 0 } as const;
  if (kind === "image") return <img src={url} alt={title || "Uploaded file"} style={{ ...box, objectFit: "contain" }} />;
  if (kind === "pdf") return <iframe src={url} title={title || "PDF preview"} style={{ ...box, height: "70vh" }} />;
  if (kind === "video") return <video src={url} controls style={box} />;
  if (kind === "audio") return <audio src={url} controls style={{ width: "100%" }} />;
  return <p>No preview for this file type. Download it to open.</p>;
}
