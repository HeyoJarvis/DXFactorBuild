#!/bin/bash

# Kill processes using OAuth ports
echo "🔍 Checking for processes using OAuth ports..."

for port in 8888 8889 8890; do
  PID=$(lsof -ti:$port)
  if [ ! -z "$PID" ]; then
    echo "🔴 Port $port is in use by process $PID - killing it..."
    kill -9 $PID
    echo "✅ Killed process on port $port"
  else
    echo "✅ Port $port is free"
  fi
done

echo ""
echo "✅ All OAuth ports cleared!"
echo "You can now start the app."


