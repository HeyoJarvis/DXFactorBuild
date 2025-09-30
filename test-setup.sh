#!/bin/bash

# Task Intelligence System Test Setup
# This script helps you test the complete AI-powered task intelligence system

echo "🧪 Task Intelligence System Test Setup"
echo "======================================"

# Check if intelligent background service is running
echo "🔍 Checking services..."

if curl -s http://localhost:3002/health > /dev/null 2>&1; then
    echo "✅ Intelligent Background Service is running on port 3002"
else
    echo "❌ Intelligent Background Service not running"
    echo ""
    echo "🚀 Starting Intelligent Background Service..."
    echo "Please run in another terminal:"
    echo "   cd crm-integration"
    echo "   ./start-intelligent-service.sh"
    echo ""
    echo "Then come back and run this test again."
    exit 1
fi

# Check environment variables
echo "🔍 Checking environment variables..."

if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "⚠️  ANTHROPIC_API_KEY not set"
    echo "   Export your Anthropic API key:"
    echo "   export ANTHROPIC_API_KEY='your-key-here'"
fi

if [ -z "$HUBSPOT_API_KEY" ]; then
    echo "⚠️  HUBSPOT_API_KEY not set"
    echo "   Export your HubSpot API key:"
    echo "   export HUBSPOT_API_KEY='your-key-here'"
fi

echo ""
echo "🎯 Ready to test! Choose an option:"
echo ""
echo "1. Test a single message:"
echo "   node test-task-intelligence-system.js \"Hey John, follow up with Acme Corp by Friday\""
echo ""
echo "2. Interactive testing mode:"
echo "   node test-task-intelligence-system.js --interactive"
echo ""
echo "3. Run example tests:"
echo "   node test-task-intelligence-system.js --examples"
echo ""
echo "📋 Example test messages to try:"
echo "   • \"Sarah, can you schedule a demo with the new client?\""
echo "   • \"Mike, please update the CRM with the latest deal info\""
echo "   • \"Can someone follow up with DXFactor about the contract?\""
echo "   • \"We need to send the proposal to the prospect by tomorrow\""
echo ""
echo "🔍 What the system will test:"
echo "   ✅ Task detection using AI"
echo "   ✅ CRM context matching with your real HubSpot data"
echo "   ✅ Tool recommendations based on task type"
echo "   ✅ Personalized completion guidance"
echo "   ✅ Delivery simulation (Slack DM, Desktop, Thread)"
echo ""
