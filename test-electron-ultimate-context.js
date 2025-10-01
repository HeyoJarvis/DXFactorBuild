/**
 * Test Electron Ultimate Context Integration
 * 
 * This script tests the Electron desktop app integration with the ultimate context system.
 */

const { app, BrowserWindow } = require('electron');
const path = require('path');

// Load environment variables
require('dotenv').config();

let mainWindow;

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'desktop/bridge/preload.js')
    }
  });

  // Load the ultimate context chat interface
  mainWindow.loadFile(path.join(__dirname, 'desktop/renderer/ultimate-context-chat.html'));

  // Open DevTools for testing
  mainWindow.webContents.openDevTools();

  console.log('🚀 Ultimate Context Chat window opened');
  console.log('📝 Test the following features:');
  console.log('   1. Select an organization from the dropdown');
  console.log('   2. Click "Refresh Context" to load real CRM and Slack data');
  console.log('   3. Ask questions about your business processes');
  console.log('   4. Test the context management features');
}

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

console.log('🎯 Electron Ultimate Context Test');
console.log('   - Make sure your .env file has ANTHROPIC_API_KEY');
console.log('   - Make sure your .env file has HUBSPOT_ACCESS_TOKEN');
console.log('   - Ensure your CRM and Slack integrations are working');
console.log('   - The chat interface will open in a new window');
