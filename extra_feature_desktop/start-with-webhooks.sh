#!/bin/bash

# Start HeyJarvis with Webhook Support
# This script starts both the app and ngrok for local development

echo "🚀 Starting HeyJarvis with Webhook Support"
echo ""

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo "❌ ngrok is not installed"
    echo ""
    echo "Install ngrok:"
    echo "  macOS: brew install ngrok"
    echo "  Linux: https://ngrok.com/download"
    echo ""
    exit 1
fi

echo "✅ ngrok found"

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  No .env file found, creating from template..."
    cat > .env << EOF
# Webhook Configuration
WEBHOOK_PORT=3001
WEBHOOK_URL=http://localhost:3001/webhooks

# Note: After ngrok starts, update WEBHOOK_URL with the ngrok HTTPS URL
# Example: WEBHOOK_URL=https://abc123.ngrok.io/webhooks
EOF
    echo "✅ .env file created"
fi

echo ""
echo "📝 Instructions:"
echo "1. This will start the app in one terminal"
echo "2. Open a SECOND terminal and run: ngrok http 3001"
echo "3. Copy the ngrok HTTPS URL (e.g., https://abc123.ngrok.io)"
echo "4. Update .env file: WEBHOOK_URL=https://abc123.ngrok.io/webhooks"
echo "5. Restart the app (Ctrl+C and run this script again)"
echo ""
echo "Press Enter to start the app..."
read

# Start the app
echo "🚀 Starting app..."
npm run dev

