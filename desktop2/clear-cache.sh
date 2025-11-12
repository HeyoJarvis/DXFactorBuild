#!/bin/bash

# HeyJarvis Desktop2 - Clear All Cache and Data
# This script removes all local data, cache, and session storage

echo "🧹 Clearing HeyJarvis Desktop2 cache and data..."

# Kill any running Electron processes
echo "🛑 Stopping Electron processes..."
pkill -9 -f "electron" 2>/dev/null || true
pkill -9 -f "HeyJarvis" 2>/dev/null || true

# Kill dev servers
echo "🛑 Stopping dev servers..."
lsof -ti:5173 | xargs kill -9 2>/dev/null || true  # Vite
lsof -ti:8890 | xargs kill -9 2>/dev/null || true  # OAuth server

# Wait a moment for processes to fully stop
sleep 2

# Determine the config directory based on OS
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    CONFIG_DIR="$HOME/Library/Application Support"
    CACHE_DIR="$HOME/Library/Caches"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    CONFIG_DIR="$HOME/.config"
    CACHE_DIR="$HOME/.cache"
else
    echo "❌ Unsupported OS: $OSTYPE"
    exit 1
fi

# Clear electron-store data (multiple store names used in the app)
echo "🗑️  Clearing electron-store data..."

# Auth store
if [ -f "$CONFIG_DIR/@heyjarvis/desktop2/heyjarvis-auth.json" ]; then
    rm -f "$CONFIG_DIR/@heyjarvis/desktop2/heyjarvis-auth.json"
    echo "   ✅ Removed auth store"
fi

# Config store
if [ -f "$CONFIG_DIR/@heyjarvis/desktop2/heyjarvis-v2-config.json" ]; then
    rm -f "$CONFIG_DIR/@heyjarvis/desktop2/heyjarvis-v2-config.json"
    echo "   ✅ Removed config store"
fi

# Clear all Electron cache directories
echo "🗑️  Clearing Electron cache..."

if [ -d "$CONFIG_DIR/@heyjarvis/desktop2/Cache" ]; then
    rm -rf "$CONFIG_DIR/@heyjarvis/desktop2/Cache"
    echo "   ✅ Removed Cache"
fi

if [ -d "$CONFIG_DIR/@heyjarvis/desktop2/Code Cache" ]; then
    rm -rf "$CONFIG_DIR/@heyjarvis/desktop2/Code Cache"
    echo "   ✅ Removed Code Cache"
fi

if [ -d "$CONFIG_DIR/@heyjarvis/desktop2/GPUCache" ]; then
    rm -rf "$CONFIG_DIR/@heyjarvis/desktop2/GPUCache"
    echo "   ✅ Removed GPU Cache"
fi

if [ -d "$CONFIG_DIR/@heyjarvis/desktop2/Session Storage" ]; then
    rm -rf "$CONFIG_DIR/@heyjarvis/desktop2/Session Storage"
    echo "   ✅ Removed Session Storage"
fi

if [ -d "$CONFIG_DIR/@heyjarvis/desktop2/Local Storage" ]; then
    rm -rf "$CONFIG_DIR/@heyjarvis/desktop2/Local Storage"
    echo "   ✅ Removed Local Storage"
fi

if [ -d "$CONFIG_DIR/@heyjarvis/desktop2/IndexedDB" ]; then
    rm -rf "$CONFIG_DIR/@heyjarvis/desktop2/IndexedDB"
    echo "   ✅ Removed IndexedDB"
fi

# Clear logs
if [ -d "$CONFIG_DIR/@heyjarvis/desktop2/logs" ]; then
    rm -rf "$CONFIG_DIR/@heyjarvis/desktop2/logs"
    echo "   ✅ Removed logs"
fi

# Clear system cache
if [ -d "$CACHE_DIR/@heyjarvis/desktop2" ]; then
    rm -rf "$CACHE_DIR/@heyjarvis/desktop2"
    echo "   ✅ Removed system cache"
fi

# Clear Vite cache in project
if [ -d "$(dirname "$0")/node_modules/.vite" ]; then
    rm -rf "$(dirname "$0")/node_modules/.vite"
    echo "   ✅ Removed Vite cache"
fi

if [ -d "$(dirname "$0")/renderer2/node_modules/.vite" ]; then
    rm -rf "$(dirname "$0")/renderer2/node_modules/.vite"
    echo "   ✅ Removed renderer Vite cache"
fi

# Clear dist folder (built files)
if [ -d "$(dirname "$0")/dist" ]; then
    rm -rf "$(dirname "$0")/dist"
    echo "   ✅ Removed dist folder"
fi

echo ""
echo "✅ All cache and data cleared!"
echo ""
echo "📍 Cleared locations:"
echo "   - $CONFIG_DIR/@heyjarvis/desktop2/"
echo "   - $CACHE_DIR/@heyjarvis/desktop2/"
echo "   - Project node_modules/.vite"
echo "   - Project dist/"
echo ""
echo "🚀 You can now run: npm run dev"
echo ""


