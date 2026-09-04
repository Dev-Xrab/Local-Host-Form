import express from "express";
import path from "node:path";
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

app.listen(PORT, () => {
  console.log(`StoneArch server listening on http://localhost:${PORT}`);
});
