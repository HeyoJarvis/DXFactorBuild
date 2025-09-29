#!/bin/bash

# Start Intelligent Background Service
# This script starts the new AI-powered background service

echo "🚀 Starting Intelligent CRM Background Service..."
echo "============================================================"

# Check for required environment variables
if [ -z "$HUBSPOT_API_KEY" ]; then
    echo "❌ Error: HUBSPOT_API_KEY environment variable is required"
    exit 1
fi

if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "❌ Error: ANTHROPIC_API_KEY environment variable is required"
    exit 1
fi

# Set default company website if not provided
if [ -z "$COMPANY_WEBSITE" ]; then
    export COMPANY_WEBSITE="https://dxfactor.com"
    echo "ℹ️  Using default company website: $COMPANY_WEBSITE"
fi

# Set default log level if not provided
if [ -z "$LOG_LEVEL" ]; then
    export LOG_LEVEL="info"
fi

echo "🌐 Company Website: $COMPANY_WEBSITE"
echo "📊 Log Level: $LOG_LEVEL"
echo "🔑 HubSpot API: ${HUBSPOT_API_KEY:0:10}..."
echo "🤖 Anthropic API: ${ANTHROPIC_API_KEY:0:10}..."
echo ""

# Create logs directory if it doesn't exist
mkdir -p logs

# Start the service
echo "🎯 Starting service on port 3002..."
node intelligent-background-service.js
