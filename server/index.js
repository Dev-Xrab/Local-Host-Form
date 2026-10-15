import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./createApp.js";
import { stopTunnel } from "./tunnel/service.js";

// Dev convenience: an optional, git-ignored .env.local at the project root (e.g. CLOUD_SERVER_URL=
// http://localhost:8787 to use a local cloud server). Real environment variables win, and the
// packaged desktop app sets its own, so a missing file is simply ignored.
try { process.loadEnvFile(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".env.local")); } catch { /* none */ }

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 5174;

const app = createApp({
  port: PORT,
  // Serve the built frontend in production so the whole app is one process/port.
  mountWebUi(app) {
    const distDir = path.join(__dirname, "..", "dist");
    app.use(express.static(distDir));
    app.get(/^(?!\/api).*/, (req, res, next) => {
      res.sendFile(path.join(distDir, "index.html"), (err) => {
        if (err) next();
      });
    });
  },
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Self Host Form server listening on http://localhost:${PORT}`);
});

// Covers Ctrl+C and `systemctl stop` for anyone running this directly (not just the Electron
// build) — without this, a live Cloudflare tunnel child process would be orphaned on shutdown
// instead of being told to disconnect.
function shutdown() {
  stopTunnel();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
