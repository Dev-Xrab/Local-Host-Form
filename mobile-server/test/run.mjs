// Runs the phone server runtime in Node: real routes + real database schema + the phone's HTTP
// framework and shims, listening on a TCP port so ordinary HTTP clients (the smoke test, a
// browser) can talk to it.   node mobile-server/test/run.mjs [port] [dataDir]
import { register } from "node:module";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { mkdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

register("./loader.mjs", import.meta.url);

const port = Number(process.argv[2] || 5191);
const dataDir = process.argv[3] || path.join(os.tmpdir(), `shf-phone-${process.pid}`);
mkdirSync(dataDir, { recursive: true });

// Stand-in for expo-sqlite's synchronous API, built on node:sqlite. The *shim* under test
// (shims/node-sqlite.js) is the real one; only the bottom layer is faked.
globalThis.__SHF_SQLITE__ = {
  openDatabaseSync(name) {
    const db = new DatabaseSync(path.join(dataDir, name));
    return {
      execSync: (sql) => db.exec(sql),
      runSync: (sql, params) => {
        const r = db.prepare(sql).run(...params);
        return { changes: Number(r.changes), lastInsertRowId: Number(r.lastInsertRowid) };
      },
      getFirstSync: (sql, params) => db.prepare(sql).get(...params) ?? null,
      getAllSync: (sql, params) => db.prepare(sql).all(...params),
      closeSync: () => db.close(),
    };
  },
};
globalThis.__SHF_LAN__ = [{ name: "wlan0", address: "192.168.1.50" }];
if (process.env.CLOUD_SERVER_URL === undefined && process.argv[4]) process.env.CLOUD_SERVER_URL = process.argv[4];

const { createMobileApp } = await import("../createMobileApp.js");
const { attachConnection } = await import("../http/connection.js");

const app = createMobileApp({ port, webUi: null });
net
  .createServer((socket) => attachConnection(app, socket, { maxBodyBytes: 14 * 1024 * 1024, log: (...a) => console.log("[conn]", ...a) }))
  .listen(port, "0.0.0.0", () => console.log(`Phone runtime (node harness) listening on http://localhost:${port}  data=${dataDir}`));
