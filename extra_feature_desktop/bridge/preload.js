/**
 * Preload Script
 * Exposes secure IPC APIs to renderer process
 */

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected APIs to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Meeting APIs
  meeting: {
    getUpcoming: (options) => ipcRenderer.invoke('meeting:getUpcoming', options),
    save: (userId, meetingData, options) => ipcRenderer.invoke('meeting:save', userId, meetingData, options),
    uploadNotes: (userId, meetingId, notes) => ipcRenderer.invoke('meeting:uploadNotes', userId, meetingId, notes),
    generateSummary: (userId, meetingId) => ipcRenderer.invoke('meeting:generateSummary', userId, meetingId),
    getSummaries: (options) => ipcRenderer.invoke('meeting:getSummaries', options),
    checkCopilotReadiness: (meetingId) => ipcRenderer.invoke('meeting:checkCopilotReadiness', meetingId),
    fetchCopilotNotes: (meetingId) => ipcRenderer.invoke('meeting:fetchCopilotNotes', meetingId)
  },

  // Intelligence APIs
  intelligence: {
    ask: (userId, question, options) => ipcRenderer.invoke('intelligence:ask', userId, question, options),
    clearHistory: () => ipcRenderer.invoke('intelligence:clearHistory'),
    getHistory: () => ipcRenderer.invoke('intelligence:getHistory')
  },

  // Sync APIs
  sync: {
    getUpdates: (options) => ipcRenderer.invoke('sync:getUpdates', options), // Fast: read from database
    fetchAll: (options) => ipcRenderer.invoke('sync:fetchAll', options), // Slow: fetch from APIs
    fetchJIRA: (userId, options) => ipcRenderer.invoke('sync:fetchJIRA', userId, options),
    fetchGitHub: (userId, options) => ipcRenderer.invoke('sync:fetchGitHub', userId, options),
    linkToMeeting: (meetingId, updateIds) => ipcRenderer.invoke('sync:linkToMeeting', meetingId, updateIds)
  },

  // Auth APIs
  auth: {
    login: (email, password) => ipcRenderer.invoke('auth:login', email, password),
    signup: (email, password) => ipcRenderer.invoke('auth:signup', email, password),
    logout: () => ipcRenderer.invoke('auth:logout'),
    getSession: () => ipcRenderer.invoke('auth:getSession'),
    initializeServices: (userId) => ipcRenderer.invoke('auth:initializeServices', userId),
    checkStatus: () => ipcRenderer.invoke('auth:checkStatus'),
    connectMicrosoft: () => ipcRenderer.invoke('auth:connectMicrosoft'),
    connectJIRA: () => ipcRenderer.invoke('auth:connectJIRA'),
    connectGitHub: () => ipcRenderer.invoke('auth:connectGitHub'),
    disconnect: (service) => ipcRenderer.invoke('auth:disconnect', service)
  },

  // GitHub APIs
  github: {
    listRepositories: () => ipcRenderer.invoke('github:listRepositories'),
    getRepository: (params) => ipcRenderer.invoke('github:getRepository', params)
  },

  // Code Indexer APIs (GitHub Repository Querying)
  codeIndexer: {
    indexRepository: (params) => ipcRenderer.invoke('codeIndexer:indexRepository', params),
    query: (params) => ipcRenderer.invoke('codeIndexer:query', params),
    getStatus: (params) => ipcRenderer.invoke('codeIndexer:getStatus', params),
    checkAvailability: () => ipcRenderer.invoke('codeIndexer:checkAvailability'),
    getJobStatus: (params) => ipcRenderer.invoke('codeIndexer:getJobStatus', params)
  },

  // Teams APIs
  teams: {
    list: () => ipcRenderer.invoke('teams:list'),
    create: (teamData) => ipcRenderer.invoke('teams:create', teamData),
    update: (teamId, updates) => ipcRenderer.invoke('teams:update', teamId, updates),
    delete: (teamId) => ipcRenderer.invoke('teams:delete', teamId),
    getContext: (teamId) => ipcRenderer.invoke('teams:getContext', teamId),
    getById: (teamId) => ipcRenderer.invoke('teams:getById', teamId),
    assignMeeting: (meetingId, teamId) => ipcRenderer.invoke('teams:assignMeeting', meetingId, teamId),
    assignTask: (taskId, teamId) => ipcRenderer.invoke('teams:assignTask', taskId, teamId),
    assignRepository: (teamId, owner, repo) => ipcRenderer.invoke('teams:assignRepository', teamId, owner, repo),
    getUnassignedMeetings: () => ipcRenderer.invoke('teams:getUnassignedMeetings'),
    getUnassignedTasks: () => ipcRenderer.invoke('teams:getUnassignedTasks'),
    askQuestion: (teamId, question, options) => ipcRenderer.invoke('teams:askQuestion', teamId, question, options)
  },

  // Real-time events
  events: {
    onSyncCompleted: (callback) => {
      const subscription = (event, data) => callback(data);
      ipcRenderer.on('sync-completed', subscription);
      
      // Return cleanup function
      return () => {
        ipcRenderer.removeListener('sync-completed', subscription);
      };
    }
  }
});

