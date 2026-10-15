import { apiFetch } from "../../../../lib/http";
const BASE = "/api/public";

async function request(path, options) {
  const res = await apiFetch(path, {
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
    error.body = body;
    throw error;
  }

  if (res.status === 204) return null;
  return res.json();
}

export const responsesApi = {
  getSessionByCode: (code) => request(`${BASE}/sessions/${encodeURIComponent(code)}`),
  join: (code, payload) =>
    request(`${BASE}/sessions/${encodeURIComponent(code)}/join`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getResponse: (id, deviceId) =>
    request(`${BASE}/responses/${id}?deviceId=${encodeURIComponent(deviceId)}`),
  submit: (id, payload) =>
    request(`${BASE}/responses/${id}/submit`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  editResponse: (id, deviceId) =>
    request(`${BASE}/responses/${id}/edit`, {
      method: "POST",
      body: JSON.stringify({ deviceId }),
    }),
  // Tells the server this device's tab just went hidden, so it can anchor the tab-refocus
  // countdown to a timestamp that survives a reload — see RespondForm's visibilitychange handler.
  startRefocusLock: (id, deviceId) =>
    request(`${BASE}/responses/${id}/refocus-lock`, {
      method: "POST",
      body: JSON.stringify({ deviceId }),
    }),
};
