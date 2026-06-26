#!/usr/bin/env bash
#
# run-android-dev.sh — Build & deploy the WaterParty app to a connected Android device.
# Uses bundled mode (no WiFi), API goes through ADB reverse.
#
# Usage:
#   ./scripts/run-android-dev.sh [--device DEVICE_ID] [--no-clean] [--help]
#
# Options:
#   --device DEVICE_ID  Target a specific device (default: first device found by adb)
#   --no-clean          Skip cleaning Android build caches (faster for repeat runs)
#   --help              Show this help

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$SCRIPT_DIR"

# ─── Config ────────────────────────────────────────────────────────────────

JAVA_HOME_PATH="/c/Program Files/Android/Android Studio/jbr"
ANDROID_SDK_PATH="/c/Users/John Victor/AppData/Local/Android/Sdk"
DEV_SERVER_PORT=3000

# ─── Help ──────────────────────────────────────────────────────────────────

show_help() {
  cat <<'EOF'
run-android-dev.sh — Build & deploy the WaterParty app to a connected Android device.

Usage:
  ./scripts/run-android-dev.sh [--device DEVICE_ID] [--no-clean] [--help]

Options:
  --device DEVICE_ID  Target a specific device (default: first device found by adb)
  --no-clean          Skip cleaning Android build caches (faster for repeat runs)
  --help              Show this help

The app is deployed in bundled mode (loads from APK files).
API calls go through ADB reverse (adb reverse tcp:3000 tcp:3000).
EOF
  exit 0
}

# ─── Parse args ────────────────────────────────────────────────────────────

DEVICE_ID=""
CLEAN=true

while [[ $# -gt 0 ]]; do
  case "$1" in
    --device) DEVICE_ID="$2"; shift 2 ;;
    --no-clean) CLEAN=false; shift ;;
    --help) show_help ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

export JAVA_HOME="$JAVA_HOME_PATH"
export PATH="$JAVA_HOME/bin:$ANDROID_SDK_PATH/platform-tools:$ANDROID_SDK_PATH:$PATH"
export ANDROID_HOME="$ANDROID_SDK_PATH"

# ─── Check prerequisites ──────────────────────────────────────────────────

if [ ! -d "$JAVA_HOME_PATH" ]; then
  echo "❌ JAVA_HOME not found at: $JAVA_HOME_PATH"
  echo "   Update JAVA_HOME_PATH in this script to point to your JDK."
  exit 1
fi

# ─── Kill Terabox (cloud sync that creates junk files) ────────────────────

echo "🛑 Stopping Terabox sync process..."
tasklist 2>/dev/null | grep -qi terabox && taskkill -f -im terabox.exe 2>/dev/null || true
echo "   Done"

# ─── Clean terabox junk files ─────────────────────────────────────────────

echo "🧹 Cleaning Terabox junk files..."
find "$SCRIPT_DIR" -name "*.terabox*" -delete 2>/dev/null || true
echo "   Done"

# ─── Clean Android build caches ────────────────────────────────────────────

if [ "$CLEAN" = true ]; then
  echo "🧼 Cleaning Android build caches..."
  rm -rf android/.gradle android/app/build android/capacitor-cordova-android-plugins/build 2>/dev/null || true
  echo "   Done"
else
  echo "⏩ Skipping build cache clean (--no-clean)"
fi

# ─── Build web assets ──────────────────────────────────────────────────────

echo "🏗️  Building web assets for Capacitor..."
bun run build:capacitor
echo "✅ Build complete"

# ─── Sync Capacitor plugins ────────────────────────────────────────────────

echo "🔄 Syncing Capacitor plugins..."
bunx cap sync
echo "✅ Sync complete"

# ─── Find connected device ────────────────────────────────────────────────

if [ -z "$DEVICE_ID" ]; then
  echo "📱 Finding connected Android device..."
  DEVICE_ID=$(adb devices 2>/dev/null | tail -n +2 | grep -E "^\w+" | grep -v "List" | head -1 | awk '{print $1}')
  if [ -z "$DEVICE_ID" ]; then
    echo "❌ No Android device found. Connect a device via USB with USB debugging enabled."
    echo "   Run 'adb devices' to check."
    exit 1
  fi
fi
echo "   Target device: $DEVICE_ID"

# ─── Set up ADB reverse ───────────────────────────────────────────────────

echo "🔌 Setting up ADB reverse port forwarding..."
if adb -s "$DEVICE_ID" reverse tcp:${DEV_SERVER_PORT} tcp:${DEV_SERVER_PORT} 2>/dev/null; then
  echo "   ✅ Port ${DEV_SERVER_PORT} forwarded (device → computer)"
else
  echo "   ⚠️  ADB reverse failed"
fi

# ─── Deploy ────────────────────────────────────────────────────────────────

echo "📦 Deploying to device..."
bunx cap run android --target "$DEVICE_ID"
echo ""
echo "🎉 App deployed successfully to $DEVICE_ID"
echo "   API: http://localhost:${DEV_SERVER_PORT} (via ADB reverse)"
