/**
 * Copilot Preload Script - For the copilot overlay window
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Chat APIs
  chat: {
    send: (message) => ipcRenderer.invoke('chat:send', message),
    clear: () => ipcRenderer.invoke('chat:clear')
  },

  // Window controls
  window: {
    expand: () => ipcRenderer.invoke('window:expandCopilot'),
    collapse: () => ipcRenderer.invoke('window:collapseCopilot'),
    hide: () => ipcRenderer.invoke('window:hideMain')
  },

  // System status
  system: {
    getStatus: () => ipcRenderer.invoke('system:getStatus')
  }
});

console.log('🔗 Copilot preload script loaded');

