const STORAGE_KEY = "stonearch_device_id";

// crypto.randomUUID only exists in secure contexts (HTTPS or localhost). This app is
// meant to be opened over a plain-HTTP LAN address, where it's simply undefined —
// so every caller needs a fallback rather than assuming the API is there.
function generateId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `device-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function getDeviceId() {
  try {
    let id = localStorage.getItem(STORAGE_KEY);
    if (!id) {
      id = generateId();
      localStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  } catch {
    // localStorage unavailable (private browsing, etc.) — duplicate-response
    // detection is best-effort only, so a per-tab id is an acceptable fallback.
    return generateId();
  }
}
