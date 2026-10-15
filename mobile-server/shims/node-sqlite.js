// `node:sqlite` DatabaseSync for the phone runtime, backed by expo-sqlite's synchronous API.
// The server only uses exec / prepare().run|get|all, so that is all this provides.
//
// The backend is injected (globalThis.__SHF_SQLITE__ = { openDatabaseSync }) rather than imported
// here, so the same shim can be exercised in Node tests with a fake backend.

function backend() {
  const b = globalThis.__SHF_SQLITE__;
  if (!b?.openDatabaseSync) throw new Error("SQLite backend not registered (expo-sqlite).");
  return b;
}

const baseName = (file) => String(file).split(/[\\/]/).pop();

// node:sqlite binds undefined as an error; expo-sqlite wants null. Booleans pass straight through.
const bind = (params) => params.map((p) => (p === undefined ? null : p));

export class DatabaseSync {
  constructor(file) {
    // The phone keeps databases in the app's own SQLite folder, so only the file name matters.
    this._db = backend().openDatabaseSync(baseName(file));
  }

  exec(sql) {
    this._db.execSync(sql);
  }

  prepare(sql) {
    const db = this._db;
    return {
      run(...params) {
        const r = db.runSync(sql, bind(params));
        return { changes: r.changes, lastInsertRowid: r.lastInsertRowId };
      },
      get(...params) {
        return db.getFirstSync(sql, bind(params)) ?? undefined; // node:sqlite returns undefined, not null, when no row matches
      },
      all(...params) {
        return db.getAllSync(sql, bind(params));
      },
    };
  }

  close() {
    this._db.closeSync();
  }
}

export default { DatabaseSync };
