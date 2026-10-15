import express from "express";
import helmet from "helmet";
import { networkInterfaces } from "node:os";
import { formsRouter } from "./forms/routes.js";
import { formSessionsRouter, formResponsesRouter, sessionsRouter } from "./sessions/routes.js";
import { subjectsRouter } from "./subjects/routes.js";
import { rosterRouter } from "./roster/routes.js";
import { publicRouter } from "./public/routes.js";
import { authRouter } from "./auth/routes.js";
import { maintenanceRouter } from "./maintenance/routes.js";
import { requireAuth } from "./auth/middleware.js";
import { ensureDefaultSubject } from "./subjects/repository.js";
import { backfillFormsWithoutSubject } from "./forms/repository.js";
import { cloudRouter } from "./cloud/routes.js";
import { ensureDeviceId } from "./cloud/repository.js";
import { tunnelRouter } from "./tunnel/routes.js";
import { requireSameOrigin } from "./security/network.js";
import { apiLimiter, importLimiter, submitLimiter } from "./security/rateLimits.js";


/**
 * Builds the whole Express app (security headers, rate limits, API routers, error handling).
 * Shared by the Node launcher (server/index.js, used by the desktop app) and the phone runtime
 * (mobile-server/), so both enforce the exact same rules in the exact same order.
 *
 * @param {object} options
 * @param {number|string} options.port  Reported by /api/network-info.
 * @param {(app) => void} [options.mountWebUi]  Installs the web UI (static files + SPA fallback).
 *   Runs after every /api route and before the error handler.
 */
export function createApp({ port, mountWebUi } = {}) {
  const PORT = port || process.env.PORT || 5174;

  ensureDefaultSubject();
  backfillFormsWithoutSubject();
  ensureDeviceId();

  const app = express();

  // Security headers. The CSP is written for this app's actual needs: everything is served from
  // this origin, images/files are inline data:/blob: URIs (question images, banners, respondent
  // uploads, QR codes, exports) or remote question-image URLs, and the PDF preview is a data: iframe.
  // upgrade-insecure-requests and HSTS are deliberately off — the app is normally served over plain
  // HTTP on the LAN, where forcing HTTPS would break every subresource.
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "blob:", "https:", "http:"],
          mediaSrc: ["'self'", "data:", "blob:"],
          frameSrc: ["'self'", "data:", "blob:"],
          fontSrc: ["'self'", "data:"],
          connectSrc: ["'self'"],
          workerSrc: ["'self'", "blob:"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
        },
      },
      strictTransportSecurity: false,
      // Opening the OAuth flow in the OS browser from the Electron window uses window.open.
      crossOriginOpenerPolicy: false,
    })
  );

  app.use("/api", apiLimiter);

  // Body size limits: small by default so no client can make the server buffer megabytes of JSON
  // on an arbitrary route. Only the routes that legitimately carry inline images/files get more —
  // a form (question images, banner) and a respondent's submission (file-upload answers, each
  // separately capped at 5MB in server/security/uploads.js).
  // The rate limiter / auth check runs *before* the large parser, so an unauthenticated or
  // throttled client is turned away without the server ever buffering its body.
  const largeJson = express.json({ limit: "12mb" });
  app.post("/api/public/responses/:id/submit", submitLimiter, largeJson);
  app.use("/api/forms", requireAuth, largeJson);
  app.use(express.json({ limit: "256kb" }));

  // Every API response is dynamic (session status, respondent counts, toggle state, ...) and must
  // never be served stale — a plain `serverProcess.kill()`-free browser cache would be one thing,
  // but a Cloudflare Quick Tunnel (see server/tunnel/) routes requests through Cloudflare's edge
  // network, which applies its own default heuristic caching to anything that doesn't explicitly
  // say not to. Without this, a host toggling a session setting (or ending it, or a respondent
  // joining) could appear not to "take" when viewed through the public tunnel link even though the
  // database updated correctly — the exact same request over the LAN address never passed through
  // that edge, so it wouldn't show the same staleness. Scoped to /api so the static frontend bundle
  // below keeps its normal (helpful) caching.
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });

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
  app.get("/api/network-info", requireAuth, (req, res) => {
    const addresses = Object.entries(networkInterfaces())
      .flatMap(([name, ifaces]) => ifaces.map((iface) => ({ name, ...iface })))
      .filter((iface) => iface.family === "IPv4" && !iface.internal)
      .sort((a, b) => rankAdapter(a.name) - rankAdapter(b.name))
      .map(({ name, address }) => ({ name, address }));

    res.json({ port: PORT, addresses });
  });

  // Respondents: no cookie, no session — every route in here does its own ownership checks.
  app.use("/api/public", publicRouter);
  // Everything below is (or leads to) the host's cookie-authenticated session, so cross-site
  // state-changing requests are refused before any route runs — see requireSameOrigin.
  app.use("/api", requireSameOrigin);
  app.use("/api/auth", authRouter);
  app.use("/api/forms/:formId/sessions", requireAuth, formSessionsRouter);
  app.use("/api/forms/:formId/responses", requireAuth, formResponsesRouter);
  app.use("/api/sessions", requireAuth, sessionsRouter);
  app.use("/api/subjects", requireAuth, subjectsRouter);
  app.use("/api/roster", requireAuth, rosterRouter);
  app.post("/api/forms/import", requireAuth, importLimiter);
  app.use("/api/forms", requireAuth, formsRouter);
  app.use("/api/maintenance", requireAuth, maintenanceRouter);
  // Not wrapped in requireAuth here: /auth/start and /auth/callback must stay reachable from the
  // OS's default browser mid-OAuth-flow, which carries no session cookie for this origin. Every
  // other route inside cloudRouter applies requireAuth itself — see server/cloud/routes.js.
  app.use("/api/cloud", cloudRouter);
  app.use("/api/tunnel", requireAuth, tunnelRouter);


  mountWebUi?.(app);

  app.use((err, req, res, _next) => {
    // Body-parser rejections (malformed JSON, oversized body) are the client's fault — say so
    // without echoing internals, instead of reporting them as a server crash.
    if (err.type === "entity.too.large") {
      return res.status(413).json({ error: "That request is too large." });
    }
    if (err.status >= 400 && err.status < 500) {
      return res.status(err.status).json({ error: "Malformed request." });
    }
    console.error(err);
    // Set SHF_DEBUG_ERRORS=1 to see what failed in the response (used when debugging the phone host).
    const detail = process.env.SHF_DEBUG_ERRORS === "1" ? String(err?.stack || err).slice(0, 2000) : undefined;
    res.status(500).json({ error: "Internal server error", detail });
  });


  return app;
}
