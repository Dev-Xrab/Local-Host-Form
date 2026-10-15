import { apiFetch } from "../../../../lib/http";
const BASE = "/api/sessions";

async function request(path, options) {
  const res = await apiFetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // response had no JSON body
    }
    const error = new Error(message);
    error.status = res.status;
    throw error;
  }

  if (res.status === 204) return null;
  return res.json();
}

export const sessionsApi = {
  list: () => request(BASE),
  get: (id) => request(`${BASE}/${id}`),
  create: (data) => request(BASE, { method: "POST", body: JSON.stringify(data) }),
  update: (id, data) => request(`${BASE}/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  setEditable: (id, editable) =>
    request(`${BASE}/${id}/editable`, { method: "POST", body: JSON.stringify({ editable }) }),
  // `seconds` null turns the tab-refocus countdown off.
  setRefocusLock: (id, seconds) =>
    request(`${BASE}/${id}/refocus-lock`, { method: "POST", body: JSON.stringify({ seconds }) }),
  setFullscreenEnabled: (id, enabled) =>
    request(`${BASE}/${id}/fullscreen`, { method: "POST", body: JSON.stringify({ enabled }) }),
  start: (id) => request(`${BASE}/${id}/start`, { method: "POST" }),
  end: (id) => request(`${BASE}/${id}/end`, { method: "POST" }),
  reopen: (id) => request(`${BASE}/${id}/reopen`, { method: "POST" }),
  remove: (id) => request(`${BASE}/${id}`, { method: "DELETE" }),
  respondents: (id) => request(`${BASE}/${id}/respondents`),
  respondentDetail: (id, responseId) => request(`${BASE}/${id}/respondents/${responseId}`),
  exportData: (id) => request(`${BASE}/${id}/export`),
};
