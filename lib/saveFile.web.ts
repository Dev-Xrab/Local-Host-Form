/** Triggers a browser/Electron download. Electron routes blob: URLs through its download handler. */
export async function saveTextFile(filename: string, text: string, mime = "application/json;charset=utf-8;"): Promise<void> {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Saves a data: URI (an uploaded attachment) under the given, already-sanitized filename. */
export async function saveDataUri(filename: string, dataUri: string): Promise<void> {
  const a = document.createElement("a");
  a.href = dataUri;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
