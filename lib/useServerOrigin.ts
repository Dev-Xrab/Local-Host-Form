import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { apiFetch, getServerUrl } from "./http";

const initial = () =>
  Platform.OS === "web" ? (typeof window !== "undefined" ? window.location.origin : "") : (getServerUrl() ?? "");

const isLoopback = (host: string) => host === "localhost" || host === "127.0.0.1" || host === "::1";

// The address students should open. It is not the address this window talks to:
//  - Electron always loads http://localhost, which nobody else can reach;
//  - the phone app talks to its own server on 127.0.0.1.
// In both cases, ask the server for its real Wi-Fi/Ethernet address (ranked to prefer real adapters
// over virtual ones) and build the share link from that.
export function useServerOrigin(): string {
  const [origin, setOrigin] = useState(initial);

  useEffect(() => {
    let protocol = "http:";
    if (Platform.OS === "web") {
      const loc = window.location;
      if (!isLoopback(loc.hostname)) return;
      protocol = loc.protocol;
    } else {
      const base = getServerUrl();
      if (!base) return;
      try {
        if (!isLoopback(new URL(base).hostname)) return; // connected to a host computer: its address is already shareable
      } catch {
        return;
      }
    }

    let cancelled = false;
    const load = () =>
      apiFetch("/api/network-info")
        .then((res) => res.json())
        .then(({ port, addresses }: { port: number; addresses?: { address: string }[] }) => {
          if (!cancelled && addresses?.length) setOrigin(`${protocol}//${addresses[0].address}:${port}`);
        })
        .catch(() => {});
    load();
    // A phone can change Wi-Fi mid-session, so keep the link fresh there.
    const timer = Platform.OS === "web" ? null : setInterval(load, 15_000);
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, []);

  return origin;
}
