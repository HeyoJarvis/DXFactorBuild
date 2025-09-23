#!/bin/bash

echo "🚀 Starting HeyJarvis CEO Monitoring System"
echo "=========================================="

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo ""
    echo "📋 Please create .env file with:"
    echo "CEO_SLACK_USER_ID=YOUR_USER_ID_FROM_LIST_ABOVE"
    echo "SLACK_BOT_TOKEN=xoxb-your-token"
    echo "SLACK_SIGNING_SECRET=your-secret"
    echo "ORGANIZATION_NAME=CIPIO"
    exit 1
fi

# Check if CEO_SLACK_USER_ID is set
if ! grep -q "CEO_SLACK_USER_ID=" .env; then
    echo "⚠️  CEO_SLACK_USER_ID not found in .env"
    echo ""
    echo "📋 Add this line to your .env file:"
    echo "CEO_SLACK_USER_ID=YOUR_USER_ID_FROM_THE_LIST"
    echo ""
    echo "👥 Available user IDs from your team:"
    echo "   Harshil Shah: U01E9GN1VU3"
    echo "   Punit Bhadoirya: U01EFFA1Z3N (Owner)"
    echo "   Tejas Shah: U01EHCP60LT (Owner)" 
    echo "   Growson Edwards: U01EPBCC2MA"
    echo "   Hemang Sanghavi: U01F71Y40GG (Owner)"
    exit 1
fi

echo "✅ Configuration found"
echo "🚀 Starting CEO Slack monitoring..."
echo ""
echo "💡 Once running, you can use these commands in Slack:"
echo "   /ceo-dashboard - Get team overview"
echo "   /task-status - View task assignments and completions"  
echo "   /ai-suggestions - Get AI-curated leadership insights"
echo ""
echo "🔄 Starting now..."

node ceo-slack-integration.js
