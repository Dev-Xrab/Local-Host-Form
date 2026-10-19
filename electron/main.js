import { app, BrowserWindow, ipcMain, powerSaveBlocker, safeStorage, session, shell } from "electron";
import { spawn, execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let serverProcess;
let mainWindow;
let splashWindow;

const PORT = 5174;
const APP_ICON = path.join(__dirname, "..", "build", "icon.ico");

// The key that encrypts stored Google tokens. It is wrapped with the operating system's credential
// store (Windows DPAPI, macOS Keychain) and kept outside the data folder, so copying the database
// or the data folder does not reveal it: only this OS user account can unwrap it. If the OS store is
// unavailable the server falls back to its own key file (server/oauth/tokenVault.js).
function loadTokenKey() {
  if (!safeStorage.isEncryptionAvailable()) return undefined;
  const file = path.join(app.getPath("userData"), "token-key.bin");
  try {
    if (existsSync(file)) return safeStorage.decryptString(readFileSync(file));
  } catch {
    // Unreadable (e.g. a different OS user): make a new key; tokens under the old one just mean signing in again.
  }
  const key = randomBytes(32).toString("base64");
  writeFileSync(file, safeStorage.encryptString(key), { mode: 0o600 });
  return key;
}

function startServer() {
  const tokenKey = loadTokenKey();
  const serverPath = path.join(
  __dirname,
  "..",
  "server",
  "index.js"
);

  serverProcess = spawn(process.execPath, [serverPath], {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      PORT: String(PORT),
      DATA_DIR: path.join(app.getPath("userData"), "data"),
      ...(tokenKey ? { TOKEN_ENCRYPTION_KEY: tokenKey } : {}),
    },
    stdio: "pipe",
    // The server can itself spawn a Cloudflare tunnel child process (Remote Access). Killing just
    // this direct child on quit wouldn't take that grandchild down with it — on Windows via
    // taskkill /t below regardless, and on macOS/Linux only if this is its own process group,
    // which detached:true makes it (see the process.kill(-pid) call in before-quit).
    detached: process.platform !== "win32",
  });

  serverProcess.stdout.on("data", (data) => {
    console.log(`[Server] ${data}`);
  });

  serverProcess.stderr.on("data", (data) => {
    console.error(`[Server Error] ${data}`);
  });

  serverProcess.on("error", (error) => {
    console.error("Failed to start server:", error);
  });
}

async function waitForServer(url, retries = 30) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);

      if (response.ok) {
        return true;
      }
    } catch {
      // Server isn't ready yet.
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return false;
}

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 420,
    height: 320,
    frame: false,
    resizable: false,
    movable: false,
    show: false,
    backgroundColor: "#0D0E10",
    icon: APP_ICON,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  splashWindow.loadFile(path.join(__dirname, "splash.html"));
  splashWindow.once("ready-to-show", () => splashWindow.show());
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    icon: APP_ICON,
    // Frameless: the OS title bar is gone, so src/components/TitleBar draws the app's own
    // (drag region + minimize/maximize/close) via the IPC bridge in electron/preload.cjs —
    // see the window: handlers below.
    frame: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  mainWindow.once("ready-to-show", () => {
    if (splashWindow) {
      splashWindow.close();
      splashWindow = null;
    }
    mainWindow.show();
  });

  const notifyMaximizedChange = () => {
    mainWindow.webContents.send("window:maximized-changed", mainWindow.isMaximized());
  };
  mainWindow.on("maximize", notifyMaximizedChange);
  mainWindow.on("unmaximize", notifyMaximizedChange);

  // Google's OAuth consent screen refuses to load inside an embedded/webview browser like this
  // window ("disallowed_useragent"), so web links leaving our own local server — the cloud
  // sign-in flow, in practice — are handed off to the user's real OS browser instead.
  //
  // This window renders content other people control (respondents' names, answers and uploaded
  // files; imported forms), so only plain web links are ever handed to the OS. shell.openExternal
  // on an arbitrary URL can launch any registered protocol handler or local file, which is a
  // well-known way to turn an injected link into code execution.
  const OWN_ORIGIN = `http://localhost:${PORT}`;

  const isOwnOrigin = (url) => {
    try {
      return new URL(url).origin === OWN_ORIGIN;
    } catch {
      return false;
    }
  };

  const isWebUrl = (url) => {
    try {
      const { protocol } = new URL(url);
      return protocol === "https:" || protocol === "http:";
    } catch {
      return false;
    }
  };

  const openExternal = (url) => {
    if (!isWebUrl(url)) return;
    shell.openExternal(url).catch((err) => {
      console.error("Failed to open external URL:", url, err);
    });
  };

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isOwnOrigin(url)) {
      return {
        action: "allow",
        overrideBrowserWindowOptions: {
          webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, webviewTag: false },
        },
      };
    }
    // data:/blob: URLs are this app's own generated files (exports, attachments). They're
    // saved through Electron's download handling rather than opened as a page — a data:text/html
    // "file" from a respondent must never get a window of its own.
    if (url.startsWith("data:") || url.startsWith("blob:")) {
      mainWindow.webContents.downloadURL(url);
      return { action: "deny" };
    }
    openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (isOwnOrigin(url)) return;
    event.preventDefault();
    openExternal(url);
  });

  mainWindow.webContents.on("will-attach-webview", (event) => event.preventDefault());

  mainWindow.loadURL(`http://localhost:${PORT}`);
}

ipcMain.on("window:minimize", () => mainWindow?.minimize());
ipcMain.on("window:toggle-maximize", () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.on("window:close", () => mainWindow?.close());
ipcMain.handle("window:is-maximized", () => mainWindow?.isMaximized() ?? false);

// Deny every browser permission (camera, microphone, geolocation, notifications, ...) except the
// few this app actually uses.
const ALLOWED_PERMISSIONS = new Set(["fullscreen", "clipboard-sanitized-write"]);

app.whenReady().then(async () => {
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(ALLOWED_PERMISSIONS.has(permission));
  });
  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => ALLOWED_PERMISSIONS.has(permission));

  createSplashWindow();
  startServer();

  const ready = await waitForServer(
    `http://localhost:${PORT}/api/health`
  );

  if (!ready) {
    console.error("LocalForm server failed to start.");
    app.quit();
    return;
  }

  // Students connect to this computer, so it must not go to sleep mid-exam. This blocks system
  // sleep (the screen may still turn off) for as long as the app is open.
  sleepBlockerId = powerSaveBlocker.start("prevent-app-suspension");

  createWindow();
});

app.on("window-all-closed", () => {
  app.quit();
});

let sleepBlockerId = null;

app.on("before-quit", () => {
  if (sleepBlockerId !== null && powerSaveBlocker.isStarted(sleepBlockerId)) {
    powerSaveBlocker.stop(sleepBlockerId);
    sleepBlockerId = null;
  }
  if (serverProcess) {
    // serverProcess.kill() only ever signals that one process — it does not take down a
    // grandchild the server itself spawned (a live Cloudflare tunnel, see server/tunnel/service.js),
    // which would otherwise be orphaned and keep running after the app closes.
    if (process.platform === "win32") {
      try {
        execFileSync("taskkill", ["/pid", String(serverProcess.pid), "/t", "/f"]);
      } catch {
        // Best-effort — the process may have already exited on its own.
      }
    } else {
      try {
        process.kill(-serverProcess.pid, "SIGTERM");
      } catch {
        serverProcess.kill();
      }
    }
    serverProcess = null;
  }
});