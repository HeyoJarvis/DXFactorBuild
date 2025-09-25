#!/usr/bin/env node

/**
 * Enhanced HeyJarvis Copilot with CRM Tab
 * 
 * This launches the enhanced copilot that includes:
 * 1. Original chat functionality
 * 2. New CRM dashboard tab
 * 3. Real-time CRM data integration
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
  console.log('💡 Try: npx electron start-copilot-enhanced.js');
  process.exit(1);
}

const { app, BrowserWindow, ipcMain, screen } = electron;
const path = require('path');

let copilotWindow = null;

// Setup IPC handlers for copilot
function setupCopilotHandlers() {
  // Handle copilot messages
  ipcMain.handle('copilot:sendMessage', async (event, message) => {
    try {
      console.log('💬 Processing message:', message.substring(0, 50) + '...');
      
      // Check if we have Anthropic API key
      if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'sk-ant-your-api-key-here') {
        return {
          type: 'message',
          content: 'Hi! I\'m your AI copilot. I notice you haven\'t configured your Anthropic API key yet, so I can\'t provide real AI responses. Please add your API key to the .env file to enable full AI functionality.',
          timestamp: new Date().toISOString()
        };
      }
      
      // Import AI analyzer
      const AIAnalyzer = require('./core/signals/enrichment/ai-analyzer');
      const aiAnalyzer = new AIAnalyzer();
      
      // Create context for the AI
      const context = {
        timestamp: new Date().toISOString(),
        user: {
          role: 'product_manager',
          focus_areas: ['competitive intelligence', 'market analysis', 'crm optimization']
        },
        recent_activity: 'Using HeyJarvis Enhanced Copilot',
        system_status: 'Active'
      };
      
      // Build prompt for conversational AI
      const prompt = `You are HeyJarvis, an AI copilot for competitive intelligence and CRM optimization. You help users understand their competitive landscape, analyze CRM data, and make strategic decisions.

Current Context:
${JSON.stringify(context, null, 2)}

User Message: ${message}

Respond as a helpful, knowledgeable assistant. Be concise but informative. If the user is asking about competitors, market trends, CRM workflows, or business intelligence, provide actionable insights.`;

      // Get response from Claude
      const response = await aiAnalyzer.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 500,
        temperature: 0.7,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });
      
      return {
        type: 'message',
        content: response.content[0].text,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('AI processing failed:', error.message);
      
      // Fallback response
      return {
        type: 'message',
        content: "I'm here to help with competitive intelligence and CRM insights. What would you like to know about your market, competitors, or sales workflows?",
        timestamp: new Date().toISOString()
      };
    }
  });

  // Handle window controls
  ipcMain.handle('copilot:minimize', () => {
    if (copilotWindow) {
      copilotWindow.minimize();
    }
  });

  ipcMain.handle('copilot:close', () => {
    if (copilotWindow) {
      copilotWindow.close();
    }
  });

  // Handle CRM data requests
  ipcMain.handle('crm:getData', async () => {
    try {
      // In production, this would fetch from your CRM background service
      // For now, return mock data
      return {
        success: true,
        data: {
          healthScore: 72,
          totalDeals: 45,
          pipelineValue: 2850000,
          avgDealSize: 63333,
          cycleTime: 67,
          recentActivity: [
            { type: 'deal_created', text: 'Acme Corp - $125K', time: '2 hours ago' },
            { type: 'stage_change', text: 'TechStart Inc - $89K', time: '4 hours ago' },
            { type: 'deal_won', text: 'Global Solutions - $156K', time: '1 day ago' }
          ]
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  });
}

app.whenReady().then(() => {
  console.log('🚀 Creating Enhanced HeyJarvis Copilot with CRM Dashboard...');
  
  // Setup IPC handlers
  setupCopilotHandlers();
  
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
  
  // Create enhanced copilot window
  copilotWindow = new BrowserWindow({
    width: 380,  // Slightly wider for CRM dashboard
    height: 600, // Taller for more content
    x: screenWidth - 400,
    y: 50,
    
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // Allow localhost requests
      preload: path.join(__dirname, 'desktop/bridge/copilot-preload.js')
    }
  });
  
  // Load the enhanced copilot UI
  const copilotHtml = path.join(__dirname, 'desktop/renderer/copilot-enhanced.html');
  copilotWindow.loadFile(copilotHtml);
  
  // Enable DevTools for debugging (remove in production)
  // copilotWindow.webContents.openDevTools();
  
  copilotWindow.once('ready-to-show', () => {
    copilotWindow.show();
    
    console.log('✅ Enhanced HeyJarvis Copilot is ready!');
    console.log('💬 Chat tab: Original AI copilot functionality');
    console.log('📊 CRM tab: Real-time CRM dashboard and insights');
    console.log('🔄 The CRM tab connects to your background service on port 3001');
    
    if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'sk-ant-your-api-key-here') {
      console.log('🤖 AI functionality enabled');
    } else {
      console.log('⚠️  AI functionality disabled (no Anthropic API key)');
    }
  });
  
  // DevTools can be toggled with Ctrl+Shift+I if needed for debugging

  copilotWindow.on('closed', () => {
    copilotWindow = null;
    app.quit();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Handle app events
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
