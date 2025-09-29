#!/bin/bash

# Intelligent HeyJarvis Frontend Startup Script
# This launches the frontend connected to the new intelligent background service

echo "🧠 Starting Intelligent HeyJarvis Frontend..."
echo "============================================================"

# Check if intelligent background service is running
if curl -s http://localhost:3002/health > /dev/null 2>&1; then
    echo "✅ Intelligent Background Service detected on port 3002"
    
    # Get service status
    SERVICE_STATUS=$(curl -s http://localhost:3002/health | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
    UPTIME=$(curl -s http://localhost:3002/health | grep -o '"uptime":[^,]*' | cut -d':' -f2)
    echo "   Status: $SERVICE_STATUS | Uptime: ${UPTIME}s"
else
    echo "❌ Intelligent Background Service not detected on port 3002"
    echo ""
    echo "🔧 To start the intelligent service:"
    echo "   cd crm-integration"
    echo "   export HUBSPOT_API_KEY=\"your-key\""
    echo "   export ANTHROPIC_API_KEY=\"your-key\""
    echo "   export COMPANY_WEBSITE=\"https://your-company.com\""
    echo "   ./start-intelligent-service.sh"
    echo ""
    echo "❓ Continue anyway? The frontend will show connection errors until the service is started."
    read -p "Press Enter to continue or Ctrl+C to exit..."
fi

# Check for required API keys
echo ""
echo "🔑 Checking API Configuration..."

if [ -f .env ] && grep -q "ANTHROPIC_API_KEY" .env; then
    echo "✅ Anthropic API key found in .env"
else
    echo "⚠️  No Anthropic API key found - AI features will be limited"
fi

if [ -f .env ] && grep -q "HUBSPOT_API_KEY" .env; then
    echo "✅ HubSpot API key found in .env"
else
    echo "⚠️  No HubSpot API key found - CRM features will be limited"
fi

echo ""
echo "🎯 Intelligent Frontend Features:"
echo "   🧠 AI-Powered Analysis: Claude AI workflow pattern detection"
echo "   💡 Smart Recommendations: Contextual tool suggestions with ROI"
echo "   🏢 Company Intelligence: Website analysis and insights"
echo "   📊 Real-time CRM Dashboard: Live workflow health monitoring"
echo "   🔔 Intelligent Alerts: Smart notifications with rate limiting"
echo "   ⚡ Enhanced Performance: Modern architecture with event streaming"
echo ""

# Check if we're in desktop directory
if [ -f "desktop/package.json" ]; then
    echo "🚀 Starting Desktop App..."
    cd desktop
    npm run dev:main
elif [ -f "package.json" ] && grep -q "electron" package.json; then
    echo "🚀 Starting Desktop App..."
    npm run dev:main
else
    echo "❌ Desktop app not found. Make sure you're in the correct directory."
    echo "   Expected: /home/sdalal/test/BeachBaby/"
    exit 1
fi
