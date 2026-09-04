const BASE = "/api/roster";

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

export const rosterApi = {
  list: () => request(BASE),
  create: (data) => request(BASE, { method: "POST", body: JSON.stringify(data) }),
  update: (id, data) => request(`${BASE}/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  remove: (id) => request(`${BASE}/${id}`, { method: "DELETE" }),
};
