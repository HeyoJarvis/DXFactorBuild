/**
 * Copilot Preload Script - Secure bridge between copilot UI and main process
 */

const { contextBridge, ipcRenderer } = require('electron');

// Expose secure API to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Message handling
  sendMessage: (message) => ipcRenderer.invoke('copilot:sendMessage', message),
  
  // Window controls
  minimize: () => ipcRenderer.invoke('copilot:minimize'),
  closeWindow: () => ipcRenderer.invoke('copilot:close'),
  toggleAlwaysOnTop: () => ipcRenderer.invoke('copilot:toggleAlwaysOnTop'),
  
  // Top bar controls
  toggleTopBar: () => ipcRenderer.invoke('topbar:toggle'),
  expandTopBar: () => ipcRenderer.invoke('topbar:expand'),
  collapseTopBar: () => ipcRenderer.invoke('topbar:collapse'),
  repositionTopBar: () => ipcRenderer.invoke('topbar:reposition'),
  resetPosition: () => ipcRenderer.invoke('topbar:resetPosition'),
  getPosition: () => ipcRenderer.invoke('topbar:getPosition'),
  setOpacity: (opacity) => ipcRenderer.invoke('overlay:opacity', opacity),
  
  // Drag handling
  startDrag: () => ipcRenderer.invoke('copilot:startDrag'),
  endDrag: () => ipcRenderer.invoke('copilot:endDrag'),
  moveWindow: (delta) => ipcRenderer.invoke('copilot:moveWindow', delta),
  
  // CRM functionality
  getCRMData: () => ipcRenderer.invoke('crm:getData'),
  refreshCRM: () => ipcRenderer.invoke('crm:refresh'),
  triggerAnalysis: (orgId) => ipcRenderer.invoke('crm:triggerAnalysis', orgId),
  getRecommendations: (orgId) => ipcRenderer.invoke('crm:getRecommendations', orgId),
  getIntelligence: (orgId) => ipcRenderer.invoke('crm:getIntelligence', orgId),
  healthCheck: () => ipcRenderer.invoke('crm:healthCheck'),
  
  // Slack functionality
  slack: {
    getStatus: () => ipcRenderer.invoke('slack:getStatus'),
    getRecentMessages: (limit) => ipcRenderer.invoke('slack:getRecentMessages', limit),
    sendMessage: (channel, message) => ipcRenderer.invoke('slack:sendMessage', channel, message),
    startMonitoring: () => ipcRenderer.invoke('slack:startMonitoring'),
    stopMonitoring: () => ipcRenderer.invoke('slack:stopMonitoring'),
    getUserInfo: (userId) => ipcRenderer.invoke('slack:getUserInfo', userId),
    getChannelInfo: (channelId) => ipcRenderer.invoke('slack:getChannelInfo', channelId)
  },
  
  // Settings
  updateSettings: (settings) => ipcRenderer.invoke('copilot:updateSettings', settings),
  
  // History management
  getHistory: () => ipcRenderer.invoke('copilot:getHistory'),
  clearHistory: () => ipcRenderer.invoke('copilot:clearHistory'),
  saveHistory: () => ipcRenderer.invoke('copilot:saveHistory'),
  
  // Event listeners
  onMessage: (callback) => {
    ipcRenderer.on('copilot:message', (event, message) => callback(message));
  },
  
  onSettingsChanged: (callback) => {
    ipcRenderer.on('copilot:settingsChanged', (event, settings) => callback(settings));
  },

  onStateChange: (callback) => {
    ipcRenderer.on('copilot:setState', (event, state) => callback(state));
  },

  onCRMUpdate: (callback) => {
    ipcRenderer.on('crm:dataUpdate', (event, data) => callback(data));
  },

  // CRM loading event listeners
  onCRMLoadingStarted: (callback) => {
    ipcRenderer.on('crm:loading:started', (event, data) => callback(data));
  },

  onCRMLoadingProgress: (callback) => {
    ipcRenderer.on('crm:loading:progress', (event, data) => callback(data));
  },

  onCRMLoadingCompleted: (callback) => {
    ipcRenderer.on('crm:loading:completed', (event, data) => callback(data));
  },

  onCRMLoadingError: (callback) => {
    ipcRenderer.on('crm:loading:error', (event, data) => callback(data));
  },

  onCRMDataUpdated: (callback) => {
    ipcRenderer.on('crm:data:updated', (event, data) => callback(data));
  },

  // Slack event listeners
  onSlackMention: (callback) => {
    ipcRenderer.on('slack:mention', (event, message) => callback(message));
  },
  
  onSlackMessage: (callback) => {
    ipcRenderer.on('slack:message', (event, message) => callback(message));
  },
  
  onSlackConnected: (callback) => {
    ipcRenderer.on('slack:connected', () => callback());
  },

  onSlackDisconnected: (callback) => {
    ipcRenderer.on('slack:disconnected', () => callback());
  },

  onSlackError: (callback) => {
    ipcRenderer.on('slack:error', (event, error) => callback(error));
  },

  // Top bar event listeners
  onTopBarExpanded: (callback) => {
    ipcRenderer.on('topbar:expanded', (event, isExpanded) => callback(isExpanded));
  },

  onTopBarManuallyPositioned: (callback) => {
    ipcRenderer.on('topbar:manually-positioned', (event, isManual) => callback(isManual));
  },
  
  // Fact checking API
  factCheck: {
    captureScreen: () => ipcRenderer.invoke('fact-check:capture-screen'),
    extractText: (imageBase64) => ipcRenderer.invoke('fact-check:extract-text', imageBase64)
  },
  
  // AI analysis API
  ai: {
    simpleAnalyze: (prompt) => ipcRenderer.invoke('ai:simple-analyze', prompt)
  },
  
  // Highlight system API
  highlights: {
    show: (highlights) => ipcRenderer.invoke('highlights:show', highlights),
    hide: () => ipcRenderer.invoke('highlights:hide'),
    test: () => ipcRenderer.invoke('highlights:test'),
    findHeyjarvis: () => ipcRenderer.invoke('fact-check:analyze-screen'),
    calibrate: () => ipcRenderer.invoke('highlights:calibrate')
  },
  
  // Listen for explanation requests
  onShowExplanation: (callback) => {
    ipcRenderer.on('show-explanation', (event, data) => callback(data));
  }
});

// Add drag functionality to window - only on drag handle
window.addEventListener('DOMContentLoaded', () => {
  let isDragging = false;
  let dragOffset = { x: 0, y: 0 };
  
  // Make only the title area draggable
  const dragHandle = document.getElementById('dragHandle');
  if (dragHandle) {
    dragHandle.addEventListener('mousedown', (e) => {
      // Only start drag if clicking on the title area, not input elements
      if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'BUTTON') {
        isDragging = true;
        dragOffset.x = e.clientX;
        dragOffset.y = e.clientY;
        
        // Add visual feedback
        document.body.classList.add('dragging');
        
        console.log('🎯 Started dragging from title area');
      }
    });
    
    document.addEventListener('mousemove', (e) => {
      if (isDragging) {
        const deltaX = e.clientX - dragOffset.x;
        const deltaY = e.clientY - dragOffset.y;
        
        // Update drag offset for next calculation
        dragOffset.x = e.clientX;
        dragOffset.y = e.clientY;
        
        // Move window by delta
        if (window.electronAPI && window.electronAPI.moveWindow) {
          window.electronAPI.moveWindow({ deltaX, deltaY });
        }
      }
    });
    
    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        
        // Remove visual feedback
        document.body.classList.remove('dragging');
        
        console.log('🎯 Finished dragging');
      }
    });
  }
});
