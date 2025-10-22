#!/bin/bash

# Create Power Platform Solution Package for Import
# This creates a proper solution ZIP that can be imported into Power Automate

echo "📦 Creating Power Platform Solution Package..."
echo ""

SOLUTION_NAME="TeamsTranscriptAutomation"
VERSION="1_0_0_0"
PACKAGE_FILE="${SOLUTION_NAME}_${VERSION}.zip"

# Create temporary directory
TEMP_DIR="/tmp/${SOLUTION_NAME}"
rm -rf "$TEMP_DIR"
mkdir -p "$TEMP_DIR"

echo "📁 Copying solution files..."

# Copy solution structure
cp "power-automate-solution/[Content_Types].xml" "$TEMP_DIR/"
cp "power-automate-solution/solution.xml" "$TEMP_DIR/"

# Create Workflows directory
mkdir -p "$TEMP_DIR/Workflows"
cp "power-automate-solution/Workflows/tsi_TeamsMeetingTranscriptSync.json" "$TEMP_DIR/Workflows/"

echo "   ✅ Solution files copied"

# Create the ZIP
cd /tmp
echo "🗜️  Creating solution package..."

if command -v zip &> /dev/null; then
    zip -r "$PACKAGE_FILE" "${SOLUTION_NAME}" -q
    echo "   ✅ Solution package created"
else
    tar -czf "${PACKAGE_FILE%.zip}.tar.gz" "${SOLUTION_NAME}"
    echo "   ✅ Solution package created as .tar.gz (zip not available)"
    PACKAGE_FILE="${PACKAGE_FILE%.zip}.tar.gz"
fi

# Move to original directory
ORIGINAL_DIR="/home/sdalal/test/BeachBaby/extra_feature_desktop"
mv "/tmp/$PACKAGE_FILE" "$ORIGINAL_DIR/"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "✅ Power Platform Solution Package Created!"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "📦 File: $ORIGINAL_DIR/$PACKAGE_FILE"
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
echo "   - Set up Office 365 connection"
echo "   - Set up OneDrive connection"
echo "   - Turn on the flow"
echo ""
echo "📖 Full guide: power-automate-solution/SOLUTION_IMPORT_GUIDE.md"
echo ""
echo "═══════════════════════════════════════════════════════════"

# Cleanup
rm -rf "$TEMP_DIR"

echo ""
echo "✅ Done!"
echo ""

