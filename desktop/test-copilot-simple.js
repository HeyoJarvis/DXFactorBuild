#!/usr/bin/env node

/**
 * Simple Copilot Test - Direct test of the transparent overlay
 */

// Load environment variables
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { app } = require('electron');
const CopilotOverlay = require('./main/copilot-overlay');

console.log('🤖 Testing HeyJarvis Transparent Copilot...');

// Mock app lifecycle
const mockAppLifecycle = {
  isDevelopment: true,
  getLogger: () => ({
    info: (...args) => console.log('ℹ️ ', ...args),
    debug: (...args) => console.log('🐛', ...args),
    error: (...args) => console.error('❌', ...args),
    warn: (...args) => console.warn('⚠️ ', ...args)
  }),
  getStore: () => ({
    get: (key, defaultValue) => {
      console.log(`📦 Store get: ${key} -> using default`);
      return defaultValue;
    },
    set: (key, value) => {
      console.log(`📦 Store set: ${key} =`, value);
    }
  })
};

app.whenReady().then(async () => {
  console.log('✅ Electron ready');
  
  try {
    // Create copilot overlay
    const copilot = new CopilotOverlay(mockAppLifecycle);
    
    // Show the overlay
    await copilot.createOverlay();
    
    console.log('🚀 Transparent Copilot created and ready!');
    console.log('');
    console.log('✨ Features:');
    console.log('• Transparent, always-on-top window');
    console.log('• Real AI conversation with Claude');
    console.log('• Draggable and resizable');
    console.log('• Minimizable to small widget');
    console.log('• Contextual competitive intelligence');
    console.log('');
    console.log('💬 Try asking:');
    console.log('- "What are the latest competitor moves?"');
    console.log('- "Analyze recent market trends"');
    console.log('- "Show me competitive intelligence insights"');
    console.log('');
    console.log('🎮 Controls:');
    console.log('- Drag the header to move');
    console.log('- Click minimize (-) to shrink to widget');
    console.log('- Click close (×) to hide');
    
  } catch (error) {
    console.error('❌ Failed to create copilot:', error.message);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  console.log('👋 Copilot test complete');
  app.quit();
});

app.on('before-quit', () => {
  console.log('🔄 Shutting down...');
});
