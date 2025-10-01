/**
 * Highlight Overlay Preload Script
 * Provides secure API for highlight overlay communication
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Listen for highlight data from main process
  onShowHighlights: (callback) => {
    ipcRenderer.on('show-highlights', (event, highlights) => callback(highlights));
  },
  
  // Listen for selective click setup
  onSetupSelectiveClicks: (callback) => {
    ipcRenderer.on('setup-selective-clicks', (event, highlights) => callback(highlights));
  },
  
  // Request explanation for a specific highlight
  explainHighlight: async (highlightId) => {
    return await ipcRenderer.invoke('highlights:explain', highlightId);
  },
  
  // Hide all highlights
  hideHighlights: () => {
    ipcRenderer.invoke('highlights:hide');
  },
  
  // Forward click to underlying window
  forwardClick: (x, y) => {
    ipcRenderer.invoke('highlights:forward-click', x, y);
  }
});
