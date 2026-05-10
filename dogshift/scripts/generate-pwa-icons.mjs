// Regenerate PWA icons from public/dogshift-logo.png
// Usage: node scripts/generate-pwa-icons.mjs

import sharp from "sharp";
import { join, dirname } from "path";
import { mkdirSync } from "fs";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "public/dogshift-logo.png");
const out = join(root, "public/pwa-icons");

mkdirSync(out, { recursive: true });

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

await Promise.all(
  sizes.map((s) =>
    sharp(src)
      .resize(s, s, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .png()
      .toFile(join(out, `icon-${s}x${s}.png`))
      .then(() => console.log(`✓ icon-${s}x${s}.png`))
  )
);

console.log("Done.");
