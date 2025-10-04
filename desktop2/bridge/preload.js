/**
 * Preload Script - Secure bridge between renderer and main process
 * Exposes only necessary APIs to the renderer through contextBridge
 */

const { contextBridge, ipcRenderer } = require('electron');

// Expose secure API to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Chat APIs
  chat: {
    send: (message) => ipcRenderer.invoke('chat:send', message),
    clear: () => ipcRenderer.invoke('chat:clear'),
    getHistory: () => ipcRenderer.invoke('chat:getHistory')
  },

  // Task APIs
  tasks: {
    create: (taskData) => ipcRenderer.invoke('tasks:create', taskData),
    getAll: () => ipcRenderer.invoke('tasks:getAll'),
    update: (taskId, updates) => ipcRenderer.invoke('tasks:update', { taskId, updates }),
    delete: (taskId) => ipcRenderer.invoke('tasks:delete', taskId),
    
    // Task chat
    sendChatMessage: (taskId, message, context) => ipcRenderer.invoke('tasks:sendChatMessage', taskId, message, context),
    getChatHistory: (taskId) => ipcRenderer.invoke('tasks:getChatHistory', taskId)
  },
  
  // Task event listeners
  onTaskCreated: (callback) => {
    const listener = (event, task) => callback(task);
    ipcRenderer.on('task:created', listener);
    // Return cleanup function
    return () => ipcRenderer.removeListener('task:created', listener);
  },

  // System APIs
  system: {
    getStatus: () => ipcRenderer.invoke('system:getStatus'),
    getAppInfo: () => ipcRenderer.invoke('system:getAppInfo')
  },

  // Window APIs
  window: {
    showMain: () => ipcRenderer.invoke('window:showMain'),
    hideMain: () => ipcRenderer.invoke('window:hideMain'),
    toggleCopilot: () => ipcRenderer.invoke('window:toggleCopilot'),
    expandCopilot: () => ipcRenderer.invoke('window:expandCopilot'),
    collapseCopilot: () => ipcRenderer.invoke('window:collapseCopilot')
  }
});

// Log that preload is loaded
console.log('🔗 Preload script loaded successfully');

