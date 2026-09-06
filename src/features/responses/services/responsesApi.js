const BASE = "/api/public";

async function request(path, options) {
  const res = await fetch(path, {
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
};
