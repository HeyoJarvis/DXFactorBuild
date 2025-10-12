/**
 * JIRA API Service
 * 
 * Integrates with Atlassian JIRA for project management:
 * - Projects and boards management
 * - Issue tracking (tickets, bugs, tasks)
 * - Sprint planning and velocity tracking
 * - Workflow automation and transitions
 * 
 * Features:
 * 1. OAuth 2.0 authentication with Atlassian
 * 2. Bidirectional sync (read and write issues)
 * 3. Real-time webhook support for updates
 * 4. Sprint velocity and analytics calculation
 * 5. Intelligent issue classification and prioritization
 */

const fetch = require('node-fetch');
const winston = require('winston');
const crypto = require('crypto');
const EventEmitter = require('events');

class JIRAService extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      clientId: options.clientId || process.env.JIRA_CLIENT_ID,
      clientSecret: options.clientSecret || process.env.JIRA_CLIENT_SECRET,
      redirectUri: options.redirectUri || process.env.JIRA_REDIRECT_URI || 'http://localhost:8890/auth/jira/callback',
      scopes: options.scopes || [
        'read:jira-work',
        'write:jira-work',
        'read:jira-user',
        'offline_access'
      ],
      logLevel: options.logLevel || 'info',
      ...options
    };

    // Initialize logger
    this.logger = winston.createLogger({
      level: this.options.logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ 
          filename: 'logs/jira-service.log',
          maxsize: 5242880, // 5MB
          maxFiles: 5
        })
      ],
      defaultMeta: { service: 'jira-service' }
    });

    // Authentication state
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiry = null;
    this.cloudId = null;
    this.siteUrl = null;
    this.codeVerifier = null;
    this.codeChallenge = null;

    this.logger.info('JIRA Service initialized', {
      clientId: this.options.clientId ? '***' + this.options.clientId.slice(-4) : 'not set',
      scopes: this.options.scopes.length
    });
  }

  /**
   * Generate PKCE code verifier and challenge
   */
  _generatePKCE() {
    // Generate random code verifier (43-128 characters)
    this.codeVerifier = crypto.randomBytes(32).toString('base64url');
    
    // Generate code challenge (SHA256 hash of verifier)
    this.codeChallenge = crypto
      .createHash('sha256')
      .update(this.codeVerifier)
      .digest('base64url');
    
    this.logger.debug('PKCE generated', {
      verifierLength: this.codeVerifier.length,
      challengeLength: this.codeChallenge.length
    });
  }

  /**
   * Get authorization URL for OAuth flow
   */
  getAuthorizationUrl() {
    this._generatePKCE();
    
    const params = new URLSearchParams({
      audience: 'api.atlassian.com',
      client_id: this.options.clientId,
      scope: this.options.scopes.join(' '),
      redirect_uri: this.options.redirectUri,
      response_type: 'code',
      prompt: 'consent',
      code_challenge: this.codeChallenge,
      code_challenge_method: 'S256'
    });

    const authUrl = `https://auth.atlassian.com/authorize?${params.toString()}`;
    
    this.logger.info('Authorization URL generated', {
      redirectUri: this.options.redirectUri,
      scopes: this.options.scopes
    });

    return authUrl;
  }

  /**
   * Exchange authorization code for access token
   */
  async authenticateWithCode(code) {
    try {
      this.logger.info('Exchanging authorization code for tokens');

      if (!this.codeVerifier) {
        throw new Error('PKCE code verifier not found. Call getAuthorizationUrl() first.');
      }

      const response = await fetch('https://auth.atlassian.com/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          client_id: this.options.clientId,
          client_secret: this.options.clientSecret,
          code: code,
          redirect_uri: this.options.redirectUri,
          code_verifier: this.codeVerifier
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error('Token exchange failed', {
          status: response.status,
          error: errorText
        });
        throw new Error(`Token exchange failed: ${response.status} - ${errorText}`);
      }

      const tokenData = await response.json();
      
      // Store tokens
      this.accessToken = tokenData.access_token;
      this.refreshToken = tokenData.refresh_token;
      this.tokenExpiry = Date.now() + (tokenData.expires_in * 1000);

      // Get accessible resources (cloud instances)
      await this._getAccessibleResources();

      this.logger.info('Successfully authenticated with JIRA', {
        expiresIn: tokenData.expires_in,
        cloudId: this.cloudId,
        siteUrl: this.siteUrl
      });

      this.emit('authenticated', {
        cloudId: this.cloudId,
        siteUrl: this.siteUrl
      });

      return {
        access_token: this.accessToken,
        refresh_token: this.refreshToken,
        expires_in: tokenData.expires_in,
        cloud_id: this.cloudId,
        site_url: this.siteUrl
      };

    } catch (error) {
      this.logger.error('Authentication failed', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Get accessible JIRA cloud instances
   */
  async _getAccessibleResources() {
    try {
      const response = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get accessible resources: ${response.status}`);
      }

      const resources = await response.json();
      
      if (resources.length === 0) {
        throw new Error('No accessible JIRA instances found');
      }

      // Use first accessible resource
      this.cloudId = resources[0].id;
      this.siteUrl = resources[0].url;

      this.logger.info('Accessible resources retrieved', {
        count: resources.length,
        cloudId: this.cloudId,
        siteUrl: this.siteUrl
      });

    } catch (error) {
      this.logger.error('Failed to get accessible resources', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken() {
    try {
      this.logger.info('Refreshing access token');

      if (!this.refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await fetch('https://auth.atlassian.com/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          grant_type: 'refresh_token',
          client_id: this.options.clientId,
          client_secret: this.options.clientSecret,
          refresh_token: this.refreshToken
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error('Token refresh failed', {
          status: response.status,
          error: errorText
        });
        
        // Check if refresh token is invalid (403 unauthorized_client)
        if (response.status === 403 || errorText.includes('unauthorized_client') || errorText.includes('refresh_token is invalid')) {
          this.logger.error('Refresh token is invalid - user needs to re-authenticate');
          
          // Clear invalid tokens to stop retry loops
          this.accessToken = null;
          this.refreshToken = null;
          this.tokenExpiry = null;
          
          // Emit event to notify UI
          this.emit('auth_required', {
            reason: 'refresh_token_invalid',
            message: 'JIRA authentication expired. Please reconnect your JIRA account.'
          });
          
          throw new Error('JIRA refresh token expired. Please re-authenticate with JIRA.');
        }
        
        throw new Error(`Token refresh failed: ${response.status}`);
      }

      const tokenData = await response.json();
      
      this.accessToken = tokenData.access_token;
      this.refreshToken = tokenData.refresh_token || this.refreshToken;
      this.tokenExpiry = Date.now() + (tokenData.expires_in * 1000);

      this.logger.info('Access token refreshed', {
        expiresIn: tokenData.expires_in
      });

      this.emit('token_refreshed', {
        expiresIn: tokenData.expires_in
      });

      return this.accessToken;

    } catch (error) {
      this.logger.error('Token refresh failed', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Ensure token is valid, refresh if needed
   */
  async _ensureValidToken() {
    if (!this.accessToken) {
      throw new Error('Not authenticated. Call authenticateWithCode() first.');
    }

    // Refresh token if expired or expires in < 5 minutes
    if (this.tokenExpiry && (Date.now() >= this.tokenExpiry - 300000)) {
      await this.refreshAccessToken();
    }
  }

  /**
   * Make authenticated request to JIRA API
   */
  async _makeRequest(endpoint, options = {}) {
    await this._ensureValidToken();

    const url = `https://api.atlassian.com/ex/jira/${this.cloudId}${endpoint}`;
    
    const defaultOptions = {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    };

    const mergedOptions = {
      ...defaultOptions,
      ...options,
      headers: {
        ...defaultOptions.headers,
        ...options.headers
      }
    };

    try {
      this.logger.debug('Making JIRA API request', {
        endpoint,
        method: mergedOptions.method || 'GET'
      });

      const response = await fetch(url, mergedOptions);

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error('JIRA API request failed', {
          endpoint,
          status: response.status,
          error: errorText
        });
        throw new Error(`JIRA API error: ${response.status} - ${errorText}`);
      }

      // Handle 204 No Content
      if (response.status === 204) {
        return null;
      }

      return await response.json();

    } catch (error) {
      this.logger.error('JIRA API request error', {
        endpoint,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get all projects
   */
  async getProjects() {
    try {
      this.logger.info('Fetching JIRA projects');

      const projects = await this._makeRequest('/rest/api/3/project');

      this.logger.info('Projects retrieved', {
        count: projects.length
      });

      return projects.map(project => ({
        id: project.id,
        key: project.key,
        name: project.name,
        project_type: project.projectTypeKey,
        lead: project.lead?.displayName,
        avatar_url: project.avatarUrls?.['48x48']
      }));

    } catch (error) {
      this.logger.error('Failed to get projects', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get boards for a project
   */
  async getBoards(projectKey) {
    try {
      this.logger.info('Fetching boards', { projectKey });

      const response = await this._makeRequest(`/rest/agile/1.0/board?projectKeyOrId=${projectKey}`);

      this.logger.info('Boards retrieved', {
        projectKey,
        count: response.values?.length || 0
      });

      return response.values || [];

    } catch (error) {
      this.logger.error('Failed to get boards', {
        projectKey,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get sprints for a board
   */
  async getSprints(boardId, state = 'active,future') {
    try {
      this.logger.info('Fetching sprints', { boardId, state });

      const response = await this._makeRequest(`/rest/agile/1.0/board/${boardId}/sprint?state=${state}`);

      this.logger.info('Sprints retrieved', {
        boardId,
        count: response.values?.length || 0
      });

      return response.values || [];

    } catch (error) {
      this.logger.error('Failed to get sprints', {
        boardId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get issues with JQL query
   */
  async getIssues(jql, options = {}) {
    try {
      const {
        startAt = 0,
        maxResults = 50,
        fields = ['summary', 'status', 'assignee', 'priority', 'created', 'updated', 'description', 'customfield_10016'] // customfield_10016 is usually story points
      } = options;

      this.logger.info('Fetching issues', { jql, startAt, maxResults });

      const params = new URLSearchParams({
        jql,
        startAt: startAt.toString(),
        maxResults: maxResults.toString(),
        fields: fields.join(',')
      });

      const response = await this._makeRequest(`/rest/api/3/search/jql?${params.toString()}`);

      this.logger.info('Issues retrieved', {
        total: response.total,
        returned: response.issues?.length || 0
      });

      return {
        total: response.total,
        startAt: response.startAt,
        maxResults: response.maxResults,
        issues: response.issues.map(issue => this._normalizeIssue(issue))
      };

    } catch (error) {
      this.logger.error('Failed to get issues', {
        jql,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get issues for a sprint
   */
  async getSprintIssues(sprintId) {
    try {
      this.logger.info('Fetching sprint issues', { sprintId });

      const response = await this._makeRequest(`/rest/agile/1.0/sprint/${sprintId}/issue`);

      this.logger.info('Sprint issues retrieved', {
        sprintId,
        count: response.issues?.length || 0
      });

      return response.issues.map(issue => this._normalizeIssue(issue));

    } catch (error) {
      this.logger.error('Failed to get sprint issues', {
        sprintId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Create a new issue
   */
  async createIssue(issueData) {
    try {
      this.logger.info('Creating issue', {
        project: issueData.project,
        type: issueData.issuetype
      });

      const response = await this._makeRequest('/rest/api/3/issue', {
        method: 'POST',
        body: JSON.stringify({
          fields: issueData
        })
      });

      this.logger.info('Issue created', {
        issueId: response.id,
        issueKey: response.key
      });

      this.emit('issue_created', {
        id: response.id,
        key: response.key
      });

      return response;

    } catch (error) {
      this.logger.error('Failed to create issue', {
        project: issueData.project,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Update an issue
   */
  async updateIssue(issueIdOrKey, updateData) {
    try {
      this.logger.info('Updating issue', { issueIdOrKey });

      await this._makeRequest(`/rest/api/3/issue/${issueIdOrKey}`, {
        method: 'PUT',
        body: JSON.stringify({
          fields: updateData
        })
      });

      this.logger.info('Issue updated', { issueIdOrKey });

      this.emit('issue_updated', {
        issue: issueIdOrKey
      });

      return { success: true };

    } catch (error) {
      this.logger.error('Failed to update issue', {
        issueIdOrKey,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Transition an issue (change status)
   */
  async transitionIssue(issueIdOrKey, transitionId, comment = null) {
    try {
      this.logger.info('Transitioning issue', { issueIdOrKey, transitionId });

      const body = {
        transition: { id: transitionId }
      };

      if (comment) {
        body.update = {
          comment: [{ add: { body: comment } }]
        };
      }

      await this._makeRequest(`/rest/api/3/issue/${issueIdOrKey}/transitions`, {
        method: 'POST',
        body: JSON.stringify(body)
      });

      this.logger.info('Issue transitioned', { issueIdOrKey, transitionId });

      this.emit('issue_transitioned', {
        issue: issueIdOrKey,
        transition: transitionId
      });

      return { success: true };

    } catch (error) {
      this.logger.error('Failed to transition issue', {
        issueIdOrKey,
        transitionId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get available transitions for an issue
   */
  async getTransitions(issueIdOrKey) {
    try {
      this.logger.info('Fetching transitions', { issueIdOrKey });

      const response = await this._makeRequest(`/rest/api/3/issue/${issueIdOrKey}/transitions`);

      return response.transitions || [];

    } catch (error) {
      this.logger.error('Failed to get transitions', {
        issueIdOrKey,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Normalize issue data to consistent format
   */
  _normalizeIssue(issue) {
    const fields = issue.fields || {};
    
    return {
      id: issue.id,
      key: issue.key,
      summary: fields.summary,
      description: fields.description,
      status: {
        id: fields.status?.id,
        name: fields.status?.name,
        category: fields.status?.statusCategory?.key
      },
      issue_type: {
        id: fields.issuetype?.id,
        name: fields.issuetype?.name,
        icon_url: fields.issuetype?.iconUrl
      },
      priority: {
        id: fields.priority?.id,
        name: fields.priority?.name,
        icon_url: fields.priority?.iconUrl
      },
      assignee: fields.assignee ? {
        account_id: fields.assignee.accountId,
        display_name: fields.assignee.displayName,
        email: fields.assignee.emailAddress,
        avatar_url: fields.assignee.avatarUrls?.['48x48']
      } : null,
      reporter: fields.reporter ? {
        account_id: fields.reporter.accountId,
        display_name: fields.reporter.displayName,
        email: fields.reporter.emailAddress
      } : null,
      story_points: fields.customfield_10016 || null,
      created_at: fields.created,
      updated_at: fields.updated,
      labels: fields.labels || [],
      components: (fields.components || []).map(c => c.name),
      sprint: fields.sprint || null,
      url: `${this.siteUrl}/browse/${issue.key}`
    };
  }

  /**
   * Calculate sprint velocity
   */
  async calculateSprintVelocity(sprintId) {
    try {
      this.logger.info('Calculating sprint velocity', { sprintId });

      const issues = await this.getSprintIssues(sprintId);
      
      const completedIssues = issues.filter(issue => 
        issue.status.category === 'done'
      );

      const totalStoryPoints = issues.reduce((sum, issue) => 
        sum + (issue.story_points || 0), 0
      );

      const completedStoryPoints = completedIssues.reduce((sum, issue) => 
        sum + (issue.story_points || 0), 0
      );

      const velocity = {
        sprint_id: sprintId,
        total_issues: issues.length,
        completed_issues: completedIssues.length,
        total_story_points: totalStoryPoints,
        completed_story_points: completedStoryPoints,
        completion_rate: issues.length > 0 ? completedIssues.length / issues.length : 0,
        velocity_rate: totalStoryPoints > 0 ? completedStoryPoints / totalStoryPoints : 0
      };

      this.logger.info('Sprint velocity calculated', velocity);

      return velocity;

    } catch (error) {
      this.logger.error('Failed to calculate sprint velocity', {
        sprintId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get current user info
   */
  async getCurrentUser() {
    try {
      this.logger.info('Fetching current user');

      const user = await this._makeRequest('/rest/api/3/myself');

      this.logger.info('Current user retrieved', {
        accountId: user.accountId,
        displayName: user.displayName
      });

      return {
        account_id: user.accountId,
        display_name: user.displayName,
        email: user.emailAddress,
        avatar_url: user.avatarUrls?.['48x48']
      };

    } catch (error) {
      this.logger.error('Failed to get current user', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      await this._ensureValidToken();
      await this.getCurrentUser();

      return {
        status: 'healthy',
        jira: 'connected',
        cloud_id: this.cloudId,
        site_url: this.siteUrl
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


