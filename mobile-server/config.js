// Phone-host defaults.

// Same port as the desktop app, so a share link looks the same whichever device hosts.
export const DEFAULT_PORT = 5174;

// How many ports above the default to try if the preferred one is busy.
export const PORT_ATTEMPTS = 10;

// How often to re-read the phone's Wi-Fi address (it changes when you switch networks).
export const LAN_REFRESH_MS = 10_000;
