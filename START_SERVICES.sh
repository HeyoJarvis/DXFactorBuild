#!/bin/bash

# Start HeyJarvis with Code Indexer

echo "🚀 Starting HeyJarvis Services..."
echo ""

# Start API Server
echo "📡 Starting Engineering Intelligence API Server on port 3000..."
node server.js &
API_PID=$!

# Wait for API to be ready
echo "⏳ Waiting for API server to start..."
sleep 3

# Check if API is running
if curl -s http://localhost:3000/health > /dev/null; then
    echo "✅ API Server is running (PID: $API_PID)"
    echo ""
    echo "🎯 Code Indexer is ready!"
    echo ""
    echo "Next steps:"
    echo "1. Open a new terminal"
    echo "2. Run: cd desktop2 && npm run dev"
    echo "3. Open Code Indexer tab in the app"
    echo ""
    echo "To stop API server: kill $API_PID"
else
    echo "❌ API Server failed to start"
    kill $API_PID 2>/dev/null
    exit 1
fi

# Keep script running
wait
