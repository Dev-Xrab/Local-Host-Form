/** Triggers a browser/Electron download. Electron routes blob: URLs through its download handler. */
export async function downloadBytes(data: Uint8Array | ArrayBuffer | Blob, filename: string, mime = "application/octet-stream"): Promise<void> {
  const blob = data instanceof Blob ? data : new Blob([data as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
