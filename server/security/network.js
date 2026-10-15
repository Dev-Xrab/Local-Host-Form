import { networkInterfaces } from "node:os";
import { ipKeyGenerator } from "express-rate-limit";

const LOOPBACK_ADDRESSES = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

function isLoopbackSocket(req) {
  return LOOPBACK_ADDRESSES.has(req.socket?.remoteAddress);
}

// A request that arrives on one of this machine's own network addresses (the 192.168.x.x address the
// dashboard tells people to share, opened on the host itself) comes from the host just as much as one
// from localhost: another device cannot send a packet whose source is this machine's own address, so
// matching it is as safe as matching loopback.
const stripAddress = (address) => String(address || "").replace(/^::ffff:/i, "").replace(/%.*$/, "").toLowerCase();

function isOwnAddressSocket(req) {
  const remote = stripAddress(req.socket?.remoteAddress);
  if (!remote) return false;
  return Object.values(networkInterfaces()).some((list) => (list || []).some((i) => stripAddress(i.address) === remote));
}

// Remote Access (server/tunnel) runs cloudflared on this machine and points it at localhost, so
// every tunnelled request arrives from a loopback socket — indistinguishable from the host's own
// Electron window by address alone. Cloudflare's edge stamps these headers on everything it
// forwards; their presence is what marks a loopback request as really coming from the internet.
// A LAN client can add them too, but that only ever makes it look *more* remote, never local.
export function isTunnelRequest(req) {
  return !!(req.headers["cf-connecting-ip"] || req.headers["cf-ray"] || req.headers["cdn-loop"]);
}

// The machine the server runs on — the Electron window or a browser on the host itself.
export function isLocalConsole(req) {
  return (isLoopbackSocket(req) || isOwnAddressSocket(req)) && !isTunnelRequest(req);
}

// Used by rate limiters. For tunnelled traffic the socket address is always 127.0.0.1, so the
// real client is taken from cf-connecting-ip — but only when the socket really is loopback
// (i.e. the header was added by our own cloudflared), never from a LAN client that set it itself.
export function clientKey(req) {
  const forwarded = req.headers["cf-connecting-ip"];
  if (isLoopbackSocket(req) && typeof forwarded === "string" && forwarded) {
    return ipKeyGenerator(forwarded.trim());
  }
  return ipKeyGenerator(req.socket?.remoteAddress || "unknown");
}

export function requireLocalConsole(req, res, next) {
  if (!isLocalConsole(req)) {
    return res.status(403).json({ error: "This can only be done on the computer running Self Host Form." });
  }
  next();
}

// Host controls stay reachable from phones/tablets on the LAN, but never through the public
// Remote Access link — that link exists for respondents, and exposing the host login to the whole
// internet would turn the host password into the only thing standing between strangers and the
// gradebook.
export function blockTunnel(req, res, next) {
  if (isTunnelRequest(req)) {
    return res.status(403).json({ error: "Host controls aren't available over the Remote Access link." });
  }
  next();
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// CSRF defence for the cookie-authenticated routes. SameSite=Lax already stops cross-site POSTs,
// but browsers treat every port on localhost (and every page on the same IP) as "same-site", so
// any other local web app could still ride the host's cookie. Fetch-metadata is checked where the
// browser sends it (secure contexts); the Origin/Host comparison covers plain-HTTP LAN addresses,
// where it doesn't. Requests with neither header (curl, scripts) aren't CSRF — they carry no
// ambient cookie — and still have to pass requireAuth on their own.
export function requireSameOrigin(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();

  const site = req.headers["sec-fetch-site"];
  if (site) {
    if (site === "same-origin" || site === "none") return next();
    return res.status(403).json({ error: "Cross-site request blocked." });
  }

  const origin = req.headers.origin;
  if (!origin) return next();
  try {
    if (new URL(origin).host === req.headers.host) return next();
  } catch {
    // Malformed Origin — fall through to reject.
  }
  return res.status(403).json({ error: "Cross-site request blocked." });
}
