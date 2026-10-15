import { downloadBytes } from "./downloadBytes";

const encoder = new TextEncoder();

/** Saves text (a form export) as a file. On the phone this opens the share sheet. */
export async function saveTextFile(filename: string, text: string, mime = "application/json"): Promise<void> {
  await downloadBytes(encoder.encode(text), filename, mime.split(";")[0]);
}

/** Saves a data: URI (an uploaded attachment) under the given, already-sanitized filename. */
export async function saveDataUri(filename: string, dataUri: string): Promise<void> {
  const match = /^data:([^;,]*)((?:;[^;,]*)*),(.*)$/s.exec(dataUri);
  if (!match) throw new Error("This attachment can't be downloaded.");
  const [, mime, params, payload] = match;
  let bytes: Uint8Array;
  if (/;base64/i.test(params)) {
    const bin = atob(payload);
    bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  } else {
    bytes = encoder.encode(decodeURIComponent(payload));
  }
  await downloadBytes(bytes, filename, mime || "application/octet-stream");
}
