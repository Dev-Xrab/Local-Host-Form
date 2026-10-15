import { openExternal } from "../../../../lib/openExternal";
import { apiFetch } from "../../../../lib/http";
const BASE = "/api/cloud";

async function request(path, options) {
  const res = await apiFetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    let body = null;
    try {
      body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // response had no JSON body
    }
    const error = new Error(message);
    error.status = res.status;
    // Some errors carry extra structured detail (e.g. Google Forms import's `skipped` list even
    // when nothing importable was found) that a caller may want beyond the message string.
    if (body) error.body = body;
    throw error;
  }

  if (res.status === 204) return null;
  return res.json();
}

export const cloudApi = {
  status: () => request("/auth/status"),
  logout: () => request("/auth/logout", { method: "POST" }),
  // Mints a one-time launch URL (see server/cloud/routes.js POST /auth/launch), then opens it
  // in a new window — Electron's window-open handler routes anything off-origin to the OS
  // browser, which is where Google's consent screen actually has to render.
  startLogin: async () => {
    const { url } = await request("/auth/launch", { method: "POST" });
    await openExternal(url);
  },
  listForms: () => request("/forms"),
  // Always brings in the cloud copy's latest. `overwrite` is only needed when this device's copy
  // has local edits the cloud doesn't have (the server answers 409 otherwise).
  importForm: (id, { overwrite = false } = {}) =>
    request(`/forms/${id}/import`, { method: "POST", body: JSON.stringify({ overwrite }) }),
  publishForm: (id) => request(`/forms/${id}/publish`, { method: "POST" }),
  // `id` here is the CLOUD form's own id, not a local one — these operate on forms browsed in
  // "Import from Cloud" that may not be imported onto this device at all.
  deleteCloudForm: (id) => request(`/forms/cloud/${id}`, { method: "DELETE" }),
  syncStatus: () => request("/sync/status"),
  sync: () => request("/sync", { method: "POST" }),
  // Real Google Forms (forms.google.com), distinct from listForms/importForm above which only
  // ever deal with forms created in this app and published to the cloud server.
  listGoogleForms: () => request("/google-forms"),
  importGoogleForm: (id) => request(`/google-forms/${id}/import`, { method: "POST" }),
  // Read-only structural diff against the live Google Form — `id` is the LOCAL form id (unlike
  // importGoogleForm's Google Drive file id). Call this before applying anything.
  checkGoogleFormChanges: (id) => request(`/google-forms/${id}/changes`),
  // Applies the host's decision from the sync dialog and pulls in new responses either way.
  applyGoogleFormChanges: (id, decision) =>
    request(`/google-forms/${id}/apply-changes`, { method: "POST", body: JSON.stringify({ decision }) }),
  // Queues the Google responses fetched onto this device (kept local until now) for upload and
  // syncs them. `id` is the LOCAL form id.
  saveGoogleResponsesToCloud: (id) => request(`/google-forms/${id}/save-to-cloud`, { method: "POST" }),
  listSyncIssues: () => request("/sync/issues"),
  retrySyncIssue: (id) => request(`/sync/issues/${id}/retry`, { method: "POST" }),
  discardSyncIssue: (id) => request(`/sync/issues/${id}/discard`, { method: "POST" }),
};
