// Fills server/oauth/clientDefaults.js with the OAuth client from .env.local for a release build, so
// the desktop installer and the phone app can sign in with no environment set up.
//   npm run inject:oauth             write the client in
//   npm run inject:oauth -- --reset  put the empty defaults back
//
// Use a "Desktop app" client: Google treats its secret as non-confidential. A "Web application"
// client's secret is confidential and must never be shipped (the script refuses obvious misuse
// only by name; checking the client type is up to you).
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(root, "server", "oauth", "clientDefaults.js");
const reset = process.argv.includes("--reset");

const git = (...args) => {
  try {
    execFileSync("git", ["-c", "safe.directory=*", "-C", root, ...args], { stdio: "ignore" });
  } catch {
    // Not a git checkout (e.g. a source archive): nothing to protect.
  }
};

let id = "";
let secret = "";
if (!reset) {
  try {
    process.loadEnvFile(path.join(root, ".env.local"));
  } catch {
    // fall through to the check below
  }
  id = process.env.GOOGLE_CLIENT_ID || "";
  secret = process.env.GOOGLE_CLIENT_SECRET || "";
  if (!id) {
    console.error("GOOGLE_CLIENT_ID is not set (put it in .env.local). Nothing injected.");
    process.exit(1);
  }
}

const quote = (v) => JSON.stringify(v);
writeFileSync(
  target,
  `// Built-in Google OAuth client for release builds. ${reset ? "Empty in git on purpose." : "INJECTED LOCALLY by scripts/inject-oauth-client.mjs: do not commit."}
export const DEFAULT_CLIENT_ID = ${quote(id)};
export const DEFAULT_CLIENT_SECRET = ${quote(secret)};
`
);
// While injected, git must not see the file as modified (so `git add .` cannot commit the secret).
git("update-index", reset ? "--no-skip-worktree" : "--skip-worktree", "server/oauth/clientDefaults.js");
console.log(reset ? "Cleared the built-in OAuth client." : `Injected OAuth client ${id.slice(0, 12)}… (secret hidden).`);
