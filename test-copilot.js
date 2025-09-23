#!/usr/bin/env node

/**
 * Test script for the HeyJarvis Transparent Copilot
 */

// Load environment variables
require('dotenv').config();

// Check if we're in an Electron environment
if (typeof require === 'undefined' || !require('electron')) {
  console.error('❌ This script must be run with Electron');
  console.log('💡 Try: cd desktop && npm run dev:main');
  process.exit(1);
}

const { app, BrowserWindow } = require('electron');
const CopilotOverlay = require('./desktop/main/copilot-overlay');

console.log('🤖 Testing HeyJarvis Transparent Copilot...');

// Mock app lifecycle for testing
const mockAppLifecycle = {
  isDevelopment: true,
  getLogger: () => ({
    info: console.log,
    debug: console.log,
    error: console.error,
    warn: console.warn
  }),
  getStore: () => ({
    get: (key, defaultValue) => defaultValue,
    set: (key, value) => console.log(`Store set: ${key} =`, value)
  })
};

app.whenReady().then(async () => {
  console.log('✅ Electron ready');
  
  // Create copilot overlay
  const copilot = new CopilotOverlay(mockAppLifecycle);
  
  // Show the overlay
  await copilot.createOverlay();
  
  console.log('🚀 Transparent Copilot created!');
  console.log('');
  console.log('Features:');
  console.log('• Transparent, always-on-top window');
  console.log('• Real AI conversation with Claude');
  console.log('• Draggable and resizable');
  console.log('• Minimizable to small widget');
  console.log('• Contextual competitive intelligence');
  console.log('');
  console.log('Try asking:');
  console.log('- "What are the latest competitor moves?"');
  console.log('- "Analyze recent market trends"');
  console.log('- "Show me competitive intelligence insights"');
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('before-quit', () => {
  console.log('👋 Copilot test complete');
});
