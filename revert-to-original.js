#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 Reverting to original working Copilot...\n');

const mainJsPath = path.join(__dirname, 'desktop/main.js');
let mainJs = fs.readFileSync(mainJsPath, 'utf8');

// Change back to loading the original copilot.html
const oldLine = "  mainWindow.loadFile(path.join(__dirname, 'renderer/copilot-with-tasks.html'));";
const newLine = "  mainWindow.loadFile(path.join(__dirname, 'renderer/copilot.html'));";

if (mainJs.includes(oldLine)) {
  mainJs = mainJs.replace(oldLine, newLine);
  fs.writeFileSync(mainJsPath, mainJs);
  console.log('✅ Reverted to loading original copilot.html');
  console.log('\n📋 Original Copilot interface restored!');
  console.log('🚀 Restart the app - everything will work like before.\n');
  console.log('💡 The To Do List feature and Slack integration are still active.');
  console.log('   Tasks will auto-create in Supabase from Slack messages.');
  console.log('   You can view them in Supabase Table Editor.\n');
} else {
  console.log('⚠️  Already using original copilot.html or line not found');
}

