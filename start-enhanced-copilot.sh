#!/bin/bash

# Enhanced HeyJarvis Copilot Startup Script
# This launches the copilot with CRM dashboard functionality

echo "🚀 Starting Enhanced HeyJarvis Copilot with CRM Dashboard..."

# Check if background service is running
if curl -s http://localhost:3001/health > /dev/null 2>&1; then
    echo "✅ CRM Background Service detected on port 3001"
else
    echo "⚠️  CRM Background Service not detected on port 3001"
    echo "   The CRM tab will show connection errors until the service is started"
    echo "   To start the background service: cd crm-integration && node background-service.js"
fi

# Check for Anthropic API key
if [ -f .env ] && grep -q "ANTHROPIC_API_KEY" .env; then
    echo "✅ Anthropic API key found in .env"
else
    echo "⚠️  No Anthropic API key found - AI chat will be limited"
fi

echo ""
echo "🎯 Features:"
echo "   💬 Chat Tab: AI-powered competitive intelligence"
echo "   📊 CRM Tab: Real-time CRM dashboard and insights"
echo "   🔄 Auto-refresh: CRM data updates every 2 minutes"
echo "   ⚡ Arc Reactor: Click minimize for compact mode"
echo ""

# Start the enhanced copilot
npx electron start-copilot-enhanced.js
