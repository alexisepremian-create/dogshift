/**
 * Generate the Capacitor native splash image (iOS + Android).
 *
 * Output: a 2732×2732 PNG with the DogShift purple #7c3aed background and the
 * inverted white DogShift logo centered. Replaces the default Capacitor "blue
 * X" placeholder. Same image is written 3× into the iOS imageset (1x/2x/3x)
 * per the Capacitor template — `scaleAspectFill` in LaunchScreen.storyboard
 * crops the square to whatever device aspect ratio, keeping the logo centered.
 *
 * Why 2732×2732 specifically: it's the iPad Pro's longest dimension and the
 * Capacitor / Ionic convention for splash assets. Smaller iPhones downscale
 * it cleanly. Anything smaller looks blurry on iPad.
 *
 * Why composite (rather than dropping in a pre-made PNG): keeps the logo
 * source of truth in `public/dogshift-logo.svg`. If we ever rebrand, just
 * rerun this script after updating the SVG.
 *
 * Usage:
 *   node scripts/generate-native-splash.mjs
 *
 * See docs/bugs/native-app-footer-flash-on-launch.md for the full context.
 */

import { readFileSync, mkdirSync, copyFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const CANVAS_SIZE = 2732;
const LOGO_SIZE = 900;
const BG_HEX = "#7c3aed";

const logoSvg = readFileSync(join(root, "public/dogshift-logo.svg"), "utf8");

const whiteLogoSvg = logoSvg.replace(/fill="#000000"/g, 'fill="#ffffff"');

const logoBuffer = await sharp(Buffer.from(whiteLogoSvg))
  .resize(LOGO_SIZE, LOGO_SIZE, {
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png()
  .toBuffer();

const splash = await sharp({
  create: {
    width: CANVAS_SIZE,
    height: CANVAS_SIZE,
    channels: 4,
    background: BG_HEX,
  },
})
  .composite([
    {
      input: logoBuffer,
      gravity: "center",
    },
  ])
  .png({ compressionLevel: 9 })
  .toBuffer();

const iosSplashDir = join(root, "ios/App/App/Assets.xcassets/Splash.imageset");
mkdirSync(iosSplashDir, { recursive: true });

const iosOutputs = [
  "splash-2732x2732.png",
  "splash-2732x2732-1.png",
  "splash-2732x2732-2.png",
];

const primary = join(iosSplashDir, iosOutputs[0]);
await sharp(splash).toFile(primary);
console.log(`✓ iOS ${iosOutputs[0]}`);

for (const name of iosOutputs.slice(1)) {
  const dest = join(iosSplashDir, name);
  copyFileSync(primary, dest);
  console.log(`✓ iOS ${name} (copy)`);
}

const androidDrawables = [
  "android/app/src/main/res/drawable/splash.png",
  "android/app/src/main/res/drawable-land-mdpi/splash.png",
  "android/app/src/main/res/drawable-land-hdpi/splash.png",
  "android/app/src/main/res/drawable-land-xhdpi/splash.png",
  "android/app/src/main/res/drawable-land-xxhdpi/splash.png",
  "android/app/src/main/res/drawable-land-xxxhdpi/splash.png",
  "android/app/src/main/res/drawable-port-mdpi/splash.png",
  "android/app/src/main/res/drawable-port-hdpi/splash.png",
  "android/app/src/main/res/drawable-port-xhdpi/splash.png",
  "android/app/src/main/res/drawable-port-xxhdpi/splash.png",
  "android/app/src/main/res/drawable-port-xxxhdpi/splash.png",
];

for (const rel of androidDrawables) {
  const dest = join(root, rel);
  try {
    mkdirSync(dirname(dest), { recursive: true });
    await sharp(splash).toFile(dest);
    console.log(`✓ ${rel}`);
  } catch (err) {
    console.warn(`  skipped ${rel} (${(err && err.message) || err})`);
  }
}

console.log("\nDone. Run `npx cap sync` then rebuild in Xcode / Android Studio.");
