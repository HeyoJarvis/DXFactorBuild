/**
 * Simple Electron Main Entry Point
 * Loads the copilot-enhanced.html directly without webpack
 */

const { app, BrowserWindow, ipcMain, Tray, Menu } = require('electron');
const path = require('path');
const SlackService = require('./main/slack-service');
const CRMStartupService = require('./main/crm-startup-service');

let mainWindow;
let tray;
let slackService;
let crmStartupService;
let conversationHistory = []; // Store conversation history
let lastSlackContext = null; // Cache Slack context
let isExpanded = false; // Track if top bar is expanded
let isManuallyPositioned = false; // Track if user has manually moved the bar

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
    console.log('🖥️ Display metrics changed');
    setTimeout(positionOverlayOnCurrentScreen, 500);
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
app.whenReady().then(() => {
  createWindow();
  initializeServices();
});

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

// OCR text extraction handler (placeholder for now)
ipcMain.handle('fact-check:extract-text', async (event, imageBase64) => {
  try {
    console.log('🔍 Starting OCR text extraction (placeholder)');
    
    // Simulate OCR processing time
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // For MVP, return a placeholder - you can integrate real OCR later
    const mockText = 'OCR text extraction not yet implemented. Using clipboard fallback.';
    
    console.log('✅ OCR extraction completed (mock)');
    
    return {
      success: true,
      text: mockText
    };
    
  } catch (error) {
    console.error('❌ OCR extraction failed:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
});

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

console.log('✅ Fact check IPC handlers registered');