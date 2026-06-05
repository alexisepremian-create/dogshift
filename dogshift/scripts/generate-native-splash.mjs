/**
 * Generate the Capacitor native splash image (iOS + Android).
 *
 * Output: a 2732×2732 PNG with the DogShift purple #7c3aed background and
 * the app's paw-print logo centred (sourced from `public/apple-touch-icon.png`
 * — same artwork as the iOS home-screen icon, so the transition from icon
 * tap to splash to in-app feels visually continuous). Replaces the default
 * Capacitor "blue X" placeholder. Same image is written 3× into the iOS
 * imageset (1x/2x/3x) per the Capacitor template — `scaleAspectFill` in
 * LaunchScreen.storyboard crops the square to whatever device aspect ratio,
 * keeping the logo centred.
 *
 * Why 2732×2732 specifically: it's the iPad Pro's longest dimension and
 * the Capacitor / Ionic convention for splash assets. Smaller iPhones
 * downscale it cleanly. Anything smaller looks blurry on iPad.
 *
 * Logo sizing rationale: `LOGO_SIZE = 600` on a 2732 canvas → renders at
 * roughly 45 % of an iPhone screen width after `scaleAspectFill`, which
 * lands in the sweet spot between "iOS app icon" (~25 %) and "hero brand
 * mark" (~65 %). Big enough to read at a glance, small enough that the
 * subsequent CSS scale-up grow animation (see `app/globals.css`) has
 * room to expand without clipping the viewport edges.
 *
 * Why composite (rather than dropping in a pre-made PNG): keeps the
 * splash regenerable from the app icon. If we ever rebrand the icon, we
 * regenerate the splash by rerunning this script — no manual Photoshop.
 *
 * Usage:
 *   node scripts/generate-native-splash.mjs
 *
 * See docs/bugs/native-app-footer-flash-on-launch.md for the full context.
 */

import { mkdirSync, copyFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const CANVAS_SIZE = 2732;
const LOGO_SIZE = 900;
const BG_HEX = "#7c3aed";

const logoSrc = join(root, "public/apple-touch-icon.png");

// Extract the white paw silhouette out of the iOS home-screen icon so it can
// be composited on the brand-purple #7c3aed canvas without the icon's own
// (slightly darker, ~#6911cc) rounded square showing through as a colour
// patch. Per-pixel: compute luminance, then apply a smoothstep from
// `LUM_TRANSPARENT` (everything below → α=0) to `LUM_OPAQUE` (everything
// above → α=255). The narrow ramp in between is where the paw's anti-
// aliased edges live; smoothstep keeps them crisp on retina without a
// hard binary threshold that would jag the curves.
const LUM_TRANSPARENT = 100;
const LUM_OPAQUE = 200;

const { data: rawData, info: rawInfo } = await sharp(logoSrc)
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const pixelCount = rawInfo.width * rawInfo.height;
const pawAlphaBuffer = Buffer.alloc(pixelCount * 4);
for (let i = 0; i < pixelCount; i++) {
  const r = rawData[i * 3];
  const g = rawData[i * 3 + 1];
  const b = rawData[i * 3 + 2];
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  const t = Math.max(
    0,
    Math.min(1, (luminance - LUM_TRANSPARENT) / (LUM_OPAQUE - LUM_TRANSPARENT)),
  );
  const smoothed = t * t * (3 - 2 * t);
  pawAlphaBuffer[i * 4] = 255;
  pawAlphaBuffer[i * 4 + 1] = 255;
  pawAlphaBuffer[i * 4 + 2] = 255;
  pawAlphaBuffer[i * 4 + 3] = Math.round(255 * smoothed);
}

const logoBuffer = await sharp(pawAlphaBuffer, {
  raw: { width: rawInfo.width, height: rawInfo.height, channels: 4 },
})
  .resize(LOGO_SIZE, LOGO_SIZE, {
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png()
  .toBuffer();

// Also publish the extracted paw at a CSS-friendly retina size so the
// in-WebView splash overlay (app/globals.css) can show the EXACT same
// silhouette as the native LaunchScreen. Without this we'd see a tiny
// "pop" at the handoff because the SVG-rendered paw and the PNG-rendered
// paw have subtly different anti-aliasing.
const PAW_WEB_SIZE = 512;
const pawWebBuffer = await sharp(pawAlphaBuffer, {
  raw: { width: rawInfo.width, height: rawInfo.height, channels: 4 },
})
  .resize(PAW_WEB_SIZE, PAW_WEB_SIZE, {
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png({ compressionLevel: 9 })
  .toBuffer();

await sharp(pawWebBuffer).toFile(join(root, "public/dogshift-paw-white.png"));
console.log("✓ public/dogshift-paw-white.png");

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
