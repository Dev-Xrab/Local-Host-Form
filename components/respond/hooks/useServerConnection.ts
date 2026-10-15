import { apiFetch } from "../../../lib/http";
import { useEffect, useState } from "react";

const POLL_MS = 2500;
const TIMEOUT_MS = 4000;
// A single dropped or slow ping shouldn't flash the screen blurred: it takes this many in a row.
const FAILURES_BEFORE_OFFLINE = 2;

async function pingServer(): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await apiFetch(`/api/public/ping?t=${Date.now()}`, { cache: "no-store", signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

const browserOffline = () => typeof navigator !== "undefined" && navigator.onLine === false;

/**
 * Whether this device can currently reach the server. Only polls while `enabled` (the form's "blur
 * on disconnect" setting), so a form that doesn't use it costs nothing.
 */
export function useServerConnection(enabled: boolean): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let failures = 0;
    let timer: ReturnType<typeof setTimeout>;

    const check = async () => {
      const ok = !browserOffline() && (await pingServer());
      if (cancelled) return;
      failures = ok ? 0 : failures + 1;
      if (ok) setOnline(true);
      else if (failures >= FAILURES_BEFORE_OFFLINE || browserOffline()) setOnline(false);
      timer = setTimeout(check, POLL_MS);
    };

    const canListen = typeof window !== "undefined" && typeof window.addEventListener === "function";
    const goOffline = () => setOnline(false);
    const goOnline = () => { clearTimeout(timer); failures = 0; check(); };
    if (canListen) {
      window.addEventListener("offline", goOffline);
      window.addEventListener("online", goOnline);
    }
    check();

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (canListen) {
        window.removeEventListener("offline", goOffline);
        window.removeEventListener("online", goOnline);
      }
      setOnline(true);
    };
  }, [enabled]);

  return online;
}
