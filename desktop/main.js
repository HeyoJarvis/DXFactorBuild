/**
 * Simple Electron Main Entry Point
 * Loads the copilot-enhanced.html directly without webpack
 */

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const SlackService = require('./main/slack-service');

let mainWindow;
let slackService;
let conversationHistory = []; // Store conversation history
let lastSlackContext = null; // Cache Slack context

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 400,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'bridge/copilot-preload.js')
    },
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true
  });

  // Load the copilot HTML file directly
  mainWindow.loadFile(path.join(__dirname, 'renderer/copilot-enhanced.html'));

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

// Initialize Slack service
function initializeSlackService() {
  slackService = new SlackService();
  
  // Slack IPC handlers
  ipcMain.handle('slack:getStatus', () => {
    return slackService.getStatus();
  });

  ipcMain.handle('slack:getRecentMessages', (event, limit) => {
    return slackService.getRecentMessages(limit);
  });

  ipcMain.handle('slack:startMonitoring', async () => {
    return await slackService.start();
  });

  ipcMain.handle('slack:stopMonitoring', async () => {
    return await slackService.stop();
  });

  ipcMain.handle('slack:sendMessage', async (event, channel, message) => {
    return await slackService.sendMessage(channel, message);
  });

  ipcMain.handle('slack:getUserInfo', async (event, userId) => {
    return await slackService.getUserInfo(userId);
  });

  ipcMain.handle('slack:getChannelInfo', async (event, channelId) => {
    return await slackService.getChannelInfo(channelId);
  });

  // Copilot IPC handlers with persistent context and real data integration
  ipcMain.handle('copilot:sendMessage', async (event, message) => {
    try {
      console.log('💬 Processing copilot message with context:', message.substring(0, 50) + '...');
      
      // Add user message to conversation history
      conversationHistory.push({
        role: 'user',
        content: message,
        timestamp: new Date().toISOString()
      });
      
      // Keep only last 10 messages for context
      if (conversationHistory.length > 20) {
        conversationHistory = conversationHistory.slice(-20);
      }
      
      // Get current Slack context with actual data
      const slackStatus = slackService.getStatus();
      const recentSlackMessages = slackService.getRecentMessages(10);
      
      // Build rich context with actual Slack data
      const slackContext = {
        connected: slackStatus.connected,
        bot_name: 'hj2',
        total_messages: slackStatus.messageCount || 0,
        mentions: slackStatus.mentionCount || 0,
        recent_messages: recentSlackMessages.map(msg => ({
          type: msg.type,
          user: msg.user,
          text: msg.text.substring(0, 100) + (msg.text.length > 100 ? '...' : ''),
          timestamp: msg.timestamp,
          urgent: msg.urgent,
          channel: msg.channel
        }))
      };
      
      // Cache Slack context for comparison
      lastSlackContext = slackContext;
      
      // Import AI analyzer for direct Claude integration with context
      const AIAnalyzer = require('../core/signals/enrichment/ai-analyzer');
      const aiAnalyzer = new AIAnalyzer();
      
      // Build comprehensive prompt with conversation history and real data
      const systemPrompt = `You are HeyJarvis, an AI copilot for competitive intelligence and business automation.

CURRENT SLACK CONTEXT:
- Bot Status: ${slackContext.connected ? 'Connected' : 'Disconnected'}
- Total Messages: ${slackContext.total_messages}
- Recent @hj2 Mentions: ${slackContext.mentions}
- Recent Activity: ${slackContext.recent_messages.length > 0 ? 'Active' : 'No recent activity'}

RECENT SLACK MESSAGES:
${slackContext.recent_messages.length > 0 ? 
  slackContext.recent_messages.map(msg => 
    `- ${msg.type.toUpperCase()}: @${msg.user} in ${msg.channel}: "${msg.text}"${msg.urgent ? ' [URGENT]' : ''}`
  ).join('\n') : 
  '- No recent messages'
}

CONVERSATION HISTORY:
${conversationHistory.slice(-6).map(msg => `${msg.role}: ${msg.content}`).join('\n')}

CAPABILITIES:
- Analyze Slack conversations and mentions
- Provide CRM workflow recommendations  
- Suggest business intelligence insights
- Help with task management and automation
- Competitive intelligence analysis

Respond as a knowledgeable business AI assistant. Reference the actual Slack data when relevant. Be conversational and helpful.`;

      // Get AI response with full context
      const response = await aiAnalyzer.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1000,
        temperature: 0.7,
        messages: [
          {
            role: 'user',
            content: `${systemPrompt}\n\nUser: ${message}`
          }
        ]
      });
      
      const aiResponse = response.content[0].text;
      
      // Add AI response to conversation history
      conversationHistory.push({
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date().toISOString()
      });
      
      // Add contextual insights based on actual data
      let contextualInsights = '';
      
      if (slackContext.mentions > 0) {
        contextualInsights += `\n\n🔔 **Live Slack Activity**: You have ${slackContext.mentions} recent @hj2 mentions that may need attention.`;
      }
      
      if (slackContext.recent_messages.some(msg => msg.urgent)) {
        const urgentCount = slackContext.recent_messages.filter(msg => msg.urgent).length;
        contextualInsights += `\n\n⚠️ **Urgent Messages**: ${urgentCount} urgent messages detected in recent Slack activity.`;
      }
      
      if (slackContext.recent_messages.length > 0) {
        const channels = [...new Set(slackContext.recent_messages.map(msg => msg.channel))];
        contextualInsights += `\n\n📊 **Activity Summary**: Recent activity across ${channels.length} channels.`;
      }
      
      return {
        type: 'message',
        content: aiResponse + contextualInsights,
        timestamp: new Date().toISOString(),
        metadata: {
          conversation_length: conversationHistory.length,
          slack_connected: slackContext.connected,
          recent_mentions: slackContext.mentions,
          context_used: true
        }
      };
      
    } catch (error) {
      console.error('❌ Copilot message processing failed:', error);
      
      // Add error to conversation history to maintain context
      conversationHistory.push({
        role: 'assistant',
        content: 'I encountered an error processing your request. Let me try to help you anyway.',
        timestamp: new Date().toISOString(),
        error: true
      });
      
      // Fallback response with context
      const slackStatus = slackService ? slackService.getStatus() : { connected: false };
      
      return {
        type: 'message',
        content: `I'm your AI copilot for competitive intelligence and business insights. I can help you analyze market trends, manage tasks, and optimize workflows.

${slackStatus.connected ? '💬 I can see your Slack is connected - I can help analyze your @hj2 mentions and team conversations.' : '📱 Connect Slack in the Slack tab to get real-time insights from your team conversations.'}

What would you like to explore?`,
        timestamp: new Date().toISOString(),
        error: true
      };
    }
  });

  ipcMain.handle('copilot:minimize', () => {
    if (mainWindow) {
      mainWindow.minimize();
    }
  });

  ipcMain.handle('copilot:close', () => {
    if (mainWindow) {
      mainWindow.close();
    }
  });

  ipcMain.handle('copilot:toggleAlwaysOnTop', () => {
    if (mainWindow) {
      const isAlwaysOnTop = mainWindow.isAlwaysOnTop();
      mainWindow.setAlwaysOnTop(!isAlwaysOnTop);
      return !isAlwaysOnTop;
    }
    return false;
  });

  ipcMain.handle('copilot:clearHistory', () => {
    conversationHistory = [];
    console.log('🗑️ Conversation history cleared');
    return { success: true, message: 'Conversation history cleared' };
  });

  ipcMain.handle('copilot:getHistory', () => {
    return {
      success: true,
      history: conversationHistory,
      length: conversationHistory.length
    };
  });

  // Forward Slack events to renderer
  slackService.on('mention', (message) => {
    if (mainWindow) {
      mainWindow.webContents.send('slack:mention', message);
    }
  });

  slackService.on('message', (message) => {
    if (mainWindow) {
      mainWindow.webContents.send('slack:message', message);
    }
  });

  slackService.on('connected', () => {
    if (mainWindow) {
      mainWindow.webContents.send('slack:connected');
    }
  });

  slackService.on('disconnected', () => {
    if (mainWindow) {
      mainWindow.webContents.send('slack:disconnected');
    }
  });

  slackService.on('error', (error) => {
    if (mainWindow) {
      mainWindow.webContents.send('slack:error', error.message);
    }
  });
}

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  createWindow();
  initializeSlackService();
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});