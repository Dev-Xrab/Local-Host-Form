import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
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

// Render (and most PaaS hosts) terminate TLS at one proxy hop in front of this process; trusting
// exactly that hop is what makes req.ip the real client address for rate limiting, without
// letting a client spoof its own IP through X-Forwarded-For.
app.set("trust proxy", Number(process.env.TRUST_PROXY_HOPS ?? 1));
app.use(helmet());

const limiter = (windowMs, limit) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (req, res) => res.status(429).json({ error: "Too many requests — try again shortly." }),
  });

// OAuth endpoints are unauthenticated and each call writes a row or hits Google.
app.use("/auth", limiter(60 * 1000, 30));
app.use("/api", limiter(60 * 1000, 600));

// Small bodies by default; only authenticated sync/publish traffic (which can carry inline
// respondent files) gets more, and only after the bearer token has been checked.
const largeJson = express.json({ limit: "12mb" });
app.use("/api/forms", requireBearer, largeJson);
app.use("/api/sync", requireBearer, largeJson);
app.use(express.json({ limit: "64kb" }));

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
  if (err.type === "entity.too.large") {
    return res.status(413).json({ error: "That request is too large." });
  }
  if (err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ error: "Malformed request." });
  }
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`Self Host Form cloud server listening on http://localhost:${PORT}`);
});
