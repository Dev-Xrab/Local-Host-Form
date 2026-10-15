// Zips the web build (dist/) into assets/web-ui.zip so the phone app can serve it to students.
// Run after `npm run build`.  npm run pack:web-ui
import { readdir, readFile, mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const target = path.join(root, "assets", "web-ui.zip");

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

try {
  await stat(path.join(dist, "index.html"));
} catch {
  console.error("dist/index.html not found. Run `npm run build` first.");
  process.exit(1);
}

const zip = new JSZip();
let files = 0;
for await (const file of walk(dist)) {
  zip.file(path.relative(dist, file).split(path.sep).join("/"), await readFile(file));
  files++;
}
const bytes = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 9 } });
await mkdir(path.dirname(target), { recursive: true });
await writeFile(target, bytes);
console.log(`Packed ${files} files from dist/ into assets/web-ui.zip (${(bytes.length / 1024 / 1024).toFixed(1)} MB)`);
