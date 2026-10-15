// Node ESM resolve hook: runs the real server code against the phone shims, so the phone runtime
// can be tested on a desktop. Only imports made *from server/* are redirected; the harness and the
// shims themselves still see the real Node modules.
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const { MODULES, fileAlias } = require("../aliases.cjs");

export async function resolve(specifier, context, nextResolve) {
  const fromServerCode = /\/server\//.test(context.parentURL || "");
  if (fromServerCode && MODULES[specifier]) {
    return { url: pathToFileURL(MODULES[specifier]).href, shortCircuit: true, format: "module" };
  }
  const resolved = await nextResolve(specifier, context);
  if (resolved.url.startsWith("file:")) {
    const alias = fileAlias(fileURLToPath(resolved.url));
    if (alias) return { url: pathToFileURL(alias).href, shortCircuit: true, format: "module" };
  }
  return resolved;
}
