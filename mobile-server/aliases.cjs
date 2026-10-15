// Which Node/Express modules the phone runtime replaces, and with what. Shared by Metro
// (metro.config.cjs, for the real app) and the Node test harness (test/loader.mjs), so both run
// the server code against exactly the same shims.
const path = require("node:path");

const shim = (file) => path.join(__dirname, "shims", file);

/** import specifier -> shim file */
const MODULES = {
  express: shim("express.js"),
  "express-rate-limit": shim("express-rate-limit.js"),
  helmet: shim("helmet.js"),
  cloudflared: shim("cloudflared.js"),
  "node:crypto": shim("node-crypto.js"),
  "node:sqlite": shim("node-sqlite.js"),
  "node:path": shim("node-path.js"),
  "node:fs": shim("node-fs.js"),
  "node:url": shim("node-url.js"),
  "node:os": shim("node-os.js"),
  "node:child_process": shim("node-child_process.js"),
};

/** server files (matched by path suffix) replaced wholesale */
const FILES = [{ suffix: path.join("server", "db", "dataDir.js"), replacement: shim("dataDir.js") }];

function fileAlias(resolvedPath) {
  const hit = FILES.find((f) => resolvedPath.endsWith(f.suffix));
  return hit ? hit.replacement : null;
}

module.exports = { MODULES, FILES, fileAlias };
