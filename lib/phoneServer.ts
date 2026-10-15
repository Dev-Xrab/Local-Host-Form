// Native: this phone can host Self Host Form itself, like the desktop app does.
import { setMode, setServerUrl } from "./http";

export const canHostOnPhone = true;

// Loaded on demand: importing the server runtime opens the database, so it must only happen when hosting.
const runtime = () => require("../mobile-server/native/startPhoneServer") as typeof import("../mobile-server/native/startPhoneServer");

/** Starts the on-device server and points the app at it. Resolves with its loopback URL. */
export async function startPhoneHost(): Promise<string> {
  const { url } = await runtime().startPhoneServer();
  await setServerUrl(url);
  await setMode("host");
  return url;
}

export async function stopPhoneHost(): Promise<void> {
  try {
    runtime().stopPhoneServer();
  } catch {
    // never started
  }
}
