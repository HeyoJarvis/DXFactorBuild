/**
 * Main Preload Script - Secure bridge between main dashboard UI and main process
 */

const { contextBridge, ipcRenderer } = require('electron');

// Expose secure API to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Authentication
  auth: {
    signInWithSlack: () => ipcRenderer.invoke('auth:sign-in-slack'),
    signOut: () => ipcRenderer.invoke('auth:sign-out'),
    getUser: () => ipcRenderer.invoke('auth:get-user')
  },
  
  // Signal management
  signals: {
    getRecent: (limit) => ipcRenderer.invoke('signals:getRecent', limit),
    search: (query, filters) => ipcRenderer.invoke('signals:search', query, filters),
    markAsRead: (signalId) => ipcRenderer.invoke('signals:markAsRead', signalId),
    getDetails: (signalId) => ipcRenderer.invoke('signals:getDetails', signalId)
  },
  
  // Settings management
  settings: {
    getAll: () => ipcRenderer.invoke('settings:getAll'),
    update: (category, settings) => ipcRenderer.invoke('settings:update', category, settings),
    reset: (category) => ipcRenderer.invoke('settings:reset', category)
  },
  
  // Window controls
  window: {
    show: () => ipcRenderer.invoke('window:show'),
    hide: () => ipcRenderer.invoke('window:hide'),
    toggleCopilot: () => ipcRenderer.invoke('window:toggleCopilot'),
    getStatus: () => ipcRenderer.invoke('window:getStatus'),
    openUltimateContext: () => ipcRenderer.invoke('open-ultimate-context')
  },
  
  // Performance monitoring
  performance: {
    getMetrics: () => ipcRenderer.invoke('performance:getMetrics'),
    getSummary: () => ipcRenderer.invoke('performance:getSummary'),
    reset: () => ipcRenderer.invoke('performance:reset')
  },
  
  // Notifications
  notifications: {
    getHistory: () => ipcRenderer.invoke('notifications:getHistory'),
    clearHistory: () => ipcRenderer.invoke('notifications:clearHistory'),
    test: (type) => ipcRenderer.invoke('notifications:test', type),
    toggle: (enabled) => ipcRenderer.invoke('notifications:toggle', enabled)
  },
  
  // Ultimate Context System
  ultimateContext: {
    initialize: (organizationId, crmConfig) => ipcRenderer.invoke('ultimate-context:initialize', { organizationId, crmConfig }),
    processSession: (organizationId, sessionId, freshSlackWorkflows) => ipcRenderer.invoke('ultimate-context:process-session', { organizationId, sessionId, freshSlackWorkflows }),
    generateRecommendations: (organizationId, userQuery, sessionId) => ipcRenderer.invoke('ultimate-context:generate-recommendations', { organizationId, userQuery, sessionId }),
    getContext: (organizationId) => ipcRenderer.invoke('ultimate-context:get-context', { organizationId }),
    getSummary: (organizationId) => ipcRenderer.invoke('ultimate-context:get-summary', { organizationId }),
    refresh: (organizationId, crmConfig) => ipcRenderer.invoke('ultimate-context:refresh', { organizationId, crmConfig }),
    clear: (organizationId) => ipcRenderer.invoke('ultimate-context:clear', { organizationId }),
    getCachedOrganizations: () => ipcRenderer.invoke('ultimate-context:get-cached-organizations'),
    exists: (organizationId) => ipcRenderer.invoke('ultimate-context:exists', { organizationId })
  },

  // API integration with Vercel backend
  api: {
    getInsights: (userId) => ipcRenderer.invoke('api:getInsights', userId),
    getSignals: (userId, limit) => ipcRenderer.invoke('api:getSignals', userId, limit),
    healthCheck: () => ipcRenderer.invoke('api:healthCheck')
  },

  // CRM functionality
  crm: {
    getData: () => ipcRenderer.invoke('crm:getData'),
    refresh: () => ipcRenderer.invoke('crm:refresh'),
    triggerAnalysis: (orgId) => ipcRenderer.invoke('crm:triggerAnalysis', orgId),
    getRecommendations: (orgId) => ipcRenderer.invoke('crm:getRecommendations', orgId),
    getIntelligence: (orgId) => ipcRenderer.invoke('crm:getIntelligence', orgId),
    healthCheck: () => ipcRenderer.invoke('crm:healthCheck')
  },
  
  // Event listeners
  on: (channel, callback) => {
    const validChannels = [
      'signal-update',
      'performance-alert',
      'notification-received',
      'settings-changed'
    ];
    
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, callback);
    }
  },
  
  off: (channel, callback) => {
    ipcRenderer.removeListener(channel, callback);
  }
});
