import express from "express";
import https from "node:https";
import { readFileSync } from "node:fs";
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
const tlsCert = process.env.SHF_TLS_CERT;
const tlsKey = process.env.SHF_TLS_KEY;
if (!!tlsCert !== !!tlsKey) throw new Error("SHF_TLS_CERT and SHF_TLS_KEY must be set together");
const HTTPS_PORT = tlsCert ? Number(process.env.SHF_HTTPS_PORT || 5443) : null;
if (tlsCert && (!Number.isInteger(HTTPS_PORT) || HTTPS_PORT < 1 || HTTPS_PORT > 65535 || HTTPS_PORT === Number(PORT))) {
  throw new Error("SHF_HTTPS_PORT must be a valid port different from PORT");
}

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

// With TLS configured, the plaintext listener is only for the local Electron window and
// cloudflared. Classroom devices must use the HTTPS listener; no LAN HTTP fallback exists.
app.listen(PORT, tlsCert ? "127.0.0.1" : "0.0.0.0", () => {
  console.log(`Self Host Form server listening on http://localhost:${PORT}`);
});
if (tlsCert) {
  const tlsServer = https.createServer({ cert: readFileSync(tlsCert), key: readFileSync(tlsKey) }, app);
  tlsServer.listen(HTTPS_PORT, "0.0.0.0", () => {
    console.log(`Self Host Form HTTPS server listening on port ${HTTPS_PORT}`);
  });
}

// Covers Ctrl+C and `systemctl stop` for anyone running this directly (not just the Electron
// build) — without this, a live Cloudflare tunnel child process would be orphaned on shutdown
// instead of being told to disconnect.
function shutdown() {
  stopTunnel();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
