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
  }
});

// Add drag functionality to window
window.addEventListener('DOMContentLoaded', () => {
  let isDragging = false;
  let dragOffset = { x: 0, y: 0 };
  
  // Make header draggable
  const header = document.querySelector('.copilot-header');
  if (header && window.electronAPI) {
    header.addEventListener('mousedown', (e) => {
      isDragging = true;
      dragOffset.x = e.clientX;
      dragOffset.y = e.clientY;
      if (window.electronAPI.startDrag) {
        window.electronAPI.startDrag();
      }
    });
    
    document.addEventListener('mousemove', (e) => {
      if (isDragging) {
        const deltaX = e.clientX - dragOffset.x;
        const deltaY = e.clientY - dragOffset.y;
        
        // Move window
        if (window.electronAPI.moveWindow) {
          window.electronAPI.moveWindow({ deltaX, deltaY });
        }
      }
    });
    
    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        if (window.electronAPI.endDrag) {
          window.electronAPI.endDrag();
        }
      }
    });
  }
});
