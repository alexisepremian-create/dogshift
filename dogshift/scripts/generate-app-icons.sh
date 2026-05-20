#!/usr/bin/env bash
#
# Generate all iOS + Android + PWA icon sizes from a single master PNG.
#
# Usage :
#   ./scripts/generate-app-icons.sh assets/app-icon-master.png
#
# Expects a 1024×1024 (or larger) PNG with NO transparency for Apple.
# Uses macOS native `sips` so no extra deps.

set -euo pipefail

SRC="${1:-assets/app-icon-master.png}"
if [[ ! -f "$SRC" ]]; then
  echo "❌ Master icon not found at $SRC"
  echo "   Drop your 1024×1024 PNG there first."
  exit 1
fi

echo "🎨 Generating icons from $SRC"

# ── iOS — AppIcon.appiconset ──────────────────────────────────────────────
IOS_DIR="ios/App/App/Assets.xcassets/AppIcon.appiconset"
if [[ -d "ios/App" ]]; then
  mkdir -p "$IOS_DIR"
  declare -a IOS_SIZES=(
    "20"   "40"   "60"     # 20pt @1x @2x @3x
    "29"   "58"   "87"     # 29pt @1x @2x @3x
    "40"   "80"   "120"    # 40pt @1x @2x @3x
    "60"   "120"  "180"    # 60pt @2x @3x
    "76"   "152"           # 76pt iPad
    "167"                  # 83.5pt iPad Pro
    "1024"                 # App Store marketing
  )
  for size in "${IOS_SIZES[@]}"; do
    sips -Z "$size" "$SRC" --out "$IOS_DIR/icon-${size}.png" >/dev/null
    echo "  ✓ iOS ${size}×${size}"
  done
else
  echo "⚠️  ios/ not present (CocoaPods not installed yet). Run \`npx cap add ios\` after installing CocoaPods."
fi

# ── Android — mipmap-*dpi ─────────────────────────────────────────────────
ANDROID_DIR="android/app/src/main/res"
if [[ -d "$ANDROID_DIR" ]]; then
  declare -A ANDROID_SIZES=(
    [mipmap-mdpi]=48
    [mipmap-hdpi]=72
    [mipmap-xhdpi]=96
    [mipmap-xxhdpi]=144
    [mipmap-xxxhdpi]=192
  )
  for dir in "${!ANDROID_SIZES[@]}"; do
    size=${ANDROID_SIZES[$dir]}
    mkdir -p "$ANDROID_DIR/$dir"
    sips -Z "$size" "$SRC" --out "$ANDROID_DIR/$dir/ic_launcher.png" >/dev/null
    sips -Z "$size" "$SRC" --out "$ANDROID_DIR/$dir/ic_launcher_round.png" >/dev/null
    sips -Z "$size" "$SRC" --out "$ANDROID_DIR/$dir/ic_launcher_foreground.png" >/dev/null
    echo "  ✓ Android $dir ${size}×${size}"
  done
else
  echo "⚠️  android/ not present"
fi

# ── PWA — public/pwa-icons ────────────────────────────────────────────────
echo "🌐 PWA icons (public/pwa-icons/)"
mkdir -p public/pwa-icons
for size in 72 96 128 144 152 192 384 512; do
  sips -Z "$size" "$SRC" --out "public/pwa-icons/icon-${size}x${size}.png" >/dev/null
  echo "  ✓ PWA ${size}×${size}"
done

# ── Apple touch icon (180×180) ────────────────────────────────────────────
sips -Z 180 "$SRC" --out public/apple-touch-icon.png >/dev/null
echo "  ✓ apple-touch-icon.png 180×180"

# ── App Store screenshot template (for reference) ─────────────────────────
echo ""
echo "✅ All icons generated."
echo ""
echo "Next steps :"
echo "  1. Open ios/App/App/Assets.xcassets/AppIcon.appiconset/Contents.json"
echo "     and verify each size is referenced (Xcode usually does this for you)."
echo "  2. Commit + push : git add ios/ android/ public/ && git commit -m 'chore: app icons'"
echo "  3. Re-sync Capacitor : npx cap sync"
