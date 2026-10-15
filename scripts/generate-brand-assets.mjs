// Regenerates every icon and splash image from one vector glyph.  Run: npm run brand
//
// The mark is a form outline: a margin bar plus four rows, three of them with bullet holes. It is
// drawn here as paths (not a bitmap) so each size is crisp and each surface gets the right colors.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import pngToIco from "png-to-ico";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = (...p) => path.join(root, ...p);

const BG = "#0D0E10"; // app canvas (ui/tokens.ts palette.dark.bg)
const FG = "#FFFFFF";
const ACCENT = "#3B6BF6";

// Glyph geometry in its original 1125px artboard; the bounding box is x 80-1023, y 133-986.
const BOX = { w: 943, h: 853, cx: 551.5, cy: 559.5 };
const hole = (cx, cy, r) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;
const GLYPH_PATH = [
  "M80 133h156v853H80z", // margin bar
  `M313 133h710v156H313z ${hole(401, 211, 24)}`,
  `M313 365h710v156H313z ${hole(401, 441, 24)}`,
  `M313 597h710v156H313z ${hole(401, 675, 24)}`,
  "M313 829h710v157H313z",
].join(" ");

/** SVG for a canvas of `size` px with the glyph `scale` (fraction of canvas width) wide, centered. */
function svg({ size, bg = null, radius = 0, inset = 0, fill = FG, scale = 0.56, accentBar = false }) {
  const k = (size * scale) / BOX.w;
  const body = size - inset * 2;
  const background = bg ? `<rect x="${inset}" y="${inset}" width="${body}" height="${body}" rx="${radius}" fill="${bg}"/>` : "";
  // A thin accent underline beneath the glyph ties the icon to the app's blue without hurting legibility.
  const accent = accentBar
    ? `<rect x="${size / 2 - (BOX.w * k) / 2}" y="${size / 2 + (BOX.h * k) / 2 + size * 0.045}" width="${BOX.w * k * 0.36}" height="${size * 0.018}" rx="${size * 0.009}" fill="${ACCENT}"/>`
    : "";
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${background}` +
      `<g transform="translate(${size / 2} ${size / 2}) scale(${k}) translate(${-BOX.cx} ${-BOX.cy})"><path d="${GLYPH_PATH}" fill="${fill}" fill-rule="evenodd"/></g>${accent}</svg>`
  );
}

const png = (buf, size, file) => sharp(buf, { density: 144 }).resize(size, size).png().toFile(file);

await mkdir(out("assets"), { recursive: true });
await mkdir(out("build"), { recursive: true });

// --- Mobile (Expo) -------------------------------------------------------------------------
// App icon: full-bleed square (iOS and Android round it themselves, so no corners here).
await png(svg({ size: 1024, bg: BG, scale: 0.54, accentBar: true }), 1024, out("assets", "icon.png"));
// Android adaptive icon: foreground sits inside the 66% safe zone; the launcher supplies the mask.
await png(svg({ size: 1024, scale: 0.42 }), 1024, out("assets", "adaptive-icon.png"));
// Android 13+ themed icon: single-color silhouette; the system tints it.
await png(svg({ size: 1024, scale: 0.42, fill: "#000000" }), 1024, out("assets", "adaptive-icon-monochrome.png"));
// Splash: white mark on transparent; the splash screen paints BG behind it.
await png(svg({ size: 1024, scale: 0.8 }), 1024, out("assets", "splash-icon.png"));

// --- Web ------------------------------------------------------------------------------------
await png(svg({ size: 256, bg: BG, radius: 56, scale: 0.6 }), 64, out("public", "favicon.png"));

// --- Desktop (Electron) ---------------------------------------------------------------------
// Desktop icons aren't masked by the OS, so draw our own rounded tile with a little breathing room.
const tile = (size) => svg({ size, bg: BG, radius: size * 0.2, inset: size * 0.06, scale: 0.5, accentBar: true });
await png(tile(1024), 1024, out("build", "icon.png"));
const sizes = [16, 24, 32, 48, 64, 128, 256];
const frames = await Promise.all(sizes.map((s) => sharp(tile(1024), { density: 144 }).resize(s, s).png().toBuffer()));
await writeFile(out("build", "icon.ico"), await pngToIco(frames));
// Splash window logo.
await png(svg({ size: 512, scale: 0.86 }), 512, out("electron", "logo.png"));

console.log("Brand assets written: assets/{icon,adaptive-icon,adaptive-icon-monochrome,splash-icon}.png, public/favicon.png, build/icon.{png,ico}, electron/logo.png");
