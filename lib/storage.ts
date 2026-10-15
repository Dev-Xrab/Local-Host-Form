// Best-effort key/value storage for conveniences like a saved name or an in-progress draft.
// localStorage on web (can throw in private windows); in-memory elsewhere. Never relied on for correctness.
const memory = new Map<string, string>();

export function getItem(key: string): string | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage.getItem(key) : (memory.get(key) ?? null);
  } catch {
    return memory.get(key) ?? null;
  }
}

export function setItem(key: string, value: string): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
    else memory.set(key, value);
  } catch {
    memory.set(key, value);
  }
}

export function removeItem(key: string): void {
  memory.delete(key);
  try {
    if (typeof localStorage !== "undefined") localStorage.removeItem(key);
  } catch {
    // ignore
  }
}
