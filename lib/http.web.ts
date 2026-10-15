// Browser and Electron: same-origin requests carrying the HttpOnly session cookie.
export const isNativeClient = false;

export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(path, init);
}

export type ConnectionMode = "host" | "remote";
export async function loadConnection(): Promise<void> {}
export function getMode(): ConnectionMode | null {
  return null;
}
export async function setMode(_mode: ConnectionMode | null): Promise<void> {}
export function getServerUrl(): string | null {
  return null;
}
export function getAuthToken(): string | null {
  return null;
}
export async function setServerUrl(_url: string | null): Promise<void> {}
export async function setAuthToken(_token: string | null): Promise<void> {}
export async function verifyServer(_url: string): Promise<string> {
  return "";
}
