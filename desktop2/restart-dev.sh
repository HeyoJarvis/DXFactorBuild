#!/bin/bash

# HeyJarvis Desktop2 - Clean Restart Script
# Kills all Electron processes and restarts the dev server

echo "🧹 Cleaning up..."

# Kill all Electron processes
pkill -9 -f "electron" 2>/dev/null
echo "✓ Killed Electron processes"

# Kill any Node processes running on port 5173 (Vite)
lsof -ti:5173 | xargs kill -9 2>/dev/null
echo "✓ Cleared port 5173"

# Kill any Node processes running on port 8890 (OAuth server)
lsof -ti:8890 | xargs kill -9 2>/dev/null
echo "✓ Cleared port 8890"

# Optional: Clear Electron cache
# Uncomment if you want to clear cache on every restart
# rm -rf ~/Library/Application\ Support/@heyjarvis/desktop2/Cache
# rm -rf ~/Library/Application\ Support/@heyjarvis/desktop2/Code\ Cache
# echo "✓ Cleared Electron cache"

echo ""
echo "🚀 Starting fresh dev server..."
echo ""

# Start the dev server
npm run dev
