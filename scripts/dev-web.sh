#!/bin/bash
set -e

# Ensure dist/ exists
mkdir -p dist/assets

# Copy static files once
cp index.html dist/index.html 2>/dev/null || true
cp public/*.webmanifest dist/ 2>/dev/null || true
cp branding.jpg dist/ 2>/dev/null || true
cp neue_frutiger_world_regular.ttf dist/ 2>/dev/null || true
echo "✅ Static assets copied"

# Start CSS watcher in background
bunx @tailwindcss/cli -i ./src/index.css -o ./dist/assets/index.css --watch &
CSS_PID=$!

# Start JS/TS watcher (rebuilds on src/ changes)
bun run scripts/build-web.js --watch &
WEB_PID=$!

echo ""
echo "📦 Watching for frontend changes..."
echo "   CSS PID: $CSS_PID  |  Web PID: $WEB_PID"
echo ""
echo "   The Hono server (dev:server) will auto-reload when dist/ changes."
echo "   Press Ctrl+C to stop."
echo ""

# Trap Ctrl+C and kill both watchers
trap 'echo ""; echo "Stopping watchers..."; kill $CSS_PID $WEB_PID 2>/dev/null; exit 0' SIGINT SIGTERM

# Wait for both
wait
