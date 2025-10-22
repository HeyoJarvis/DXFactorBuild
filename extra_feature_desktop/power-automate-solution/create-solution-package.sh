#!/bin/bash

# Create Power Platform Solution Package for Import
# This creates a proper solution ZIP that can be imported into Power Automate

echo "📦 Creating Power Platform Solution Package..."
echo ""

SOLUTION_NAME="TeamsTranscriptAutomation"
VERSION="1_0_0_0"
PACKAGE_FILE="${SOLUTION_NAME}_${VERSION}.zip"

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Create temporary directory
TEMP_DIR="/tmp/${SOLUTION_NAME}_build"
rm -rf "$TEMP_DIR"
mkdir -p "$TEMP_DIR"

echo "📁 Copying solution files..."

# Copy solution structure
cp "[Content_Types].xml" "$TEMP_DIR/"
cp "solution.xml" "$TEMP_DIR/"

# Create Workflows directory
mkdir -p "$TEMP_DIR/Workflows"
cp "Workflows/tsi_TeamsMeetingTranscriptSync.json" "$TEMP_DIR/Workflows/"

echo "   ✅ Solution files copied"

# Create the ZIP
cd /tmp
echo "🗜️  Creating solution package..."

if command -v zip &> /dev/null; then
    cd "$TEMP_DIR"
    zip -r "/tmp/$PACKAGE_FILE" * -q
    cd /tmp
    echo "   ✅ Solution package created"
else
    tar -czf "${PACKAGE_FILE%.zip}.tar.gz" -C "$TEMP_DIR" .
    echo "   ✅ Solution package created as .tar.gz (zip not available)"
    PACKAGE_FILE="${PACKAGE_FILE%.zip}.tar.gz"
fi

# Move to original directory
mv "/tmp/$PACKAGE_FILE" "$SCRIPT_DIR/"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "✅ Power Platform Solution Package Created!"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "📦 File: $SCRIPT_DIR/$PACKAGE_FILE"
echo "📊 Size: $(du -h "$SCRIPT_DIR/$PACKAGE_FILE" | cut -f1)"
echo ""
echo "🚀 To import:"
echo "   1. Go to: https://make.powerautomate.com"
echo "   2. Click: Solutions (left sidebar)"
echo "   3. Click: Import solution"
echo "   4. Upload: $PACKAGE_FILE"
echo "   5. Configure connections when prompted"
echo "   6. Click: Import"
echo ""
echo "⚠️  After import, you'll need to:"
echo "   - Set up Office 365 Outlook connection"
echo "   - Set up OneDrive for Business connection"  
echo "   - Turn on the flow"
echo "   - Create /Recordings folder in OneDrive"
echo ""
echo "📖 Full guide: IMPORT_INSTRUCTIONS.md"
echo ""
echo "💡 Note: This creates placeholder files."
echo "   For full transcript functionality, see IMPORT_INSTRUCTIONS.md"
echo ""
echo "═══════════════════════════════════════════════════════════"

# Cleanup
rm -rf "$TEMP_DIR"

echo ""
echo "✅ Done!"
echo ""

