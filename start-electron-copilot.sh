#!/bin/bash

# Start Electron Copilot with Intelligent Service
# This launches the Electron app connected to the intelligent background service

echo "🚀 Starting Electron Copilot with Intelligent Service..."
echo "============================================================"

# Check if intelligent background service is running
if curl -s http://localhost:3002/health > /dev/null 2>&1; then
    echo "✅ Intelligent Background Service detected on port 3002"
else
    echo "🔧 Starting intelligent background service..."
    
    if [ -f "crm-integration/intelligent-background-service.js" ]; then
        cd crm-integration
        # Load from .env file instead of hardcoding
        # export HUBSPOT_API_KEY="..."
        # export ANTHROPIC_API_KEY="..."
        export COMPANY_WEBSITE="https://dxfactor.com"
        node intelligent-background-service.js &
        
        echo "⏳ Waiting for service to start..."
        sleep 5
        cd ..
    else
        echo "❌ Service file not found"
        exit 1
    fi
fi

echo ""
echo "🎯 Starting Electron Copilot..."
echo "   🧠 AI-Powered Analysis"
echo "   💡 Smart Recommendations" 
echo "   📊 Real-time CRM Dashboard"
echo ""

# Start Electron app
cd desktop
NODE_ENV=development npx electron main.js
