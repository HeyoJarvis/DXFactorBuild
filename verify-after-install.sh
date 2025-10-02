#!/bin/bash

echo ""
echo "🔍 Verifying Supabase Installation..."
echo ""
sleep 3

node test-when-ready.js

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ SUCCESS! Your database is ready to use!"
  echo ""
  echo "📚 Next steps:"
  echo "   • node demo.js - Run full demo"
  echo "   • npm run dev:delivery - Start Slack bot"
  echo "   • npm run dev:desktop - Start desktop app"
  echo ""
else
  echo ""
  echo "⚠️  Verification incomplete. Refresh the Supabase page and check if tables appear."
  echo ""
fi

