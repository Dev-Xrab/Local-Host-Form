import { driveApiBase, driveUploadBase } from "./googleConfig.js";

// Thin wrapper over the Google Drive v3 REST API, limited to the hidden app-data folder
// (scope drive.appdata). Every call takes a ready access token; refreshing it is client.js's job.

export class DriveError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

// Above this, Drive's single-request multipart upload (5 MB cap) is not safe, so a resumable
// upload is used. Responses with an uploaded file (up to 5 MB, base64-encoded) can exceed it.
const SIMPLE_UPLOAD_LIMIT = 4 * 1024 * 1024;

async function failure(res, fallback) {
  let message = fallback;
  try {
    const body = await res.json();
    message = body?.error?.message || body?.error_description || fallback;
  } catch {
    // no JSON body
  }
  return new DriveError(message, res.status);
}

async function request(token, url, init = {}) {
  let res;
  try {
    res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.headers || {}) } });
  } catch (err) {
    throw new DriveError(`Could not reach Google Drive: ${err.message}`, 0);
  }
  if (!res.ok) throw await failure(res, `Google Drive request failed (${res.status})`);
  return res;
}

/** Lists files in the app-data folder. `q` is a Drive query string; returns all pages. */
export async function listAppFiles(token, { q, fields = "id,name,modifiedTime,size" } = {}) {
  const files = [];
  let pageToken;
  do {
    const params = new URLSearchParams({
      spaces: "appDataFolder",
      pageSize: "1000",
      fields: `nextPageToken,files(${fields})`,
    });
    if (q) params.set("q", q);
    if (pageToken) params.set("pageToken", pageToken);
    const res = await request(token, `${driveApiBase()}/files?${params}`);
    const body = await res.json();
    files.push(...(body.files || []));
    pageToken = body.nextPageToken;
  } while (pageToken);
  return files;
}

export async function readJson(token, fileId) {
  const res = await request(token, `${driveApiBase()}/files/${encodeURIComponent(fileId)}?alt=media`);
  return res.json();
}

const byteLength = (text) => new TextEncoder().encode(text).length;

async function resumableUpload(token, method, path, metadata, content) {
  const start = await request(token, `${driveUploadBase()}${path}${path.includes("?") ? "&" : "?"}uploadType=resumable`, {
    method,
    headers: { "Content-Type": "application/json; charset=UTF-8", "X-Upload-Content-Type": "application/json" },
    body: JSON.stringify(metadata),
  });
  const location = start.headers.get("location");
  if (!location) throw new DriveError("Google Drive did not return an upload location.", 502);
  const done = await request(token, location, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: content,
  });
  return done.json();
}

/** Creates a JSON file in the app-data folder and returns its metadata ({ id, name, modifiedTime }). */
export async function createJson(token, name, value) {
  const content = JSON.stringify(value);
  const metadata = { name, parents: ["appDataFolder"], mimeType: "application/json" };

  if (byteLength(content) > SIMPLE_UPLOAD_LIMIT) {
    return resumableUpload(token, "POST", "/files?fields=id,name,modifiedTime", metadata, content);
  }

  const boundary = `shf${Math.random().toString(36).slice(2)}${Date.now()}`;
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n${content}\r\n--${boundary}--`;
  const res = await request(token, `${driveUploadBase()}/files?uploadType=multipart&fields=id,name,modifiedTime`, {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  return res.json();
}

/** Replaces a file's content and returns its metadata. */
export async function updateJson(token, fileId, value) {
  const content = JSON.stringify(value);
  const path = `/files/${encodeURIComponent(fileId)}?fields=id,name,modifiedTime`;

  if (byteLength(content) > SIMPLE_UPLOAD_LIMIT) {
    return resumableUpload(token, "PATCH", path, {}, content);
  }

  const res = await request(token, `${driveUploadBase()}${path}&uploadType=media`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: content,
  });
  return res.json();
}

export async function deleteFile(token, fileId) {
  const res = await fetch(`${driveApiBase()}/files/${encodeURIComponent(fileId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  }).catch((err) => {
    throw new DriveError(`Could not reach Google Drive: ${err.message}`, 0);
  });
  // Already gone counts as deleted.
  if (!res.ok && res.status !== 404) throw await failure(res, `Google Drive request failed (${res.status})`);
}
