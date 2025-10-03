#!/usr/bin/env node

/**
 * Lower work request detection threshold to match assignment detection
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Lowering work request detection threshold...\n');

const mainJsPath = path.join(__dirname, 'desktop/main.js');
let mainJs = fs.readFileSync(mainJsPath, 'utf8');

// Lower threshold from 0.7 to 0.5
const oldConfig = `  workRequestSystem = new WorkRequestAlertSystem({
    alertThreshold: 0.7,
    adminUserId: process.env.ADMIN_USER_ID || 'U09GEFMKGE7' // Your user ID
  });`;

const newConfig = `  workRequestSystem = new WorkRequestAlertSystem({
    alertThreshold: 0.5, // Lowered from 0.7 to detect more work requests
    adminUserId: process.env.ADMIN_USER_ID || 'U09GEFMKGE7' // Your user ID
  });`;

if (mainJs.includes('alertThreshold: 0.7')) {
  mainJs = mainJs.replace(oldConfig, newConfig);
  fs.writeFileSync(mainJsPath, mainJs);
  console.log('✅ Lowered threshold from 0.7 → 0.5');
  console.log('\n📊 What this means:');
  console.log('  • Messages matching 1+ work request patterns will be detected');
  console.log('  • "can you create..." → confidence 0.5 → ✅ DETECTED');
  console.log('  • "please fix..." → confidence 0.5 → ✅ DETECTED');
  console.log('  • More sensitive to work requests');
} else {
  console.log('⚠️  Threshold already changed or not found');
}

console.log('\n✨ Fix applied!');
console.log('\n🚀 Restart the desktop app and test again:');
console.log('  1. Send: "John, can you create documents for the meeting?"');
console.log('  2. Look for: "🚨 Work request detected!"');
console.log('  3. Look for: "✅ Auto-created task from Slack"');
console.log('  4. Check To Do List tab for new task\n');

