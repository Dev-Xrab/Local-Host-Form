import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// Shared by the Drive sync tests: a real local server process acting as one "device".
const SERVER = fileURLToPath(new URL("../../server/index.js", import.meta.url));

export class Device {
  constructor(port, extraEnv = {}) {
    this.port = port;
    this.origin = `http://127.0.0.1:${port}`;
    this.dir = mkdtempSync(join(tmpdir(), "shf-e2e-"));
    this.cookie = "";
    this.proc = spawn(process.execPath, [SERVER], {
      env: { ...process.env, PORT: String(port), DATA_DIR: this.dir, GOOGLE_CLIENT_ID: "test-client", NODE_ENV: "test", AUTO_SAVE_DRIVE: "0", ...extraEnv },
      stdio: ["ignore", "ignore", "pipe"],
    });
    this.stderr = "";
    this.proc.stderr.on("data", (d) => (this.stderr += d));
  }

  async ready() {
    for (let i = 0; i < 100; i++) {
      try {
        if ((await fetch(`${this.origin}/api/health`)).ok) return;
      } catch {
        // not up yet
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error(`server on ${this.port} did not start\n${this.stderr}`);
  }

  async api(method, path, body, extra = {}) {
    const res = await fetch(`${this.origin}${path}`, {
      method,
      redirect: "manual",
      headers: { "Content-Type": "application/json", Origin: this.origin, Cookie: this.cookie, ...(extra.headers || {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const set = res.headers.getSetCookie?.() || [];
    if (set.length) this.cookie = set.map((c) => c.split(";")[0]).join("; ");
    const text = await res.text();
    let data = text;
    try {
      data = JSON.parse(text);
    } catch {
      // html or empty
    }
    return { status: res.status, data, headers: res.headers };
  }

  // Walks the same steps the app does: mint a launch link, open it, let "Google" send the browser
  // back to our callback, and finish.
  async signIn(code = "good-code") {
    const launch = await this.api("POST", "/api/cloud/auth/launch");
    assert.equal(launch.status, 200);
    const start = await fetch(launch.data.url, { redirect: "manual" });
    assert.equal(start.status, 302);
    const googleUrl = new URL(start.headers.get("location"));
    const callback = await fetch(`${new URL(googleUrl.searchParams.get("redirect_uri")).origin}/api/cloud/auth/callback?code=${code}&state=${googleUrl.searchParams.get("state")}`);
    return { googleUrl, callback, html: await callback.text() };
  }

  stop() {
    this.proc.kill();
    try {
      rmSync(this.dir, { recursive: true, force: true });
    } catch {
      // temp dir still locked on Windows; harmless
    }
  }
}

