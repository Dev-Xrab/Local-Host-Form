// Security headers, matching what the desktop server sends through helmet().
// Covers the options createApp passes (a custom Content-Security-Policy, HSTS off, COOP off) and
// helmet's other defaults that still make sense for a plain-HTTP LAN server.
const kebab = (s) => s.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());

function buildCsp(directives) {
  return Object.entries(directives)
    .map(([name, values]) => {
      const list = Array.isArray(values) ? values : [values];
      return list.length ? `${kebab(name)} ${list.join(" ")}` : kebab(name);
    })
    .join("; ");
}

export default function helmet(options = {}) {
  const csp = options.contentSecurityPolicy;
  const cspHeader = csp && csp !== true && csp.directives ? buildCsp(csp.directives) : null;
  const coop = options.crossOriginOpenerPolicy;

  return function securityHeaders(req, res, next) {
    if (cspHeader) res.setHeader("Content-Security-Policy", cspHeader);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-DNS-Prefetch-Control", "off");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    if (coop !== false) res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    next();
  };
}
