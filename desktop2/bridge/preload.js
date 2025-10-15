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
    getAppInfo: () => ipcRenderer.invoke('system:getAppInfo'),
    setRole: (role) => ipcRenderer.invoke('system:setRole', role),
    getRole: () => ipcRenderer.invoke('system:getRole')
  },

  // Auth APIs
  auth: {
    signInWithSlack: () => ipcRenderer.invoke('auth:signInWithSlack'),
    signInWithTeams: () => ipcRenderer.invoke('auth:signInWithTeams'),
    signOut: () => ipcRenderer.invoke('auth:signOut'),
    getSession: () => ipcRenderer.invoke('auth:getSession'),
    getCurrentUser: () => ipcRenderer.invoke('auth:getCurrentUser'),
    onAuthStateChange: (callback) => {
      ipcRenderer.on('auth:stateChanged', (event, data) => callback(data));
      return () => ipcRenderer.removeListener('auth:stateChanged', callback);
    }
  },

  // Arc Reactor APIs
  arcReactor: {
    getMenuItems: (role) => ipcRenderer.invoke('arcReactor:getMenuItems', role)
  },

  // Window APIs
  window: {
    showMain: () => ipcRenderer.invoke('window:showMain'),
    hideMain: () => ipcRenderer.invoke('window:hideMain'),
    toggleCopilot: () => ipcRenderer.invoke('window:toggleCopilot'),
    expandCopilot: () => ipcRenderer.invoke('window:expandCopilot'),
    collapseCopilot: () => ipcRenderer.invoke('window:collapseCopilot'),
    openSecondary: (route) => ipcRenderer.invoke('window:openSecondary', route),
    navigateSecondary: (route) => ipcRenderer.invoke('window:navigateSecondary', route),
    setMouseForward: (shouldForward) => ipcRenderer.invoke('window:setMouseForward', shouldForward),
    moveWindow: (x, y) => ipcRenderer.invoke('window:moveWindow', x, y),
    resizeForMenu: (isOpen) => ipcRenderer.invoke('window:resizeForMenu', isOpen)
  },

  // Code Indexer APIs
  codeIndexer: {
    query: (params) => ipcRenderer.invoke('codeIndexer:query', params),
    listRepositories: (params) => ipcRenderer.invoke('codeIndexer:listRepositories', params),
    getStatus: () => ipcRenderer.invoke('codeIndexer:getStatus'),
    checkAvailability: () => ipcRenderer.invoke('codeIndexer:checkAvailability')
  },

  // JIRA APIs
  jira: {
    checkConnection: () => ipcRenderer.invoke('jira:checkConnection'),
    authenticate: () => ipcRenderer.invoke('jira:authenticate'),
    disconnect: () => ipcRenderer.invoke('jira:disconnect'),
    getMyIssues: (options) => ipcRenderer.invoke('jira:getMyIssues', options),
    syncTasks: () => ipcRenderer.invoke('jira:syncTasks'),
    updateIssue: (issueKey, updateData) => ipcRenderer.invoke('jira:updateIssue', issueKey, updateData),
    transitionIssue: (issueKey, transitionName) => ipcRenderer.invoke('jira:transitionIssue', issueKey, transitionName),
    healthCheck: () => ipcRenderer.invoke('jira:healthCheck')
  }
});

// Log that preload is loaded
console.log('🔗 Preload script loaded successfully');

