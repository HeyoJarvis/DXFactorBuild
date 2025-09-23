/**
 * System Tray Manager - Manages system tray icon and menu for quick access
 * 
 * Features:
 * 1. System tray icon with status indicators
 * 2. Context menu with quick actions
 * 3. Signal notifications and counters
 * 4. Quick settings and controls
 * 5. Cross-platform compatibility
 */

const { Tray, Menu, nativeImage, shell } = require('electron');
const path = require('path');

class TrayManager {
  constructor(appLifecycle) {
    this.appLifecycle = appLifecycle;
    this.logger = appLifecycle.getLogger();
    this.store = appLifecycle.getStore();
    
    this.tray = null;
    this.contextMenu = null;
    
    // Tray state
    this.unreadCount = 0;
    this.isOnline = true;
    this.isPaused = false;
    this.lastSignalTime = null;
    
    // Icon paths
    this.iconPath = path.join(__dirname, '../assets/tray');
    this.icons = {
      normal: this.createIcon('tray-icon.png'),
      unread: this.createIcon('tray-icon-unread.png'),
      offline: this.createIcon('tray-icon-offline.png'),
      paused: this.createIcon('tray-icon-paused.png')
    };
  }
  
  /**
   * Initialize system tray
   */
  async initialize() {
    try {
      // Create tray icon
      this.tray = new Tray(this.icons.normal);
      
      // Set tooltip
      this.updateTooltip();
      
      // Create context menu
      this.createContextMenu();
      
      // Set up event handlers
      this.setupEventHandlers();
      
      this.logger.info('System tray initialized');
      
    } catch (error) {
      this.logger.error('Failed to initialize system tray', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Create tray icon from file
   */
  createIcon(filename) {
    const iconPath = path.join(this.iconPath, filename);
    
    // Create different sized icons for different platforms
    const icon = nativeImage.createFromPath(iconPath);
    
    if (process.platform === 'darwin') {
      icon.setTemplateImage(true);
    }
    
    return icon;
  }
  
  /**
   * Setup tray event handlers
   */
  setupEventHandlers() {
    // Click handlers
    this.tray.on('click', () => {
      this.appLifecycle.toggleMainWindow();
    });
    
    this.tray.on('right-click', () => {
      this.tray.popUpContextMenu(this.contextMenu);
    });
    
    this.tray.on('double-click', () => {
      this.appLifecycle.showMainWindow();
    });
    
    // Balloon click (Windows)
    this.tray.on('balloon-click', () => {
      this.appLifecycle.showMainWindow();
    });
  }
  
  /**
   * Create context menu
   */
  createContextMenu() {
    const template = [
      {
        label: 'HeyJarvis',
        type: 'normal',
        enabled: false
      },
      {
        type: 'separator'
      },
      {
        label: `Unread Signals: ${this.unreadCount}`,
        type: 'normal',
        enabled: false
      },
      {
        label: this.getStatusText(),
        type: 'normal',
        enabled: false
      },
      {
        type: 'separator'
      },
      {
        label: 'Show Dashboard',
        type: 'normal',
        click: () => this.appLifecycle.showMainWindow()
      },
      {
        label: 'Toggle AI Copilot',
        type: 'normal',
        click: () => this.appLifecycle.copilotOverlay.toggle()
      },
      {
        label: 'Quick Actions',
        type: 'submenu',
        submenu: [
          {
            label: this.isPaused ? 'Resume Monitoring' : 'Pause for 1 hour',
            type: 'normal',
            click: () => this.togglePause()
          },
          {
            label: 'Mark All Read',
            type: 'normal',
            click: () => this.markAllRead(),
            enabled: this.unreadCount > 0
          },
          {
            type: 'separator'
          },
          {
            label: 'Check for Signals Now',
            type: 'normal',
            click: () => this.triggerManualCheck()
          }
        ]
      },
      {
        label: 'Settings',
        type: 'submenu',
        submenu: [
          {
            label: 'Preferences',
            type: 'normal',
            click: () => this.openPreferences()
          },
          {
            label: 'Notification Settings',
            type: 'normal',
            click: () => this.openNotificationSettings()
          },
          {
            type: 'separator'
          },
          {
            label: 'Launch at Startup',
            type: 'checkbox',
            checked: this.store.get('launchAtStartup', false),
            click: (menuItem) => this.toggleLaunchAtStartup(menuItem.checked)
          },
          {
            label: 'Show Notifications',
            type: 'checkbox',
            checked: this.store.get('enableNotifications', true),
            click: (menuItem) => this.toggleNotifications(menuItem.checked)
          }
        ]
      },
      {
        type: 'separator'
      },
      {
        label: 'Help & Support',
        type: 'submenu',
        submenu: [
          {
            label: 'Open Dashboard',
            type: 'normal',
            click: () => shell.openExternal(process.env.DASHBOARD_URL || 'https://app.heyjarvis.ai')
          },
          {
            label: 'Documentation',
            type: 'normal',
            click: () => shell.openExternal('https://docs.heyjarvis.ai')
          },
          {
            label: 'Report Issue',
            type: 'normal',
            click: () => shell.openExternal('https://github.com/heyjarvis/desktop/issues')
          },
          {
            type: 'separator'
          },
          {
            label: 'About HeyJarvis',
            type: 'normal',
            click: () => this.showAbout()
          }
        ]
      },
      {
        type: 'separator'
      },
      {
        label: 'Quit HeyJarvis',
        type: 'normal',
        click: () => this.appLifecycle.quit(),
        accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q'
      }
    ];
    
    this.contextMenu = Menu.buildFromTemplate(template);
    this.tray.setContextMenu(this.contextMenu);
  }
  
  /**
   * Update tray icon based on current state
   */
  updateIcon() {
    if (!this.tray) return;
    
    let icon;
    
    if (!this.isOnline) {
      icon = this.icons.offline;
    } else if (this.isPaused) {
      icon = this.icons.paused;
    } else if (this.unreadCount > 0) {
      icon = this.icons.unread;
    } else {
      icon = this.icons.normal;
    }
    
    this.tray.setImage(icon);
  }
  
  /**
   * Update tray tooltip
   */
  updateTooltip() {
    if (!this.tray) return;
    
    let tooltip = 'HeyJarvis - Competitive Intelligence';
    
    if (!this.isOnline) {
      tooltip += ' (Offline)';
    } else if (this.isPaused) {
      tooltip += ' (Paused)';
    } else if (this.unreadCount > 0) {
      tooltip += ` (${this.unreadCount} unread)`;
    }
    
    if (this.lastSignalTime) {
      const timeAgo = this.getTimeAgo(this.lastSignalTime);
      tooltip += `\nLast signal: ${timeAgo}`;
    }
    
    this.tray.setToolTip(tooltip);
  }
  
  /**
   * Update unread count
   */
  updateUnreadCount(count) {
    const previousCount = this.unreadCount;
    this.unreadCount = Math.max(0, count);
    
    // Update UI
    this.updateIcon();
    this.updateTooltip();
    this.createContextMenu(); // Refresh menu with new count
    
    // Show notification for new signals (if enabled)
    if (this.unreadCount > previousCount && this.store.get('enableNotifications', true)) {
      const newSignals = this.unreadCount - previousCount;
      this.showSignalNotification(newSignals);
    }
    
    this.logger.debug('Unread count updated', { 
      previous: previousCount, 
      current: this.unreadCount 
    });
  }
  
  /**
   * Update online status
   */
  updateOnlineStatus(isOnline) {
    this.isOnline = isOnline;
    this.updateIcon();
    this.updateTooltip();
    this.createContextMenu();
    
    this.logger.info('Online status updated', { isOnline });
  }
  
  /**
   * Update paused status
   */
  updatePausedStatus(isPaused) {
    this.isPaused = isPaused;
    this.updateIcon();
    this.updateTooltip();
    this.createContextMenu();
    
    this.logger.info('Paused status updated', { isPaused });
  }
  
  /**
   * Update last signal time
   */
  updateLastSignalTime(timestamp) {
    this.lastSignalTime = timestamp;
    this.updateTooltip();
  }
  
  /**
   * Show notification for new signals
   */
  showSignalNotification(count) {
    if (!this.tray) return;
    
    const title = count === 1 ? 'New Signal' : `${count} New Signals`;
    const content = count === 1 
      ? 'You have a new competitive intelligence signal'
      : `You have ${count} new competitive intelligence signals`;
    
    // Use different notification methods based on platform
    if (process.platform === 'win32') {
      this.tray.displayBalloon({
        icon: this.icons.unread,
        title,
        content
      });
    } else {
      // For macOS and Linux, we'll use the notification engine
      this.appLifecycle.notificationEngine?.showSignalNotification(title, content);
    }
  }
  
  /**
   * Get status text for menu
   */
  getStatusText() {
    if (!this.isOnline) {
      return 'Status: Offline';
    } else if (this.isPaused) {
      return 'Status: Paused';
    } else {
      return 'Status: Monitoring';
    }
  }
  
  /**
   * Toggle pause state
   */
  async togglePause() {
    try {
      if (this.isPaused) {
        // Resume monitoring
        await this.resumeMonitoring();
      } else {
        // Pause for 1 hour
        await this.pauseMonitoring(60); // 60 minutes
      }
    } catch (error) {
      this.logger.error('Failed to toggle pause state', { error: error.message });
    }
  }
  
  /**
   * Pause monitoring
   */
  async pauseMonitoring(minutes) {
    // In production, this would communicate with the core service
    this.updatePausedStatus(true);
    
    // Set timer to resume
    setTimeout(() => {
      this.resumeMonitoring();
    }, minutes * 60 * 1000);
    
    this.logger.info('Monitoring paused', { minutes });
  }
  
  /**
   * Resume monitoring
   */
  async resumeMonitoring() {
    // In production, this would communicate with the core service
    this.updatePausedStatus(false);
    this.logger.info('Monitoring resumed');
  }
  
  /**
   * Mark all signals as read
   */
  async markAllRead() {
    try {
      // In production, this would communicate with the core service
      this.updateUnreadCount(0);
      this.logger.info('All signals marked as read');
    } catch (error) {
      this.logger.error('Failed to mark all read', { error: error.message });
    }
  }
  
  /**
   * Trigger manual signal check
   */
  async triggerManualCheck() {
    try {
      // In production, this would trigger the ingestion scheduler
      this.logger.info('Manual signal check triggered');
      
      // Show temporary status
      const originalTooltip = this.tray.getToolTip();
      this.tray.setToolTip('HeyJarvis - Checking for signals...');
      
      setTimeout(() => {
        this.updateTooltip();
      }, 3000);
      
    } catch (error) {
      this.logger.error('Failed to trigger manual check', { error: error.message });
    }
  }
  
  /**
   * Open preferences
   */
  openPreferences() {
    this.appLifecycle.showMainWindow();
    // Send message to renderer to show preferences
    const mainWindow = this.appLifecycle.getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.send('navigate-to', '/settings');
    }
  }
  
  /**
   * Open notification settings
   */
  openNotificationSettings() {
    this.appLifecycle.showMainWindow();
    const mainWindow = this.appLifecycle.getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.send('navigate-to', '/settings/notifications');
    }
  }
  
  /**
   * Toggle launch at startup
   */
  toggleLaunchAtStartup(enabled) {
    this.store.set('launchAtStartup', enabled);
    
    // In production, this would configure auto-launch
    this.logger.info('Launch at startup toggled', { enabled });
  }
  
  /**
   * Toggle notifications
   */
  toggleNotifications(enabled) {
    this.store.set('enableNotifications', enabled);
    this.logger.info('Notifications toggled', { enabled });
  }
  
  /**
   * Show about dialog
   */
  showAbout() {
    const appInfo = this.appLifecycle.getAppInfo();
    
    // In production, this would show a proper about dialog
    this.logger.info('About dialog requested', appInfo);
    
    this.appLifecycle.showMainWindow();
    const mainWindow = this.appLifecycle.getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.send('show-about', appInfo);
    }
  }
  
  /**
   * Get time ago string
   */
  getTimeAgo(timestamp) {
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now - then;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMins < 1) {
      return 'just now';
    } else if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else {
      return `${diffDays}d ago`;
    }
  }
  
  /**
   * Destroy tray
   */
  destroy() {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
    
    this.logger.info('System tray destroyed');
  }
}

module.exports = TrayManager;
