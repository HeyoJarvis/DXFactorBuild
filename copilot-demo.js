#!/usr/bin/env node

/**
 * Minimal Copilot Demo - Shows transparent AI overlay
 */

require('dotenv').config();

// Check if running in Electron context
let electron;
try {
  electron = require('electron');
  if (!electron || !electron.app) {
    throw new Error('Electron not properly loaded');
  }
} catch (error) {
  console.error('❌ This script must be run with Electron');
  console.log('💡 Try: npx electron copilot-demo.js');
  console.log('💡 Or: cd desktop && npm run dev:main');
  process.exit(1);
}

const { app, BrowserWindow, screen, ipcMain } = electron;
const path = require('path');

let copilotWindows = new Map(); // Store windows for each display
let conversationHistory = []; // Store conversation history
const MAX_HISTORY_LENGTH = 20; // Keep last 20 messages

// Setup IPC handlers for copilot
function setupCopilotHandlers() {
  // Handle copilot messages
  ipcMain.handle('copilot:sendMessage', async (event, message) => {
    try {
      console.log('💬 Processing message:', message.substring(0, 50) + '...');
      
      // Add user message to history
      conversationHistory.push({
        role: 'user',
        content: message,
        timestamp: new Date().toISOString()
      });
      
      // Check if we have Anthropic API key
      if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'sk-ant-your-api-key-here') {
        const response = {
          type: 'message',
          content: 'Hi! I\'m your AI copilot. I notice you haven\'t configured your Anthropic API key yet, so I can\'t provide real AI responses. Please add your API key to the .env file to enable full AI functionality. For now, I can help you understand what I\'d be able to do once configured!',
          timestamp: new Date().toISOString()
        };
        
        // Add assistant response to history
        conversationHistory.push({
          role: 'assistant',
          content: response.content,
          timestamp: response.timestamp
        });
        
        // Trim history if too long
        if (conversationHistory.length > MAX_HISTORY_LENGTH) {
          conversationHistory = conversationHistory.slice(-MAX_HISTORY_LENGTH);
        }
        
        return response;
      }
      
      // Import AI analyzer
      const AIAnalyzer = require('./core/signals/enrichment/ai-analyzer');
      const aiAnalyzer = new AIAnalyzer();
      
      // Create context for the AI
      const context = {
        timestamp: new Date().toISOString(),
        user: {
          role: 'product_manager',
          focus_areas: ['competitive intelligence', 'market analysis']
        },
        recent_activity: 'Using HeyJarvis Copilot',
        system_status: 'Active'
      };
      
      // Build system prompt for Claude
      const systemPrompt = `You are HeyJarvis, an AI copilot for competitive intelligence. You help users understand their competitive landscape and make strategic decisions.

Current Context:
${JSON.stringify(context, null, 2)}

You have access to the conversation history and should reference previous messages when relevant. Provide helpful, actionable insights focused on competitive intelligence, market analysis, and strategic planning.`;

      // Prepare messages array with conversation history (exclude system messages)
      const messages = [];
      
      // Add conversation history (last few messages for context)
      const recentHistory = conversationHistory.slice(-10); // Last 10 messages
      recentHistory.forEach(msg => {
        if (msg.role === 'user' || msg.role === 'assistant') {
          messages.push({
            role: msg.role,
            content: msg.content
          });
        }
      });

      // Get response from Claude with conversation history
      const response = await aiAnalyzer.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 500,
        temperature: 0.7,
        system: systemPrompt, // System prompt goes here, not in messages
        messages: messages
      });
      
      const aiResponse = {
        type: 'message',
        content: response.content[0].text,
        timestamp: new Date().toISOString()
      };
      
      // Add AI response to history
      conversationHistory.push({
        role: 'assistant',
        content: aiResponse.content,
        timestamp: aiResponse.timestamp
      });
      
      // Trim history if too long
      if (conversationHistory.length > MAX_HISTORY_LENGTH) {
        conversationHistory = conversationHistory.slice(-MAX_HISTORY_LENGTH);
      }
      
      console.log(`📚 Conversation history: ${conversationHistory.length} messages`);
      
      return aiResponse;
      
    } catch (error) {
      console.error('❌ AI processing failed:', error.message);
      
      // Fallback response
      return {
        type: 'message',
        content: "I'm here to help with competitive intelligence insights. I encountered an issue processing your request, but I'm ready to help you analyze competitors, market trends, and strategic opportunities. What would you like to know?",
        timestamp: new Date().toISOString()
      };
    }
  });
  
  // Handle window controls
  ipcMain.handle('copilot:minimize', (event) => {
    // Find which window sent this event
    const senderWindow = BrowserWindow.fromWebContents(event.sender);
    if (senderWindow) {
      const currentBounds = senderWindow.getBounds();
      if (currentBounds.width > 100) {
        // Minimize to Arc Reactor orb - keep at bottom left
        const display = screen.getDisplayNearestPoint({ x: currentBounds.x, y: currentBounds.y });
        const { x: displayX, y: displayY } = display.bounds;
        const { height: screenHeight } = display.workAreaSize;
        
        senderWindow.setSize(80, 80);
        senderWindow.setPosition(displayX + 20, displayY + screenHeight - 100);
        senderWindow.webContents.send('copilot:setState', 'minimized');
        console.log('⚡ Arc Reactor orb activated at bottom-left');
      } else {
        // Restore to full size at bottom left
        const display = screen.getDisplayNearestPoint({ x: currentBounds.x, y: currentBounds.y });
        const { x: displayX, y: displayY } = display.bounds;
        const { height: screenHeight } = display.workAreaSize;
        
        senderWindow.setSize(350, 500);
        senderWindow.setPosition(displayX + 20, displayY + screenHeight - 520);
        senderWindow.webContents.send('copilot:setState', 'restored');
        console.log('📱 Full interface restored at bottom-left');
      }
    }
    return true;
  });
  
  ipcMain.handle('copilot:close', () => {
    if (copilotWindow) {
      copilotWindow.hide();
    }
    return true;
  });
  
  ipcMain.handle('copilot:toggleAlwaysOnTop', () => {
    if (copilotWindow) {
      const isAlwaysOnTop = copilotWindow.isAlwaysOnTop();
      copilotWindow.setAlwaysOnTop(!isAlwaysOnTop);
    }
    return true;
  });
  
  // Handle drag operations
  let isDragging = false;
  
  ipcMain.handle('copilot:startDrag', () => {
    isDragging = true;
    return true;
  });
  
  ipcMain.handle('copilot:endDrag', () => {
    isDragging = false;
    return true;
  });
  
  ipcMain.handle('copilot:moveWindow', (event, { deltaX, deltaY }) => {
    if (copilotWindow && isDragging) {
      const bounds = copilotWindow.getBounds();
      copilotWindow.setPosition(bounds.x + deltaX, bounds.y + deltaY);
    }
    return true;
  });
  
  // Get conversation history
  ipcMain.handle('copilot:getHistory', () => {
    return conversationHistory;
  });
  
  // Clear conversation history
  ipcMain.handle('copilot:clearHistory', () => {
    conversationHistory = [];
    console.log('🗑️ Conversation history cleared');
    return true;
  });
  
  // Save conversation history to file
  ipcMain.handle('copilot:saveHistory', () => {
    try {
      const fs = require('fs');
      const historyFile = path.join(__dirname, 'copilot-history.json');
      fs.writeFileSync(historyFile, JSON.stringify(conversationHistory, null, 2));
      console.log('💾 Conversation history saved to copilot-history.json');
      return true;
    } catch (error) {
      console.error('❌ Failed to save history:', error.message);
      return false;
    }
  });
  
  console.log('✅ Copilot IPC handlers registered');
}

// Load conversation history from file if it exists
function loadConversationHistory() {
  try {
    const fs = require('fs');
    const historyFile = path.join(__dirname, 'copilot-history.json');
    
    if (fs.existsSync(historyFile)) {
      const savedHistory = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
      conversationHistory = savedHistory || [];
      console.log(`📚 Loaded ${conversationHistory.length} messages from history`);
    }
  } catch (error) {
    console.log('📚 No previous conversation history found (starting fresh)');
    conversationHistory = [];
  }
}

app.whenReady().then(() => {
  console.log('🚀 Creating transparent AI copilot...');
  
  // Load conversation history first
  loadConversationHistory();
  
  // Setup IPC handlers
  setupCopilotHandlers();
  
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
  
  // Create transparent overlay window
  copilotWindow = new BrowserWindow({
    width: 350,
    height: 500,
    x: 20, // Position on left side
    y: screenHeight - 520, // Position above dock/taskbar
    
    // Make it transparent and always on top
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    visibleOnAllWorkspaces: true, // Persist across all screens/spaces
    fullscreenable: false,
    
    // Additional properties for multi-screen support
    ...(process.platform === 'darwin' ? {
      vibrancy: 'ultra-dark',
      titleBarStyle: 'hidden'
    } : {}),
    
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'desktop/bridge/copilot-preload.js')
    }
  });
  
  // Load the copilot UI
  const copilotHtml = path.join(__dirname, 'desktop/renderer/copilot.html');
  copilotWindow.loadFile(copilotHtml);
  
  copilotWindow.once('ready-to-show', () => {
    // Ensure window stays on all workspaces and screens
    copilotWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    copilotWindow.setAlwaysOnTop(true, 'screen-saver');
    copilotWindow.show();
    console.log('✅ Transparent AI Copilot is ready!');
    console.log('🎯 You should see a transparent chat interface at the bottom-left of your screen');
    console.log('💬 Try chatting with it - it uses real Claude AI!');
    console.log('🖥️  Multi-screen support enabled - visible on all displays!');
  });
  
  // Handle display changes to maintain visibility across screens
  screen.on('display-added', () => {
    if (copilotWindow && !copilotWindow.isDestroyed()) {
      copilotWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    }
  });
  
  screen.on('display-removed', () => {
    if (copilotWindow && !copilotWindow.isDestroyed()) {
      copilotWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    }
  });
  
  copilotWindow.on('closed', () => {
    // Auto-save conversation history when closing
    try {
      const fs = require('fs');
      const historyFile = path.join(__dirname, 'copilot-history.json');
      fs.writeFileSync(historyFile, JSON.stringify(conversationHistory, null, 2));
      console.log('💾 Conversation history auto-saved');
    } catch (error) {
      console.error('❌ Failed to auto-save history:', error.message);
    }
    
    copilotWindow = null;
    app.quit();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});

console.log('🤖 HeyJarvis Transparent Copilot Demo');
console.log('📱 Starting Electron app...');
