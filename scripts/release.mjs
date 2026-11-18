#!/usr/bin/env node
// One-command release: builds every desktop platform and uploads it to the GitHub release
// under the fixed filenames the website links to (releases/latest/download/<name>).
//
//   npm run release                 build + upload Windows, Linux, macOS
//   npm run release -- --only win   just some platforms (win,linux,mac; comma separated)
//   npm run release -- --skip-build re-upload what is already in release/
//   npm run release -- --dry-run    print what would happen, change nothing
//
// Windows + Linux build locally. macOS can only be built on a Mac, so it is built by the
// "Build macOS" GitHub Actions workflow: this script triggers it (by pushing the version tag,
// or re-running the latest run when the tag already exists), waits, and checks the files landed.
// Needs: gh (logged in, `gh auth login`), git, and push access to the repo.

import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "release");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const version = pkg.version;
const tag = `v${version}`;

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const skipBuild = args.includes("--skip-build");
const onlyIdx = args.indexOf("--only");
const only = onlyIdx >= 0 ? args[onlyIdx + 1].split(",") : ["win", "linux", "mac"];
const want = (p) => only.includes(p);

const isWin = process.platform === "win32";
const log = (m) => console.log(`\n\x1b[36m▸ ${m}\x1b[0m`);
const fail = (m) => {
  console.error(`\n\x1b[31m✗ ${m}\x1b[0m`);
  process.exit(1);
};

// Runs a command, streaming its output. `shell` is needed for npx/.cmd shims on Windows.
function run(cmd, cmdArgs, opts = {}) {
  console.log(`$ ${cmd} ${cmdArgs.join(" ")}`);
  if (dryRun && !opts.always) return "";
  // With a shell on Windows, args are concatenated unescaped, so quote anything with spaces.
  const safeArgs = isWin ? cmdArgs.map((a) => (/[s&|<>^]/.test(a) ? `"${a}"` : a)) : cmdArgs;
  const r = spawnSync(cmd, safeArgs, { cwd: root, stdio: opts.capture ? ["ignore", "pipe", "inherit"] : "inherit", shell: isWin, encoding: "utf8" });
  if (r.status !== 0 && !opts.allowFail) fail(`Command failed: ${cmd} ${cmdArgs.join(" ")}`);
  return opts.capture ? (r.stdout || "").trim() : r.status;
}
// Newest runs of the macOS workflow, parsed in JS (no jq quoting problems across shells).
const macRuns = (extra = []) => {
  const o = gh(["run", "list", "--workflow", "build-mac.yml", "--limit", "5", "--json", "databaseId,status,headBranch", ...extra], { capture: true, always: true });
  try { return JSON.parse(o || "[]"); } catch { return []; }
};
const git = (...a) => run("git", ["-c", "safe.directory=*", ...a], { capture: true, always: true });

// Detect the GitHub repo (owner/name) from the remote so nothing is hard-coded.
function repoSlug() {
  const url = execFileSync("git", ["-c", "safe.directory=*", "remote", "get-url", "origin"], { cwd: root, encoding: "utf8" }).trim();
  const m = url.match(/github\.com[:/]([^/]+\/[^/.]+)/);
  if (!m) fail(`Cannot read the GitHub repo from remote origin: ${url}`);
  return m[1];
}
const repo = repoSlug();
const gh = (a, o = {}) => run("gh", [...a, "--repo", repo], o);

// ---- preflight ------------------------------------------------------------------------
log(`Releasing ${tag} to ${repo} (${only.join(", ")})${dryRun ? " [dry run]" : ""}`);
if (spawnSync("gh", ["auth", "status"], { shell: isWin, stdio: "ignore" }).status !== 0) fail("gh is not logged in. Run: gh auth login");
if (isWin && want("linux") && !skipBuild) console.log("(Linux tar.gz is cross-built from Windows; the AppImage is skipped because it needs symlink rights.)");

// ---- build ----------------------------------------------------------------------------
const assets = []; // [localPath, releaseName]
if (!skipBuild && (want("win") || want("linux"))) {
  log("Building the web UI");
  run("npm", ["run", "build"]);
}

if (want("win")) {
  if (!skipBuild) {
    if (!isWin && process.platform !== "darwin") console.log("Note: building Windows on Linux needs wine.");
    log("Building Windows installer");
    run("npx", ["electron-builder", "--win", "--x64", "--publish", "never"]);
  }
  const exe = join(out, `Self Host Form Setup ${version}.exe`);
  if (!dryRun && !existsSync(exe)) fail(`Missing ${exe}`);
  // Two names: a stable one the website links to, and a versioned one for history.
  assets.push([exe, "Self-Host-Form-Setup.exe"], [exe, `Self-Host-Form-Setup-${version}.exe`]);
}

if (want("linux")) {
  if (!skipBuild) {
    log("Building Linux archive");
    run("npx", ["electron-builder", "--linux", "tar.gz", "--x64", "--publish", "never"]);
  }
  const tgz = join(out, `Self-Host-Form-${version}-x64.tar.gz`);
  if (!dryRun && !existsSync(tgz)) fail(`Missing ${tgz}`);
  assets.push([tgz, "Self-Host-Form-linux-x64.tar.gz"]);
}

// ---- release + upload -----------------------------------------------------------------
log(`Ensuring release ${tag} exists`);
const hasRelease = spawnSync("gh", ["release", "view", tag, "--repo", repo], { shell: isWin, stdio: "ignore" }).status === 0;
if (!hasRelease) gh(["release", "create", tag, "--title", `Self Host Form ${tag}`, "--generate-notes", "--latest"]);

if (assets.length) {
  log("Uploading to the release");
  const sums = [];
  for (const [src, name] of assets) {
    // gh names an asset after the local file, so copy to the release name first.
    const dst = join(out, name);
    if (!dryRun) {
      if (src !== dst) copyFileSync(src, dst);
      sums.push(`${createHash("sha256").update(readFileSync(src)).digest("hex")}  ${name}`);
    }
    gh(["release", "upload", tag, dst, "--clobber"]);
  }
  if (!dryRun) {
    const sumFile = join(out, "SHA256.txt");
    // Merge with the release's existing SHA256.txt so a partial run keeps the other platforms' lines.
    const merged = new Map();
    const old = gh(["release", "download", tag, "--pattern", "SHA256.txt", "--output", "-"], { capture: true, allowFail: true, always: true });
    for (const line of old.split(/\r?\n/)) {
      const m = line.match(/^([0-9a-f]{64})\s+(.+)$/);
      if (m) merged.set(m[2], m[1]);
    }
    for (const line of sums) {
      const [h, n] = line.split(/\s+/);
      merged.set(n, h);
    }
    writeFileSync(sumFile, [...merged].map(([n, h]) => `${h}  ${n}`).join("\n") + "\n");
    gh(["release", "upload", tag, sumFile, "--clobber"]);
  }
}

// ---- macOS (built by GitHub Actions) ---------------------------------------------------
if (want("mac")) {
  log("macOS: building on GitHub Actions");
  const branch = git("branch", "--show-current");
  const tagExistsRemote = git("ls-remote", "--tags", "origin", tag) !== "";
  const sha = git("rev-parse", "HEAD");
  const before = String(macRuns()[0]?.databaseId ?? "");

  if (!tagExistsRemote) {
    if (git("tag", "-l", tag) === "") git("tag", tag, sha);
    console.log(`Pushing tag ${tag} to trigger the macOS workflow`);
    if (!dryRun) git("push", "origin", tag);
  } else {
    // Tag already pushed, so a push can't re-trigger it: re-run the newest run for the branch.
    const prev = String(macRuns(["--branch", branch])[0]?.databaseId ?? "");
    if (!prev) fail(`Tag ${tag} already exists and no earlier macOS run was found for branch ${branch}. Push a commit touching .github/workflows/build-mac.yml to start one.`);
    console.log(`Tag ${tag} already pushed: re-running macOS run ${prev}`);
    gh(["run", "rerun", prev]);
  }

  if (!dryRun) {
    // Wait for the run to appear (new tag) or restart (rerun), then watch it to the end.
    let id = "";
    for (let i = 0; i < 30 && !id; i++) {
      await new Promise((r) => setTimeout(r, 4000));
      const latest = macRuns()[0];
      if (latest && (String(latest.databaseId) !== before || latest.status !== "completed")) id = String(latest.databaseId);
    }
    if (!id) fail("The macOS workflow did not start. Check the Actions tab.");
    console.log(`Watching run ${id} (takes ~5 minutes)`);
    if (gh(["run", "watch", id, "--exit-status"], { allowFail: true }) !== 0) fail(`macOS build failed: gh run view ${id} --log-failed --repo ${repo}`);
  }
}

// ---- verify ---------------------------------------------------------------------------
log("Verifying the website download links");
const expected = [];
if (want("win")) expected.push("Self-Host-Form-Setup.exe");
if (want("linux")) expected.push("Self-Host-Form-linux-x64.tar.gz");
if (want("mac")) expected.push("Self-Host-Form-mac.dmg");
let bad = 0;
for (const name of expected) {
  if (dryRun) { console.log(`(dry run) would check ${name}`); continue; }
  const code = spawnSync("curl", ["-sIL", "-o", isWin ? "NUL" : "/dev/null", "-w", "%{http_code}", "-r", "0-0", `https://github.com/${repo}/releases/latest/download/${name}`], { encoding: "utf8", shell: isWin }).stdout.trim();
  const ok = code === "200" || code === "206";
  if (!ok) bad++;
  console.log(`${ok ? "✓" : "✗"} ${name} → ${code}`);
}
if (bad) fail(`${bad} download link(s) are not live. If ${tag} is not the latest release, mark it as Latest on GitHub.`);
log(`Done: ${tag} released.`);
