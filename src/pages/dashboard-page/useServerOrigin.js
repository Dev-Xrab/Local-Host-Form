import { useEffect, useState } from "react";

// The Electron desktop window always loads http://localhost itself, so window.location.origin
// can't tell the host what address to share with students on the LAN. On that origin, ask the
// server for its actual LAN IP (ranked to prefer real Wi-Fi/Ethernet adapters over virtual ones).
export function useServerOrigin() {
  const [origin, setOrigin] = useState(window.location.origin);

  useEffect(() => {
    const { hostname, protocol } = window.location;
    if (hostname !== "localhost" && hostname !== "127.0.0.1") return;

    fetch("/api/network-info")
      .then((res) => res.json())
      .then(({ port, addresses }) => {
        if (addresses?.length) {
          setOrigin(`${protocol}//${addresses[0].address}:${port}`);
        }
      })
      .catch(() => {});
  }, []);

  return origin;
}
