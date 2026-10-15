// Runs Self Host Form's own server inside the phone app, the way the desktop app spawns one:
// the real routes and database schema from server/, listening on the phone's Wi-Fi so students on
// the same network can join, plus the same cloud sync as desktop when the phone is online.
import "./polyfills";
import { PermissionsAndroid, Platform } from "react-native";
import TcpSocket from "react-native-tcp-socket";
import * as SQLite from "expo-sqlite";
import * as Network from "expo-network";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { Asset } from "expo-asset";
import { File } from "expo-file-system";
import JSZip from "jszip";
import { attachConnection } from "../http/connection.js";
import { startHostService, stopHostService } from "../../modules/host-service";
import { DEFAULT_CLOUD_SERVER_URL, DEFAULT_PORT, LAN_REFRESH_MS, PORT_ATTEMPTS } from "../config.js";

const KEEP_AWAKE_TAG = "self-host-form-server";
const MAX_BODY_BYTES = 14 * 1024 * 1024;

let running = null; // { port, url, stop }
let starting = null;

async function loadWebUi() {
  try {
    const asset = Asset.fromModule(require("../../assets/web-ui.zip"));
    await asset.downloadAsync();
    if (!asset.localUri) return null;
    const zip = await JSZip.loadAsync(await new File(asset.localUri).arrayBuffer());
    if (!zip.file("index.html")) return null; // placeholder zip: the web UI hasn't been packed into this build
    return { read: async (path) => (zip.file(path) ? zip.file(path).async("uint8array") : null) };
  } catch (err) {
    console.warn("[phone-server] web UI not available:", err?.message);
    return null;
  }
}

async function refreshLan() {
  try {
    const ip = await Network.getIpAddressAsync();
    globalThis.__SHF_LAN__ = ip && ip !== "0.0.0.0" ? [{ name: "wifi", address: ip }] : [];
  } catch {
    globalThis.__SHF_LAN__ = [];
  }
}

function listen(server, port) {
  return new Promise((resolve, reject) => {
    const onError = (err) => reject(err);
    server.once("error", onError);
    server.listen({ port, host: "0.0.0.0", reuseAddress: true }, () => {
      server.off?.("error", onError);
      resolve();
    });
  });
}

// Android freezes background apps, which would drop every student mid-session if the teacher opened
// another app. A foreground service (with a visible notification) keeps the process, and the server
// inside it, running. On iOS there is no equivalent, so the app has to stay open while hosting.
async function startBackgroundHosting(port) {
  if (Platform.OS !== "android") return;
  try {
    // Android 13+ asks before showing notifications. The service still runs if it's declined.
    if (Platform.Version >= 33) await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  } catch {
    // not fatal
  }
  const lan = globalThis.__SHF_LAN__?.[0]?.address;
  startHostService(lan ? `Students join at http://${lan}:${port}` : "Students on your Wi-Fi can join your sessions.");
}

async function boot({ preferredPort }) {
  // Everything the server code expects from Node is provided before it is first imported, because
  // server/db/index.js opens the database as a side effect of being imported.
  globalThis.__SHF_SQLITE__ = SQLite;
  process.env.DATA_DIR = process.env.DATA_DIR || "/shf-data";
  process.env.CLOUD_SERVER_URL = process.env.CLOUD_SERVER_URL || DEFAULT_CLOUD_SERVER_URL;
  await refreshLan();
  const lanTimer = setInterval(refreshLan, LAN_REFRESH_MS);

  const webUi = await loadWebUi();

  let started = null;
  for (let i = 0; i < PORT_ATTEMPTS && !started; i++) {
    const port = preferredPort + i;
    const { createMobileApp } = require("../createMobileApp.js");
    const app = createMobileApp({ port, webUi });
    const server = TcpSocket.createServer((socket) =>
      attachConnection(app, socket, { maxBodyBytes: MAX_BODY_BYTES, log: (...a) => console.log("[phone-server]", ...a) })
    );
    try {
      await listen(server, port);
      started = { port, server };
    } catch (err) {
      try {
        server.close();
      } catch {
        // never opened
      }
      if (i === PORT_ATTEMPTS - 1) throw new Error(`Couldn't start the server: ${err?.message || "no free port"}`);
    }
  }

  activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
  startBackgroundHosting(started.port);

  return {
    port: started.port,
    url: `http://127.0.0.1:${started.port}`,
    hasWebUi: !!webUi,
    stop() {
      clearInterval(lanTimer);
      try {
        started.server.close();
      } catch {
        // already closed
      }
      deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
      stopHostService();
      running = null;
    },
  };
}

/** Starts the phone's server (once). Resolves with the loopback URL the app itself talks to. */
export function startPhoneServer({ port = DEFAULT_PORT } = {}) {
  if (running) return Promise.resolve(running);
  if (!starting) {
    starting = boot({ preferredPort: port })
      .then((r) => (running = r))
      .finally(() => {
        starting = null;
      });
  }
  return starting;
}

export function stopPhoneServer() {
  running?.stop();
}

export function getPhoneServer() {
  return running;
}
