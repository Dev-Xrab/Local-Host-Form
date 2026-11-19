// Developer-only: runs the production-style server (it serves the built web UI from dist/) and
// keeps both current. A change to the app's UI code rebuilds dist/ and then restarts the server;
// a change to server code just restarts it. Run with `npm run dev:watch`.
import { spawn } from "node:child_process";
import { existsSync, renameSync, rmSync, watch } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
// The build goes to its own folder and replaces dist/ only once it has succeeded, so a build
// error (or a request mid-build) never leaves the server without a working UI.
const staging = path.join(root, "dist-build");
const previous = path.join(root, "dist-old");

const UI_DIRS = ["app", "components", "lib", "src", "store", "ui", "assets"];
const UI_FILES = ["app.json", "metro.config.js", "tsconfig.json", "types.d.ts", "babel.config.js"];
const SERVER_DIRS = ["server", "mobile-server"];
// The server writes its database under server/data; reacting to that would restart it forever.
const IGNORED = [`${path.sep}node_modules${path.sep}`, `${path.sep}data${path.sep}`, ".sqlite", ".log"];
const DEBOUNCE_MS = 800;

let server = null;
let building = false;
let pending = { ui: false, server: false };
let timer = null;

const log = (msg) => console.log(`[dev-watch] ${msg}`);

function startServer() {
  server = spawn(process.execPath, ["server/index.js"], { cwd: root, stdio: "inherit" });
  server.on("exit", (code, signal) => {
    if (server && !server.stopping) log(`server exited (${signal || code}); waiting for the next change`);
  });
}

function stopServer() {
  return new Promise((resolve) => {
    const child = server;
    if (!child || child.exitCode !== null) return resolve();
    child.stopping = true;
    // Bound to this child on purpose: by the time it fires, `server` may be its replacement.
    const force = setTimeout(() => child.kill("SIGKILL"), 5000);
    child.once("exit", () => { clearTimeout(force); resolve(); });
    child.kill("SIGTERM");
  });
}

function buildUi() {
  return new Promise((resolve) => {
    rmSync(staging, { recursive: true, force: true });
    const child = spawn("npx", ["expo", "export", "-p", "web", "--output-dir", staging], { cwd: root, stdio: "inherit", shell: process.platform === "win32" });
    child.on("exit", (code) => {
      if (code !== 0) {
        log(`build failed (exit ${code}); keeping the previous dist/`);
        return resolve(false);
      }
      rmSync(previous, { recursive: true, force: true });
      if (existsSync(dist)) renameSync(dist, previous);
      renameSync(staging, dist);
      rmSync(previous, { recursive: true, force: true });
      resolve(true);
    });
  });
}

async function refresh() {
  if (building) return; // the running pass re-checks `pending` when it finishes
  building = true;
  while (pending.ui || pending.server) {
    const { ui } = pending;
    pending = { ui: false, server: false };
    if (ui) {
      log("UI changed: rebuilding…");
      const ok = await buildUi();
      if (ok) log("build done");
    }
    log("restarting server…");
    await stopServer();
    startServer();
  }
  building = false;
}

function onChange(kind, file) {
  if (file && IGNORED.some((part) => file.includes(part))) return;
  pending[kind] = true;
  clearTimeout(timer);
  timer = setTimeout(refresh, DEBOUNCE_MS);
}

function watchPath(target, kind) {
  const full = path.join(root, target);
  if (!existsSync(full)) return;
  watch(full, { recursive: true }, (_event, name) => onChange(kind, path.join(full, name || "")));
}

for (const dir of UI_DIRS) watchPath(dir, "ui");
for (const file of UI_FILES) watchPath(file, "ui");
for (const dir of SERVER_DIRS) watchPath(dir, "server");

const quit = async () => { await stopServer(); process.exit(0); };
process.on("SIGINT", quit);
process.on("SIGTERM", quit);

// Serve whatever dist/ holds right away, then bring it up to date with the current source.
log("starting server and building the UI; edit a file to rebuild and restart");
startServer();
pending.ui = true;
refresh();
