#!/usr/bin/env bash
#
# Generate all iOS + Android + PWA icon sizes from a single master PNG.
#
# Usage :
#   ./scripts/generate-app-icons.sh assets/app-icon-master.png
#
# Expects a 1024×1024 (or larger) PNG with NO transparency for Apple.
# Uses macOS native `sips` so no extra deps.
# Compatible bash 3.2 (default on macOS).

set -eo pipefail

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
  IOS_SIZES="20 29 40 58 60 76 80 87 120 152 167 180 1024"
  for size in $IOS_SIZES; do
    sips -Z "$size" "$SRC" --out "$IOS_DIR/icon-${size}.png" >/dev/null
    echo "  ✓ iOS ${size}×${size}"
  done
else
  echo "⚠️  ios/ not present (CocoaPods not installed yet). Run \`npx cap add ios\` after installing CocoaPods."
fi

# ── Android — mipmap-*dpi (parallel arrays — bash 3 compatible) ──────────
ANDROID_DIR="android/app/src/main/res"
if [[ -d "$ANDROID_DIR" ]]; then
  ANDROID_DIRS="mipmap-mdpi mipmap-hdpi mipmap-xhdpi mipmap-xxhdpi mipmap-xxxhdpi"
  ANDROID_SIZES="48 72 96 144 192"
  i=1
  for dir in $ANDROID_DIRS; do
    size=$(echo "$ANDROID_SIZES" | cut -d' ' -f"$i")
    mkdir -p "$ANDROID_DIR/$dir"
    sips -Z "$size" "$SRC" --out "$ANDROID_DIR/$dir/ic_launcher.png" >/dev/null
    sips -Z "$size" "$SRC" --out "$ANDROID_DIR/$dir/ic_launcher_round.png" >/dev/null
    sips -Z "$size" "$SRC" --out "$ANDROID_DIR/$dir/ic_launcher_foreground.png" >/dev/null
    echo "  ✓ Android $dir ${size}×${size}"
    i=$((i + 1))
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

echo ""
echo "✅ All icons generated."
echo ""
echo "Next steps :"
echo "  1. Open ios/App/App/Assets.xcassets/AppIcon.appiconset/Contents.json"
echo "     and verify each size is referenced (Xcode usually does this for you)."
echo "  2. Commit + push :"
echo "       git add android/ public/ ios/ 2>/dev/null"
echo "       git commit -m 'chore(native): app icons'"
echo "  3. Re-sync Capacitor : npx cap sync"
