// Starts the phone server runtime on a fresh database and runs the API smoke test and the HTTP
// edge-case suite against it.     npm run test:phone
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = mkdtempSync(path.join(os.tmpdir(), "shf-phone-test-"));

const freePort = () =>
  new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
    s.on("error", reject);
  });

const run = (file, env) =>
  new Promise((resolve) => {
    const p = spawn(process.execPath, [path.join(here, "checks", file)], { env: { ...process.env, ...env }, stdio: "inherit" });
    p.on("exit", (code) => resolve(code ?? 1));
  });

const port = await freePort();
const server = spawn(process.execPath, [path.join(here, "run.mjs"), String(port), dataDir], { stdio: ["ignore", "pipe", "inherit"] });
let ready = false;
server.stdout.on("data", (d) => {
  process.stdout.write(d);
  if (String(d).includes("listening")) ready = true;
});

const t0 = Date.now();
while (!ready && Date.now() - t0 < 15000) await new Promise((r) => setTimeout(r, 100));
if (!ready) {
  console.error("Phone runtime did not start.");
  server.kill();
  process.exit(1);
}

const env = { SMOKE_BASE: `http://localhost:${port}` };
console.log("\n=== API smoke test ===");
const smoke = await run("smoke.mjs", env);
console.log("\n=== HTTP edge cases ===");
const edge = await run("edge.mjs", env);

server.kill();
rmSync(dataDir, { recursive: true, force: true });
process.exit(smoke || edge ? 1 : 0);
