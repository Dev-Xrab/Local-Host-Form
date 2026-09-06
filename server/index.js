import express from "express";
import path from "node:path";
import { networkInterfaces } from "node:os";
import { fileURLToPath } from "node:url";
import { formsRouter } from "./forms/routes.js";
import { formSessionsRouter, sessionsRouter } from "./sessions/routes.js";
import { subjectsRouter } from "./subjects/routes.js";
import { rosterRouter } from "./roster/routes.js";
import { publicRouter } from "./public/routes.js";
import { authRouter } from "./auth/routes.js";
import { maintenanceRouter } from "./maintenance/routes.js";
import { requireAuth } from "./auth/middleware.js";
import { ensureHostPassword } from "./auth/repository.js";
import { ensureDefaultSubject } from "./subjects/repository.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 5174;

ensureHostPassword();
if (!process.env.HOST_PASSWORD) {
  console.log("\n============================================");
  console.log(" Host password: \"password\" (unless already changed)");
  console.log(" You'll be reminded to change it after logging in.");
  console.log(" Set HOST_PASSWORD in your environment to choose your own.");
  console.log("============================================\n");
}

ensureDefaultSubject();

const app = express();
app.use(express.json({ limit: "10mb" }));

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

// Machines commonly report virtual adapters (VirtualBox, VMware, Hyper-V, VPNs, WSL) alongside
// the real Wi-Fi/Ethernet one, and those virtual addresses aren't reachable from other devices
// on the classroom LAN. Rank real-looking adapter names first so the likely-correct address is
// the one the dashboard suggests by default.
const VIRTUAL_ADAPTER_PATTERN = /virtualbox|vmware|hyper-v|vethernet|virtual|docker|wsl|tailscale|zerotier|tap|tun/i;
const PHYSICAL_ADAPTER_PATTERN = /wi-?fi|wlan|ethernet|^en\d|^eth\d/i;

function rankAdapter(name) {
  if (PHYSICAL_ADAPTER_PATTERN.test(name)) return 0;
  if (VIRTUAL_ADAPTER_PATTERN.test(name)) return 2;
  return 1;
}

// The Electron window always loads http://localhost, so window.location.origin can't tell
// the host what address to share with students on the LAN. Report the machine's actual
// LAN IPv4 addresses so the dashboard can show a reachable URL instead of "localhost".
app.get("/api/network-info", (req, res) => {
  const addresses = Object.entries(networkInterfaces())
    .flatMap(([name, ifaces]) => ifaces.map((iface) => ({ name, ...iface })))
    .filter((iface) => iface.family === "IPv4" && !iface.internal)
    .sort((a, b) => rankAdapter(a.name) - rankAdapter(b.name))
    .map(({ name, address }) => ({ name, address }));

  res.json({ port: PORT, addresses });
});

app.use("/api/public", publicRouter);
app.use("/api/auth", authRouter);
app.use("/api/forms/:formId/sessions", requireAuth, formSessionsRouter);
app.use("/api/sessions", requireAuth, sessionsRouter);
app.use("/api/subjects", requireAuth, subjectsRouter);
app.use("/api/roster", requireAuth, rosterRouter);
app.use("/api/forms", requireAuth, formsRouter);
app.use("/api/maintenance", requireAuth, maintenanceRouter);

// Serve the built frontend in production so the whole app is one process/port.
const distDir = path.join(__dirname, "..", "dist");
app.use(express.static(distDir));
app.get(/^(?!\/api).*/, (req, res, next) => {
  res.sendFile(path.join(distDir, "index.html"), (err) => {
    if (err) next();
  });
});

app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`StoneArch server listening on http://localhost:${PORT}`);
});
