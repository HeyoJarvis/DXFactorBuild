/**
 * Notification Engine - Manages desktop notifications for signals and alerts
 * 
 * Features:
 * 1. Native desktop notifications
 * 2. Signal alert notifications
 * 3. Update notifications
 * 4. Custom notification actions
 * 5. Notification history and management
 */

const { Notification, nativeImage } = require('electron');
const path = require('path');

class NotificationEngine {
  constructor(appLifecycle) {
    this.appLifecycle = appLifecycle;
    this.logger = appLifecycle.getLogger();
    this.store = appLifecycle.getStore();
    
    this.notificationHistory = [];
    this.isEnabled = true;
    
    // Notification settings
    this.settings = {
      enabled: true,
      sound: true,
      urgentOnly: false,
      workHoursOnly: false,
      ...this.store.get('notificationSettings', {})
    };
  }
  
  /**
   * Initialize notification engine
   */
  async initialize() {
    try {
      this.logger.info('Initializing notification engine');
      
      // Check if notifications are supported
      if (!Notification.isSupported()) {
        this.logger.warn('Desktop notifications not supported');
        this.isEnabled = false;
        return;
      }
      
      this.logger.info('Notification engine initialized', { 
        enabled: this.isEnabled,
        settings: this.settings 
      });
      
    } catch (error) {
      this.logger.error('Failed to initialize notification engine', { error: error.message });
      this.isEnabled = false;
    }
  }
  
  /**
   * Show signal notification
   */
  showSignalNotification(signal, relevanceScore = 0) {
    if (!this.shouldShowNotification()) return;
    
    try {
      const notification = new Notification({
        title: `🚨 New Signal: ${signal.title}`,
        body: signal.summary || 'New competitive intelligence signal detected',
        icon: this.getNotificationIcon('signal'),
        urgency: this.getUrgencyLevel(signal.priority, relevanceScore),
        tag: `signal-${signal.id}`,
        actions: [
          {
            type: 'button',
            text: 'View Details'
          },
          {
            type: 'button', 
            text: 'Mark as Read'
          }
        ]
      });
      
      notification.on('click', () => {
        this.appLifecycle.showMainWindow();
        // TODO: Navigate to signal details
      });
      
      notification.on('action', (event, index) => {
        if (index === 0) {
          // View details
          this.appLifecycle.showMainWindow();
        } else if (index === 1) {
          // Mark as read
          this.markSignalAsRead(signal.id);
        }
      });
      
      notification.show();
      
      this.addToHistory({
        type: 'signal',
        signalId: signal.id,
        title: signal.title,
        timestamp: new Date(),
        relevanceScore
      });
      
      this.logger.debug('Signal notification shown', { 
        signalId: signal.id,
        relevanceScore 
      });
      
    } catch (error) {
      this.logger.error('Failed to show signal notification', { 
        error: error.message,
        signalId: signal.id 
      });
    }
  }
  
  /**
   * Show update notification
   */
  showUpdateReady(updateInfo) {
    if (!this.isEnabled) return;
    
    try {
      const notification = new Notification({
        title: '🔄 HeyJarvis Update Available',
        body: `Version ${updateInfo.version} is ready to install`,
        icon: this.getNotificationIcon('update'),
        urgency: 'normal',
        actions: [
          {
            type: 'button',
            text: 'Install Now'
          },
          {
            type: 'button',
            text: 'Later'
          }
        ]
      });
      
      notification.on('action', (event, index) => {
        if (index === 0) {
          // Install update
          require('electron').autoUpdater.quitAndInstall();
        }
      });
      
      notification.show();
      
    } catch (error) {
      this.logger.error('Failed to show update notification', { error: error.message });
    }
  }
  
  /**
   * Show system notification
   */
  showSystemNotification(title, body, type = 'info') {
    if (!this.isEnabled) return;
    
    try {
      const notification = new Notification({
        title: `${this.getTypeIcon(type)} ${title}`,
        body,
        icon: this.getNotificationIcon(type),
        urgency: type === 'error' ? 'critical' : 'normal'
      });
      
      notification.show();
      
    } catch (error) {
      this.logger.error('Failed to show system notification', { error: error.message });
    }
  }
  
  /**
   * Get notification icon path
   */
  getNotificationIcon(type) {
    const iconPath = path.join(__dirname, '../assets/notifications');
    
    switch (type) {
      case 'signal':
        return path.join(iconPath, 'signal.png');
      case 'update':
        return path.join(iconPath, 'update.png');
      case 'error':
        return path.join(iconPath, 'error.png');
      default:
        return path.join(__dirname, '../assets/icon.png');
    }
  }
  
  /**
   * Get type icon emoji
   */
  getTypeIcon(type) {
    switch (type) {
      case 'signal': return '🚨';
      case 'update': return '🔄';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'success': return '✅';
      default: return 'ℹ️';
    }
  }
  
  /**
   * Get urgency level based on priority and relevance
   */
  getUrgencyLevel(priority, relevanceScore) {
    if (priority === 'critical' || relevanceScore > 0.9) {
      return 'critical';
    } else if (priority === 'high' || relevanceScore > 0.7) {
      return 'normal';
    } else {
      return 'low';
    }
  }
  
  /**
   * Check if notification should be shown
   */
  shouldShowNotification() {
    if (!this.isEnabled || !this.settings.enabled) {
      return false;
    }
    
    // Check work hours only setting
    if (this.settings.workHoursOnly) {
      const now = new Date();
      const hour = now.getHours();
      
      // Assume work hours are 9 AM to 6 PM
      if (hour < 9 || hour > 18) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Mark signal as read
   */
  markSignalAsRead(signalId) {
    // TODO: Implement signal read status
    this.logger.debug('Signal marked as read', { signalId });
  }
  
  /**
   * Add notification to history
   */
  addToHistory(notification) {
    this.notificationHistory.unshift(notification);
    
    // Keep only last 100 notifications
    if (this.notificationHistory.length > 100) {
      this.notificationHistory = this.notificationHistory.slice(0, 100);
    }
  }
  
  /**
   * Get notification history
   */
  getHistory() {
    return this.notificationHistory;
  }
  
  /**
   * Clear notification history
   */
  clearHistory() {
    this.notificationHistory = [];
    this.logger.debug('Notification history cleared');
  }
  
  /**
   * Update notification settings
   */
  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    this.store.set('notificationSettings', this.settings);
    
    this.logger.debug('Notification settings updated', { settings: this.settings });
  }
  
  /**
   * Enable notifications
   */
  enable() {
    this.settings.enabled = true;
    this.store.set('notificationSettings', this.settings);
    this.logger.debug('Notifications enabled');
  }
  
  /**
   * Disable notifications
   */
  disable() {
    this.settings.enabled = false;
    this.store.set('notificationSettings', this.settings);
    this.logger.debug('Notifications disabled');
  }
  
  /**
   * Get notification settings
   */
  getSettings() {
    return this.settings;
  }
}

module.exports = NotificationEngine;
