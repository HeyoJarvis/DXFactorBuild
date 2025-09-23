#!/usr/bin/env node

/**
 * HeyJarvis Desktop App Entry Point
 */

// Load environment variables
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { app, BrowserWindow } = require('electron');
const AppLifecycle = require('./main/app-lifecycle');

let appLifecycle = null;

// Handle app ready
app.whenReady().then(async () => {
  console.log('🚀 HeyJarvis Desktop starting...');
  
  // Create app lifecycle instance
  appLifecycle = new AppLifecycle();
  
  // Initialize the app
  await appLifecycle.initialize();
  
  console.log('✅ HeyJarvis Desktop ready!');
  console.log('📱 Press Cmd+Shift+J (or Ctrl+Shift+J) to toggle the AI Copilot');
});

// Handle app activation (macOS)
app.on('activate', () => {
  // On macOS, re-create window when dock icon is clicked
  if (BrowserWindow.getAllWindows().length === 0 && appLifecycle) {
    appLifecycle.showMainWindow();
  }
});

// Handle all windows closed
app.on('window-all-closed', () => {
  // On macOS, apps typically stay active even when all windows are closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle before quit
app.on('before-quit', () => {
  console.log('👋 HeyJarvis Desktop shutting down...');
});

module.exports = app;
