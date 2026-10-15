// The Cloudflare tunnel is a desktop-only feature: it needs a native helper program that can't run
// inside a phone app. Starting it reports this message in the Remote Access setting instead.
const unavailable = () => {
  throw new Error("Remote access (Cloudflare tunnel) isn't available on a phone. Students on the same Wi-Fi can still join with your phone's address.");
};
export const install = async () => unavailable();
export const use = () => {};
export const Tunnel = { quick: () => unavailable() };
