#!/usr/bin/env node

/**
 * Fix task creation confidence threshold to match work request detection
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing task creation confidence threshold...\n');

const mainJsPath = path.join(__dirname, 'desktop/main.js');
let mainJs = fs.readFileSync(mainJsPath, 'utf8');

// Lower the task creation confidence check from 0.6 to 0.4 (to be safe)
const oldCheck = `        if (workRequestAnalysis.isWorkRequest && 
            workRequestAnalysis.confidence > 0.6 &&
            (workflowData.context.assignee || workflowData.context.is_assignment)) {`;

const newCheck = `        if (workRequestAnalysis.isWorkRequest && 
            workRequestAnalysis.confidence > 0.4 &&
            (workflowData.context.assignee || workflowData.context.is_assignment)) {`;

if (mainJs.includes('workRequestAnalysis.confidence > 0.6')) {
  mainJs = mainJs.replace(oldCheck, newCheck);
  
  // Also fix the mention handler (if it exists)
  const oldMentionCheck = `        if (workRequestAnalysis.isWorkRequest &&
            (workflowData.context.assignee || workflowData.context.is_assignment)) {`;
  
  // The mention handler doesn't have the confidence check, so it's fine
  
  fs.writeFileSync(mainJsPath, mainJs);
  console.log('✅ Lowered task creation confidence threshold: 0.6 → 0.4');
  console.log('\n📊 Complete Flow Now:');
  console.log('  1. Message matches pattern → confidence 0.5');
  console.log('  2. Work request detected (0.5 ≥ 0.5) → ✅');
  console.log('  3. Task creation check (0.5 > 0.4) → ✅');
  console.log('  4. Assignment extracted → ✅');
  console.log('  5. Task created! → ✅');
} else {
  console.log('⚠️  Threshold already changed or not found');
}

console.log('\n✨ Fix applied!');
console.log('\n🚀 Restart and test:');
console.log('  Message: "John, can you create documents for the meeting?"');
console.log('  Expected: Task appears in To Do List with assignee John\n');

