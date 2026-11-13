// Manual developer-only reset utility. Packaging does not call this script because builds
// must never delete an existing installation's forms or responses.
import { rmSync, existsSync } from "node:fs";
import path from "node:path";

// Matches Electron's own app.getPath("userData") default on Windows (%APPDATA%/<name>),
// where <name> is package.json's "name" field — verified against the real folder Electron
// creates when running this app (electron/main.js sets DATA_DIR to userData/data). This repo
// only ships a Windows build locally, so there's nothing to compute/wipe on other platforms
// (e.g. the macOS CI runner, which starts from a clean checkout with no prior userData anyway).
if (process.platform !== "win32") {
  console.log("[clear-dev-data] Not on Windows — nothing to wipe here.");
  process.exit(0);
}

const appDataDir = process.env.APPDATA || path.join(process.env.USERPROFILE || "", "AppData", "Roaming");
const dataDir = path.join(appDataDir, "self-host-form", "data");

if (existsSync(dataDir)) {
  rmSync(dataDir, { recursive: true, force: true });
  console.log(`[clear-dev-data] Wiped ${dataDir}`);
} else {
  console.log(`[clear-dev-data] Nothing to wipe at ${dataDir}`);
}
