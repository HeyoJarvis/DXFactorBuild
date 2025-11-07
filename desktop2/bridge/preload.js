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
  
  // Notification listener
  onNotification: (callback) => {
    const listener = (event, notification) => callback(notification);
    ipcRenderer.on('notification', listener);
    return () => ipcRenderer.removeListener('notification', listener);
  },

  // Code Indexer APIs
  codeIndexer: {
    query: (params) => ipcRenderer.invoke('codeIndexer:query', params),
    listRepositories: (params) => ipcRenderer.invoke('codeIndexer:listRepositories', params),
    listIndexedRepositories: () => ipcRenderer.invoke('codeIndexer:listIndexedRepositories'),
    indexRepository: (params) => ipcRenderer.invoke('codeIndexer:indexRepository', params),
    getIndexingStatus: (params) => ipcRenderer.invoke('codeIndexer:getIndexingStatus', params),
    getStatus: () => ipcRenderer.invoke('codeIndexer:getStatus'),
    checkAvailability: () => ipcRenderer.invoke('codeIndexer:checkAvailability'),
    analyzeArchitecture: (params) => ipcRenderer.invoke('codeIndexer:analyzeArchitecture', params)
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

  // Confluence APIs (uses JIRA OAuth)
  confluence: {
    checkConnection: () => ipcRenderer.invoke('confluence:checkConnection'),
    getSpaces: () => ipcRenderer.invoke('confluence:getSpaces'),
    createPage: (params) => ipcRenderer.invoke('confluence:createPage', params),
    updatePage: (params) => ipcRenderer.invoke('confluence:updatePage', params),
    searchPages: (params) => ipcRenderer.invoke('confluence:searchPages', params),
    getPage: (params) => ipcRenderer.invoke('confluence:getPage', params)
  },

  // Slack APIs
  slack: {
    getRecentMessages: (limit) => ipcRenderer.invoke('slack:getRecentMessages', limit),
    getUserMentions: () => ipcRenderer.invoke('slack:getUserMentions'),
    getStatus: () => ipcRenderer.invoke('slack:getStatus')
  },

  // Microsoft 365 APIs
  microsoft: {
    checkConnection: () => ipcRenderer.invoke('microsoft:checkConnection'),
    authenticate: () => ipcRenderer.invoke('microsoft:authenticate'),
    disconnect: () => ipcRenderer.invoke('microsoft:disconnect'),
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
    disconnect: () => ipcRenderer.invoke('google:disconnect'),
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
    getUnified: (options) => ipcRenderer.invoke('inbox:getUnified', options),
    generateSuggestions: (messages) => ipcRenderer.invoke('inbox:generateSuggestions', messages)
  },

  // Email Semantic Search & Indexing APIs
  email: {
    index: (data) => ipcRenderer.invoke('email:index', data),
    indexSingle: (data) => ipcRenderer.invoke('email:index-single', data),
    query: (data) => ipcRenderer.invoke('email:query', data),
    stats: (data) => ipcRenderer.invoke('email:stats', data),
    reindex: (data) => ipcRenderer.invoke('email:reindex', data),
    findByDate: (data) => ipcRenderer.invoke('email:find-by-date', data),
    indexingStatus: (data) => ipcRenderer.invoke('email:indexing-status', data)
  },

  // Calendar API
  calendar: {
    generateSuggestions: (events) => ipcRenderer.invoke('calendar:generateSuggestions', events)
  },

  // Mission Control API
  missionControl: {
    getCalendar: (options) => ipcRenderer.invoke('missionControl:getCalendar', options)
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
    sendMessage: (teamId, message, chatContext) => ipcRenderer.invoke('team-chat:send-message', teamId, message, chatContext),
    saveContextSettings: (teamId, settings) => ipcRenderer.invoke('team-chat:save-context-settings', teamId, settings),
    addRepositoryToTeam: (teamId, owner, name, branch, url) => ipcRenderer.invoke('team-chat:add-repository-to-team', teamId, owner, name, branch, url),
    getUpcomingMeetings: (teamId) => ipcRenderer.invoke('team-chat:get-upcoming-meetings', teamId)
  },

  // User Productivity Chat APIs
  userChat: {
    getUserInfo: (userId) => ipcRenderer.invoke('user-chat:get-user-info', userId),
    loadContext: (userId) => ipcRenderer.invoke('user-chat:load-context', userId),
    getHistory: (userId) => ipcRenderer.invoke('user-chat:get-history', userId),
    sendMessage: (userId, message) => ipcRenderer.invoke('user-chat:send-message', userId, message)
  },

  // AI APIs
  ai: {
    generateEmailDraft: (prompt) => ipcRenderer.invoke('ai:generateEmailDraft', prompt)
  },

    // Admin APIs
    admin: {
      createOrUpdateTeam: (teamData) => ipcRenderer.invoke('admin:createOrUpdateTeam', teamData),
      deleteTeam: (teamId) => ipcRenderer.invoke('admin:deleteTeam', teamId),
      getAllTeams: () => ipcRenderer.invoke('admin:getAllTeams'),
      // User management
      getAllUsers: () => ipcRenderer.invoke('admin:getAllUsers'),
      getUserTeams: (userId) => ipcRenderer.invoke('admin:getUserTeams', userId),
      addUserToTeam: (userId, teamId) => ipcRenderer.invoke('admin:addUserToTeam', userId, teamId),
      removeUserFromTeam: (userId, teamId) => ipcRenderer.invoke('admin:removeUserFromTeam', userId, teamId),
      updateUserRole: (userId, newRole, leadTeamIds) => ipcRenderer.invoke('admin:updateUserRole', userId, newRole, leadTeamIds),
      getUserLeadTeams: (userId) => ipcRenderer.invoke('admin:getUserLeadTeams', userId),
      getTeamMembers: (teamId) => ipcRenderer.invoke('admin:getTeamMembers', teamId),
      // Capabilities
      getCapabilities: () => ipcRenderer.invoke('admin:getCapabilities')
    }
});

// Log that preload is loaded
console.log('🔗 Preload script loaded successfully');

