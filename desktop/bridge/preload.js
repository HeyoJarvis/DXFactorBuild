/**
 * Main Preload Script - Secure bridge between main dashboard UI and main process
 */

const { contextBridge, ipcRenderer } = require('electron');

// Expose secure API to renderer
contextBridge.exposeInMainWorld('electronAPI', {
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
    getStatus: () => ipcRenderer.invoke('window:getStatus')
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
