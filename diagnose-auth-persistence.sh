#!/bin/bash

# Auth Persistence Diagnostic Script
# Collects relevant logs to diagnose integration persistence issues

echo "🔍 Auth Persistence Diagnostic Tool"
echo "====================================="
echo ""

LOG_DIR="desktop2/logs"
OUTPUT_FILE="auth-persistence-diagnostic-$(date +%Y%m%d-%H%M%S).log"

echo "📋 Collecting diagnostic information..."
echo "" > "$OUTPUT_FILE"

# System info
echo "=== SYSTEM INFO ===" >> "$OUTPUT_FILE"
echo "Date: $(date)" >> "$OUTPUT_FILE"
echo "User: $(whoami)" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Check if logs directory exists
if [ ! -d "$LOG_DIR" ]; then
    echo "❌ Error: $LOG_DIR directory not found"
    echo "   Please run this script from the HeyJarvis root directory"
    exit 1
fi

# Function to extract recent logs
extract_recent() {
    local file=$1
    local label=$2
    local lines=${3:-50}

    if [ -f "$file" ]; then
        echo "" >> "$OUTPUT_FILE"
        echo "=== $label (last $lines lines) ===" >> "$OUTPUT_FILE"
        tail -n "$lines" "$file" >> "$OUTPUT_FILE"
        echo "" >> "$OUTPUT_FILE"
    else
        echo "⚠️  $file not found" >> "$OUTPUT_FILE"
    fi
}

# Function to search for specific patterns
search_pattern() {
    local file=$1
    local pattern=$2
    local label=$3

    if [ -f "$file" ]; then
        echo "" >> "$OUTPUT_FILE"
        echo "=== $label ===" >> "$OUTPUT_FILE"
        grep -i "$pattern" "$file" | tail -n 30 >> "$OUTPUT_FILE"
        echo "" >> "$OUTPUT_FILE"
    fi
}

echo "📝 Extracting Microsoft OAuth logs..."
extract_recent "$LOG_DIR/microsoft-oauth.log" "MICROSOFT OAUTH LOGS" 100
search_pattern "$LOG_DIR/microsoft-oauth.log" "token" "MICROSOFT TOKEN EVENTS"
search_pattern "$LOG_DIR/microsoft-oauth.log" "initialize" "MICROSOFT INITIALIZATION"

echo "📝 Extracting Microsoft Graph logs..."
extract_recent "$LOG_DIR/microsoft-graph.log" "MICROSOFT GRAPH LOGS" 100
search_pattern "$LOG_DIR/microsoft-graph.log" "token" "MICROSOFT GRAPH TOKEN EVENTS"
search_pattern "$LOG_DIR/microsoft-graph.log" "initialize" "MICROSOFT GRAPH INITIALIZATION"

echo "📝 Extracting Google OAuth logs..."
extract_recent "$LOG_DIR/google-oauth.log" "GOOGLE OAUTH LOGS" 100
search_pattern "$LOG_DIR/google-oauth.log" "token" "GOOGLE TOKEN EVENTS"
search_pattern "$LOG_DIR/google-oauth.log" "initialize" "GOOGLE INITIALIZATION"

echo "📝 Extracting Google Gmail logs..."
extract_recent "$LOG_DIR/google-gmail.log" "GOOGLE GMAIL LOGS" 100

# Check main process logs if they exist
if [ -d "$HOME/Library/Application Support/heyjarvis-desktop2/logs" ]; then
    MAIN_LOG="$HOME/Library/Application Support/heyjarvis-desktop2/logs/main.log"
    if [ -f "$MAIN_LOG" ]; then
        echo "📝 Extracting main process logs..."
        extract_recent "$MAIN_LOG" "MAIN PROCESS LOGS" 200
        search_pattern "$MAIN_LOG" "auto-initializ" "AUTO-INITIALIZATION EVENTS"
        search_pattern "$MAIN_LOG" "integration" "INTEGRATION EVENTS"
        search_pattern "$MAIN_LOG" "session" "SESSION EVENTS"
    fi
fi

# Check for electron-store files
STORE_PATH="$HOME/Library/Application Support/heyjarvis-desktop2"
if [ -d "$STORE_PATH" ]; then
    echo "" >> "$OUTPUT_FILE"
    echo "=== ELECTRON STORE FILES ===" >> "$OUTPUT_FILE"
    ls -la "$STORE_PATH"/*.json 2>/dev/null >> "$OUTPUT_FILE" || echo "No JSON files found" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
fi

echo "" >> "$OUTPUT_FILE"
echo "=== DIAGNOSTIC COMPLETE ===" >> "$OUTPUT_FILE"
echo "Timestamp: $(date)" >> "$OUTPUT_FILE"

echo ""
echo "✅ Diagnostic complete!"
echo "📄 Results saved to: $OUTPUT_FILE"
echo ""
echo "📤 Please share the following:"
echo "   1. The diagnostic file: $OUTPUT_FILE"
echo "   2. Steps you took before the issue occurred"
echo "   3. What you expected vs what actually happened"
echo ""
echo "🔍 Quick preview of key issues:"
echo "   Checking for common patterns..."
echo ""

# Quick analysis
echo "=== QUICK ANALYSIS ==="
grep -i "error\|fail\|warning" "$OUTPUT_FILE" | tail -n 10

echo ""
echo "💡 To help diagnose:"
echo "   1. Try to reproduce the issue with the app running"
echo "   2. Run this script immediately after"
echo "   3. Share the output file with the developer"
