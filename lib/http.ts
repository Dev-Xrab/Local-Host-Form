// Native (Android/iOS) builds have no same-origin server and no cookie jar, so every request goes
// to a user-entered server URL and carries the host session as a Bearer token. Both are kept in
// secure storage and mirrored in memory so apiFetch stays synchronous after loadConnection().
import * as SecureStore from "expo-secure-store";

export const isNativeClient = true;

const URL_KEY = "shf_server_url";
const TOKEN_KEY = "shf_auth_token";
const MODE_KEY = "shf_mode";

/** "host": this phone runs its own server. "remote": it connects to a host computer. */
export type ConnectionMode = "host" | "remote";
let mode: ConnectionMode | null = null;

let serverUrl: string | null = null;
let authToken: string | null = null;

export async function loadConnection(): Promise<void> {
  try {
    serverUrl = await SecureStore.getItemAsync(URL_KEY);
    authToken = await SecureStore.getItemAsync(TOKEN_KEY);
    const m = await SecureStore.getItemAsync(MODE_KEY);
    mode = m === "host" || m === "remote" ? m : null;
  } catch {
    serverUrl = null;
    authToken = null;
  }
}

export const getServerUrl = () => serverUrl;
export const getMode = () => mode;

export async function setMode(next: ConnectionMode | null): Promise<void> {
  mode = next;
  try {
    if (next) await SecureStore.setItemAsync(MODE_KEY, next);
    else await SecureStore.deleteItemAsync(MODE_KEY);
  } catch {
    // kept in memory for this run
  }
}
export const getAuthToken = () => authToken;

export async function setServerUrl(url: string | null): Promise<void> {
  serverUrl = url;
  try {
    if (url) await SecureStore.setItemAsync(URL_KEY, url);
    else await SecureStore.deleteItemAsync(URL_KEY);
  } catch {
    // kept in memory for this run
  }
}

export async function setAuthToken(token: string | null): Promise<void> {
  authToken = token;
  try {
    if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
    else await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    // kept in memory for this run
  }
}

export function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string> | undefined), "X-Auth-Mode": "bearer" };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  return fetch(`${serverUrl ?? ""}${path}`, { ...init, headers });
}

/** Normalises what the user typed (adds http://, drops trailing slashes) and checks it's a Self Host Form server. Returns the clean URL or throws. */
export async function verifyServer(input: string): Promise<string> {
  let url = input.trim().replace(/\/+$/, "");
  if (!url) throw new Error("Enter the server address.");
  if (!/^https?:\/\//i.test(url)) url = `http://${url}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(`${url}/api/health`, { signal: controller.signal });
    const body = await res.json();
    if (!res.ok || body?.ok !== true) throw new Error("not a server");
    return url;
  } catch {
    throw new Error("Couldn't reach a Self Host Form server at that address. Check the IP, port, and that you're on the same Wi-Fi.");
  } finally {
    clearTimeout(timer);
  }
}
