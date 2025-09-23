/**
 * Copilot Overlay - Transparent AI assistant that lives on your screen
 * 
 * Features:
 * 1. Transparent, always-on-top window
 * 2. Conversational AI interface with Claude
 * 3. Contextual competitive intelligence
 * 4. Draggable, resizable, and minimizable
 * 5. Smart positioning and auto-hide
 */

const { BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');

class CopilotOverlay {
  constructor(appLifecycle) {
    this.appLifecycle = appLifecycle;
    this.logger = appLifecycle.getLogger();
    this.store = appLifecycle.getStore();
    
    this.overlayWindow = null;
    this.isVisible = false;
    this.isMinimized = false;
    this.isDragging = false;
    
    // Default overlay settings
    this.settings = {
      width: 350,
      height: 500,
      opacity: 0.95,
      alwaysOnTop: true,
      position: 'top-right', // top-right, top-left, bottom-right, bottom-left, center
      autoHide: false,
      hideOnBlur: false,
      ...this.store.get('copilotSettings', {})
    };
    
    this.setupIPCHandlers();
  }
  
  /**
   * Create and show the copilot overlay
   */
  async createOverlay() {
    if (this.overlayWindow) {
      this.showOverlay();
      return;
    }
    
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
    
    // Calculate position based on settings
    const position = this.calculatePosition(screenWidth, screenHeight);
    
    this.overlayWindow = new BrowserWindow({
      width: this.settings.width,
      height: this.settings.height,
      x: position.x,
      y: position.y,
      
      // Transparency and overlay settings
      transparent: true,
      frame: false,
      alwaysOnTop: this.settings.alwaysOnTop,
      skipTaskbar: true,
      resizable: true,
      minimizable: false,
      maximizable: false,
      closable: true,
      
      // Window behavior
      show: false,
      opacity: this.settings.opacity,
      
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        preload: path.join(__dirname, '../bridge/copilot-preload.js'),
        backgroundThrottling: false // Keep AI responsive
      }
    });
    
    // Load the copilot UI
    const copilotPath = this.appLifecycle.isDevelopment 
      ? 'http://localhost:3001/copilot.html'
      : `file://${path.join(__dirname, '../renderer/dist/copilot.html')}`;
    
    await this.overlayWindow.loadURL(copilotPath);
    
    this.setupWindowEvents();
    this.setupAutoHide();
    
    this.logger.info('Copilot overlay created', { 
      position, 
      size: { width: this.settings.width, height: this.settings.height }
    });
  }
  
  /**
   * Calculate window position based on settings
   */
  calculatePosition(screenWidth, screenHeight) {
    const margin = 20;
    let x, y;
    
    switch (this.settings.position) {
      case 'top-left':
        x = margin;
        y = margin;
        break;
      case 'top-right':
        x = screenWidth - this.settings.width - margin;
        y = margin;
        break;
      case 'bottom-left':
        x = margin;
        y = screenHeight - this.settings.height - margin;
        break;
      case 'bottom-right':
        x = screenWidth - this.settings.width - margin;
        y = screenHeight - this.settings.height - margin;
        break;
      case 'center':
        x = (screenWidth - this.settings.width) / 2;
        y = (screenHeight - this.settings.height) / 2;
        break;
      default:
        // Default to top-right
        x = screenWidth - this.settings.width - margin;
        y = margin;
    }
    
    return { x: Math.round(x), y: Math.round(y) };
  }
  
  /**
   * Setup window event handlers
   */
  setupWindowEvents() {
    // Show window when ready
    this.overlayWindow.once('ready-to-show', () => {
      this.showOverlay();
      
      if (this.appLifecycle.isDevelopment) {
        // this.overlayWindow.webContents.openDevTools({ mode: 'detach' });
      }
    });
    
    // Handle window close
    this.overlayWindow.on('close', (event) => {
      event.preventDefault();
      this.hideOverlay();
    });
    
    // Handle window closed
    this.overlayWindow.on('closed', () => {
      this.overlayWindow = null;
      this.isVisible = false;
    });
    
    // Handle window blur (for auto-hide)
    this.overlayWindow.on('blur', () => {
      if (this.settings.hideOnBlur && !this.isDragging) {
        setTimeout(() => {
          if (!this.overlayWindow.isFocused()) {
            this.hideOverlay();
          }
        }, 1000);
      }
    });
    
    // Handle window resize
    this.overlayWindow.on('resize', () => {
      const bounds = this.overlayWindow.getBounds();
      this.settings.width = bounds.width;
      this.settings.height = bounds.height;
      this.saveSettings();
    });
    
    // Handle window move
    this.overlayWindow.on('move', () => {
      this.saveSettings();
    });
    
    // Prevent window from being hidden behind other apps
    this.overlayWindow.on('focus', () => {
      if (this.settings.alwaysOnTop) {
        this.overlayWindow.setAlwaysOnTop(true);
      }
    });
  }
  
  /**
   * Setup auto-hide behavior
   */
  setupAutoHide() {
    if (!this.settings.autoHide) return;
    
    let hideTimeout;
    
    const resetHideTimer = () => {
      if (hideTimeout) {
        clearTimeout(hideTimeout);
      }
      
      hideTimeout = setTimeout(() => {
        if (this.isVisible && !this.overlayWindow.isFocused()) {
          this.minimizeOverlay();
        }
      }, 10000); // Hide after 10 seconds of inactivity
    };
    
    // Reset timer on mouse enter
    this.overlayWindow.on('enter-full-screen', resetHideTimer);
    this.overlayWindow.on('focus', resetHideTimer);
    
    // Clear timer on mouse leave
    this.overlayWindow.on('blur', () => {
      if (hideTimeout) {
        clearTimeout(hideTimeout);
      }
    });
  }
  
  /**
   * Setup IPC handlers for copilot communication
   */
  setupIPCHandlers() {
    // Handle copilot messages
    ipcMain.handle('copilot:sendMessage', async (event, message) => {
      try {
        return await this.processMessage(message);
      } catch (error) {
        this.logger.error('Copilot message processing failed', { error: error.message });
        return {
          type: 'error',
          content: 'Sorry, I encountered an error processing your request.'
        };
      }
    });
    
    // Handle settings updates
    ipcMain.handle('copilot:updateSettings', async (event, newSettings) => {
      this.settings = { ...this.settings, ...newSettings };
      this.saveSettings();
      this.applySettings();
      return this.settings;
    });
    
    // Handle window actions
    ipcMain.handle('copilot:minimize', () => this.minimizeOverlay());
    ipcMain.handle('copilot:close', () => this.hideOverlay());
    ipcMain.handle('copilot:toggleAlwaysOnTop', () => this.toggleAlwaysOnTop());
    
    // Handle drag operations
    ipcMain.handle('copilot:startDrag', () => {
      this.isDragging = true;
    });
    
    ipcMain.handle('copilot:endDrag', () => {
      this.isDragging = false;
    });
    
    // Handle window movement
    ipcMain.handle('copilot:moveWindow', (event, { deltaX, deltaY }) => {
      if (this.overlayWindow && this.isDragging) {
        const bounds = this.overlayWindow.getBounds();
        this.overlayWindow.setPosition(bounds.x + deltaX, bounds.y + deltaY);
      }
    });
  }
  
  /**
   * Process user message with AI
   */
  async processMessage(message) {
    this.logger.info('Processing copilot message', { message: message.substring(0, 100) });
    
    try {
      // Import AI analyzer
      const AIAnalyzer = require('../../core/signals/enrichment/ai-analyzer');
      const aiAnalyzer = new AIAnalyzer();
      
      // Create context for the AI
      const context = await this.gatherContext();
      
      // Build prompt for conversational AI
      const prompt = `You are HeyJarvis, an AI copilot for competitive intelligence. You help users understand their competitive landscape and make strategic decisions.

Current Context:
${JSON.stringify(context, null, 2)}

User Message: ${message}

Respond as a helpful, knowledgeable assistant. Be concise but informative. If the user is asking about competitors, market trends, or business intelligence, provide actionable insights.`;

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
      this.logger.error('AI processing failed', { error: error.message });
      
      // Fallback response
      return {
        type: 'message',
        content: "I'm here to help with competitive intelligence insights. What would you like to know about your market or competitors?",
        timestamp: new Date().toISOString()
      };
    }
  }
  
  /**
   * Gather current context for AI
   */
  async gatherContext() {
    const context = {
      timestamp: new Date().toISOString(),
      user: {
        role: 'product_manager', // Could be fetched from user settings
        focus_areas: ['competitive intelligence', 'market analysis']
      },
      recent_activity: 'Monitoring competitive signals',
      system_status: 'Active'
    };
    
    // TODO: Add recent signals, current alerts, etc.
    return context;
  }
  
  /**
   * Show the overlay
   */
  showOverlay() {
    if (!this.overlayWindow) {
      this.createOverlay();
      return;
    }
    
    this.overlayWindow.show();
    this.overlayWindow.focus();
    this.isVisible = true;
    this.isMinimized = false;
    
    this.logger.debug('Copilot overlay shown');
  }
  
  /**
   * Hide the overlay
   */
  hideOverlay() {
    if (this.overlayWindow) {
      this.overlayWindow.hide();
    }
    this.isVisible = false;
    this.isMinimized = false;
    
    this.logger.debug('Copilot overlay hidden');
  }
  
  /**
   * Minimize overlay to a small widget
   */
  minimizeOverlay() {
    if (!this.overlayWindow) return;
    
    if (this.isMinimized) {
      // Restore
      this.overlayWindow.setSize(this.settings.width, this.settings.height);
      this.isMinimized = false;
    } else {
      // Minimize to small widget
      this.overlayWindow.setSize(60, 60);
      this.isMinimized = true;
    }
    
    this.logger.debug('Copilot overlay minimized', { isMinimized: this.isMinimized });
  }
  
  /**
   * Toggle always on top
   */
  toggleAlwaysOnTop() {
    this.settings.alwaysOnTop = !this.settings.alwaysOnTop;
    
    if (this.overlayWindow) {
      this.overlayWindow.setAlwaysOnTop(this.settings.alwaysOnTop);
    }
    
    this.saveSettings();
    this.logger.debug('Copilot always on top toggled', { alwaysOnTop: this.settings.alwaysOnTop });
  }
  
  /**
   * Apply current settings to window
   */
  applySettings() {
    if (!this.overlayWindow) return;
    
    this.overlayWindow.setOpacity(this.settings.opacity);
    this.overlayWindow.setAlwaysOnTop(this.settings.alwaysOnTop);
    
    // Reposition if needed
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
    const position = this.calculatePosition(screenWidth, screenHeight);
    
    this.overlayWindow.setPosition(position.x, position.y);
  }
  
  /**
   * Save settings to store
   */
  saveSettings() {
    this.store.set('copilotSettings', this.settings);
  }
  
  /**
   * Toggle overlay visibility
   */
  toggle() {
    if (this.isVisible) {
      this.hideOverlay();
    } else {
      this.showOverlay();
    }
  }
  
  /**
   * Destroy the overlay
   */
  destroy() {
    if (this.overlayWindow) {
      this.overlayWindow.destroy();
      this.overlayWindow = null;
    }
    this.isVisible = false;
    this.isMinimized = false;
  }
  
  /**
   * Get overlay status
   */
  getStatus() {
    return {
      isVisible: this.isVisible,
      isMinimized: this.isMinimized,
      settings: this.settings,
      windowExists: !!this.overlayWindow
    };
  }
}

module.exports = CopilotOverlay;
