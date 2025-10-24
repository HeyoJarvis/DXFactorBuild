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
    getChatHistory: (taskId) => ipcRenderer.invoke('tasks:getChatHistory', taskId),
    
    // Product requirements generation (silent, no chat history)
    generateProductRequirements: (taskId, taskData) => ipcRenderer.invoke('tasks:generateProductRequirements', taskId, taskData)
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
    signInWithMicrosoft: () => ipcRenderer.invoke('auth:signInWithMicrosoft'),
    signInWithGoogle: () => ipcRenderer.invoke('auth:signInWithGoogle'),
    signOut: () => ipcRenderer.invoke('auth:signOut'),
    getSession: () => ipcRenderer.invoke('auth:getSession'),
    getCurrentUser: () => ipcRenderer.invoke('auth:getCurrentUser'),
    onAuthStateChange: (callback) => {
      ipcRenderer.on('auth:stateChanged', (event, data) => callback(data));
      return () => ipcRenderer.removeListener('auth:stateChanged', callback);
    }
  },

  // Onboarding APIs
  onboarding: {
    getStatus: () => ipcRenderer.invoke('onboarding:getStatus'),
    setRole: (role) => ipcRenderer.invoke('onboarding:setRole', role),
    saveRole: (role) => ipcRenderer.invoke('onboarding:saveRole', role),
    setTeam: (teamName) => ipcRenderer.invoke('onboarding:setTeam', teamName),
    skipIntegrations: () => ipcRenderer.invoke('onboarding:skipIntegrations'),
    complete: () => ipcRenderer.invoke('onboarding:complete'),
    getRecommendedIntegrations: () => ipcRenderer.invoke('onboarding:getRecommendedIntegrations')
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
    expandToLoginFlow: () => ipcRenderer.invoke('window:expandToLoginFlow'),
    openSecondary: (route) => ipcRenderer.invoke('window:openSecondary', route),
    navigateSecondary: (route) => ipcRenderer.invoke('window:navigateSecondary', route),
    setMouseForward: (shouldForward) => ipcRenderer.invoke('window:setMouseForward', shouldForward),
    moveWindow: (x, y) => ipcRenderer.invoke('window:moveWindow', x, y),
    resizeForMenu: (isOpen) => ipcRenderer.invoke('window:resizeForMenu', isOpen),
    // Window controls
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    toggleMaximize: () => ipcRenderer.send('window:toggleMaximize'),
    close: () => ipcRenderer.send('window:close'),
    // Event listeners
    onSecondaryWindowChange: (callback) => {
      const listener = (event, isOpen, route) => callback(isOpen, route);
      ipcRenderer.on('window:secondaryWindowChange', listener);
      return () => ipcRenderer.removeListener('window:secondaryWindowChange', listener);
    }
  },

  // Code Indexer APIs
  codeIndexer: {
    query: (params) => ipcRenderer.invoke('codeIndexer:query', params),
    listRepositories: (params) => ipcRenderer.invoke('codeIndexer:listRepositories', params),
    indexRepository: (params) => ipcRenderer.invoke('codeIndexer:indexRepository', params),
    getIndexingStatus: (params) => ipcRenderer.invoke('codeIndexer:getIndexingStatus', params),
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
  },

  // Microsoft 365 APIs
  microsoft: {
    checkConnection: () => ipcRenderer.invoke('microsoft:checkConnection'),
    authenticate: () => ipcRenderer.invoke('microsoft:authenticate'),
    createEvent: (eventData) => ipcRenderer.invoke('microsoft:createEvent', eventData),
    sendEmail: (emailData) => ipcRenderer.invoke('microsoft:sendEmail', emailData),
    getUpcomingEvents: (options) => ipcRenderer.invoke('microsoft:getUpcomingEvents', options),
    findMeetingTimes: (attendees, durationMinutes, options) => ipcRenderer.invoke('microsoft:findMeetingTimes', attendees, durationMinutes, options),
    healthCheck: () => ipcRenderer.invoke('microsoft:healthCheck'),
    // Email APIs
    getEmails: (folderId, maxResults) => ipcRenderer.invoke('microsoft:getEmails', folderId, maxResults),
    getUnreadEmails: (maxResults) => ipcRenderer.invoke('microsoft:getUnreadEmails', maxResults),
    markEmailAsRead: (messageId) => ipcRenderer.invoke('microsoft:markEmailAsRead', messageId)
  },

  // Google Workspace APIs
  google: {
    checkConnection: () => ipcRenderer.invoke('google:checkConnection'),
    authenticate: () => ipcRenderer.invoke('google:authenticate'),
    createEvent: (eventData) => ipcRenderer.invoke('google:createEvent', eventData),
    sendEmail: (emailData) => ipcRenderer.invoke('google:sendEmail', emailData),
    getUpcomingEvents: (options) => ipcRenderer.invoke('google:getUpcomingEvents', options),
    healthCheck: () => ipcRenderer.invoke('google:healthCheck'),
    // Email APIs
    getEmails: (options) => ipcRenderer.invoke('google:getEmails', options),
    getUnreadEmails: (maxResults) => ipcRenderer.invoke('google:getUnreadEmails', maxResults),
    getEmailThread: (threadId) => ipcRenderer.invoke('google:getEmailThread', threadId),
    markEmailAsRead: (messageId) => ipcRenderer.invoke('google:markEmailAsRead', messageId)
  },

  // Unified Inbox API
  inbox: {
    getUnified: (options) => ipcRenderer.invoke('inbox:getUnified', options)
  },

  // Team/Workspace APIs
  teams: {
    getAvailable: () => ipcRenderer.invoke('teams:getAvailable'),
    getUserTeams: () => ipcRenderer.invoke('teams:getUserTeams'),
    join: (teamId, role) => ipcRenderer.invoke('teams:join', teamId, role),
    leave: (teamId) => ipcRenderer.invoke('teams:leave', teamId),
    create: (teamData) => ipcRenderer.invoke('teams:create', teamData)
  },

  // Team Chat APIs
  teamChat: {
    loadTeams: () => ipcRenderer.invoke('team-chat:load-teams'),
    loadTeamContext: (teamId) => ipcRenderer.invoke('team-chat:load-team-context', teamId),
    getHistory: (teamId) => ipcRenderer.invoke('team-chat:get-history', teamId),
    sendMessage: (teamId, message) => ipcRenderer.invoke('team-chat:send-message', teamId, message),
    saveContextSettings: (teamId, settings) => ipcRenderer.invoke('team-chat:save-context-settings', teamId, settings),
    getUpcomingMeetings: (teamId) => ipcRenderer.invoke('team-chat:get-upcoming-meetings', teamId)
  },

  // AI APIs
  ai: {
    generateEmailDraft: (prompt) => ipcRenderer.invoke('ai:generateEmailDraft', prompt)
  }
});

// Log that preload is loaded
console.log('🔗 Preload script loaded successfully');

