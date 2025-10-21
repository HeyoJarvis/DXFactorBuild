#!/bin/bash
# Kill all OAuth ports used by HeyJarvis

echo "🔪 Killing all OAuth ports..."

# Microsoft (8889)
if lsof -ti:8889 > /dev/null 2>&1; then
  echo "  Killing port 8889 (Microsoft)..."
  lsof -ti:8889 | xargs kill -9 2>/dev/null
  echo "  ✅ Port 8889 freed"
else
  echo "  ✓ Port 8889 already free"
fi

# JIRA (8892)
if lsof -ti:8892 > /dev/null 2>&1; then
  echo "  Killing port 8892 (JIRA)..."
  lsof -ti:8892 | xargs kill -9 2>/dev/null
  echo "  ✅ Port 8892 freed"
else
  echo "  ✓ Port 8892 already free"
fi

# Google (8893)
if lsof -ti:8893 > /dev/null 2>&1; then
  echo "  Killing port 8893 (Google)..."
  lsof -ti:8893 | xargs kill -9 2>/dev/null
  echo "  ✅ Port 8893 freed"
else
  echo "  ✓ Port 8893 already free"
fi

# Slack Auth (8888)
if lsof -ti:8888 > /dev/null 2>&1; then
  echo "  Killing port 8888 (Slack)..."
  lsof -ti:8888 | xargs kill -9 2>/dev/null
  echo "  ✅ Port 8888 freed"
else
  echo "  ✓ Port 8888 already free"
fi

echo ""
echo "✅ All OAuth ports cleared!"
echo ""
echo "You can now restart the app:"
echo "  npm run dev:desktop"

