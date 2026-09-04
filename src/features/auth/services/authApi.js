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

export const authApi = {
  login: (password) => request("/api/auth/login", { method: "POST", body: JSON.stringify({ password }) }),
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
