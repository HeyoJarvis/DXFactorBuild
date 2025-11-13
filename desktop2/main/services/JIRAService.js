/**
 * JIRA Service for Desktop2
 * Manages JIRA integration for developer task management
 */

const JIRAServiceCore = require('../../../core/integrations/jira-service');
const EventEmitter = require('events');
const { isJiraStatusCompleted } = require('../utils/jira-status-mapper');

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
        maxResults = 100,
        status = null  // Fetch ALL statuses
      } = options;

      // Build JQL query - if no status filter, get ALL tasks
      let jql;
      if (status) {
        const statusList = status
          .split(',')
          .map(s => `"${s.trim()}"`)
          .join(',');
        jql = `assignee = currentUser() AND status IN (${statusList}) ORDER BY priority DESC, updated DESC`;
      } else {
        // Fetch ALL tasks assigned to current user regardless of status
        jql = `assignee = currentUser() ORDER BY updated DESC`;
      }

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
      let tasksDeleted = 0;

      // Get ALL existing JIRA tasks from database (all users, only active, non-deleted ones)
      // We need to check ALL JIRA tasks, not just the current user's, to properly mark deleted tasks
      const existingJiraTasks = await this.supabaseAdapter.getTasksBySource(
        userId, 
        'jira', 
        false,  // includeDeleted = false
        true    // allUsers = true (get tasks from all users)
      );
      
      this.logger.info('🔍 Existing JIRA tasks in database (all users)', {
        count: existingJiraTasks.length,
        tasks: existingJiraTasks.map(t => ({
          id: t.id,
          user_id: t.user_id,
          external_id: t.external_id,
          external_key: t.external_key,
          title: t.title,
          has_external_id: !!t.external_id,
          external_id_format_valid: t.external_id?.startsWith('jira_')
        }))
      });

      // Filter out and clean up tasks without external_id (these are malformed or manually created)
      // Only sync tasks that have proper JIRA external_id (format: jira_XXXXX)
      const invalidJiraTasks = [];
      const validExistingTasks = existingJiraTasks.filter(task => {
        if (!task.external_id) {
          this.logger.warn('⚠️ Found task marked as JIRA but without external_id', {
            taskId: task.id,
            title: task.title,
            external_key: task.external_key
          });
          invalidJiraTasks.push(task);
          return false;
        }
        
        // Check if external_id has proper JIRA format
        if (!task.external_id.startsWith('jira_')) {
          this.logger.warn('⚠️ Found task with invalid JIRA external_id format', {
            taskId: task.id,
            title: task.title,
            external_id: task.external_id
          });
          invalidJiraTasks.push(task);
          return false;
        }
        
        return true;
      });

      // Clean up invalid JIRA tasks by removing their external_source tag
      if (invalidJiraTasks.length > 0) {
        this.logger.warn('🧹 Cleaning up invalid JIRA tasks', {
          count: invalidJiraTasks.length,
          tasks: invalidJiraTasks.map(t => ({ id: t.id, title: t.title }))
        });

        for (const task of invalidJiraTasks) {
          // Remove the JIRA external_source tag from these tasks
          await this.supabaseAdapter.updateTask(task.id, {
            externalSource: null,
            external_id: null,
            external_key: null
          });
          this.logger.info('✅ Cleaned up invalid JIRA task', {
            taskId: task.id,
            title: task.title
          });
        }
      }

      const existingTaskMap = new Map(
        validExistingTasks.map(task => [task.external_id, task])
      );

      // Track which tasks we've seen in JIRA
      const jiraIssueIds = new Set();

      // Create or update tasks from JIRA
      for (const issue of result.issues) {
        const externalId = `jira_${issue.id}`;
        jiraIssueIds.add(externalId);
        
        const existingTask = existingTaskMap.get(externalId);
        
        // Map JIRA status to internal completion status using centralized utility
        const jiraStatusName = issue.status?.name;
        const isCompletedInJira = isJiraStatusCompleted(jiraStatusName);
        
        const taskData = {
          title: issue.summary,
          description: issue.description || issue.summary,
          priority: this.mapJiraPriority(issue.priority?.name),
          tags: ['jira', issue.issue_type?.name?.toLowerCase() || 'task'],
          externalId,
          externalKey: issue.key,
          externalUrl: issue.url,
          externalSource: 'jira',
          jira_status: jiraStatusName,
          jira_issue_type: issue.issue_type?.name,
          jira_priority: issue.priority?.name,
          story_points: issue.story_points,
          sprint: issue.sprint,
          labels: issue.labels,
          epic_key: issue.epic?.key || null,
          epic_name: issue.epic?.name || null,
          due_date: issue.duedate || null,
          // Sync internal completion status with JIRA status
          is_completed: isCompletedInJira,
          completed_at: isCompletedInJira ? new Date().toISOString() : null
        };

        // Debug logging for status sync
        this.logger.info('📊 Syncing task', {
          key: issue.key,
          title: issue.summary,
          jira_status: jiraStatusName,
          is_completed: isCompletedInJira,
          status_category: issue.status?.category,
          priority: this.mapJiraPriority(issue.priority?.name),
          jira_priority: issue.priority?.name,
          due_date: issue.duedate || 'NO DUE DATE',
          story_points: issue.story_points || 0,
          epic_key: issue.epic?.key || 'NO EPIC',
          epic_name: issue.epic?.name || 'NO EPIC'
        });

        if (existingTask) {
          await this.supabaseAdapter.updateTask(existingTask.id, taskData);
          tasksUpdated++;
        } else {
          const createResult = await this.supabaseAdapter.createTask(userId, taskData);
          if (createResult.success) tasksCreated++;
        }
      }

      // Mark tasks as deleted/archived if they no longer exist in JIRA
      this.logger.info('Checking for deleted tasks', {
        existingTaskCount: existingTaskMap.size,
        currentJiraIssueCount: jiraIssueIds.size
      });

      for (const [externalId, task] of existingTaskMap) {
        if (!jiraIssueIds.has(externalId)) {
          this.logger.info('❌ Marking task as deleted (no longer in JIRA)', {
            taskId: task.id,
            externalId,
            externalKey: task.external_key,
            title: task.title
          });
          
          // Mark as deleted and completed instead of actually deleting
          const updateResult = await this.supabaseAdapter.updateTask(task.id, {
            is_completed: true,
            jira_deleted: true,
            completed_at: new Date().toISOString()
          });
          
          if (updateResult.success) {
            this.logger.info('✅ Task marked as deleted successfully', {
              taskId: task.id
            });
            tasksDeleted++;
          } else {
            this.logger.error('Failed to mark task as deleted', {
              taskId: task.id,
              error: updateResult.error
            });
          }
        }
      }

      this.logger.info('JIRA sync complete', {
        userId,
        tasksCreated,
        tasksUpdated,
        tasksDeleted,
        totalIssues: result.issues.length
      });

      return {
        success: true,
        tasksCreated,
        tasksUpdated,
        tasksDeleted,
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

