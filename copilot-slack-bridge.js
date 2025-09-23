#!/usr/bin/env node

/**
 * HeyJarvis Copilot with Slack Integration
 * Transparent desktop copilot that also sends messages to Slack
 */

require('dotenv').config();

const { app, BrowserWindow, screen, ipcMain } = require('electron');
const { App: SlackApp } = require('@slack/bolt');
const path = require('path');

let copilotWindow = null;
let slackApp = null;

// Initialize Slack app
function initializeSlack() {
  if (!process.env.SLACK_BOT_TOKEN || !process.env.SLACK_SIGNING_SECRET) {
    console.log('⚠️  Slack not configured - copilot will work without Slack integration');
    return null;
  }

  try {
    slackApp = new SlackApp({
      token: process.env.SLACK_BOT_TOKEN,
      signingSecret: process.env.SLACK_SIGNING_SECRET,
      socketMode: process.env.SLACK_SOCKET_MODE === 'true',
      appToken: process.env.SLACK_APP_TOKEN,
    });

    console.log('✅ Slack integration initialized');
    return slackApp;
  } catch (error) {
    console.error('❌ Failed to initialize Slack:', error.message);
    return null;
  }
}

// Setup IPC handlers for copilot with Slack integration
function setupCopilotHandlers() {
  // Handle copilot messages
  ipcMain.handle('copilot:sendMessage', async (event, message) => {
    try {
      console.log('💬 Processing message:', message.substring(0, 50) + '...');
      
      // Check if we have Anthropic API key
      if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'sk-ant-your-api-key-here') {
        const response = {
          type: 'message',
          content: 'Hi! I\'m your AI copilot. I notice you haven\'t configured your Anthropic API key yet, so I can\'t provide real AI responses. Please add your API key to the .env file to enable full AI functionality.',
          timestamp: new Date().toISOString()
        };

        // Send to Slack if configured
        if (slackApp) {
          await sendToSlack('🤖 Copilot: ' + response.content);
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
      
      // Build prompt for conversational AI
      const prompt = `You are HeyJarvis, an AI copilot for competitive intelligence. You help users understand their competitive landscape and make strategic decisions.

Current Context:
${JSON.stringify(context, null, 2)}

User Message: ${message}

Respond as a helpful, knowledgeable assistant focused on competitive intelligence. Be concise but informative. If the user is asking about competitors, market trends, or business intelligence, provide actionable insights.`;

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
      
      const aiResponse = {
        type: 'message',
        content: response.content[0].text,
        timestamp: new Date().toISOString()
      };

      // Send to Slack if configured
      if (slackApp) {
        await sendToSlack(`👤 **You:** ${message}\n\n🤖 **HeyJarvis:** ${aiResponse.content}`);
      }
      
      return aiResponse;
      
    } catch (error) {
      console.error('❌ AI processing failed:', error.message);
      
      // Fallback response
      const fallbackResponse = {
        type: 'message',
        content: "I'm here to help with competitive intelligence insights. I encountered an issue processing your request, but I'm ready to help you analyze competitors, market trends, and strategic opportunities. What would you like to know?",
        timestamp: new Date().toISOString()
      };

      // Send error to Slack if configured
      if (slackApp) {
        await sendToSlack('🤖 Copilot encountered an error: ' + fallbackResponse.content);
      }

      return fallbackResponse;
    }
  });
  
  // Handle window controls (same as before)
  ipcMain.handle('copilot:minimize', () => {
    if (copilotWindow) {
      if (copilotWindow.getBounds().width > 100) {
        copilotWindow.setSize(60, 60);
      } else {
        copilotWindow.setSize(350, 500);
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
  
  console.log('✅ Copilot IPC handlers registered');
}

// Send message to Slack
async function sendToSlack(message) {
  if (!slackApp) return;

  try {
    // You can customize this - send to a specific channel or DM
    const channel = process.env.SLACK_COPILOT_CHANNEL || '#general'; // or a user ID for DM
    
    await slackApp.client.chat.postMessage({
      channel: channel,
      text: message,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: message
          }
        }
      ]
    });
    
    console.log('📤 Sent to Slack:', message.substring(0, 50) + '...');
    
  } catch (error) {
    console.error('❌ Failed to send to Slack:', error.message);
  }
}

app.whenReady().then(async () => {
  console.log('🚀 Creating HeyJarvis Copilot with Slack Integration...');
  
  // Initialize Slack
  slackApp = initializeSlack();
  if (slackApp) {
    await slackApp.start();
  }
  
  // Setup IPC handlers
  setupCopilotHandlers();
  
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
  
  // Create transparent overlay window
  copilotWindow = new BrowserWindow({
    width: 350,
    height: 500,
    x: screenWidth - 370,
    y: 50,
    
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'desktop/bridge/copilot-preload.js')
    }
  });
  
  // Load the enhanced copilot UI
  const copilotHtml = path.join(__dirname, 'desktop/renderer/copilot.html');
  copilotWindow.loadFile(copilotHtml);
  
  copilotWindow.once('ready-to-show', () => {
    copilotWindow.show();
    console.log('✅ HeyJarvis Copilot is ready!');
    console.log('💬 Chat with the copilot - messages will also appear in Slack!');
    
    if (slackApp) {
      console.log('📱 Slack integration active');
    } else {
      console.log('📱 Slack integration disabled (not configured)');
    }
  });
  
  copilotWindow.on('closed', () => {
    copilotWindow = null;
    app.quit();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});

console.log('🤖 HeyJarvis Copilot with Slack Bridge');
console.log('====================================');
console.log('This creates a transparent desktop copilot that ALSO sends messages to Slack');
console.log('');
