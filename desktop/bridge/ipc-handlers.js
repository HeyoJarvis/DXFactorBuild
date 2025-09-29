/**
 * IPC Handlers - Secure communication bridge between main and renderer processes
 * 
 * Features:
 * 1. Signal data communication
 * 2. Settings management
 * 3. Window controls
 * 4. Performance metrics
 * 5. Notification management
 */

const { ipcMain } = require('electron');
const fetch = require('node-fetch');

class IPCHandlers {
  constructor(appLifecycle) {
    this.appLifecycle = appLifecycle;
    this.logger = appLifecycle.getLogger();
    this.store = appLifecycle.getStore();
  }
  
  /**
   * Setup all IPC handlers
   */
  setup() {
    try {
      this.setupSignalHandlers();
      this.setupSettingsHandlers();
      this.setupWindowHandlers();
      this.setupPerformanceHandlers();
      this.setupNotificationHandlers();
      this.setupCRMHandlers();
      
      this.logger.info('IPC handlers setup complete');
      
    } catch (error) {
      this.logger.error('Failed to setup IPC handlers', { error: error.message });
    }
  }
  
  /**
   * Setup signal-related IPC handlers
   */
  setupSignalHandlers() {
    // Get recent signals
    ipcMain.handle('signals:getRecent', async (event, limit = 50) => {
      try {
        // TODO: Implement actual signal fetching from database
        return this.getMockSignals(limit);
      } catch (error) {
        this.logger.error('Failed to get recent signals', { error: error.message });
        return [];
      }
    });
    
    // Search signals
    ipcMain.handle('signals:search', async (event, query, filters = {}) => {
      try {
        // TODO: Implement signal search
        return this.searchMockSignals(query, filters);
      } catch (error) {
        this.logger.error('Failed to search signals', { error: error.message });
        return [];
      }
    });
    
    // Mark signal as read
    ipcMain.handle('signals:markAsRead', async (event, signalId) => {
      try {
        // TODO: Implement signal read status
        this.logger.debug('Signal marked as read', { signalId });
        return true;
      } catch (error) {
        this.logger.error('Failed to mark signal as read', { error: error.message });
        return false;
      }
    });
    
    // Get signal details
    ipcMain.handle('signals:getDetails', async (event, signalId) => {
      try {
        // TODO: Implement signal details fetching
        return this.getMockSignalDetails(signalId);
      } catch (error) {
        this.logger.error('Failed to get signal details', { error: error.message });
        return null;
      }
    });
  }
  
  /**
   * Setup settings-related IPC handlers
   */
  setupSettingsHandlers() {
    // Get all settings
    ipcMain.handle('settings:getAll', async () => {
      try {
        return {
          app: this.store.store,
          notifications: this.appLifecycle.notificationEngine.getSettings(),
          performance: this.appLifecycle.performanceMonitor.getMetrics()
        };
      } catch (error) {
        this.logger.error('Failed to get settings', { error: error.message });
        return {};
      }
    });
    
    // Update settings
    ipcMain.handle('settings:update', async (event, category, settings) => {
      try {
        switch (category) {
          case 'app':
            Object.keys(settings).forEach(key => {
              this.store.set(key, settings[key]);
            });
            break;
          case 'notifications':
            this.appLifecycle.notificationEngine.updateSettings(settings);
            break;
          case 'performance':
            this.appLifecycle.performanceMonitor.updateThresholds(settings);
            break;
        }
        
        this.logger.debug('Settings updated', { category, settings });
        return true;
        
      } catch (error) {
        this.logger.error('Failed to update settings', { error: error.message });
        return false;
      }
    });
    
    // Reset settings
    ipcMain.handle('settings:reset', async (event, category) => {
      try {
        switch (category) {
          case 'app':
            this.store.clear();
            break;
          case 'notifications':
            this.appLifecycle.notificationEngine.updateSettings({
              enabled: true,
              sound: true,
              urgentOnly: false,
              workHoursOnly: false
            });
            break;
        }
        
        this.logger.debug('Settings reset', { category });
        return true;
        
      } catch (error) {
        this.logger.error('Failed to reset settings', { error: error.message });
        return false;
      }
    });
  }
  
  /**
   * Setup window-related IPC handlers
   */
  setupWindowHandlers() {
    // Show/hide main window
    ipcMain.handle('window:show', () => {
      this.appLifecycle.showMainWindow();
      return true;
    });
    
    ipcMain.handle('window:hide', () => {
      this.appLifecycle.hideMainWindow();
      return true;
    });
    
    // Toggle copilot
    ipcMain.handle('window:toggleCopilot', () => {
      this.appLifecycle.copilotOverlay.toggle();
      return true;
    });
    
    // Get window status
    ipcMain.handle('window:getStatus', () => {
      const mainWindow = this.appLifecycle.getMainWindow();
      return {
        main: {
          isVisible: mainWindow ? mainWindow.isVisible() : false,
          isFocused: mainWindow ? mainWindow.isFocused() : false,
          bounds: mainWindow ? mainWindow.getBounds() : null
        },
        copilot: this.appLifecycle.copilotOverlay.getStatus()
      };
    });
  }
  
  /**
   * Setup performance-related IPC handlers
   */
  setupPerformanceHandlers() {
    // Get performance metrics
    ipcMain.handle('performance:getMetrics', () => {
      return this.appLifecycle.performanceMonitor.getMetrics();
    });
    
    // Get performance summary
    ipcMain.handle('performance:getSummary', () => {
      return this.appLifecycle.performanceMonitor.getSummary();
    });
    
    // Reset performance metrics
    ipcMain.handle('performance:reset', () => {
      this.appLifecycle.performanceMonitor.reset();
      return true;
    });
  }
  
  /**
   * Setup notification-related IPC handlers
   */
  setupNotificationHandlers() {
    // Get notification history
    ipcMain.handle('notifications:getHistory', () => {
      return this.appLifecycle.notificationEngine.getHistory();
    });
    
    // Clear notification history
    ipcMain.handle('notifications:clearHistory', () => {
      this.appLifecycle.notificationEngine.clearHistory();
      return true;
    });
    
    // Test notification
    ipcMain.handle('notifications:test', (event, type = 'info') => {
      this.appLifecycle.notificationEngine.showSystemNotification(
        'Test Notification',
        'This is a test notification from HeyJarvis',
        type
      );
      return true;
    });
    
    // Enable/disable notifications
    ipcMain.handle('notifications:toggle', (event, enabled) => {
      if (enabled) {
        this.appLifecycle.notificationEngine.enable();
      } else {
        this.appLifecycle.notificationEngine.disable();
      }
      return true;
    });
  }
  
  /**
   * Get mock signals for testing
   */
  getMockSignals(limit) {
    const mockSignals = [
      {
        id: 'signal-1',
        title: 'OpenAI Releases GPT-4 Turbo',
        summary: 'OpenAI announces GPT-4 Turbo with improved performance and reduced costs',
        category: 'product_launch',
        priority: 'high',
        relevanceScore: 0.85,
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
        source: 'TechCrunch',
        isRead: false
      },
      {
        id: 'signal-2',
        title: 'Anthropic Raises $450M Series C',
        summary: 'Anthropic secures major funding round to accelerate Claude development',
        category: 'funding',
        priority: 'medium',
        relevanceScore: 0.72,
        timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000),
        source: 'VentureBeat',
        isRead: true
      },
      {
        id: 'signal-3',
        title: 'Google Announces Gemini Ultra',
        summary: 'Google unveils most capable AI model to compete with GPT-4',
        category: 'product_launch',
        priority: 'critical',
        relevanceScore: 0.92,
        timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000),
        source: 'Google Blog',
        isRead: false
      }
    ];
    
    return mockSignals.slice(0, limit);
  }
  
  /**
   * Search mock signals
   */
  searchMockSignals(query, filters) {
    const signals = this.getMockSignals(100);
    
    return signals.filter(signal => {
      // Text search
      const matchesQuery = !query || 
        signal.title.toLowerCase().includes(query.toLowerCase()) ||
        signal.summary.toLowerCase().includes(query.toLowerCase());
      
      // Category filter
      const matchesCategory = !filters.category || signal.category === filters.category;
      
      // Priority filter
      const matchesPriority = !filters.priority || signal.priority === filters.priority;
      
      // Read status filter
      const matchesReadStatus = filters.isRead === undefined || signal.isRead === filters.isRead;
      
      return matchesQuery && matchesCategory && matchesPriority && matchesReadStatus;
    });
  }
  
  /**
   * Get mock signal details
   */
  getMockSignalDetails(signalId) {
    const signal = this.getMockSignals(100).find(s => s.id === signalId);
    
    if (!signal) return null;
    
    return {
      ...signal,
      content: `This is the full content for ${signal.title}. In a real implementation, this would contain the complete article or signal content with detailed analysis and insights.`,
      entities: [
        { type: 'company', name: 'OpenAI', confidence: 0.95 },
        { type: 'product', name: 'GPT-4', confidence: 0.89 },
        { type: 'person', name: 'Sam Altman', confidence: 0.76 }
      ],
      analysis: {
        sentiment: 0.2,
        competitiveThreat: 0.8,
        marketOpportunity: 0.6,
        strategicImportance: 0.9
      },
      recommendations: [
        'Monitor OpenAI pricing strategy changes',
        'Evaluate competitive positioning against GPT-4 Turbo',
        'Consider partnership opportunities'
      ]
    };
  }

  /**
   * Setup CRM-related IPC handlers
   */
  setupCRMHandlers() {
    const INTELLIGENT_SERVICE_URL = 'http://localhost:3002';
    
    // Get CRM data
    ipcMain.handle('crm:getData', async (event) => {
      try {
        const response = await fetch(`${INTELLIGENT_SERVICE_URL}/analysis/latest/default_org`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        
        this.logger.debug('CRM data retrieved', { 
          patterns: data.patterns?.length || 0,
          recommendations: data.recommendations?.length || 0 
        });
        
        return data;
      } catch (error) {
        this.logger.error('Failed to get CRM data', { error: error.message });
        return { error: error.message, patterns: [], recommendations: [], workflows: [] };
      }
    });
    
    // Refresh CRM data
    ipcMain.handle('crm:refresh', async (event) => {
      try {
        const response = await fetch(`${INTELLIGENT_SERVICE_URL}/analysis/trigger`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            website: process.env.COMPANY_WEBSITE || 'https://dxfactor.com',
            organization_id: 'default_org'
          })
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        this.logger.info('CRM refresh triggered', { 
          analysis_id: result.analysis_id,
          recommendations: result.recommendations || 0,
          patterns: result.patterns || 0
        });
        
        return result;
      } catch (error) {
        this.logger.error('Failed to refresh CRM data', { error: error.message });
        return { error: error.message };
      }
    });
    
    // Trigger analysis for specific organization
    ipcMain.handle('crm:triggerAnalysis', async (event, orgId) => {
      try {
        const response = await fetch(`${INTELLIGENT_SERVICE_URL}/analysis/trigger`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            website: process.env.COMPANY_WEBSITE || 'https://dxfactor.com',
            organization_id: orgId || 'default_org'
          })
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        this.logger.info('Analysis triggered', { 
          organization_id: orgId,
          analysis_id: result.analysis_id 
        });
        
        return result;
      } catch (error) {
        this.logger.error('Failed to trigger analysis', { 
          organization_id: orgId,
          error: error.message 
        });
        return { error: error.message };
      }
    });
    
    // Get recommendations
    ipcMain.handle('crm:getRecommendations', async (event, orgId = 'default_org') => {
      try {
        const response = await fetch(`${INTELLIGENT_SERVICE_URL}/recommendations/${orgId}`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        
        this.logger.debug('Recommendations retrieved', { 
          organization_id: orgId,
          count: data.recommendations?.length || 0 
        });
        
        return data;
      } catch (error) {
        this.logger.error('Failed to get recommendations', { 
          organization_id: orgId,
          error: error.message 
        });
        return { error: error.message, recommendations: [] };
      }
    });
    
    // Get company intelligence
    ipcMain.handle('crm:getIntelligence', async (event, orgId = 'default_org') => {
      try {
        const response = await fetch(`${INTELLIGENT_SERVICE_URL}/intelligence/${orgId}`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        
        this.logger.debug('Company intelligence retrieved', { 
          organization_id: orgId,
          company: data.company?.name 
        });
        
        return data;
      } catch (error) {
        this.logger.error('Failed to get company intelligence', { 
          organization_id: orgId,
          error: error.message 
        });
        return { error: error.message };
      }
    });
    
    // Health check
    ipcMain.handle('crm:healthCheck', async (event) => {
      try {
        const response = await fetch(`${INTELLIGENT_SERVICE_URL}/health`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        
        this.logger.debug('Service health checked', { 
          status: data.status,
          uptime: data.uptime 
        });
        
        return data;
      } catch (error) {
        this.logger.error('Failed to check service health', { error: error.message });
        return { status: 'unhealthy', error: error.message };
      }
    });
  }
}

module.exports = IPCHandlers;
