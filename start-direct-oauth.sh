#!/bin/bash

# Start Direct OAuth System (no Supabase Auth needed)
# This script starts the OAuth server and Electron app

echo "🚀 Starting HeyJarvis with Direct OAuth..."
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo "Please create a .env file with your OAuth credentials."
    exit 1
fi

# Start OAuth server in background
echo "🔐 Starting OAuth server on port 8890..."
node oauth/electron-oauth-server.js &
OAUTH_PID=$!

# Wait for OAuth server to start
sleep 2

# Check if OAuth server is running
if curl -s http://localhost:8890/health > /dev/null; then
    echo "✅ OAuth server running on port 8890"
else
    echo "❌ OAuth server failed to start"
    kill $OAUTH_PID 2>/dev/null
    exit 1
fi

# Start Electron app
echo "🖥️  Starting Electron app..."
cd desktop2 && npm run dev &
ELECTRON_PID=$!

echo ""
echo "✅ All services started!"
echo ""
echo "📍 OAuth Server: http://localhost:8890"
echo "   - Slack:     http://localhost:8890/auth/slack"
echo "   - Microsoft: http://localhost:8890/auth/microsoft"
echo "   - Google:    http://localhost:8890/auth/google"
echo ""
echo "Press Ctrl+C to stop all services..."

# Cleanup function
cleanup() {
    echo ""
    echo "🛑 Shutting down services..."
    kill $OAUTH_PID 2>/dev/null
    kill $ELECTRON_PID 2>/dev/null
    exit 0
}

# Trap Ctrl+C
trap cleanup SIGINT SIGTERM

# Wait indefinitely
wait

