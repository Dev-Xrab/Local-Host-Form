// Phones have no "Downloads" the app can drop a file into silently, so the file is written to the
// app's cache and handed to the system share sheet: Save to Files / Drive, send via WhatsApp, etc.
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

const safeName = (name: string) => name.replace(/[\/:*?"<>|\u0000-\u001f]/g, "_").slice(0, 120) || "export";

export async function downloadBytes(data: Uint8Array | ArrayBuffer | Blob, filename: string, mime = "application/octet-stream"): Promise<void> {
  const bytes = data instanceof Uint8Array ? data : data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(await (data as Blob).arrayBuffer());
  if (!(await Sharing.isAvailableAsync())) throw new Error("This device can't share files.");
  const file = new File(Paths.cache, safeName(filename));
  if (file.exists) file.delete();
  file.create();
  file.write(bytes);
  await Sharing.shareAsync(file.uri, { mimeType: mime, dialogTitle: filename });
}
