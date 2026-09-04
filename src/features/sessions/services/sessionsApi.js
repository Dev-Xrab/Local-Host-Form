const BASE = "/api/sessions";

async function request(path, options) {
  const res = await fetch(path, {
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
  start: (id) => request(`${BASE}/${id}/start`, { method: "POST" }),
  end: (id) => request(`${BASE}/${id}/end`, { method: "POST" }),
  reopen: (id) => request(`${BASE}/${id}/reopen`, { method: "POST" }),
  remove: (id) => request(`${BASE}/${id}`, { method: "DELETE" }),
  respondents: (id) => request(`${BASE}/${id}/respondents`),
  respondentDetail: (id, responseId) => request(`${BASE}/${id}/respondents/${responseId}`),
  exportData: (id) => request(`${BASE}/${id}/export`),
};
