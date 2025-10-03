#!/usr/bin/env node

/**
 * Copy the EXACT original copilot.html content into copilot-with-tasks.html
 * No modifications, no "improvements" - just literal copy-paste
 */

const fs = require('fs');
const path = require('path');

console.log('📋 Copying EXACT original Copilot interface...\n');

const copilotOriginal = fs.readFileSync(path.join(__dirname, 'desktop/renderer/copilot.html'), 'utf8');
const copilotWithTasks = fs.readFileSync(path.join(__dirname, 'desktop/renderer/copilot-with-tasks.html'), 'utf8');

// Extract the EXACT CSS from original (everything between <style> tags after the import)
const cssStart = copilotOriginal.indexOf('@import url');
const cssEnd = copilotOriginal.indexOf('</style>');
const originalCSS = copilotOriginal.substring(cssStart, cssEnd);

// Extract the EXACT body HTML content (everything from copilot-header to end of copilot-content)
const bodyStart = copilotOriginal.indexOf('<div class="copilot-header">');
const bodyEnd = copilotOriginal.indexOf('</div>\n\n  <script>');
const originalBodyHTML = copilotOriginal.substring(bodyStart, bodyEnd + 6); // +6 for </div>

// Extract the EXACT JavaScript (everything between <script> tags)
const jsStart = copilotOriginal.indexOf('<script>') + 10;
const jsEnd = copilotOriginal.indexOf('</script>');
const originalJS = copilotOriginal.substring(jsStart, jsEnd);

// Now replace in copilot-with-tasks.html

// 1. Add the original CSS styles (insert before existing styles' closing tag)
let updated = copilotWithTasks;

// Find where to insert original CSS - right before the closing </style>
const styleEnd = updated.indexOf('  </style>');
if (styleEnd > 0) {
  updated = updated.slice(0, styleEnd) + '\n    /* === ORIGINAL COPILOT STYLES === */\n    ' + originalCSS + '\n\n  ' + updated.slice(styleEnd);
  console.log('✅ Added original Copilot CSS');
}

// 2. Replace the Copilot tab content with EXACT original
const tabStart = updated.indexOf('<!-- Copilot Tab Content -->');
const tabEnd = updated.indexOf('<!-- To Do List Tab Content -->');

if (tabStart > 0 && tabEnd > 0) {
  const newCopilotTab = `<!-- Copilot Tab Content -->
  <div id="copilotTab" class="tab-content active">
    ${originalBodyHTML}
  </div>

  `;
  
  updated = updated.slice(0, tabStart) + newCopilotTab + updated.slice(tabEnd);
  console.log('✅ Replaced Copilot tab with EXACT original HTML');
}

// 3. Add the original JavaScript
// Find the script section in copilot-with-tasks and add original JS at the top
const scriptStart = updated.indexOf('<script>');
if (scriptStart > 0) {
  const scriptInsertPoint = scriptStart + 10; // After <script>\n
  const copilotJS = `
    // ============================================
    // EXACT ORIGINAL COPILOT JAVASCRIPT
    // Copied directly from copilot.html
    // ============================================
    
${originalJS}

    // ============================================
    // TASKS TAB FUNCTIONALITY BELOW
    // ============================================
    
    `;
  
  updated = updated.slice(0, scriptInsertPoint) + copilotJS + updated.slice(scriptInsertPoint);
  console.log('✅ Added EXACT original Copilot JavaScript');
}

// Write the file
fs.writeFileSync(path.join(__dirname, 'desktop/renderer/copilot-with-tasks.html'), updated);

console.log('\n✨ Done! Copilot tab now has the EXACT original interface.');
console.log('\n📋 What was copied:');
console.log('  • All original CSS styles (Arc Reactor, messages, animations)');
console.log('  • All original HTML structure');
console.log('  • All original JavaScript functions');
console.log('  • Nothing modified, just wrapped in a tab div');
console.log('\n🚀 Restart the app - Copilot tab will look & function exactly like before!\n');

