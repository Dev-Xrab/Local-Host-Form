// A minimal in-memory stand-in for the Google Drive v3 REST API (app-data folder only), enough to
// exercise server/cloud/drive.js and driveCloud.js without network access or a Google account.
import http from "node:http";
import { randomUUID } from "node:crypto";

export const TOKEN = "test-token";

export function startFakeDrive({ port = 0 } = {}) {
  const files = new Map(); // id -> { id, name, content, modifiedTime }
  const pendingUploads = new Map(); // upload id -> { method, id?, metadata }
  let clock = Date.UTC(2026, 0, 1, 0, 0, 0);
  let revoked = false;
  let offline = false;
  const stats = { multipart: 0, media: 0, resumable: 0, lists: 0, reads: 0, deletes: 0, exchanges: 0, refreshes: 0, revokes: 0, verifiers: [] };
  const now = () => new Date((clock += 5)).toISOString(); // strictly increasing, like real writes

  const meta = (f) => ({ id: f.id, name: f.name, modifiedTime: f.modifiedTime, size: String(Buffer.byteLength(f.content)) });
  const json = (res, status, body) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  };

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://fake");
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks).toString("utf8");

    // A stand-in consent page so the real app can be clicked through without a Google OAuth client.
    if (req.method === "GET" && url.pathname === "/auth") {
      const back = new URL(url.searchParams.get("redirect_uri"));
      back.searchParams.set("code", "good-code");
      back.searchParams.set("state", url.searchParams.get("state"));
      const denied = new URL(back);
      denied.searchParams.delete("code");
      denied.searchParams.set("error", "access_denied");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(`<!doctype html><meta charset="utf-8"><title>Fake Google sign-in</title>
<body style="font-family:system-ui;background:#121212;color:#ededed;max-width:520px;margin:48px auto;padding:0 20px">
<p style="color:#f2b24c">FAKE GOOGLE. For local testing only. Nothing here is sent to Google.</p>
<h2>Self Host Form wants to access your Google Account</h2>
<p>Signed in as <b>teacher@example.com</b></p>
<ul><li>Associate you with your personal info on Google</li><li>See your email address</li>
<li>See your personal info, including any personal info you've made publicly available</li>
<li><b>See, create, and delete its own configuration data in your Google Drive</b> (drive.appdata)</li></ul>
<p><a href="${back}" style="background:#006239;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">Allow</a>
&nbsp; <a href="${denied}" style="color:#a0a0a0">Cancel</a></p></body>`);
    }
    // Connectivity probe used by the app, and a switch to simulate losing the connection.
    if (req.method === "GET" && url.pathname === "/generate_204") {
      res.writeHead(offline ? 503 : 204);
      return res.end();
    }
    if (req.method === "POST" && url.pathname === "/__offline") {
      offline = url.searchParams.get("on") === "1";
      return json(res, 200, { offline });
    }
    // Lets you see what the app stored in the fake Drive app folder.
    if (req.method === "GET" && url.pathname === "/__files") {
      return json(res, 200, [...files.values()].map((f) => ({ name: f.name, bytes: Buffer.byteLength(f.content), modifiedTime: f.modifiedTime })));
    }

    // Fake Google OAuth endpoints, used by the end-to-end test.
    if (req.method === "POST" && url.pathname === "/token") {
      const form = new URLSearchParams(raw);
      if (form.get("grant_type") === "authorization_code") {
        stats.exchanges++;
        stats.verifiers.push(form.get("code_verifier"));
        if (form.get("code") === "good-code" || form.get("code") === "no-drive-code") {
          const scope = "openid email profile" + (form.get("code") === "good-code" ? " https://www.googleapis.com/auth/drive.appdata" : "");
          // expires_in is tiny so the next sync has to take the refresh path.
          return json(res, 200, { access_token: TOKEN, refresh_token: "refresh-1", expires_in: 1, scope, token_type: "Bearer" });
        }
        return json(res, 400, { error: "invalid_grant", error_description: "Bad code" });
      }
      if (form.get("grant_type") === "refresh_token") {
        if (form.get("refresh_token") !== "refresh-1" || revoked) return json(res, 400, { error: "invalid_grant", error_description: "Token has been expired or revoked." });
        stats.refreshes++;
        // Also short-lived, so every later call re-checks the grant, which is how a revoked token is noticed.
        return json(res, 200, { access_token: TOKEN, expires_in: 1, token_type: "Bearer" });
      }
      return json(res, 400, { error: "unsupported_grant_type" });
    }
    if (req.method === "POST" && url.pathname === "/revoke") {
      stats.revokes++;
      revoked = true;
      return json(res, 200, {});
    }
    if (req.method === "GET" && url.pathname === "/userinfo" && req.headers.authorization === `Bearer ${TOKEN}`) {
      return json(res, 200, { sub: "google-user-1", email: "teacher@example.com", name: "Test Teacher", picture: null });
    }

    if (req.headers.authorization !== `Bearer ${TOKEN}` && !url.pathname.startsWith("/resumable/")) {
      return json(res, 401, { error: { code: 401, message: "Invalid Credentials" } });
    }

    // files.list
    if (req.method === "GET" && url.pathname === "/drive/v3/files") {
      stats.lists++;
      if (url.searchParams.get("spaces") !== "appDataFolder") return json(res, 400, { error: { message: "spaces must be appDataFolder" } });
      let list = [...files.values()];
      const q = url.searchParams.get("q");
      const exact = q && /^name = '(.+)'$/.exec(q);
      if (q && !exact) return json(res, 400, { error: { message: `unsupported query: ${q}` } });
      if (exact) list = list.filter((f) => f.name === exact[1]);
      return json(res, 200, { files: list.map(meta) });
    }

    // files.get media / delete
    const fileMatch = /^\/drive\/v3\/files\/([^/]+)$/.exec(url.pathname);
    if (fileMatch) {
      const f = files.get(decodeURIComponent(fileMatch[1]));
      if (!f) return json(res, 404, { error: { code: 404, message: "File not found" } });
      if (req.method === "GET" && url.searchParams.get("alt") === "media") {
        stats.reads++;
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(f.content);
      }
      if (req.method === "DELETE") {
        stats.deletes++;
        files.delete(f.id);
        res.writeHead(204);
        return res.end();
      }
    }

    // multipart create
    if (req.method === "POST" && url.pathname === "/upload/drive/v3/files" && url.searchParams.get("uploadType") === "multipart") {
      stats.multipart++;
      const boundary = /boundary=(.+)$/.exec(req.headers["content-type"] || "")[1];
      const parts = raw.split(`--${boundary}`).filter((p) => p.trim() && p.trim() !== "--");
      const body = (p) => p.slice(p.indexOf("\r\n\r\n") + 4).replace(/\r\n$/, "");
      const metadata = JSON.parse(body(parts[0]));
      if (!metadata.parents?.includes("appDataFolder")) return json(res, 400, { error: { message: "must be created in appDataFolder" } });
      const f = { id: randomUUID(), name: metadata.name, content: body(parts[1]), modifiedTime: now() };
      files.set(f.id, f);
      return json(res, 200, meta(f));
    }

    // media update
    const upMatch = /^\/upload\/drive\/v3\/files\/([^/]+)$/.exec(url.pathname);
    if (req.method === "PATCH" && upMatch && url.searchParams.get("uploadType") === "media") {
      stats.media++;
      const f = files.get(decodeURIComponent(upMatch[1]));
      if (!f) return json(res, 404, { error: { message: "File not found" } });
      f.content = raw;
      f.modifiedTime = now();
      return json(res, 200, meta(f));
    }

    // resumable: start, then PUT content
    if (url.pathname.startsWith("/upload/drive/v3/files") && url.searchParams.get("uploadType") === "resumable") {
      stats.resumable++;
      const id = randomUUID();
      pendingUploads.set(id, { method: req.method, fileId: upMatch ? decodeURIComponent(upMatch[1]) : null, metadata: JSON.parse(raw || "{}") });
      res.writeHead(200, { Location: `http://127.0.0.1:${server.address().port}/resumable/${id}` });
      return res.end();
    }
    const resumeMatch = /^\/resumable\/([^/]+)$/.exec(url.pathname);
    if (req.method === "PUT" && resumeMatch) {
      const pending = pendingUploads.get(resumeMatch[1]);
      if (!pending) return json(res, 404, { error: { message: "unknown upload" } });
      pendingUploads.delete(resumeMatch[1]);
      let f;
      if (pending.fileId) {
        f = files.get(pending.fileId);
        f.content = raw;
        f.modifiedTime = now();
      } else {
        f = { id: randomUUID(), name: pending.metadata.name, content: raw, modifiedTime: now() };
        files.set(f.id, f);
      }
      return json(res, 200, meta(f));
    }

    json(res, 404, { error: { message: `no route ${req.method} ${url.pathname}` } });
  });

  return new Promise((resolve) => {
    server.listen(port, "127.0.0.1", () => {
      const base = `http://127.0.0.1:${server.address().port}`;
      process.env.DRIVE_API_BASE = `${base}/drive/v3`;
      process.env.DRIVE_UPLOAD_BASE = `${base}/upload/drive/v3`;
      process.env.GOOGLE_AUTH_URL = `${base}/auth`;
      process.env.GOOGLE_TOKEN_URL = `${base}/token`;
      process.env.GOOGLE_REVOKE_URL = `${base}/revoke`;
      process.env.GOOGLE_USERINFO_URL = `${base}/userinfo`;
      resolve({ base, files, stats, close: () => new Promise((r) => server.close(r)) });
    });
  });
}
