import { apiFetch } from "../../../../lib/http";
const BASE = "/api/tunnel";

async function request(path, options) {
  const res = await apiFetch(`${BASE}${path}`, {
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

  return res.json();
}

export const tunnelApi = {
  status: () => request("/status"),
  start: () => request("/start", { method: "POST" }),
  stop: () => request("/stop", { method: "POST" }),
};
