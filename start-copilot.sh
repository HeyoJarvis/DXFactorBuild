#!/bin/bash

# HeyJarvis Transparent Copilot Launcher

echo "🤖 Starting HeyJarvis Transparent Copilot..."
echo "=================================="

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ No .env file found!"
    echo "💡 Make sure you have configured your API keys in .env"
    exit 1
fi

# Check if Anthropic API key is set
if ! grep -q "ANTHROPIC_API_KEY=sk-ant-" .env; then
    echo "⚠️  Warning: ANTHROPIC_API_KEY not configured"
    echo "💡 The copilot will work but won't have AI responses"
fi

echo "🚀 Launching transparent copilot overlay..."
echo ""
echo "✨ Features:"
echo "• Transparent, always-on-top window"
echo "• Real AI conversation with Claude"
echo "• Draggable and resizable"
echo "• Minimizable to small widget"
echo ""
echo "🎮 Controls:"
echo "• Drag the header to move"
echo "• Click minimize (-) to shrink to widget"
echo "• Click close (×) to hide"
echo ""

# Launch the copilot
npx electron copilot-demo.js
