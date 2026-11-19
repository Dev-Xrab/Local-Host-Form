import { useEffect, useState } from "react";

// Best guess at the visitor's desktop platform, so the matching download can be promoted.
// Phones and tablets keep the Windows default: the desktop app is where hosting happens.
export function usePlatform() {
  const [id, setId] = useState("windows");
  useEffect(() => {
    const ua = navigator.userAgent;
    if (/Android|iPhone|iPad/i.test(ua)) return;
    if (/Mac/i.test(ua)) setId("mac");
    else if (/Linux|X11/i.test(ua)) setId("linux");
  }, []);
  return id;
}
