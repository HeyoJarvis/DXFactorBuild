/**
 * Ultimate Context Chat Interface for Electron Desktop App
 * 
 * This module provides the chat interface that uses the ultimate context system
 * to provide intelligent business recommendations based on real CRM and Slack data.
 */

class UltimateContextChat {
  constructor() {
    this.currentOrganizationId = null;
    this.isInitialized = false;
    this.isProcessing = false;
    
    this.initializeElements();
    this.setupEventListeners();
    this.setupContextManager();
  }

  /**
   * Initialize DOM elements
   */
  initializeElements() {
    this.chatContainer = document.getElementById('chat-container');
    this.messageInput = document.getElementById('message-input');
    this.sendButton = document.getElementById('send-button');
    this.messagesContainer = document.getElementById('messages-container');
    this.contextStatus = document.getElementById('context-status');
    this.organizationSelect = document.getElementById('organization-select');
    this.refreshButton = document.getElementById('refresh-context');
    this.clearButton = document.getElementById('clear-context');
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Send message
    this.sendButton.addEventListener('click', () => this.sendMessage());
    this.messageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // Organization selection
    this.organizationSelect.addEventListener('change', (e) => {
      this.currentOrganizationId = e.target.value;
      this.loadContextForOrganization();
    });

    // Refresh context
    this.refreshButton.addEventListener('click', () => this.refreshContext());

    // Clear context
    this.clearButton.addEventListener('click', () => this.clearContext());

    // Load cached organizations on startup
    this.loadCachedOrganizations();
  }

  /**
   * Setup context manager
   */
  setupContextManager() {
    // Listen for context events
    window.electronAPI.on('ultimate-context:context-ready', (data) => {
      this.onContextReady(data);
    });

    window.electronAPI.on('ultimate-context:context-refreshed', (data) => {
      this.onContextRefreshed(data);
    });

    window.electronAPI.on('ultimate-context:context-cleared', (data) => {
      this.onContextCleared(data);
    });
  }

  /**
   * Load cached organizations
   */
  async loadCachedOrganizations() {
    try {
      const result = await window.electronAPI.invoke('ultimate-context:get-cached-organizations');
      
      if (result.success) {
        this.populateOrganizationSelect(result.data);
      }
    } catch (error) {
      console.error('Failed to load cached organizations:', error);
    }
  }

  /**
   * Populate organization select dropdown
   */
  populateOrganizationSelect(organizations) {
    this.organizationSelect.innerHTML = '<option value="">Select Organization</option>';
    
    organizations.forEach(orgId => {
      const option = document.createElement('option');
      option.value = orgId;
      option.textContent = orgId;
      this.organizationSelect.appendChild(option);
    });
  }

  /**
   * Load context for selected organization
   */
  async loadContextForOrganization() {
    if (!this.currentOrganizationId) {
      this.updateContextStatus('No organization selected', 'warning');
      return;
    }

    try {
      this.updateContextStatus('Checking context...', 'loading');
      
      const result = await window.electronAPI.invoke('ultimate-context:exists', {
        organizationId: this.currentOrganizationId
      });

      if (result.success) {
        if (result.data.exists) {
          this.updateContextStatus('Context loaded', 'success');
          this.isInitialized = true;
          this.addSystemMessage('Context loaded successfully. You can now ask questions about your business processes, CRM data, and Slack workflows.');
        } else {
          this.updateContextStatus('No context found', 'warning');
          this.addSystemMessage('No context found for this organization. Please refresh to load CRM and Slack data.');
        }
      } else {
        this.updateContextStatus('Error checking context', 'error');
        this.addSystemMessage('Error checking context: ' + result.error);
      }
    } catch (error) {
      console.error('Failed to load context:', error);
      this.updateContextStatus('Error loading context', 'error');
    }
  }

  /**
   * Refresh context for current organization
   */
  async refreshContext() {
    if (!this.currentOrganizationId) {
      this.addSystemMessage('Please select an organization first.');
      return;
    }

    try {
      this.isProcessing = true;
      this.updateContextStatus('Refreshing context...', 'loading');
      this.addSystemMessage('Refreshing context with latest CRM and Slack data...');

      // Get CRM config (this would need to be configured)
      const crmConfig = {
        type: 'hubspot',
        organization_id: this.currentOrganizationId,
        access_token: process.env.HUBSPOT_API_KEY,
        website_url: 'https://example.com' // This should be configurable
      };

      const result = await window.electronAPI.invoke('ultimate-context:refresh', {
        organizationId: this.currentOrganizationId,
        crmConfig
      });

      if (result.success) {
        this.updateContextStatus('Context refreshed', 'success');
        this.addSystemMessage('Context refreshed successfully with latest data.');
        this.isInitialized = true;
      } else {
        this.updateContextStatus('Error refreshing context', 'error');
        this.addSystemMessage('Error refreshing context: ' + result.error);
      }
    } catch (error) {
      console.error('Failed to refresh context:', error);
      this.updateContextStatus('Error refreshing context', 'error');
      this.addSystemMessage('Error refreshing context: ' + error.message);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Clear context for current organization
   */
  async clearContext() {
    if (!this.currentOrganizationId) {
      this.addSystemMessage('Please select an organization first.');
      return;
    }

    try {
      const result = await window.electronAPI.invoke('ultimate-context:clear', {
        organizationId: this.currentOrganizationId
      });

      if (result.success) {
        this.updateContextStatus('Context cleared', 'warning');
        this.addSystemMessage('Context cleared successfully.');
        this.isInitialized = false;
      } else {
        this.addSystemMessage('Error clearing context: ' + result.error);
      }
    } catch (error) {
      console.error('Failed to clear context:', error);
      this.addSystemMessage('Error clearing context: ' + error.message);
    }
  }

  /**
   * Send message and get AI response
   */
  async sendMessage() {
    const message = this.messageInput.value.trim();
    if (!message) return;

    if (!this.isInitialized) {
      this.addSystemMessage('Please initialize context first by selecting an organization and refreshing.');
      return;
    }

    if (this.isProcessing) {
      this.addSystemMessage('Please wait, processing previous request...');
      return;
    }

    try {
      this.isProcessing = true;
      
      // Add user message to chat
      this.addMessage(message, 'user');
      
      // Clear input
      this.messageInput.value = '';
      
      // Show typing indicator
      const typingId = this.addTypingIndicator();
      
      // Generate AI response
      const result = await window.electronAPI.invoke('ultimate-context:generate-recommendations', {
        organizationId: this.currentOrganizationId,
        userQuery: message
      });

      // Remove typing indicator
      this.removeTypingIndicator(typingId);

      if (result.success) {
        this.addMessage(result.data.recommendations.recommendations, 'assistant');
      } else {
        this.addMessage('Error generating response: ' + result.error, 'error');
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      this.addMessage('Error sending message: ' + error.message, 'error');
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Add message to chat
   */
  addMessage(content, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = content;
    
    messageDiv.appendChild(contentDiv);
    this.messagesContainer.appendChild(messageDiv);
    
    // Scroll to bottom
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }

  /**
   * Add system message
   */
  addSystemMessage(content) {
    this.addMessage(content, 'system');
  }

  /**
   * Add typing indicator
   */
  addTypingIndicator() {
    const typingId = 'typing-' + Date.now();
    const typingDiv = document.createElement('div');
    typingDiv.id = typingId;
    typingDiv.className = 'message assistant typing';
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = 'AI is thinking...';
    
    typingDiv.appendChild(contentDiv);
    this.messagesContainer.appendChild(typingDiv);
    
    // Scroll to bottom
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    
    return typingId;
  }

  /**
   * Remove typing indicator
   */
  removeTypingIndicator(typingId) {
    const typingDiv = document.getElementById(typingId);
    if (typingDiv) {
      typingDiv.remove();
    }
  }

  /**
   * Update context status
   */
  updateContextStatus(message, type) {
    this.contextStatus.textContent = message;
    this.contextStatus.className = `context-status ${type}`;
  }

  /**
   * Handle context ready event
   */
  onContextReady(data) {
    console.log('Context ready:', data);
    this.updateContextStatus('Context ready', 'success');
    this.addSystemMessage('Context loaded successfully. You can now ask questions about your business processes.');
  }

  /**
   * Handle context refreshed event
   */
  onContextRefreshed(data) {
    console.log('Context refreshed:', data);
    this.updateContextStatus('Context refreshed', 'success');
    this.addSystemMessage('Context refreshed with latest data.');
  }

  /**
   * Handle context cleared event
   */
  onContextCleared(data) {
    console.log('Context cleared:', data);
    this.updateContextStatus('Context cleared', 'warning');
    this.addSystemMessage('Context cleared successfully.');
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new UltimateContextChat();
});
