// In-memory stand-in for express-rate-limit, covering the options server/security/rateLimits.js
// uses: windowMs, limit, keyGenerator, skip, skipSuccessfulRequests, handler.
const sweepEvery = 60_000;

export function ipKeyGenerator(ip) {
  // Collapse IPv4-mapped IPv6 ("::ffff:1.2.3.4") so one device can't hold two buckets.
  return String(ip || "unknown").replace(/^::ffff:/, "");
}

export function rateLimit(options) {
  const { windowMs, limit, keyGenerator, skip, skipSuccessfulRequests, handler } = options;
  const hits = new Map(); // key -> { count, resetAt }
  let lastSweep = Date.now();

  return function limiter(req, res, next) {
    const now = Date.now();
    if (now - lastSweep > sweepEvery) {
      for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
      lastSweep = now;
    }
    if (skip && skip(req, res)) return next();

    const key = (keyGenerator ? keyGenerator(req, res) : ipKeyGenerator(req.socket?.remoteAddress)) ?? "unknown";
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;

    if (skipSuccessfulRequests) {
      res.once("finish", () => {
        if (res.statusCode < 400 && entry.count > 0) entry.count -= 1;
      });
    }

    if (entry.count > limit) {
      res.setHeader("Retry-After", String(Math.max(1, Math.ceil((entry.resetAt - now) / 1000))));
      return handler(req, res, next, options);
    }
    next();
  };
}

export default rateLimit;
