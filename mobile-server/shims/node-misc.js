// Tiny stand-ins for node:path, node:fs, node:url, node:os and node:child_process. The server only
// touches these for things that don't apply on a phone (data directory, tunnel binary), so each
// one is the smallest thing that lets the import succeed and behave sensibly.

// ---- node:path
const clean = (parts) => {
  const out = [];
  for (const seg of parts.join("/").split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") out.pop();
    else out.push(seg);
  }
  return out;
};
export const path = {
  sep: "/",
  join: (...parts) => (String(parts[0] ?? "").startsWith("/") ? "/" : "") + clean(parts).join("/"),
  dirname: (p) => String(p).replace(/\/+$/, "").split("/").slice(0, -1).join("/") || "/",
  basename: (p) => String(p).replace(/\/+$/, "").split("/").pop(),
  resolve: (...parts) => "/" + clean(parts).join("/"),
};

// ---- node:fs (the phone's storage is handled by expo-sqlite, so there is nothing to create)
export const existsSync = () => true;
export const mkdirSync = () => undefined;

// ---- node:url
export const fileURLToPath = (u) => String(u).replace(/^file:\/\//, "");
export const pathToFileURL = (p) => ({ href: `file://${p}` });

// ---- node:os
// The app reads the phone's Wi-Fi address (expo-network) and publishes it here so
// /api/network-info can tell the teacher what address to share with students.
export function networkInterfaces() {
  const list = globalThis.__SHF_LAN__ || [];
  const out = {};
  for (const { name, address } of list) out[name] = [{ family: "IPv4", internal: false, address }];
  return out;
}
export const hostname = () => "phone";

// ---- node:child_process
export function execFileSync() {
  throw new Error("Running programs isn't available on a phone.");
}

export default { path, existsSync, mkdirSync, fileURLToPath, pathToFileURL, networkInterfaces, hostname, execFileSync };
