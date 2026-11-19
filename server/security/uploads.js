// Respondent "file upload" answers and host-authored images are stored inline as base64 data:
// URIs (no files ever touch the disk — see FileUploadField.jsx / ImageBlock.jsx). That rules out
// path traversal and server-side execution, but the data URI itself is still attacker-supplied:
// its MIME type decides the file extension the host downloads it as, and a non-data: string would
// make the host's machine fetch an arbitrary URL. So the server re-validates everything the
// client-side checks already did, and never trusts the declared MIME type on its own — the
// decoded bytes must actually look like that type.

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const startsWith = (buf, bytes, offset = 0) =>
  buf.length >= offset + bytes.length && bytes.every((b, i) => buf[offset + i] === b);
const ascii = (s) => [...s].map((c) => c.charCodeAt(0));

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG = [0xff, 0xd8, 0xff];
const ZIP = [0x50, 0x4b, 0x03, 0x04];
const OLE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const EBML = [0x1a, 0x45, 0xdf, 0xa3];

const isPng = (b) => startsWith(b, PNG);
const isJpeg = (b) => startsWith(b, JPEG);
const isGif = (b) => startsWith(b, ascii("GIF87a")) || startsWith(b, ascii("GIF89a"));
const isWebp = (b) => startsWith(b, ascii("RIFF")) && startsWith(b, ascii("WEBP"), 8);
const isBmp = (b) => startsWith(b, ascii("BM"));
const isPdf = (b) => startsWith(b, ascii("%PDF-"));
const isZip = (b) => startsWith(b, ZIP);
const isOle = (b) => startsWith(b, OLE);
const isWav = (b) => startsWith(b, ascii("RIFF")) && startsWith(b, ascii("WAVE"), 8);
const isOgg = (b) => startsWith(b, ascii("OggS"));
const isEbml = (b) => startsWith(b, EBML);
const isIsoMedia = (b) => startsWith(b, ascii("ftyp"), 4);
const isMp3 = (b) => startsWith(b, ascii("ID3")) || (b.length > 1 && b[0] === 0xff && (b[1] & 0xe0) === 0xe0);
// Plain text has no signature; the best practical check is "no NUL bytes" in the first chunk,
// which rejects renamed binaries (executables are full of them).
const isText = (b) => !b.subarray(0, 8192).includes(0);
// Only ever rendered through <img>, where SVG scripts never run.
const isSvg = (b) => /^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE[^>]*>\s*)?<svg[\s>]/i.test(b.subarray(0, 4096).toString("utf8").replace(/^﻿/, ""));

// MIME type -> the only extension it may ever be saved as, and how its bytes must start.
// Anything not listed here (executables, scripts, HTML, installers, ...) is rejected outright.
const FILE_TYPES = {
  "image/png": { ext: "png", check: isPng },
  "image/jpeg": { ext: "jpg", check: isJpeg },
  "image/gif": { ext: "gif", check: isGif },
  "image/webp": { ext: "webp", check: isWebp },
  "image/bmp": { ext: "bmp", check: isBmp },
  "application/pdf": { ext: "pdf", check: isPdf },
  "audio/mpeg": { ext: "mp3", check: isMp3 },
  "audio/wav": { ext: "wav", check: isWav },
  "audio/x-wav": { ext: "wav", check: isWav },
  "audio/wave": { ext: "wav", check: isWav },
  "audio/ogg": { ext: "ogg", check: isOgg },
  "video/ogg": { ext: "ogv", check: isOgg },
  "audio/webm": { ext: "weba", check: isEbml },
  "video/webm": { ext: "webm", check: isEbml },
  "audio/mp4": { ext: "m4a", check: isIsoMedia },
  "audio/x-m4a": { ext: "m4a", check: isIsoMedia },
  "video/mp4": { ext: "mp4", check: isIsoMedia },
  "video/quicktime": { ext: "mov", check: isIsoMedia },
  "application/zip": { ext: "zip", check: isZip },
  "application/x-zip-compressed": { ext: "zip", check: isZip },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { ext: "docx", check: isZip },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": { ext: "xlsx", check: isZip },
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": { ext: "pptx", check: isZip },
  "application/vnd.oasis.opendocument.text": { ext: "odt", check: isZip },
  "application/vnd.oasis.opendocument.spreadsheet": { ext: "ods", check: isZip },
  "application/vnd.oasis.opendocument.presentation": { ext: "odp", check: isZip },
  "application/msword": { ext: "doc", check: isOle },
  "application/vnd.ms-excel": { ext: "xls", check: isOle },
  "application/vnd.ms-powerpoint": { ext: "ppt", check: isOle },
  "text/csv": { ext: "csv", check: isText },
  "text/markdown": { ext: "md", check: isText },
};

const IMAGE_TYPES = {
  "image/png": isPng,
  "image/jpeg": isJpeg,
  "image/gif": isGif,
  "image/webp": isWebp,
  "image/bmp": isBmp,
  "image/avif": isIsoMedia,
  "image/x-icon": (b) => startsWith(b, [0x00, 0x00, 0x01, 0x00]),
  "image/vnd.microsoft.icon": (b) => startsWith(b, [0x00, 0x00, 0x01, 0x00]),
  "image/svg+xml": isSvg,
};

// Any other text/* (source code, .txt, ...) is accepted but always saved as .txt, so a
// "text/html" or "text/javascript" upload can never be double-clicked into something that runs.
function fileTypeFor(mime) {
  if (FILE_TYPES[mime]) return FILE_TYPES[mime];
  if (mime.startsWith("text/")) return { ext: "txt", check: isText };
  return null;
}

const DATA_URI_PATTERN = /^data:([a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*)((?:;[a-z0-9_-]+=[a-z0-9_.-]+)*);base64,([A-Za-z0-9+/]*={0,2})$/i;

function parseDataUri(value, maxBytes) {
  if (typeof value !== "string") return { error: "must be a data: URI string" };
  // Cheap length check before running the regex over a huge string.
  if (value.length > Math.ceil((maxBytes * 4) / 3) + 256) return { error: "is too large" };
  const match = DATA_URI_PATTERN.exec(value);
  if (!match) return { error: "must be a base64 data: URI" };
  const bytes = Buffer.from(match[3], "base64");
  if (bytes.length === 0) return { error: "is empty" };
  if (bytes.length > maxBytes) return { error: "is too large" };
  return { mime: match[1].toLowerCase(), bytes };
}

// Returns null when valid, otherwise a short reason.
export function validateUploadedFile(value) {
  const parsed = parseDataUri(value, MAX_UPLOAD_BYTES);
  if (parsed.error) return `file ${parsed.error} (max ${MAX_UPLOAD_BYTES / 1024 / 1024}MB)`;
  const type = fileTypeFor(parsed.mime);
  if (!type) return `files of type ${parsed.mime} aren't allowed`;
  if (!type.check(parsed.bytes)) return "the file's contents don't match its type";
  return null;
}

// Question images and form banners: an inline image, or a plain http(s) URL.
export function validateImageSource(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return "image must be a string";
  if (/^https?:\/\//i.test(value)) {
    if (value.length > 2048) return "image URL is too long";
    try {
      new URL(value);
      return null;
    } catch {
      return "image URL is invalid";
    }
  }
  const parsed = parseDataUri(value, MAX_IMAGE_BYTES);
  if (parsed.error) return `image ${parsed.error} (max ${MAX_IMAGE_BYTES / 1024 / 1024}MB)`;
  const check = IMAGE_TYPES[parsed.mime];
  if (!check) return `images of type ${parsed.mime} aren't allowed`;
  if (!check(parsed.bytes)) return "the image's contents don't match its type";
  return null;
}
