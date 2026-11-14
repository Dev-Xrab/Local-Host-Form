import path from "node:path";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
// Renamed on import: cloudflared's exported `use` (points the library at a binary path) trips
// oxlint's react-hooks/rules-of-hooks check, which flags any bare `use*` call by name alone —
// this is plain server-side Node, not React, so the collision is cosmetic only.
import { Tunnel, install, use as setCloudflaredBin } from "cloudflared";
import { dataDir } from "../db/index.js";
import { getAllowedEmails } from "./settings.js";

const PORT = process.env.PORT || 5174;

// Deliberately separate from the binary node_modules/cloudflared's own postinstall may have
// downloaded (see package.json's build.files exclusion) — that copy isn't shippable as-is (it'd
// need asarUnpack to run from inside app.asar). This one lives next to the sqlite file, in a
// directory that's always writable and always outside the asar, on every platform and whether
// running from source or packaged.
const binPath = path.join(dataDir, "cloudflared", process.platform === "win32" ? "cloudflared.exe" : "cloudflared");

let state = { status: "idle", url: null, error: null };
let tunnel = null;
// Bumped on every stopTunnel() call and checked before any async step below touches shared state.
// Without this, clicking Stop while still downloading/connecting could get silently overwritten a
// moment later when that now-orphaned attempt finally resolves — the same class of bug already hit
// once this session with the tab-refocus lock's client-side state.
let generation = 0;

export function getStatus() {
  return { ...state, allowedEmails: getAllowedEmails() };
}

// Fire-and-forget by design: the caller (the /start route) returns immediately with whatever
// status this sets synchronously, and the client polls getStatus() for progress — the same lesson
// learned from the earlier "Save to cloud" fix, where awaiting the whole flow made the request hang.
export function startTunnel() {
  if (state.status === "installing" || state.status === "starting" || state.status === "connected") {
    return getStatus();
  }

  if (getAllowedEmails().length > 0) {
    state = {
      status: "error", url: null,
      error: "Cloudflare's email-protected Quick Tunnel sign-in is currently failing. The saved email list was kept. Clear it only if you want a public link, or use a named tunnel with Cloudflare Access.",
    };
    return getStatus();
  }

  const myGeneration = ++generation;
  state = { status: "installing", url: null, error: null };

  (async () => {
    try {
      if (!existsSync(binPath)) {
        await install(binPath);
      }
      if (myGeneration !== generation) return;

      setCloudflaredBin(binPath);
      state = { status: "starting", url: null, error: null };

      const allowedEmails = getAllowedEmails();
      const myTunnel = Tunnel.quick(`http://localhost:${PORT}`, allowedEmails.length ? { "--allowed-mail": allowedEmails.join(",") } : {});
      tunnel = myTunnel;

      let publicUrl = null;
      let connected = false;
      const showConnected = () => {
        if (myGeneration !== generation || !publicUrl || !connected) return;
        state = { status: "connected", url: publicUrl, error: null };
      };
      myTunnel.once("url", (url) => {
        if (myGeneration !== generation) return;
        publicUrl = url;
        showConnected();
      });
      myTunnel.once("connected", () => { connected = true; showConnected(); });

      myTunnel.on("error", (err) => {
        if (myGeneration !== generation) return;
        state = { status: "error", url: null, error: err.message || String(err) };
      });

      myTunnel.on("exit", () => {
        if (tunnel === myTunnel) tunnel = null;
        // A generation bump means stopTunnel() already set state to idle deliberately — this
        // exit is just that process actually going away, not new information.
        if (myGeneration !== generation) return;
        state = { status: "error", url: null, error: "The tunnel disconnected unexpectedly. Start it again to get a new link." };
      });
    } catch (err) {
      if (myGeneration !== generation) return;
      state = { status: "error", url: null, error: err.message || String(err) };
    }
  })();

  return getStatus();
}

// Observed in testing: cloudflared's graceful SIGINT shutdown (tunnel.stop()) can hang onto the
// process indefinitely once it's actually carried real traffic, instead of exiting promptly the
// way it does for a freshly-connected, idle tunnel — a real problem here, not a cosmetic one,
// since a stuck process means the "old" public URL keeps working even after the host believes
// Remote Access is off. This forces it after a short grace period so Stop is always actually stop.
const STOP_GRACE_MS = 3000;

function forceKill(proc) {
  if (process.platform === "win32") {
    try {
      execFileSync("taskkill", ["/pid", String(proc.pid), "/t", "/f"]);
    } catch {
      // Already gone.
    }
  } else {
    try {
      proc.kill("SIGKILL");
    } catch {
      // Already gone.
    }
  }
}

export function stopTunnel() {
  generation++;
  if (tunnel) {
    const proc = tunnel.process;
    tunnel.stop();
    const forceTimer = setTimeout(() => forceKill(proc), STOP_GRACE_MS);
    proc.once("exit", () => clearTimeout(forceTimer));
    tunnel = null;
  }
  state = { status: "idle", url: null, error: null };
  return getStatus();
}
