import { openExternal } from "../../../../lib/openExternal";
import { apiFetch } from "../../../../lib/http";
const BASE = "/api/cloud";

const GOOGLE_FORMS_BASE = "/api/google-forms";
const googleRequest = (path, options) => request(path, options, GOOGLE_FORMS_BASE);

async function request(path, options, base = BASE) {
  const res = await apiFetch(`${base}${path}`, {
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
  // Automatic saving of forms and responses to Drive while signed in and online.
  getAutoSave: () => request("/auto-save"),
  setAutoSave: (enabled) => request("/auto-save", { method: "PUT", body: JSON.stringify({ enabled }) }),
  syncStatus: () => request("/sync/status"),
  sync: () => request("/sync", { method: "POST" }),
  listSyncIssues: () => request("/sync/issues"),
  retrySyncIssue: (id) => request(`/sync/issues/${id}/retry`, { method: "POST" }),
  discardSyncIssue: (id) => request(`/sync/issues/${id}/discard`, { method: "POST" }),
};

// Google Forms: browse the user's forms, import one with its responses, and keep it in sync.
// `googleId` is the Google Drive file id; `formId` is this device's own form id.
export const googleFormsApi = {
  list: () => googleRequest("/"),
  // Either of these also pulls the form's existing responses; re-importing just syncs them.
  importId: (googleId) => googleRequest(`/import/${googleId}`, { method: "POST" }),
  // `link` is an editor link or a bare form id; the server explains anything it can't read.
  importLink: (link) => googleRequest("/import", { method: "POST", body: JSON.stringify({ link }) }),
  syncAll: () => googleRequest("/sync", { method: "POST" }),
  status: (formId) => googleRequest(`/${formId}/status`),
  sync: (formId) => googleRequest(`/${formId}/sync`, { method: "POST" }),
  changes: (formId) => googleRequest(`/${formId}/changes`),
  applyChanges: (formId) => googleRequest(`/${formId}/apply-changes`, { method: "POST" }),
};
