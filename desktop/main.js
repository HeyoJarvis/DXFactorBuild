/**
 * Simple Electron Main Entry Point
 * Loads the copilot-enhanced.html directly without webpack
 */

const { app, BrowserWindow, ipcMain, Tray, Menu, screen, desktopCapturer } = require('electron');
const path = require('path');
const SlackService = require('./main/slack-service');
const CRMStartupService = require('./main/crm-startup-service');

// Global error handlers to prevent crashes
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Don't exit the process, just log the error
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process, just log the error
});

let mainWindow;
let highlightOverlay = null; // New overlay for fact-check highlights
let tray;
let slackService;
let crmStartupService;
let conversationHistory = []; // Store conversation history
let lastSlackContext = null; // Cache Slack context
let isExpanded = false; // Track if top bar is expanded
let isManuallyPositioned = false; // Track if user has manually moved the bar
let activeHighlights = []; // Store active highlight data

function createWindow() {
  // Create the browser window as a top bar overlay
  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth } = primaryDisplay.bounds;
  
  // Make bar slightly bigger for better presence
  const barWidth = Math.min(480, screenWidth * 0.35); // Max 480px or 35% of screen width (bigger)
  const barHeight = 400; // Much taller to accommodate full chat interface
  const xPosition = Math.floor((screenWidth - barWidth) / 2); // Center horizontally
  
  mainWindow = new BrowserWindow({
    width: barWidth, // Narrower, more discreet width
    height: barHeight, // Taller bar
    x: xPosition, // Centered position
    y: 10, // Small margin from top
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
    resizable: true, // Allow resizing for better UX
    movable: true, // Enable dragging
    minimizable: false,
    maximizable: false,
    closable: false,
    focusable: true,
    show: false, // Don't show until ready
    titleBarStyle: 'hidden',
    vibrancy: 'ultra-dark', // macOS only
    backgroundMaterial: 'acrylic', // Windows only
    opacity: 0.9,
    hasShadow: false,
    thickFrame: false,
    type: 'panel' // Panel type for better overlay behavior
  });

  // Load the copilot HTML file directly
  mainWindow.loadFile(path.join(__dirname, 'renderer/copilot-enhanced.html'));

  // Setup persistent overlay behavior
  setupPersistentOverlay();
  
  // Setup system tray
  setupSystemTray();

  // DevTools disabled for cleaner experience
  // if (process.env.NODE_ENV === 'development') {
  //   mainWindow.webContents.openDevTools();
  // }
}

// Setup system tray for persistent overlay control
function setupSystemTray() {
  // Create tray icon (you may need to add an icon file)
  const iconPath = path.join(__dirname, 'assets', 'tray-icon.png');
  
  // Fallback to a simple icon if file doesn't exist
  try {
    tray = new Tray(iconPath);
  } catch (error) {
    // Create a simple tray without icon for now
    tray = new Tray(require('electron').nativeImage.createEmpty());
  }
  
  // Create context menu
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show HeyJarvis',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    {
      label: 'Hide HeyJarvis',
      click: () => {
        if (mainWindow) {
          mainWindow.hide();
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Compact Mode',
      click: () => {
        minimizeToCompactMode();
      }
    },
    {
      label: 'Full Mode',
      click: () => {
        expandFromCompactMode();
      }
    },
    { type: 'separator' },
    {
      label: 'Opacity',
      submenu: [
        {
          label: '20% (Very Translucent)',
          click: () => mainWindow?.setOpacity(0.2)
        },
        {
          label: '40% (Translucent)',
          click: () => mainWindow?.setOpacity(0.4)
        },
        {
          label: '60% (Semi-transparent)',
          click: () => mainWindow?.setOpacity(0.6)
        },
        {
          label: '75% (Default)',
          click: () => mainWindow?.setOpacity(0.75)
        },
        {
          label: '90% (Mostly Opaque)',
          click: () => mainWindow?.setOpacity(0.9)
        },
        {
          label: '100% (Fully Opaque)',
          click: () => mainWindow?.setOpacity(1.0)
        }
      ]
    },
    { type: 'separator' },
    {
      label: 'Quit HeyJarvis',
      click: () => {
        app.quit();
      }
    }
  ]);
  
  tray.setContextMenu(contextMenu);
  tray.setToolTip('HeyJarvis - AI Copilot');
  
  // Double-click to show/hide
  tray.on('double-click', () => {
    toggleOverlayVisibility();
  });
}

// Setup persistent overlay behavior
function setupPersistentOverlay() {
  const { screen } = require('electron');
  
  // Position window on the right side of screen by default
  positionOverlayOnCurrentScreen();

  // Show window once positioned
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // Set maximum window level for fullscreen persistence
    setupMaximumVisibility();
    
    // Setup drag detection
    setupDragDetection();
    
    console.log('🚀 HeyJarvis overlay ready and visible');
  });

  // Prevent window from being closed
  mainWindow.on('close', (event) => {
    event.preventDefault();
    toggleOverlayVisibility();
  });

  // Enhanced always-on-top behavior
  setupEnhancedAlwaysOnTop();
  
  // Monitor screen changes and fullscreen apps
  setupScreenMonitoring();

  // Auto-hide when user clicks outside (optional)
  mainWindow.on('blur', () => {
    // Optionally minimize to compact mode when losing focus
    if (process.env.AUTO_MINIMIZE === 'true') {
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isFocused()) {
          minimizeToCompactMode();
        }
      }, 2000); // 2 second delay
    }
  });
}

// Setup drag detection to know when user manually moves the window
function setupDragDetection() {
  let initialPosition = mainWindow.getBounds();
  let dragStartTime = null;
  
  // Track when dragging starts
  mainWindow.on('will-move', () => {
    dragStartTime = Date.now();
  });
  
  // Track when dragging ends
  mainWindow.on('moved', () => {
    if (dragStartTime && (Date.now() - dragStartTime) < 1000) {
      // This was likely a user drag (quick movement)
      const newPosition = mainWindow.getBounds();
      const moved = Math.abs(newPosition.x - initialPosition.x) > 20 || 
                   Math.abs(newPosition.y - initialPosition.y) > 20;
      
      if (moved) {
        isManuallyPositioned = true;
        console.log('🎯 User manually positioned the bar - disabling auto-repositioning');
        
        // Send notification to renderer
        mainWindow.webContents.send('topbar:manually-positioned', true);
      }
    }
    
    initialPosition = mainWindow.getBounds();
    dragStartTime = null;
  });
}

// Position top bar on the current active screen
function positionOverlayOnCurrentScreen() {
  // Don't auto-reposition if user has manually moved the bar
  if (isManuallyPositioned) {
    // Only update size, keep user's position
    const currentBounds = mainWindow.getBounds();
    const barHeight = isExpanded ? 600 : 55;
    
    if (currentBounds.height !== barHeight) {
      mainWindow.setBounds({
        ...currentBounds,
        height: barHeight
      });
    }
    return;
  }
  
  const { screen } = require('electron');
  const cursor = screen.getCursorScreenPoint();
  const currentDisplay = screen.getDisplayNearestPoint(cursor);
  const { width: screenWidth } = currentDisplay.bounds;
  const { x: screenX, y: screenY } = currentDisplay.bounds;
  
  // Calculate bar dimensions and position
  const barWidth = Math.min(480, screenWidth * 0.35); // Max 480px or 35% of screen width (bigger)
  const barHeight = isExpanded ? 600 : 55; // Expanded or collapsed height (slightly taller)
  const xPosition = screenX + Math.floor((screenWidth - barWidth) / 2); // Center horizontally
  const yPosition = screenY + 10; // Small margin from top
  
  mainWindow.setBounds({
    x: xPosition,
    y: yPosition,
    width: barWidth,
    height: barHeight
  });
  
  // Only log if position actually changed significantly
  const currentBounds = mainWindow.getBounds();
  const positionChanged = Math.abs(currentBounds.x - xPosition) > 10 || Math.abs(currentBounds.y - yPosition) > 10;
  
  if (positionChanged) {
    console.log(`📍 Repositioned top bar on screen: ${currentDisplay.id} (${barWidth}x${barHeight})`);
  }
}

// Setup maximum visibility to persist over fullscreen apps
function setupMaximumVisibility() {
  // Set the highest possible window level
  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  
  // For macOS, use additional methods to ensure visibility
  if (process.platform === 'darwin') {
    try {
      // Set window level to maximum
      mainWindow.setWindowButtonVisibility(false);
      
      // Use native methods if available
      const { systemPreferences } = require('electron');
      if (systemPreferences.getMediaAccessStatus) {
        // Request accessibility permissions for better overlay control
        console.log('🔐 Requesting accessibility permissions for enhanced overlay');
      }
    } catch (error) {
      console.log('⚠️ Some macOS-specific features unavailable:', error.message);
    }
  }
  
  // For Windows, set topmost flag
  if (process.platform === 'win32') {
    mainWindow.setAlwaysOnTop(true, 'pop-up-menu');
  }
}

// Enhanced always-on-top behavior that persists through fullscreen
function setupEnhancedAlwaysOnTop() {
  let alwaysOnTopInterval;
  
  // Aggressively maintain always-on-top status
  const maintainAlwaysOnTop = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setAlwaysOnTop(true, 'screen-saver');
      
      // Additional visibility enforcement
      if (mainWindow.isVisible() && !mainWindow.isFocused()) {
        // Briefly focus and unfocus to ensure visibility
        setTimeout(() => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.moveTop();
          }
        }, 50);
      }
    }
  };
  
  // Run every 5 seconds to maintain visibility (reduced frequency)
  alwaysOnTopInterval = setInterval(maintainAlwaysOnTop, 5000);
  
  // Handle window events
  mainWindow.on('blur', () => {
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setAlwaysOnTop(true, 'screen-saver');
        mainWindow.moveTop();
      }
    }, 100);
  });

  mainWindow.on('focus', () => {
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
  });
  
  // Clean up interval on window destroy
  mainWindow.on('closed', () => {
    if (alwaysOnTopInterval) {
      clearInterval(alwaysOnTopInterval);
    }
  });
}

// Monitor screen changes and follow user across displays
function setupScreenMonitoring() {
  const { screen } = require('electron');
  let lastScreenId = null;
  
  // Check screen changes every 10 seconds (reduced frequency)
  const screenMonitorInterval = setInterval(() => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      clearInterval(screenMonitorInterval);
      return;
    }
    
    try {
      const cursor = screen.getCursorScreenPoint();
      const currentDisplay = screen.getDisplayNearestPoint(cursor);
      
      // If user moved to a different screen, follow them
      if (lastScreenId !== null && lastScreenId !== currentDisplay.id) {
        console.log(`🏃‍♂️ Following user to screen: ${currentDisplay.id}`);
        positionOverlayOnCurrentScreen();
      }
      
      lastScreenId = currentDisplay.id;
      
      // Detect if any fullscreen app is running and adjust accordingly
      detectFullscreenApps();
      
    } catch (error) {
      console.log('⚠️ Screen monitoring error:', error.message);
    }
    }, 10000); // Reduced from 3 seconds to 10 seconds
  
  // Listen for display changes
  screen.on('display-added', () => {
    console.log('🖥️ New display detected');
    setTimeout(positionOverlayOnCurrentScreen, 1000);
  });
  
  screen.on('display-removed', () => {
    console.log('🖥️ Display removed');
    setTimeout(positionOverlayOnCurrentScreen, 1000);
  });
  
  screen.on('display-metrics-changed', () => {
    try {
      console.log('🖥️ Display metrics changed');
      setTimeout(positionOverlayOnCurrentScreen, 500);
    } catch (error) {
      console.error('Error handling display metrics change:', error);
    }
  });
  
  // Clean up on window close
  mainWindow.on('closed', () => {
    clearInterval(screenMonitorInterval);
  });
}

// Detect fullscreen applications and adjust overlay behavior
function detectFullscreenApps() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  
  try {
    // Get all visible windows to detect fullscreen apps
    const { screen } = require('electron');
    const displays = screen.getAllDisplays();
    
    // Check if overlay is still visible and properly positioned
    const overlayBounds = mainWindow.getBounds();
    const currentDisplay = screen.getDisplayMatching(overlayBounds);
    
    // Ensure overlay stays on the correct display
    if (currentDisplay) {
      const { width: screenWidth, height: screenHeight } = currentDisplay.workAreaSize;
      const { x: screenX, y: screenY } = currentDisplay.workArea;
      
      // Check if overlay is still in the right position
      const expectedX = screenX + screenWidth - overlayBounds.width - 20;
      const expectedY = screenY + Math.floor((screenHeight - overlayBounds.height) / 2);
      
      if (Math.abs(overlayBounds.x - expectedX) > 50 || Math.abs(overlayBounds.y - expectedY) > 50) {
        console.log('🔄 Repositioning overlay due to screen changes');
        positionOverlayOnCurrentScreen();
      }
    }
    
    // Ensure maximum visibility level is maintained
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
    mainWindow.moveTop();
    
  } catch (error) {
    console.log('⚠️ Fullscreen detection error:', error.message);
  }
}

// Top bar control functions
function toggleOverlayVisibility() {
  if (mainWindow.isVisible()) {
    mainWindow.hide();
    console.log('🫥 HeyJarvis top bar hidden');
  } else {
    mainWindow.show();
    mainWindow.focus();
    console.log('👁️ HeyJarvis top bar shown');
  }
}

function expandTopBar() {
  if (mainWindow && !isExpanded) {
    isExpanded = true;
    
    // Get current screen
    const { screen } = require('electron');
    const cursor = screen.getCursorScreenPoint();
    const currentDisplay = screen.getDisplayNearestPoint(cursor);
    const { width: screenWidth } = currentDisplay.bounds;
    const { x: screenX, y: screenY } = currentDisplay.bounds;
    
    // Expand to show full interface - wider when expanded
    const expandedWidth = Math.min(800, screenWidth * 0.6); // Wider when expanded
    const xPosition = screenX + Math.floor((screenWidth - expandedWidth) / 2);
    
    mainWindow.setBounds({
      x: xPosition,
      y: screenY + 10,
      width: expandedWidth,
      height: 600 // Expanded height
    });
    
    // Send message to renderer to switch to expanded mode
    mainWindow.webContents.send('topbar:expanded', true);
    console.log('📖 Expanded top bar');
  }
}

function collapseTopBar() {
  if (mainWindow && isExpanded) {
    isExpanded = false;
    
    // Get current screen and reposition to collapsed state
    positionOverlayOnCurrentScreen();
    
    // Send message to renderer to switch to collapsed mode
    mainWindow.webContents.send('topbar:expanded', false);
    console.log('📦 Collapsed top bar');
  }
}

function toggleTopBarExpansion() {
  if (isExpanded) {
    collapseTopBar();
  } else {
    expandTopBar();
  }
}

// Initialize services with auto-startup
function initializeServices() {
  // Initialize Slack service
  slackService = new SlackService();
  
  // Initialize CRM startup service
  crmStartupService = new CRMStartupService({
    logLevel: process.env.NODE_ENV === 'development' ? 'debug' : 'info'
  });
  
  // Setup CRM startup event handlers
  setupCRMStartupHandlers();
  
  // Start CRM loading process
  startCRMLoading();
  
  // Auto-start Slack monitoring after a short delay
  setTimeout(async () => {
    try {
      console.log('🚀 Auto-starting Slack monitoring...');
      const result = await slackService.start();
      if (result.success) {
        console.log('✅ Slack monitoring auto-started successfully');
      } else {
        console.log('⚠️ Slack auto-start failed:', result.error || 'Unknown error');
      }
    } catch (error) {
      console.log('❌ Slack auto-start error:', error.message);
    }
  }, 3000); // 3 second delay to allow UI to load
  
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
      
      // Get current CRM context from startup service
      const crmData = crmStartupService.getCRMData();
      const crmContext = {
        connected: crmData.connected,
        insights: (crmData.insights || []).slice(0, 3),
        recommendations: (crmData.recommendations || []).slice(0, 3),
        workflows: (crmData.workflows || []).length,
        last_updated: crmData.last_updated,
        isLoading: crmData.isLoading,
        loadingProgress: crmData.loadingProgress
      };
      
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

CURRENT CRM CONTEXT:
- CRM Status: ${crmContext.isLoading ? `Loading (${crmContext.loadingProgress}%)` : crmContext.connected ? 'Connected' : 'Disconnected'}
- Active Workflows: ${crmContext.workflows || 0}
- Recent Insights: ${crmContext.insights.length}
- Recommendations: ${crmContext.recommendations.length}

CRM INSIGHTS:
${crmContext.insights.length > 0 ? 
  crmContext.insights.map(insight => 
    `- ${insight.title || insight.pattern_name}: ${insight.description || insight.insight}`
  ).join('\n') : 
  '- No recent CRM insights'
}

CRM RECOMMENDATIONS:
${crmContext.recommendations.length > 0 ? 
  crmContext.recommendations.map(rec => 
    `- ${rec.title || rec.recommendation_title}: ${rec.description || rec.details}`
  ).join('\n') : 
  '- No recent CRM recommendations'
}

CONVERSATION HISTORY:
${conversationHistory.slice(-6).map(msg => `${msg.role}: ${msg.content}`).join('\n')}

CAPABILITIES:
- Analyze Slack conversations and mentions
- Provide CRM workflow recommendations based on real data
- Suggest business intelligence insights from actual CRM patterns
- Help with task management and automation
- Competitive intelligence analysis
- Reference actual CRM insights and Slack activity

Respond as a knowledgeable business AI assistant. Reference the actual Slack and CRM data when relevant. Be conversational and helpful.`;

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
      
      // Add CRM contextual insights
      if (crmContext.connected) {
        if (crmContext.insights.length > 0) {
          contextualInsights += `\n\n🧠 **CRM Intelligence**: ${crmContext.insights.length} active insights from your CRM analysis.`;
        }
        
        if (crmContext.recommendations.length > 0) {
          const highPriorityRecs = crmContext.recommendations.filter(rec => rec.priority === 'high').length;
          if (highPriorityRecs > 0) {
            contextualInsights += `\n\n🎯 **CRM Recommendations**: ${highPriorityRecs} high-priority workflow optimizations available.`;
          }
        }
        
        if (crmContext.workflows > 0) {
          contextualInsights += `\n\n⚙️ **CRM Status**: ${crmContext.workflows} active workflows being monitored.`;
        }
      } else {
        contextualInsights += `\n\n📋 **CRM Integration**: Connect your CRM service to get real-time workflow insights and recommendations.`;
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
    collapseTopBar();
  });

  ipcMain.handle('copilot:close', () => {
    toggleOverlayVisibility();
  });

  ipcMain.handle('copilot:toggleAlwaysOnTop', () => {
    if (mainWindow) {
      const isAlwaysOnTop = mainWindow.isAlwaysOnTop();
      mainWindow.setAlwaysOnTop(!isAlwaysOnTop);
      return !isAlwaysOnTop;
    }
    return false;
  });

  // Top bar specific controls
  ipcMain.handle('topbar:toggle', () => {
    toggleTopBarExpansion();
  });

  ipcMain.handle('topbar:expand', () => {
    expandTopBar();
  });

  ipcMain.handle('topbar:collapse', () => {
    collapseTopBar();
  });

  ipcMain.handle('topbar:reposition', () => {
    positionOverlayOnCurrentScreen();
  });

  ipcMain.handle('topbar:resetPosition', () => {
    isManuallyPositioned = false;
    positionOverlayOnCurrentScreen();
    console.log('🔄 Reset to auto-positioning mode');
    return { success: true, message: 'Position reset to auto-center' };
  });

  ipcMain.handle('topbar:getPosition', () => {
    const bounds = mainWindow.getBounds();
    return {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      isManuallyPositioned
    };
  });

  ipcMain.handle('overlay:opacity', (event, opacity) => {
    if (mainWindow) {
      mainWindow.setOpacity(Math.max(0.3, Math.min(1.0, opacity)));
    }
  });

  // Window movement for dragging
  ipcMain.handle('copilot:moveWindow', (event, delta) => {
    if (mainWindow) {
      const currentBounds = mainWindow.getBounds();
      mainWindow.setPosition(
        currentBounds.x + delta.deltaX,
        currentBounds.y + delta.deltaY
      );
    }
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

  // CRM IPC handlers - Connected to real CRM integration service
  const CRM_SERVICE_URL = 'http://localhost:3002';
  
  ipcMain.handle('crm:getData', async () => {
    try {
      console.log('🔍 Getting CRM data from startup service...');
      
      // Get data from the startup service
      const crmData = crmStartupService.getCRMData();
      
      console.log('✅ CRM data retrieved:', {
        connected: crmData.connected,
        insights: crmData.insights?.length || 0,
        recommendations: crmData.recommendations?.length || 0,
        workflows: crmData.workflows?.length || 0,
        isLoading: crmData.isLoading
      });
      
      // Format data for desktop UI
      const formattedData = {
        success: crmData.connected || crmData.isLoading,
        isLoading: crmData.isLoading,
        loadingProgress: crmData.loadingProgress,
        data: {
          insights: (crmData.insights || []).map(insight => ({
            type: insight.type || (insight.priority === 'high' ? 'critical' : insight.priority === 'medium' ? 'warning' : 'positive'),
            title: insight.title || insight.pattern_name || 'CRM Insight',
            message: insight.message || insight.description || insight.insight || 'CRM workflow insight'
          })),
          recommendations: (crmData.recommendations || []).map(rec => ({
            title: rec.title || rec.recommendation_title || 'CRM Recommendation',
            description: rec.description || rec.details || 'Workflow optimization suggestion',
            priority: rec.priority || 'medium',
            impact: rec.impact || 'Workflow efficiency'
          })),
          workflows: crmData.workflows || [],
          summary: crmData.connected ? 'CRM system connected and ready' : 'CRM system initializing...',
          last_updated: crmData.last_updated || new Date().toISOString()
        }
      };
      
      return formattedData;
      
    } catch (error) {
      console.error('❌ Failed to get CRM data:', error.message);
      
      // Get fallback data from startup service
      const fallbackData = crmStartupService.getFallbackData();
      
      return {
        success: false,
        error: error.message,
        data: {
          insights: fallbackData.insights,
          recommendations: fallbackData.recommendations,
          workflows: fallbackData.workflows,
          summary: 'CRM service unavailable',
          last_updated: fallbackData.last_updated
        }
      };
    }
  });

  ipcMain.handle('crm:refresh', async () => {
    try {
      console.log('🔄 Refreshing CRM data...');
      
      const result = await crmStartupService.refresh();
      
      console.log('✅ CRM refresh completed:', {
        insights: result.insights?.length || 0,
        recommendations: result.recommendations?.length || 0
      });
      
      return {
        success: true,
        message: 'CRM data refreshed successfully',
        data: result
      };
      
    } catch (error) {
      console.error('❌ Failed to refresh CRM:', error.message);
      return {
        success: false,
        error: error.message,
        message: 'Failed to refresh CRM data. Check service connection.'
      };
    }
  });

  ipcMain.handle('crm:triggerAnalysis', async (event, orgId) => {
    try {
      console.log('🧠 Triggering intelligent CRM analysis for:', orgId);
      
      const fetch = require('node-fetch');
      const response = await fetch(`${CRM_SERVICE_URL}/analysis/intelligent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: orgId || 'heyjarvis_org',
          website: process.env.COMPANY_WEBSITE,
          include_company_intelligence: true
        })
      });
      
      if (!response.ok) {
        throw new Error(`Analysis service responded with ${response.status}`);
      }
      
      const result = await response.json();
      
      return {
        success: true,
        message: `Intelligent analysis triggered for ${orgId}`,
        analysis_id: result.analysis_id,
        estimated_completion: '2-3 minutes'
      };
      
    } catch (error) {
      console.error('❌ Failed to trigger analysis:', error.message);
      return {
        success: false,
        error: error.message,
        message: 'Failed to trigger analysis. Check CRM service connection.'
      };
    }
  });

  ipcMain.handle('crm:getRecommendations', async (event, orgId) => {
    try {
      const fetch = require('node-fetch');
      const response = await fetch(`${CRM_SERVICE_URL}/recommendations/${orgId || 'heyjarvis_org'}`);
      
      if (!response.ok) {
        throw new Error(`Recommendations service responded with ${response.status}`);
      }
      
      const recommendations = await response.json();
      
      return {
        success: true,
        recommendations: recommendations.map(rec => ({
          title: rec.title || rec.recommendation_title,
          description: rec.description || rec.details,
          priority: rec.priority || 'medium',
          category: rec.category || 'workflow',
          impact: rec.impact || 'efficiency'
        }))
      };
      
    } catch (error) {
      console.error('❌ Failed to get recommendations:', error.message);
      return {
        success: false,
        error: error.message,
        recommendations: []
      };
    }
  });

  ipcMain.handle('crm:getIntelligence', async (event, orgId) => {
    try {
      const fetch = require('node-fetch');
      const response = await fetch(`${CRM_SERVICE_URL}/intelligence/${orgId || 'heyjarvis_org'}`);
      
      if (!response.ok) {
        throw new Error(`Intelligence service responded with ${response.status}`);
      }
      
      const intelligence = await response.json();
      
      return {
        success: true,
        intelligence: {
          summary: intelligence.summary || 'CRM intelligence analysis completed',
          insights: intelligence.insights || [],
          patterns: intelligence.patterns || [],
          metrics: intelligence.metrics || {},
          last_updated: intelligence.timestamp || new Date().toISOString()
        }
      };
      
    } catch (error) {
      console.error('❌ Failed to get intelligence:', error.message);
      return {
        success: false,
        error: error.message,
        intelligence: {
          summary: 'Unable to retrieve CRM intelligence',
          insights: []
        }
      };
    }
  });

  ipcMain.handle('crm:healthCheck', async () => {
    try {
      const fetch = require('node-fetch');
      const response = await fetch(`${CRM_SERVICE_URL}/health`);
      
      if (!response.ok) {
        throw new Error(`Health check failed with ${response.status}`);
      }
      
      const health = await response.json();
      
      return {
        success: true,
        status: 'healthy',
        message: 'CRM service is operational',
        service_url: CRM_SERVICE_URL,
        version: health.version,
        uptime: health.uptime
      };
      
    } catch (error) {
      console.error('❌ CRM health check failed:', error.message);
      return {
        success: false,
        status: 'unhealthy',
        message: `CRM service unavailable: ${error.message}`,
        service_url: CRM_SERVICE_URL
      };
    }
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

// Setup CRM startup event handlers
function setupCRMStartupHandlers() {
  // Forward CRM loading events to renderer
  crmStartupService.on('loading:started', (data) => {
    console.log('🔄 CRM Loading started:', data.message);
    if (mainWindow) {
      mainWindow.webContents.send('crm:loading:started', data);
    }
  });

  crmStartupService.on('loading:progress', (data) => {
    console.log(`📊 CRM Loading progress: ${data.progress}% - ${data.message}`);
    if (mainWindow) {
      mainWindow.webContents.send('crm:loading:progress', data);
    }
  });

  crmStartupService.on('loading:completed', (data) => {
    console.log('✅ CRM Loading completed:', data.message);
    if (mainWindow) {
      mainWindow.webContents.send('crm:loading:completed', data);
    }
  });

  crmStartupService.on('loading:error', (data) => {
    console.log('❌ CRM Loading error:', data.message);
    if (mainWindow) {
      mainWindow.webContents.send('crm:loading:error', data);
    }
  });

  crmStartupService.on('data:updated', (data) => {
    console.log('📈 CRM Data updated - insights:', data.insights?.length || 0);
    if (mainWindow) {
      mainWindow.webContents.send('crm:data:updated', data);
    }
  });
}

// Start CRM loading process
async function startCRMLoading() {
  try {
    console.log('🚀 Starting CRM data loading...');
    await crmStartupService.initialize();
  } catch (error) {
    console.error('❌ CRM startup failed:', error.message);
  }
}

// This method will be called when Electron has finished initialization
if (app && typeof app.whenReady === 'function') {
  app.whenReady().then(() => {
    createWindow();
    initializeServices();
  });
} else {
  console.error('Electron app object is not available:', typeof app);
  // Try alternative initialization
  setTimeout(() => {
    try {
      const electron = require('electron');
      if (electron.app && typeof electron.app.whenReady === 'function') {
        electron.app.whenReady().then(() => {
          createWindow();
          initializeServices();
        });
      }
    } catch (error) {
      console.error('Failed to initialize Electron app:', error);
    }
  }, 1000);
}

// Prevent app from quitting when window is closed (persistent overlay)
app.on('window-all-closed', () => {
  // Don't quit the app on macOS - keep it running as persistent overlay
  if (process.platform !== 'darwin') {
    // On Windows/Linux, keep running but hide in tray
    console.log('🔄 Window closed but app remains running in system tray');
  }
});

// Handle app quit
app.on('before-quit', async () => {
  console.log('🛑 HeyJarvis shutting down...');
  
  // Stop CRM service
  if (crmStartupService) {
    await crmStartupService.stop();
  }
  
  // Clean up tray
  if (tray) {
    tray.destroy();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// ===== HIGHLIGHT OVERLAY SYSTEM =====

function createHighlightOverlay() {
  if (highlightOverlay) {
    console.log('🔄 Reusing existing highlight overlay');
    return highlightOverlay;
  }
  
  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.bounds;
  
  console.log(`📺 Creating overlay for screen: ${screenWidth}x${screenHeight}`);
  
  highlightOverlay = new BrowserWindow({
    width: screenWidth,
    height: screenHeight,
    x: 0,
    y: 0,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'bridge/highlight-preload.js')
    },
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    closable: false,
    focusable: false, // Don't steal focus
    show: false,
    titleBarStyle: 'hidden',
    type: 'panel'
  });
  
  // Load highlight overlay HTML
  const overlayPath = path.join(__dirname, 'renderer/highlight-overlay.html');
  console.log(`📄 Loading overlay HTML from: ${overlayPath}`);
  highlightOverlay.loadFile(overlayPath);
  
  // Debug: Log when overlay is ready
  highlightOverlay.webContents.once('did-finish-load', () => {
    console.log('✅ Highlight overlay HTML loaded successfully');
  });
  
  // Make it click-through by default, but we'll enable mouse events when highlights are shown
  highlightOverlay.setIgnoreMouseEvents(true, { forward: true });
  
  console.log('✅ Highlight overlay created');
  
  return highlightOverlay;
}

function showHighlights(highlights) {
  console.log('🎯 showHighlights called with', highlights.length, 'highlights');
  
  if (!highlightOverlay) {
    console.log('🏗️ Creating new highlight overlay...');
    createHighlightOverlay();
  }
  
  // Store highlights data
  activeHighlights = highlights;
  
  // Log first few highlights for debugging
  highlights.slice(0, 3).forEach((h, i) => {
    console.log(`📍 Highlight ${i}:`, {
      id: h.id,
      text: h.text?.substring(0, 30) + '...',
      x: h.x,
      y: h.y,
      width: h.width,
      height: h.height
    });
  });
  
  // Keep overlay click-through - let CSS handle selective clicking
  highlightOverlay.setIgnoreMouseEvents(true, { forward: true });
  console.log('🖱️ Overlay kept click-through, CSS handles selective clicking');
  
  // Wait for overlay to be ready before sending data
  if (highlightOverlay.webContents.isLoading()) {
    console.log('⏳ Overlay still loading, waiting...');
    highlightOverlay.webContents.once('did-finish-load', () => {
      console.log('✅ Overlay loaded, sending highlights...');
      sendHighlightsToOverlay(highlights);
    });
  } else {
    console.log('✅ Overlay ready, sending highlights immediately...');
    sendHighlightsToOverlay(highlights);
  }
  
  // Show overlay
  highlightOverlay.show();
  highlightOverlay.focus(); // Try to ensure it's on top
  
  console.log(`✅ Overlay shown with ${highlights.length} highlights`);
}

function sendHighlightsToOverlay(highlights) {
  // Send message to overlay to set up selective click handling
  highlightOverlay.webContents.send('setup-selective-clicks', highlights);
  console.log('📤 Sent setup-selective-clicks message');
  
  // Send highlights to overlay
  highlightOverlay.webContents.send('show-highlights', highlights);
  console.log('📤 Sent show-highlights message');
}

function hideHighlights() {
  if (highlightOverlay) {
    // Re-enable click-through when hiding highlights
    highlightOverlay.setIgnoreMouseEvents(true, { forward: true });
    highlightOverlay.hide();
    activeHighlights = [];
    console.log('🔄 Highlights hidden');
  }
}

function showHighlightExplanation(highlightId) {
  const highlight = activeHighlights.find(h => h.id === highlightId);
  if (highlight) {
    // Send explanation to main window chat
    mainWindow.webContents.send('show-explanation', {
      text: highlight.text,
      reason: highlight.reason,
      confidence: highlight.confidence
    });
  }
}

// ===== FACT CHECK IPC HANDLERS =====

// Screen capture handler
ipcMain.handle('fact-check:capture-screen', async () => {
  try {
    console.log('📸 Capturing screen for fact check');
    
    const { desktopCapturer, screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: {
        width: Math.min(primaryDisplay.size.width, 1920),
        height: Math.min(primaryDisplay.size.height, 1080)
      }
    });
    
    if (sources.length === 0) {
      throw new Error('No screen sources available');
    }
    
    const screenshot = sources[0].thumbnail.toPNG();
    
    console.log('✅ Screen captured successfully');
    
    return {
      success: true,
      image: screenshot.toString('base64'),
      dimensions: primaryDisplay.size
    };
    
  } catch (error) {
    console.error('❌ Screen capture failed:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
});

// OCR-based text extraction from screen using Tesseract.js
ipcMain.handle('fact-check:extract-text', async (event, imageBase64) => {
  try {
    console.log('🔍 Starting OCR text extraction from screen');
    
    let textBlocks = [];
    let allText = null;
    
    // Method 1: Use Tesseract.js for OCR if we have a screenshot
    if (imageBase64) {
      try {
        console.log('📸 Using OCR to extract text from screenshot');
        const Tesseract = require('tesseract.js');
        
        // Convert base64 to buffer
        const imageBuffer = Buffer.from(imageBase64, 'base64');
        
        // Perform OCR with word-level recognition to get positions
        const { data } = await Tesseract.recognize(imageBuffer, 'eng', {
          logger: m => {
            if (m.status === 'recognizing text') {
              console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
            }
          }
        });
        
        // Extract text and word positions safely
        const extractedText = data.text || '';
        console.log(`📝 OCR extracted ${extractedText.length} characters of text`);
        
        // Extract word positions from blocks structure
        const words = [];
        if (data.blocks && Array.isArray(data.blocks)) {
          data.blocks.forEach(block => {
            if (block.paragraphs) {
              block.paragraphs.forEach(para => {
                if (para.lines) {
                  para.lines.forEach(line => {
                    if (line.words) {
                      line.words.forEach(word => {
                        if (word.text && word.bbox) {
                          words.push({
                            text: word.text.trim(),
                            bbox: word.bbox,
                            confidence: word.confidence || 0
                          });
                        }
                      });
                    }
                  });
                }
              });
            }
          });
        }
        
        console.log(`📚 Extracted ${words.length} words from OCR blocks`);
        
        // Filter for words containing "jarvis" (case insensitive)
        const jarvisWords = words.filter(word => 
          word.text.toLowerCase().includes('jarvis') || 
          word.text.toLowerCase().includes('heyjarvis')
        );
        
        console.log(`🎯 Found ${jarvisWords.length} words containing "jarvis"`);
        
        // Convert OCR word positions to our text block format
        jarvisWords.forEach((word, index) => {
          textBlocks.push({
            text: word.text,
            x: word.bbox.x0,
            y: word.bbox.y0,
            width: word.bbox.x1 - word.bbox.x0,
            height: word.bbox.y1 - word.bbox.y0,
            confidence: word.confidence / 100 // Convert to 0-1 scale
          });
        });
        
        // If we found jarvis-related words, return them
        if (textBlocks.length > 0) {
          console.log(`✅ OCR found ${textBlocks.length} "jarvis" text blocks`);
          return {
            success: true,
            textBlocks: textBlocks,
            method: 'ocr'
          };
        }
        
        // If no jarvis words found, create blocks from all text for general analysis
        console.log('📄 No "jarvis" found, creating blocks from all OCR text');
        const allTextBlocks = [];
        
        // Group words into lines/sentences for better analysis
        const lines = data.lines || [];
        if (Array.isArray(lines)) {
          lines.forEach((line, index) => {
            if (line.text && line.text.trim().length > 10 && line.bbox) {
              allTextBlocks.push({
                text: line.text.trim(),
                x: line.bbox.x0,
                y: line.bbox.y0,
                width: line.bbox.x1 - line.bbox.x0,
                height: line.bbox.y1 - line.bbox.y0,
                confidence: (line.confidence || 0) / 100
              });
            }
          });
        }
        
        if (allTextBlocks.length > 0) {
          return {
            success: true,
            textBlocks: allTextBlocks.slice(0, 20), // Limit to first 20 blocks
            method: 'ocr-full'
          };
        }
        
      } catch (ocrError) {
        console.log('⚠️ OCR failed:', ocrError.message);
      }
    }
    
    // Method 2: Fallback to clipboard text
    try {
      const { clipboard } = require('electron');
      const clipboardText = clipboard.readText();
      if (clipboardText && clipboardText.length > 20) {
        console.log('📋 Using clipboard text content as fallback');
        
        // Create mock positioned text blocks from clipboard content
        const mockBlocks = createMockTextBlocks(clipboardText);
        return {
          success: true,
          textBlocks: mockBlocks,
          method: 'clipboard'
        };
      }
    } catch (clipboardError) {
      console.log('⚠️ Clipboard access failed:', clipboardError.message);
    }
    
    // Method 3: Try macOS accessibility API to read screen content
    if (!allText) {
      try {
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);
        
        // Get text from Chrome/Safari using AppleScript
        const browserScript = `
          tell application "System Events"
            set frontApp to name of first application process whose frontmost is true
          end tell
          
          if frontApp contains "Chrome" or frontApp contains "Safari" or frontApp contains "Firefox" then
            tell application frontApp
              try
                set pageText to do JavaScript "document.body.innerText" in active tab of front window
                return pageText
              on error
                return ""
              end try
            end tell
          else
            return ""
          end if
        `;
        
        const { stdout } = await execAsync(`osascript -e '${browserScript}'`);
        if (stdout && stdout.trim().length > 20) {
          console.log('🌐 Using browser content text');
          allText = stdout.trim();
        }
      } catch (browserError) {
        console.log('⚠️ Browser content extraction failed:', browserError.message);
      }
    }
    
    // If we got text, create smart positioned blocks
    if (allText && allText.length > 20) {
      textBlocks = createSmartTextBlocks(allText);
      console.log(`✅ Text extraction completed - created ${textBlocks.length} smart text blocks`);
      console.log('📍 Text blocks created:', textBlocks.length);
    } else {
      // Ultimate fallback - create demo blocks for testing
      console.log('⚠️ No text found, using demo content for testing');
      textBlocks = [
        {
          text: 'Revolutionary AI breakthrough increases productivity by 500%',
          x: 300, y: 200, width: 500, height: 30
        },
        {
          text: 'Scientists discover this one weird trick that doctors hate',
          x: 250, y: 280, width: 450, height: 30
        },
        {
          text: 'Exclusive: Company revenue jumps 1000% overnight',
          x: 350, y: 360, width: 400, height: 30
        }
      ];
      console.log('📍 Demo blocks created:', textBlocks.length);
    }
    
    return {
      success: true,
      textBlocks: textBlocks
    };
    
  } catch (error) {
    console.error('❌ Text extraction failed:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
});

// Helper function to create smart positioned text blocks based on typical app layouts
function createSmartTextBlocks(text) {
  const blocks = [];
  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.bounds;
  
  console.log(`📺 Screen dimensions: ${screenWidth}x${screenHeight}`);
  
  // Define common application layout areas
  const layoutAreas = [
    // Main content area (center-left, like editor or document)
    { x: Math.floor(screenWidth * 0.2), y: Math.floor(screenHeight * 0.15), width: Math.floor(screenWidth * 0.6), label: 'main-content' },
    // Secondary content (center-right)
    { x: Math.floor(screenWidth * 0.5), y: Math.floor(screenHeight * 0.25), width: Math.floor(screenWidth * 0.4), label: 'secondary-content' },
    // Header/title area
    { x: Math.floor(screenWidth * 0.1), y: Math.floor(screenHeight * 0.05), width: Math.floor(screenWidth * 0.8), label: 'header' },
    // Sidebar content
    { x: Math.floor(screenWidth * 0.05), y: Math.floor(screenWidth * 0.2), width: Math.floor(screenWidth * 0.25), label: 'sidebar' },
    // Footer/bottom area
    { x: Math.floor(screenWidth * 0.1), y: Math.floor(screenHeight * 0.8), width: Math.floor(screenWidth * 0.8), label: 'footer' }
  ];
  
  // Split text into sentences and paragraphs
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 15);
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 30);
  
  // Use paragraphs if available, otherwise sentences
  const textSegments = paragraphs.length > 0 ? paragraphs : sentences;
  
  textSegments.forEach((segment, index) => {
    const trimmed = segment.trim();
    if (trimmed.length > 15) {
      // Cycle through layout areas
      const area = layoutAreas[index % layoutAreas.length];
      
      // Calculate position within the area
      const rowInArea = Math.floor(index / layoutAreas.length);
      const yOffset = rowInArea * 50; // 50px between rows
      
      const finalY = area.y + yOffset;
      
      // Don't go below screen
      if (finalY < screenHeight - 100) {
        blocks.push({
          text: trimmed,
          x: area.x,
          y: finalY,
          width: Math.min(trimmed.length * 7, area.width - 20),
          height: 35,
          area: area.label
        });
        
        console.log(`📍 Created block in ${area.label}: "${trimmed.substring(0, 30)}..." at (${area.x}, ${finalY})`);
      }
    }
  });
  
  console.log(`✅ Created ${blocks.length} smart text blocks`);
  return blocks;
}

// AI analysis handler
ipcMain.handle('ai:simple-analyze', async (event, prompt) => {
  try {
    console.log('🤖 Starting AI analysis for fact check');
    
    // Use existing AI analyzer
    const AIAnalyzer = require('../core/signals/enrichment/ai-analyzer');
    const aiAnalyzer = new AIAnalyzer();
    
    const response = await aiAnalyzer.anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 500,
      temperature: 0.3,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });
    
    const result = response.content[0].text;
    
    console.log('✅ AI analysis completed');
    
    return result;
    
  } catch (error) {
    console.error('❌ AI analysis failed:', error.message);
    return 'AI analysis temporarily unavailable. Please try again later.';
  }
});

// Highlight overlay handlers
ipcMain.handle('highlights:show', (event, highlights) => {
  showHighlights(highlights);
  return { success: true };
});

ipcMain.handle('highlights:hide', () => {
  hideHighlights();
  return { success: true };
});

ipcMain.handle('highlights:explain', (event, highlightId) => {
  showHighlightExplanation(highlightId);
  return { success: true };
});

// Handle click forwarding (for now, just log it)
ipcMain.handle('highlights:forward-click', (event, x, y) => {
  console.log(`🖱️ Click forwarded at coordinates: ${x}, ${y}`);
  // In the future, we could simulate a click at these coordinates
  return { success: true };
});

// OCR-based fact checking - extract screen text and analyze for BS
ipcMain.handle('fact-check:analyze-screen', async () => {
  console.log('🔍 Starting fact-check analysis of screen content...');
  
  try {
    const { desktopCapturer, screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    const scaleFactor = primaryDisplay.scaleFactor || 1;
    const { width: screenWidth, height: screenHeight } = primaryDisplay.bounds;
    
    console.log(`📺 Screen: ${screenWidth}x${screenHeight} (scale: ${scaleFactor}x)`);
    
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: {
        width: screenWidth * scaleFactor,
        height: screenHeight * scaleFactor
      }
    });
    
    if (sources.length === 0) {
      throw new Error('No screen sources available');
    }
    
    const screenshot = sources[0].thumbnail.toPNG();
    const imageBuffer = Buffer.from(screenshot.toString('base64'), 'base64');
    const capturedWidth = sources[0].thumbnail.getSize().width;
    const capturedHeight = sources[0].thumbnail.getSize().height;
    
    console.log('📸 Screen captured, extracting text...');
    
    const scaleX = screenWidth / capturedWidth;
    const scaleY = screenHeight / capturedHeight;
    
    const { createWorker } = require('tesseract.js');
    
    const worker = await createWorker('eng', 1, {
      logger: m => {
        if (m.status === 'recognizing text') {
          console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
        }
      }
    });
    
    // Get both text AND word positions for highlighting suspicious content
    const result = await worker.recognize(imageBuffer);
    
    await worker.terminate();
    
    console.log('📋 OCR result structure:', {
      hasResult: !!result,
      hasData: !!result?.data,
      dataKeys: result?.data ? Object.keys(result.data) : [],
      hasBlocks: !!result?.data?.blocks,
      blocksType: typeof result?.data?.blocks,
      blocksLength: Array.isArray(result?.data?.blocks) ? result.data.blocks.length : 'not array'
    });
    
    const data = result.data;
    const extractedText = data.text || '';
    
    console.log(`📝 Extracted ${extractedText.length} characters of text`);
    
    if (!extractedText || extractedText.trim().length < 50) {
      throw new Error(`Not enough text found on screen. Got ${extractedText.length} characters.`);
    }
    
    console.log('Text preview:', extractedText.substring(0, 200));
    
    // Send to AI for fact-checking
    console.log('🤖 Analyzing text for misinformation...');
    
    const AIAnalyzer = require('../core/signals/enrichment/ai-analyzer');
    const aiAnalyzer = new AIAnalyzer();
    
    const factCheckPrompt = `Analyze this text for misinformation, clickbait, or suspicious claims. Identify specific phrases/sentences that are problematic and explain why.

TEXT:
${extractedText}

Respond with:
1. Overall assessment (legitimate/suspicious/misleading)
2. List of specific suspicious phrases/claims (if any)
3. Brief explanation of concerns

Be specific about which exact phrases raised red flags. Format suspicious phrases in quotes.`;

    const response = await aiAnalyzer.anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 800,
      temperature: 0.3,
      messages: [{ role: 'user', content: factCheckPrompt }]
    });
    
    const analysis = response.content[0].text;
    
    console.log('✅ AI analysis completed');
    console.log('Analysis preview:', analysis.substring(0, 200));
    
    // Extract suspicious phrases from AI response and create highlights
    const highlights = [];
    
    // Parse AI response for quoted suspicious phrases
    const quoteMatches = analysis.match(/"([^"]+)"/g);
    
    if (quoteMatches && data.blocks && Array.isArray(data.blocks)) {
      console.log(`🎯 Found ${quoteMatches.length} suspicious phrases to highlight`);
      
      // Extract all words with positions from blocks structure
      const words = [];
      
      // According to Tesseract.js docs, blocks contain paragraphs -> lines -> words
      data.blocks.forEach((block, blockIndex) => {
        console.log(`📦 Block ${blockIndex}:`, {
          hasParagraphs: !!block.paragraphs,
          paragraphsType: typeof block.paragraphs,
          paragraphsLength: Array.isArray(block.paragraphs) ? block.paragraphs.length : 'not array'
        });
        
        if (block.paragraphs && Array.isArray(block.paragraphs)) {
          block.paragraphs.forEach((para, paraIndex) => {
            console.log(`  📄 Paragraph ${paraIndex}:`, {
              hasLines: !!para.lines,
              linesType: typeof para.lines,
              linesLength: Array.isArray(para.lines) ? para.lines.length : 'not array'
            });
            
            if (para.lines && Array.isArray(para.lines)) {
              para.lines.forEach((line, lineIndex) => {
                console.log(`    📝 Line ${lineIndex}:`, {
                  hasWords: !!line.words,
                  wordsType: typeof line.words,
                  wordsLength: Array.isArray(line.words) ? line.words.length : 'not array'
                });
                
                if (line.words && Array.isArray(line.words)) {
                  line.words.forEach((word, wordIndex) => {
                    if (word.text && word.bbox) {
                      words.push({
                        text: word.text.trim().toLowerCase(),
                        bbox: word.bbox,
                        confidence: word.confidence || 0
                      });
                      
                      if (wordIndex < 3) { // Log first few words for debugging
                        console.log(`      🔤 Word ${wordIndex}: "${word.text}" at (${word.bbox.x0}, ${word.bbox.y0})`);
                      }
                    }
                  });
                }
              });
            }
          });
        }
      });
      
      console.log(`📚 Extracted ${words.length} total words from OCR`);
      
      // Fallback: If no words found from blocks, try parsing TSV data
      if (words.length === 0 && data.tsv) {
        console.log('⚠️ No words from blocks, trying TSV fallback...');
        console.log('TSV data type:', typeof data.tsv, 'length:', data.tsv.length);
        
        if (typeof data.tsv === 'string' && data.tsv.length > 0) {
          const tsvLines = data.tsv.split('\n').filter(line => line.trim());
          console.log(`📊 TSV has ${tsvLines.length} lines`);
          
          tsvLines.forEach((line, lineIndex) => {
            const parts = line.split('\t');
            if (parts.length >= 12 && parts[0] === '5') { // Level 5 = word level
              const left = parseInt(parts[6]);
              const top = parseInt(parts[7]);
              const width = parseInt(parts[8]);
              const height = parseInt(parts[9]);
              const confidence = parseInt(parts[10]);
              const text = parts[11];
              
              if (text && text.trim() && !isNaN(left) && !isNaN(top)) {
                words.push({
                  text: text.trim().toLowerCase(),
                  bbox: {
                    x0: left,
                    y0: top,
                    x1: left + width,
                    y1: top + height
                  },
                  confidence: confidence
                });
                
                if (lineIndex < 5) { // Log first few for debugging
                  console.log(`      📊 TSV Word: "${text}" at (${left}, ${top})`);
                }
              }
            }
          });
          
          console.log(`✅ TSV fallback extracted ${words.length} words`);
        }
      }
      
      // For each suspicious phrase, find matching words and create highlight
      quoteMatches.forEach((quotedPhrase, index) => {
        const phrase = quotedPhrase.replace(/"/g, '').toLowerCase();
        const phraseWords = phrase.split(/\s+/).filter(w => w.length > 2); // Only significant words
        
        console.log(`🔍 Searching for phrase: "${phrase}" (${phraseWords.length} words)`);
        
        // Find words that match this phrase
        phraseWords.forEach(searchWord => {
          const matchingWords = words.filter(w => 
            w.text.includes(searchWord) || searchWord.includes(w.text)
          );
          
          matchingWords.forEach((word, wordIndex) => {
            const screenX = Math.round(word.bbox.x0 * scaleX);
            const screenY = Math.round(word.bbox.y0 * scaleY);
            const screenW = Math.round((word.bbox.x1 - word.bbox.x0) * scaleX);
            const screenH = Math.round((word.bbox.y1 - word.bbox.y0) * scaleY);
            
            highlights.push({
              id: `suspicious-${index}-${wordIndex}`,
              text: word.text,
              reason: `Suspicious claim: "${phrase}"`,
              confidence: word.confidence / 100,
              x: screenX,
              y: screenY,
              width: Math.max(screenW, 50),
              height: Math.max(screenH, 20)
            });
          });
        });
      });
      
      console.log(`✨ Created ${highlights.length} highlights for suspicious content`);
      
      if (highlights.length > 0) {
        showHighlights(highlights);
      }
    }
    
    return {
      success: true,
      extractedText: extractedText.substring(0, 500) + (extractedText.length > 500 ? '...' : ''),
      analysis: analysis,
      highlightsCreated: highlights.length,
      textLength: extractedText.length
    };
    
  } catch (error) {
    console.error('❌ Fact-check failed:', error);
    return {
      success: false,
      error: error.message,
      analysis: `Error analyzing screen: ${error.message}`
    };
  }
});

// Legacy handler for backwards compatibility
ipcMain.handle('highlights:find-heyjarvis', async () => {
  console.log('⚠️ Legacy handler called - redirecting to new fact-check system');
  // Just return a simple success for now to prevent errors
  return { 
    success: true, 
    found: 0, 
    method: 'legacy-redirect',
    message: 'Please use the new fact-check system'
  };
});

// Calibration mode - creates a grid to help fine-tune OCR coordinate mapping
ipcMain.handle('highlights:calibrate', async () => {
  console.log('🎯 Starting coordinate calibration mode...');
  
  try {
    const { screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.bounds;
    
    // Create a calibration grid with known coordinates
    const calibrationPoints = [];
    
    // Create a 3x3 grid of calibration points
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const x = Math.round((screenWidth / 4) * (col + 1));
        const y = Math.round((screenHeight / 4) * (row + 1));
        
        calibrationPoints.push({
          id: `calibration-${row}-${col}`,
          text: `CAL(${x},${y})`,
          reason: `Calibration point at exact coordinates (${x}, ${y})`,
          confidence: 1.0,
          x: x,
          y: y,
          width: 120,
          height: 30,
          debugColor: 'lime' // Use lime color for calibration points
        });
      }
    }
    
    // Add corner markers
    const corners = [
      { x: 50, y: 50, label: 'TOP-LEFT' },
      { x: screenWidth - 150, y: 50, label: 'TOP-RIGHT' },
      { x: 50, y: screenHeight - 80, label: 'BOTTOM-LEFT' },
      { x: screenWidth - 150, y: screenHeight - 80, label: 'BOTTOM-RIGHT' }
    ];
    
    corners.forEach((corner, index) => {
      calibrationPoints.push({
        id: `corner-${index}`,
        text: corner.label,
        reason: `Corner marker at (${corner.x}, ${corner.y})`,
        confidence: 1.0,
        x: corner.x,
        y: corner.y,
        width: 100,
        height: 25,
        debugColor: 'cyan'
      });
    });
    
    console.log(`🎯 Created ${calibrationPoints.length} calibration points`);
    showHighlights(calibrationPoints);
    
    return { 
      success: true, 
      found: calibrationPoints.length, 
      method: 'calibration',
      screenDimensions: { width: screenWidth, height: screenHeight }
    };
    
  } catch (error) {
    console.error('❌ Calibration failed:', error);
    return { success: false, error: error.message };
  }
});

// Test function to highlight "heyjarvis" on Cursor screen using real text detection
ipcMain.handle('highlights:test', async () => {
  console.log('🧪 Testing highlight overlay - searching for actual "heyjarvis" text positions');
  
  try {
    // Use AppleScript to find text positions in the frontmost application
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    // First try to capture screen and use simple text search
    console.log('🔍 Attempting screen capture for text detection...');
    
    const { desktopCapturer, screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: {
          width: primaryDisplay.size.width,
          height: primaryDisplay.size.height
        }
      });
      
      if (sources.length > 0) {
        console.log('📸 Screen captured, attempting text search...');
        // For now, we'll use the accessibility API as fallback
      }
    } catch (captureError) {
      console.log('⚠️ Screen capture failed:', captureError.message);
    }
    
    // Get the frontmost application and search for text
    const script = `
      tell application "System Events"
        set frontApp to name of first application process whose frontmost is true
        log "Searching in application: " & frontApp
        tell application process frontApp
          try
            -- Try multiple approaches to find text
            set allTextElements to {}
            
            -- Method 1: Search for text fields and static text
            try
              set textFields to every text field
              set staticTexts to every static text
              set allTextElements to textFields & staticTexts
            end try
            
            -- Method 2: Search all UI elements recursively
            try
              set allElements to every UI element
              set allTextElements to allTextElements & allElements
            end try
            
            set results to {}
            set searchTerms to {"heyjarvis", "HeyJarvis", "jarvis", "Jarvis", "JARVIS"}
            
            repeat with textElement in allTextElements
              try
                set elementValue to value of textElement
                if elementValue is not missing value and elementValue is not "" then
                  repeat with searchTerm in searchTerms
                    if elementValue contains searchTerm then
                      set elementPosition to position of textElement
                      set elementSize to size of textElement
                      set end of results to {elementValue, elementPosition, elementSize, searchTerm}
                      exit repeat
                    end if
                  end repeat
                end if
              end try
            end repeat
            
            log "Found " & (count of results) & " matching elements"
            return results
          on error errMsg
            log "Error searching for text: " & errMsg
            return {}
          end try
        end tell
      end tell
    `;
    
    const { stdout } = await execAsync(`osascript -e '${script}'`);
    console.log('🔍 AppleScript result:', stdout);
    
    // Parse the results and create highlights
    const testHighlights = [];
    
    // If we found actual text positions, use them
    if (stdout && stdout.trim().length > 0) {
      // Parse AppleScript output (this is a simplified parser)
      const lines = stdout.split('\n').filter(line => line.trim());
      lines.forEach((line, index) => {
        if (line.includes('jarvis')) {
          testHighlights.push({
            id: `found-heyjarvis-${index}`,
            text: 'heyjarvis (found)',
            reason: `Found actual "heyjarvis" text in application`,
            confidence: 0.95,
            x: 100 + (index * 150), // Spread them out horizontally
            y: 200 + (index * 50),   // Spread them out vertically
            width: 140,
            height: 30
          });
        }
      });
    }
    
    // Fallback: Create highlights at common Cursor locations
    if (testHighlights.length === 0) {
      console.log('📍 No text found via accessibility, using Cursor-specific positions');
      
      // Get screen dimensions for better positioning
      const { screen } = require('electron');
      const primaryDisplay = screen.getPrimaryDisplay();
      const { width: screenWidth, height: screenHeight } = primaryDisplay.bounds;
      
      console.log(`📺 Screen dimensions: ${screenWidth}x${screenHeight}`);
      
      // Create a grid of test highlights to help debug positioning
      const debugPositions = [
        // Corner markers
        { x: 50, y: 50, label: 'Top-left corner', color: 'red' },
        { x: screenWidth - 200, y: 50, label: 'Top-right corner', color: 'blue' },
        { x: 50, y: screenHeight - 100, label: 'Bottom-left corner', color: 'green' },
        { x: screenWidth - 200, y: screenHeight - 100, label: 'Bottom-right corner', color: 'purple' },
        
        // Center markers
        { x: screenWidth / 2 - 100, y: 100, label: 'Top center', color: 'orange' },
        { x: screenWidth / 2 - 100, y: screenHeight / 2, label: 'Screen center', color: 'yellow' },
        { x: screenWidth / 2 - 100, y: screenHeight - 150, label: 'Bottom center', color: 'pink' },
        
        // Common Cursor areas (updated for better detection)
        { x: 100, y: screenHeight - 200, label: 'Terminal area', color: 'cyan' },
        { x: 50, y: 150, label: 'File explorer', color: 'lime' },
        { x: screenWidth / 3, y: 80, label: 'Tab area', color: 'magenta' },
        { x: screenWidth / 2, y: 200, label: 'Main editor', color: 'teal' },
      ];
      
      debugPositions.forEach((pos, index) => {
        testHighlights.push({
          id: `debug-pos-${index}`,
          text: `DEBUG: ${pos.label}`,
          reason: `Debug highlight at ${pos.label} (${pos.x}, ${pos.y}) - Screen: ${screenWidth}x${screenHeight}`,
          confidence: 0.9,
          x: pos.x,
          y: pos.y,
          width: 200,
          height: 40,
          debugColor: pos.color
        });
      });
      
      console.log(`🎯 Created ${debugPositions.length} debug highlights across screen`);
    }
    
    console.log(`🎯 Created ${testHighlights.length} test highlights`);
    showHighlights(testHighlights);
    return { success: true, found: testHighlights.length };
    
  } catch (error) {
    console.error('❌ Test highlight error:', error);
    
    // Ultimate fallback - single obvious highlight
    const fallbackHighlight = [{
      id: 'fallback-test',
      text: 'TEST HIGHLIGHT',
      reason: 'Fallback test highlight - accessibility search failed',
      confidence: 0.5,
      x: 200,
      y: 200,
      width: 200,
      height: 40
    }];
    
    showHighlights(fallbackHighlight);
    return { success: false, error: error.message };
  }
});

// Helper function to create mock text blocks from clipboard content
function createMockTextBlocks(text) {
  const blocks = [];
  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.bounds;
  
  // Split into sentences and paragraphs
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
  
  // Common content area (center 70% of screen, avoiding edges)
  const contentStartX = Math.floor(screenWidth * 0.15);
  const contentEndX = Math.floor(screenWidth * 0.85);
  const contentStartY = Math.floor(screenHeight * 0.15);
  
  sentences.forEach((sentence, index) => {
    const trimmed = sentence.trim();
    if (trimmed.length > 10) {
      // Distribute blocks across typical content areas
      const row = Math.floor(index / 2);
      const col = index % 2;
      
      blocks.push({
        text: trimmed,
        x: contentStartX + (col * Math.floor((contentEndX - contentStartX) / 2)),
        y: contentStartY + (row * 60), // 60px between rows
        width: Math.min(trimmed.length * 7, Math.floor((contentEndX - contentStartX) / 2) - 20),
        height: 40,
        confidence: 0.8
      });
    }
  });
  
  return blocks;
}

console.log('✅ Fact check IPC handlers registered');
console.log('✅ Highlight overlay handlers registered');