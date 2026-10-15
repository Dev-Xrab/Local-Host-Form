// Serves the respondent/host web app from a zip kept in memory (the phone has no `dist/` folder).
// Same behavior as the desktop server: a real file if it exists, otherwise index.html so client-side
// routes like /s/ABC123 load, but never for /api paths.
const TYPES = {
  html: "text/html; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  json: "application/json; charset=utf-8",
  map: "application/json; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  ico: "image/x-icon",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
};

const typeOf = (name) => TYPES[name.split(".").pop().toLowerCase()] || "application/octet-stream";

/**
 * @param {{ read(path: string): Promise<Uint8Array | null> }} source  Looks up a file by its path inside the web build.
 * @returns an Express-style middleware
 */
export function webUiMiddleware(source) {
  const cache = new Map();
  const load = async (name) => {
    if (cache.has(name)) return cache.get(name);
    const bytes = await source.read(name);
    // Cache the small, hot files; hashed bundles are big and only fetched once per client anyway.
    if (bytes && bytes.length < 512 * 1024) cache.set(name, bytes);
    return bytes;
  };

  return async function serveWebUi(req, res, next) {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    const pathname = req.path;
    if (pathname.startsWith("/api")) return next();

    let name = pathname.replace(/^\/+/, "");
    try {
      name = decodeURIComponent(name);
    } catch {
      return res.status(400).send("Bad request");
    }
    if (name.includes("..")) return res.status(400).send("Bad request");

    let bytes = name ? await load(name) : null;
    let served = name;
    if (!bytes) {
      // Unknown path: a missing asset (has an extension) is a real 404; anything else is an app route.
      if (/\.[a-z0-9]{1,8}$/i.test(name)) return next();
      served = "index.html";
      bytes = await load("index.html");
    }
    if (!bytes) return next();

    res.setHeader("Content-Type", typeOf(served));
    // index.html must always be fresh so an app update is picked up; fingerprinted assets can be cached.
    res.setHeader("Cache-Control", served === "index.html" ? "no-cache" : "public, max-age=31536000, immutable");
    res.status(200).send(bytes);
  };
}
