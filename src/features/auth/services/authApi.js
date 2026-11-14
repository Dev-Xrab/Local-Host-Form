import { apiFetch } from "../../../../lib/http";
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

export const authApi = {
  setup: (password) => request("/api/auth/setup", { method: "POST", body: JSON.stringify({ password }) }),
  login: (password, code) => request("/api/auth/login", { method: "POST", body: JSON.stringify({ password, code }) }),
  remoteAdminStatus: () => request("/api/auth/remote-admin/status"),
  beginRemoteAdmin: (password) => request("/api/auth/remote-admin/begin", { method: "POST", body: JSON.stringify({ password }) }),
  confirmRemoteAdmin: (code) => request("/api/auth/remote-admin/confirm", { method: "POST", body: JSON.stringify({ code }) }),
  disableRemoteAdmin: (password, code) => request("/api/auth/remote-admin/disable", { method: "POST", body: JSON.stringify({ password, code }) }),
  logout: () => request("/api/auth/logout", { method: "POST" }),
  me: () => request("/api/auth/me"),
  changePassword: (oldPassword, newPassword) =>
    request("/api/auth/change-password", { method: "POST", body: JSON.stringify({ oldPassword, newPassword }) }),
  getRecoveryQuestion: () => request("/api/auth/recovery-question"),
  setRecoveryQuestion: (currentPassword, question, answer) =>
    request("/api/auth/recovery-question", {
      method: "POST",
      body: JSON.stringify({ currentPassword, question, answer }),
    }),
  recoverPassword: (answer, newPassword) =>
    request("/api/auth/recover-password", { method: "POST", body: JSON.stringify({ answer, newPassword }) }),
};
