/**
 * JIRA Service for Desktop2
 * Manages JIRA integration for developer task management
 */

const JIRAServiceCore = require('../../../core/integrations/jira-service');
const EventEmitter = require('events');

class JIRAService extends EventEmitter {
  constructor({ logger, supabaseAdapter }) {
    super();
    
    this.logger = logger;
    this.supabaseAdapter = supabaseAdapter;
    this.jiraCore = null;
    this.isInitialized = false;
    this.syncInterval = null;
    
    this.logger.info('JIRA Service initialized (desktop2)');
  }

  /**
   * Initialize JIRA service with user tokens
   */
  async initialize(userId) {
    try {
      this.logger.info('Initializing JIRA service', { userId });

      // Get user's JIRA tokens from Supabase
      const { data: userData, error: userError } = await this.supabaseAdapter.supabase
        .from('users')
        .select('integration_settings')
        .eq('id', userId)
        .single();

      if (userError || !userData) {
        throw new Error('Failed to get user data');
      }

      const jiraTokens = userData.integration_settings?.jira;
      
      if (!jiraTokens || !jiraTokens.access_token) {
        this.logger.warn('JIRA not connected for user', { userId });
        return {
          success: false,
          connected: false,
          error: 'JIRA not connected'
        };
      }

      // Initialize core JIRA service
      this.jiraCore = new JIRAServiceCore({
        clientId: process.env.JIRA_CLIENT_ID,
        clientSecret: process.env.JIRA_CLIENT_SECRET,
        redirectUri: process.env.JIRA_REDIRECT_URI
      });

      // Set tokens
      this.jiraCore.accessToken = jiraTokens.access_token;
      this.jiraCore.refreshToken = jiraTokens.refresh_token;
      this.jiraCore.tokenExpiry = jiraTokens.token_expiry ? new Date(jiraTokens.token_expiry).getTime() : null;
      this.jiraCore.cloudId = jiraTokens.cloud_id;
      this.jiraCore.siteUrl = jiraTokens.site_url;

      // Listen for token refresh events to update Supabase
      this.jiraCore.on('token_refreshed', async () => {
        await this.saveTokens(userId);
      });

      // Listen for auth required events
      this.jiraCore.on('auth_required', (data) => {
        this.emit('auth_required', data);
      });

      this.isInitialized = true;
      this.logger.info('JIRA service initialized successfully', {
        userId,
        siteUrl: this.jiraCore.siteUrl
      });

      return {
        success: true,
        connected: true,
        siteUrl: this.jiraCore.siteUrl,
        cloudId: this.jiraCore.cloudId
      };

    } catch (error) {
      this.logger.error('Failed to initialize JIRA service', {
        userId,
        error: error.message
      });
      
      return {
        success: false,
        connected: false,
        error: error.message
      };
    }
  }

  /**
   * Save tokens to Supabase
   */
  async saveTokens(userId) {
    try {
      const jiraTokens = {
        access_token: this.jiraCore.accessToken,
        refresh_token: this.jiraCore.refreshToken,
        token_expiry: new Date(this.jiraCore.tokenExpiry).toISOString(),
        cloud_id: this.jiraCore.cloudId,
        site_url: this.jiraCore.siteUrl
      };

      const { error } = await this.supabaseAdapter.supabase
        .from('users')
        .update({
          integration_settings: {
            jira: jiraTokens
          }
        })
        .eq('id', userId);

      if (error) throw error;

      this.logger.info('JIRA tokens saved', { userId });
      return { success: true };

    } catch (error) {
      this.logger.error('Failed to save JIRA tokens', {
        userId,
        error: error.message
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if JIRA is connected
   */
  isConnected() {
    return this.isInitialized && this.jiraCore && this.jiraCore.accessToken;
  }

  /**
   * Get a single issue by key or ID (proxy to core service)
   */
  async getIssueDetails(issueKeyOrId) {
    if (!this.isConnected()) {
      throw new Error('JIRA not connected');
    }
    return this.jiraCore.getIssueDetails(issueKeyOrId);
  }

  /**
   * Get issues by JQL query (proxy to core service)
   */
  async getIssuesByJQL(jql, options = {}) {
    if (!this.isConnected()) {
      throw new Error('JIRA not connected');
    }
    return this.jiraCore.getIssuesByJQL(jql, options);
  }

  /**
   * Get remote links (web links) for an issue (proxy to core service)
   */
  async getIssueRemoteLinks(issueKeyOrId) {
    if (!this.isConnected()) {
      throw new Error('JIRA not connected');
    }
    return this.jiraCore.getIssueRemoteLinks(issueKeyOrId);
  }

  /**
   * Get user's JIRA issues
   */
  async getMyIssues(options = {}) {
    try {
      if (!this.isConnected()) {
        throw new Error('JIRA not connected');
      }

      const {
        maxResults = 50,
        status = 'In Progress,To Do,Code Review'
      } = options;

      // Build JQL query for user's assigned issues
      // Quote each status value to handle spaces in status names
      const statusList = status
        .split(',')
        .map(s => `"${s.trim()}"`)
        .join(',');
      const jql = `assignee = currentUser() AND status IN (${statusList}) ORDER BY priority DESC, updated DESC`;

      this.logger.info('Fetching JIRA issues', { jql, maxResults });

      const result = await this.jiraCore.getIssues(jql, { maxResults });

      this.logger.info('JIRA issues fetched', {
        total: result.total,
        returned: result.issues.length
      });

      return {
        success: true,
        issues: result.issues,
        total: result.total
      };

    } catch (error) {
      this.logger.error('Failed to get JIRA issues', {
        error: error.message
      });
      
      return {
        success: false,
        error: error.message,
        issues: []
      };
    }
  }

  /**
   * Sync JIRA issues to Supabase tasks
   */
  async syncTasks(userId) {
    try {
      if (!this.isConnected()) {
        return {
          success: false,
          error: 'JIRA not connected'
        };
      }

      this.logger.info('Starting JIRA task sync', { userId });

      const result = await this.getMyIssues();

      if (!result.success) {
        throw new Error(result.error);
      }

      let tasksCreated = 0;
      let tasksUpdated = 0;

      for (const issue of result.issues) {
        const externalId = `jira_${issue.id}`;
        const existingTask = await this.supabaseAdapter.getTaskByExternalId(externalId);
        
        const taskData = {
          title: issue.summary,
          description: issue.description || issue.summary,
          priority: this.mapJiraPriority(issue.priority?.name),
          tags: ['jira', issue.issue_type?.name?.toLowerCase() || 'task'],
          externalId,
          externalKey: issue.key,
          externalUrl: issue.url,
          externalSource: 'jira',
          jira_status: issue.status?.name,
          jira_issue_type: issue.issue_type?.name,
          jira_priority: issue.priority?.name,
          story_points: issue.story_points,
          sprint: issue.sprint,
          labels: issue.labels
        };

        if (existingTask) {
          await this.supabaseAdapter.updateTask(existingTask.id, taskData);
          tasksUpdated++;
        } else {
          const createResult = await this.supabaseAdapter.createTask(userId, taskData);
          if (createResult.success) tasksCreated++;
        }
      }

      this.logger.info('JIRA sync complete', {
        userId,
        tasksCreated,
        tasksUpdated,
        totalIssues: result.issues.length
      });

      return {
        success: true,
        tasksCreated,
        tasksUpdated,
        totalIssues: result.issues.length
      };

    } catch (error) {
      this.logger.error('Failed to sync JIRA tasks', {
        userId,
        error: error.message
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Map JIRA priority to internal priority
   */
  mapJiraPriority(jiraPriority) {
    if (!jiraPriority) return 'medium';
    const priority = jiraPriority.toLowerCase();
    if (priority.includes('highest') || priority.includes('critical')) return 'urgent';
    if (priority.includes('high')) return 'high';
    if (priority.includes('low')) return 'low';
    return 'medium';
  }

  /**
   * Update JIRA issue
   */
  async updateIssue(issueKey, updateData) {
    try {
      if (!this.isConnected()) {
        throw new Error('JIRA not connected');
      }

      this.logger.info('Updating JIRA issue', { issueKey, updateData });

      const result = await this.jiraCore.updateIssue(issueKey, updateData);

      this.logger.info('JIRA issue updated', { issueKey });

      return {
        success: true,
        result
      };

    } catch (error) {
      this.logger.error('Failed to update JIRA issue', {
        issueKey,
        error: error.message
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Transition JIRA issue (change status)
   */
  async transitionIssue(issueKey, transitionName) {
    try {
      if (!this.isConnected()) {
        throw new Error('JIRA not connected');
      }

      this.logger.info('Transitioning JIRA issue', { issueKey, transitionName });

      const result = await this.jiraCore.transitionIssue(issueKey, transitionName);

      this.logger.info('JIRA issue transitioned', { issueKey, transitionName });

      return {
        success: true,
        result
      };

    } catch (error) {
      this.logger.error('Failed to transition JIRA issue', {
        issueKey,
        transitionName,
        error: error.message
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Start auto-sync interval
   */
  startAutoSync(userId, intervalMinutes = 10) {
    if (this.syncInterval) {
      this.stopAutoSync();
    }

    this.logger.info('Starting JIRA auto-sync', {
      userId,
      intervalMinutes
    });

    // Initial sync after 10 seconds
    setTimeout(() => {
      this.syncTasks(userId);
    }, 10000);

    // Then sync every N minutes
    this.syncInterval = setInterval(() => {
      this.syncTasks(userId);
    }, intervalMinutes * 60 * 1000);
  }

  /**
   * Stop auto-sync interval
   */
  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      this.logger.info('JIRA auto-sync stopped');
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      if (!this.isConnected()) {
        return {
          status: 'disconnected',
          jira: 'not connected'
        };
      }

      const health = await this.jiraCore.healthCheck();

      return {
        status: health.status,
        jira: health.jira,
        siteUrl: health.site_url,
        cloudId: health.cloud_id
      };

    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }
}

module.exports = JIRAService;

