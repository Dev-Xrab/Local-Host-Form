import express from "express";
import { ensureSchema } from "./db.js";
import { authRouter } from "./auth/routes.js";
import { formsRouter } from "./forms/routes.js";
import { syncRouter } from "./sync/routes.js";
import { googleFormsRouter } from "./google-forms/routes.js";
import { requireBearer } from "./auth/middleware.js";

const requiredEnv = ["DATABASE_URL", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_OAUTH_REDIRECT_URI"];
const missing = requiredEnv.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(", ")}`);
  console.error("See cloud-server/.env.example.");
  process.exit(1);
}

try {
  await ensureSchema();
} catch (err) {
  console.error("Could not reach or migrate the database:", err.message);
  process.exit(1);
}

const PORT = process.env.PORT || 8787;
const app = express();
app.use(express.json({ limit: "10mb" }));

app.get("/health", (req, res) => res.json({ ok: true }));

// No CORS is configured anywhere in this service on purpose: this server is never called
// directly from a browser page except for the OAuth redirects themselves (top-level
// navigation, not fetch/XHR). Every desktop client talks to it server-to-server from its own
// local Express process — the renderer only ever calls its own localhost API.
app.use("/auth", authRouter);
app.use("/api/forms", requireBearer, formsRouter);
app.use("/api/sync", requireBearer, syncRouter);
app.use("/api/google-forms", requireBearer, googleFormsRouter);

app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`Self Host Form cloud server listening on http://localhost:${PORT}`);
});
