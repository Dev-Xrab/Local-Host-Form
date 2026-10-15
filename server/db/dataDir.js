import { existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Exported so other modules that need a writable, per-install directory (e.g. server/tunnel's
// cached cloudflared binary) land next to the sqlite file instead of computing their own copy of
// this same DATA_DIR-or-fallback logic.
//
// Kept in its own module because it is the only place the server needs `import.meta`. The phone
// runtime (mobile-server/) swaps this one file for a version that uses the app's storage folder.
export const dataDir = process.env.DATA_DIR || path.join(__dirname, "..", "data");
if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
