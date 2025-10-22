/**
 * Standalone JIRA Service for Team Sync Intelligence
 * 
 * Fetches JIRA issue updates and status changes
 * Completely independent from Desktop2
 */

class StandaloneJIRAService {
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.oauthService = options.oauthService;
    this.supabaseAdapter = options.supabaseAdapter;
    
    this.logger.info('Standalone JIRA Service initialized for Team Sync');
  }

  /**
   * Make JIRA search API call using the new /search/jql endpoint
   * @param {string} cloudId - JIRA Cloud ID
   * @param {string} accessToken - OAuth access token
   * @param {string} jql - JQL query string
   * @param {Object} options - Search options
   * @returns {Promise<Object>} Search results
   */
  async _searchJQL(cloudId, accessToken, jql, options = {}) {
    const fields = options.fields || [
      'summary', 'status', 'assignee', 'reporter', 
      'created', 'updated', 'description', 'priority', 'issuetype'
    ];
    
    const url = new URL(`https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/search/jql`);
    url.searchParams.set('jql', jql);
    url.searchParams.set('maxResults', (options.maxResults || 50).toString());
    url.searchParams.set('fields', fields.join(','));
    
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      const error = new Error(`JIRA API error: ${response.status}`);
      error.statusCode = response.status;
      throw error;
    }
    
    return await response.json();
  }

  /**
   * Check if JIRA is connected for a user
   * @param {string} userId - User ID
   * @returns {Promise<boolean>}
   */
  async isConnected(userId) {
    try {
      const { data, error } = await this.supabaseAdapter.supabase
        .from('team_sync_integrations')
        .select('id')
        .eq('user_id', userId)
        .eq('service_name', 'jira')
        .single();

      return !error && data !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get JIRA issues updated in the last N days
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} JIRA issues
   */
  async getRecentUpdates(userId, options = {}) {
    try {
      const { accessToken, cloudId } = await this.oauthService.getAccessToken(userId);
      const days = options.days || 7;
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      
      const jql = `updated >= "${startDate.toISOString().split('T')[0]}" ORDER BY updated DESC`;
      
      this.logger.info('Fetching recent JIRA updates', { 
        userId, 
        days,
        jql 
      });

      // Use new /search/jql endpoint
      const data = await this._searchJQL(cloudId, accessToken, jql, {
        maxResults: options.maxResults || 50,
        fields: [
          'summary',
          'status',
          'assignee',
          'reporter',
          'created',
          'updated',
          'description',
          'priority',
          'issuetype'
        ]
      });

      this.logger.info('JIRA updates fetched', {
        userId,
        count: data.issues?.length || 0
      });

      return this._formatIssues(data.issues || []);

    } catch (error) {
      // Handle 401 errors (expired token) by refreshing and retrying once
      if (error.statusCode === 401 && !options._retried) {
        this.logger.warn('JIRA token expired (401), refreshing and retrying...', { userId });
        
        try {
          await this.oauthService.refreshAccessToken(userId);
          return await this.getRecentUpdates(userId, { ...options, _retried: true });
        } catch (refreshError) {
          this.logger.error('Failed to refresh JIRA token', {
            userId,
            error: refreshError.message
          });
          throw new Error('JIRA authentication failed. Please reconnect JIRA from Settings.');
        }
      }
      
      // Handle 410 errors (invalid Cloud ID)
      if (error.statusCode === 410) {
        await this._handleInvalidCloudId(userId);
        throw new Error('JIRA connection invalid. Please reconnect JIRA from Settings.');
      }
      
      this.logger.error('Failed to fetch JIRA updates', {
        userId,
        error: error.message,
        statusCode: error.statusCode
      });
      throw error;
    }
  }

  /**
   * Get issues assigned to current user
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Assigned issues
   */
  async getMyIssues(userId, options = {}) {
    try {
      const { accessToken, cloudId } = await this.oauthService.getAccessToken(userId);
      
      const jql = `assignee = currentUser() AND resolution = Unresolved ORDER BY updated DESC`;
      
      this.logger.info('Fetching my JIRA issues', { userId, jql });

      // Use new /search/jql endpoint
      const data = await this._searchJQL(cloudId, accessToken, jql, {
        maxResults: options.maxResults || 50,
        fields: [
          'summary',
          'status',
          'assignee',
          'reporter',
          'created',
          'updated',
          'description',
          'priority',
          'issuetype',
          'duedate'
        ]
      });

      this.logger.info('My JIRA issues fetched', {
        userId,
        count: data.issues?.length || 0
      });

      return this._formatIssues(data.issues || []);

    } catch (error) {
      // Handle 401 errors (expired token) by refreshing and retrying once
      if (error.statusCode === 401 && !options._retried) {
        this.logger.warn('JIRA token expired (401), refreshing and retrying...', { userId });
        
        try {
          await this.oauthService.refreshAccessToken(userId);
          return await this.getMyIssues(userId, { ...options, _retried: true });
        } catch (refreshError) {
          this.logger.error('Failed to refresh JIRA token', {
            userId,
            error: refreshError.message
          });
          throw new Error('JIRA authentication failed. Please reconnect JIRA from Settings.');
        }
      }
      
      // Handle 410 errors (invalid Cloud ID)
      if (error.statusCode === 410) {
        await this._handleInvalidCloudId(userId);
        throw new Error('JIRA connection invalid. Please reconnect JIRA from Settings.');
      }
      
      this.logger.error('Failed to fetch my JIRA issues', {
        userId,
        error: error.message,
        statusCode: error.statusCode
      });
      throw error;
    }
  }

  /**
   * Get completed issues in the last N days
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Completed issues
   */
  async getCompletedIssues(userId, options = {}) {
    try {
      const { accessToken, cloudId } = await this.oauthService.getAccessToken(userId);
      const days = options.days || 7;
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      
      const jql = `status changed to Done AFTER "${startDate.toISOString().split('T')[0]}" ORDER BY updated DESC`;
      
      this.logger.info('Fetching completed JIRA issues', { 
        userId, 
        days,
        jql 
      });

      // Use new /search/jql endpoint
      const data = await this._searchJQL(cloudId, accessToken, jql, {
        maxResults: options.maxResults || 50,
        fields: [
          'summary',
          'status',
          'assignee',
          'reporter',
          'created',
          'updated',
          'resolutiondate',
          'description',
          'priority',
          'issuetype'
        ]
      });

      this.logger.info('Completed JIRA issues fetched', {
        userId,
        count: data.issues?.length || 0
      });

      return this._formatIssues(data.issues || []);

    } catch (error) {
      // Handle 401 errors (expired token) by refreshing and retrying once
      if (error.statusCode === 401 && !options._retried) {
        this.logger.warn('JIRA token expired (401), refreshing and retrying...', { userId });
        
        try {
          await this.oauthService.refreshAccessToken(userId);
          return await this.getCompletedIssues(userId, { ...options, _retried: true });
        } catch (refreshError) {
          this.logger.error('Failed to refresh JIRA token', {
            userId,
            error: refreshError.message
          });
          throw new Error('JIRA authentication failed. Please reconnect JIRA from Settings.');
        }
      }
      
      // Handle 410 errors (invalid Cloud ID)
      if (error.statusCode === 410) {
        await this._handleInvalidCloudId(userId);
        throw new Error('JIRA connection invalid. Please reconnect JIRA from Settings.');
      }
      
      this.logger.error('Failed to fetch completed JIRA issues', {
        userId,
        error: error.message,
        statusCode: error.statusCode
      });
      throw error;
    }
  }

  /**
   * Search issues by query
   * @param {string} userId - User ID
   * @param {string} query - Search query
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Matching issues
   */
  async searchIssues(userId, query, options = {}) {
    try {
      const { accessToken, cloudId } = await this.oauthService.getAccessToken(userId);
      
      const jql = `text ~ "${query}" ORDER BY updated DESC`;
      
      this.logger.info('Searching JIRA issues', { userId, query });

      // Use new /search/jql endpoint
      const data = await this._searchJQL(cloudId, accessToken, jql, {
        maxResults: options.maxResults || 20,
        fields: [
          'summary',
          'status',
          'assignee',
          'reporter',
          'created',
          'updated',
          'description'
        ]
      });

      this.logger.info('JIRA search completed', {
        userId,
        query,
        count: data.issues?.length || 0
      });

      return this._formatIssues(data.issues || []);

    } catch (error) {
      // Handle 401 errors (expired token) by refreshing and retrying once
      if (error.statusCode === 401 && !options._retried) {
        this.logger.warn('JIRA token expired (401), refreshing and retrying...', { userId });
        
        try {
          await this.oauthService.refreshAccessToken(userId);
          return await this.searchIssues(userId, query, { ...options, _retried: true });
        } catch (refreshError) {
          this.logger.error('Failed to refresh JIRA token', {
            userId,
            error: refreshError.message
          });
          return [];
        }
      }
      
      // Handle 410 errors (invalid Cloud ID)
      if (error.statusCode === 410) {
        await this._handleInvalidCloudId(userId);
        return [];
      }
      
      this.logger.error('Failed to search JIRA issues', {
        userId,
        query,
        error: error.message,
        statusCode: error.statusCode
      });
      return [];
    }
  }

  /**
   * Format JIRA issues for Team Sync
   */
  _formatIssues(issues) {
    return issues.map(issue => ({
      id: issue.id,
      key: issue.key,
      summary: issue.fields.summary,
      description: issue.fields.description?.content ? 
        this._extractTextFromADF(issue.fields.description) : 
        '',
      status: issue.fields.status?.name,
      statusCategory: issue.fields.status?.statusCategory?.name,
      priority: issue.fields.priority?.name,
      issueType: issue.fields.issuetype?.name,
      assignee: issue.fields.assignee ? {
        displayName: issue.fields.assignee.displayName,
        email: issue.fields.assignee.emailAddress,
        avatarUrl: issue.fields.assignee.avatarUrls?.['48x48']
      } : null,
      reporter: issue.fields.reporter ? {
        displayName: issue.fields.reporter.displayName,
        email: issue.fields.reporter.emailAddress
      } : null,
      created: issue.fields.created,
      updated: issue.fields.updated,
      resolutionDate: issue.fields.resolutiondate,
      dueDate: issue.fields.duedate,
      url: issue.self
    }));
  }

  /**
   * Extract plain text from JIRA ADF (Atlassian Document Format)
   */
  _extractTextFromADF(adf) {
    if (!adf || !adf.content) return '';
    
    let text = '';
    
    const extractFromNode = (node) => {
      if (node.type === 'text') {
        text += node.text + ' ';
      }
      if (node.content) {
        node.content.forEach(extractFromNode);
      }
    };
    
    adf.content.forEach(extractFromNode);
    
    return text.trim();
  }

  /**
   * Handle invalid Cloud ID (410 Gone error)
   * Automatically disconnects JIRA so user can reconnect
   */
  async _handleInvalidCloudId(userId) {
    try {
      this.logger.warn('JIRA Cloud ID is invalid (410 Gone). Disconnecting JIRA integration.', { userId });
      
      // Delete the invalid JIRA integration
      await this.oauthService.disconnect(userId);
      
      this.logger.info('JIRA integration disconnected. User needs to reconnect from Settings.', { userId });
    } catch (error) {
      this.logger.error('Failed to disconnect invalid JIRA integration', {
        userId,
        error: error.message
      });
    }
  }
}

module.exports = StandaloneJIRAService;


