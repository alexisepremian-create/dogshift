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
// LOGO_SIZE picked so the LaunchScreen paw renders at the SAME on-screen
// pixel size as the in-WebView CSS overlay (`43vmin` on app/globals.css).
// On a portrait iPhone (390×844 CSS px) with scaleAspectFill, the
// 2732×2732 canvas scales by 844/2732 = 0.309. 43vmin = 167 CSS px →
// 167 / 0.309 = 540 px on the canvas. Going slightly bigger (560) absorbs
// rounding so the handoff feels seamless, not a "shrink".
const LOGO_SIZE = 560;
const BG_HEX = "#7c3aed";

// Source must be a HIGH-RES master so the upscale to LOGO_SIZE / PAW_WEB_SIZE
// stays crisp. apple-touch-icon.png is only 180×180 (iOS spec) — using it
// here produced visible pixelation at boot. The 1024 AppIcon variant is the
// largest clean PNG we ship and is the exact same artwork.
const logoSrc = join(root, "ios/App/App/Assets.xcassets/AppIcon.appiconset/icon-1024.png");

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

// Combined "paw + DOGSHIFT wordmark" mark used by BOTH the native
// LaunchScreen and the in-WebView CSS overlay so the handoff is seamless
// — same artwork, same aspect ratio, same centered position. Founder
// asked for "DOGSHIFT en dessous du logo".
//
// Geometry : 1024 wide × 1280 tall (paw 1024×1024 + 256px text strip
// below). On a portrait iPhone after the LaunchScreen's scaleAspectFill,
// this displays at 43vmin wide × ~54vmin tall — the CSS overlay uses
// the same proportions so the paw lands at the same on-screen pixel.
const MARK_WIDTH = 1024;
const MARK_HEIGHT = 1280;
const TEXT_STRIP_HEIGHT = MARK_HEIGHT - MARK_WIDTH; // 256

// SVG wordmark — same letter-spacing (~0.22em) as <BrandLogo> so the
// brand reads consistently from boot through to in-app. Slight upward
// shift inside the strip (y = 130/256) so the baseline visually
// "hangs" from the paw without too big a gap.
const wordmarkSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${MARK_WIDTH}" height="${TEXT_STRIP_HEIGHT}">
  <text x="50%" y="65%"
    font-family="Helvetica Neue, Helvetica, Arial, sans-serif"
    font-size="140"
    font-weight="700"
    letter-spacing="32"
    text-anchor="middle"
    fill="#ffffff">DOGSHIFT</text>
</svg>`;

// Paw rendered at the FULL width of the mark — it occupies the top
// 1024×1024 of the 1024×1280 canvas.
const pawForMarkBuffer = await sharp(pawAlphaBuffer, {
  raw: { width: rawInfo.width, height: rawInfo.height, channels: 4 },
})
  .resize(MARK_WIDTH, MARK_WIDTH, {
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png()
  .toBuffer();

const markBuffer = await sharp({
  create: {
    width: MARK_WIDTH,
    height: MARK_HEIGHT,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .composite([
    // Paw at the top
    { input: pawForMarkBuffer, top: 0, left: 0 },
    // DOGSHIFT below
    { input: Buffer.from(wordmarkSvg), top: MARK_WIDTH, left: 0 },
  ])
  .png({ compressionLevel: 9 })
  .toBuffer();

await sharp(markBuffer).toFile(join(root, "public/dogshift-paw-white.png"));
console.log("✓ public/dogshift-paw-white.png (paw + DOGSHIFT)");

// LaunchScreen splash — composite the SAME mark on the brand-purple
// canvas. Slight vertical lift so the visual centre of the paw+text
// group hits the geometric centre of the screen after scaleAspectFill.
const MARK_RENDER_W = LOGO_SIZE; // 560
const MARK_RENDER_H = Math.round(LOGO_SIZE * (MARK_HEIGHT / MARK_WIDTH)); // 700

const markScaledForSplash = await sharp(markBuffer)
  .resize(MARK_RENDER_W, MARK_RENDER_H)
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
      input: markScaledForSplash,
      gravity: "center",
    },
  ])
  .png({ compressionLevel: 9 })
  .toBuffer();

// ALSO write the full 2732² splash to /public so the in-WebView CSS
// overlay can use it with `background-size: cover` — that's the exact
// CSS equivalent of UIKit's `scaleAspectFill`, so the LaunchScreen and
// the WebView splash render the same artwork, at the same scale, at the
// same screen position. Pixel-perfect handoff (no more "le logo se joue
// en deux fois" / paw shrinking at the moment of takeover).
await sharp(splash).toFile(join(root, "public/native-splash.png"));
console.log("✓ public/native-splash.png (full splash for WebView overlay)");

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
