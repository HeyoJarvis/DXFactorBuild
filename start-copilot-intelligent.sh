#!/bin/bash

# Start Intelligent Copilot - Simple HTML Interface
# This opens the copilot HTML directly in your browser connected to the intelligent service

echo "🧠 Starting Intelligent Copilot Interface..."
echo "============================================================"

# Check if intelligent background service is running
if curl -s http://localhost:3002/health > /dev/null 2>&1; then
    echo "✅ Intelligent Background Service detected on port 3002"
    
    # Get service status
    SERVICE_STATUS=$(curl -s http://localhost:3002/health | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
    echo "   Status: $SERVICE_STATUS"
else
    echo "❌ Intelligent Background Service not running on port 3002"
    echo ""
    echo "🔧 Starting the intelligent service first..."
    
    # Check if we have the service file
    if [ -f "crm-integration/intelligent-background-service.js" ]; then
        echo "📡 Starting intelligent background service..."
        cd crm-integration
        export HUBSPOT_API_KEY="pat-na1-e5c61dcf-ac4b-4e68-8160-f515662e8234"
        export ANTHROPIC_API_KEY="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"
        export COMPANY_WEBSITE="https://dxfactor.com"
        node intelligent-background-service.js &
        
        echo "⏳ Waiting for service to start..."
        sleep 5
        
        cd ..
        
        # Check again
        if curl -s http://localhost:3002/health > /dev/null 2>&1; then
            echo "✅ Service started successfully!"
        else
            echo "❌ Failed to start service"
            exit 1
        fi
    else
        echo "❌ Service file not found. Make sure you're in the BeachBaby directory."
        exit 1
    fi
fi

echo ""
echo "🎯 Opening Intelligent Copilot Interface..."
echo "   🧠 AI-Powered CRM Analysis"
echo "   💡 Smart Recommendations with ROI"
echo "   🏢 Company Intelligence Integration"
echo "   📊 Real-time Workflow Health Monitoring"
echo ""

# Open the copilot HTML file in default browser
if [ -f "desktop/renderer/copilot-enhanced.html" ]; then
    COPILOT_PATH="file://$(pwd)/desktop/renderer/copilot-enhanced.html"
    echo "🌐 Opening: $COPILOT_PATH"
    
    # Try different browser commands
    if command -v xdg-open > /dev/null; then
        xdg-open "$COPILOT_PATH"
    elif command -v open > /dev/null; then
        open "$COPILOT_PATH"
    elif command -v google-chrome > /dev/null; then
        google-chrome "$COPILOT_PATH"
    elif command -v firefox > /dev/null; then
        firefox "$COPILOT_PATH"
    else
        echo "📋 Copy this URL to your browser:"
        echo "$COPILOT_PATH"
    fi
    
    echo ""
    echo "✨ Copilot is now running!"
    echo "   💬 Chat Tab: AI-powered conversations"
    echo "   📊 CRM Tab: Real-time workflow analysis"
    echo "   🔄 Auto-refresh: Updates every 2 minutes"
    
else
    echo "❌ Copilot HTML file not found at desktop/renderer/copilot-enhanced.html"
    exit 1
fi
