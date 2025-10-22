/**
 * Task & Code Intelligence Service
 * 
 * Aggregates updates from JIRA and GitHub:
 * - Fetches JIRA issues and status changes
 * - Fetches GitHub PRs and commits
 * - Links code changes to JIRA tickets
 * - Stores updates in Supabase
 */

const winston = require('winston');
const EventEmitter = require('events');

class TaskCodeIntelligenceService extends EventEmitter {
  constructor({ jiraService, githubService, supabaseAdapter, logger }) {
    super();
    
    this.jiraService = jiraService;
    this.githubService = githubService;
    this.supabaseAdapter = supabaseAdapter;
    this.logger = logger || this._createLogger();
    
    // JIRA ticket key pattern (e.g., PROJ-123)
    this.ticketKeyPattern = /[A-Z]+-\d+/g;
    
    this.logger.info('Task & Code Intelligence Service initialized');
  }

  _createLogger() {
    return winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ 
          filename: 'logs/task-code-intelligence.log',
          maxsize: 5242880,
          maxFiles: 5
        })
      ],
      defaultMeta: { service: 'task-code-intelligence' }
    });
  }

  /**
   * Fetch all updates (JIRA + GitHub) for last N days
   */
  async fetchAllUpdates(userId, options = {}) {
    try {
      const {
        days = 7
      } = options;

      this.logger.info('Fetching all updates', { userId, days });

      // Fetch JIRA and GitHub in parallel
      const [jiraResult, githubResult] = await Promise.all([
        this.fetchJIRAUpdates(userId, { days }),
        this.fetchGitHubUpdates(userId, { days })
      ]);

      const allUpdates = [
        ...(jiraResult.updates || []),
        ...(githubResult.updates || [])
      ];

      // Sort by date (newest first)
      allUpdates.sort((a, b) => 
        new Date(b.created_at) - new Date(a.created_at)
      );

      this.logger.info('All updates fetched', {
        total: allUpdates.length,
        jira: jiraResult.updates?.length || 0,
        github: githubResult.updates?.length || 0
      });

      return {
        success: true,
        updates: allUpdates,
        stats: {
          total: allUpdates.length,
          jira: jiraResult.updates?.length || 0,
          github: githubResult.updates?.length || 0
        }
      };

    } catch (error) {
      this.logger.error('Failed to fetch all updates', {
        userId,
        error: error.message
      });
      return {
        success: false,
        error: error.message,
        updates: []
      };
    }
  }

  /**
   * Fetch JIRA updates
   */
  async fetchJIRAUpdates(userId, options = {}) {
    try {
      const { days = 7 } = options;

      if (!this.jiraService || !(await this.jiraService.isConnected(userId))) {
        this.logger.warn('JIRA not connected', { userId });
        return {
          success: false,
          error: 'JIRA not connected',
          updates: []
        };
      }

      this.logger.info('Fetching JIRA updates', { userId, days });

      // Get recent updates and completed issues
      const [recentIssues, completedIssues] = await Promise.all([
        this.jiraService.getRecentUpdates(userId, { days, maxResults: 50 }),
        this.jiraService.getCompletedIssues(userId, { days, maxResults: 50 })
      ]);

      // Combine and deduplicate
      const allIssues = [...recentIssues, ...completedIssues];
      const uniqueIssues = Array.from(
        new Map(allIssues.map(issue => [issue.id, issue])).values()
      );

      // Transform to standard update format
      const updates = uniqueIssues.map(issue => {
        // Build content_text for search/filtering
        const contentParts = [
          issue.summary,
          issue.description,
          `Status: ${issue.status}`,
          `Priority: ${issue.priority || 'None'}`,
          issue.assignee?.displayName ? `Assignee: ${issue.assignee.displayName}` : ''
        ].filter(Boolean);

        return {
          update_type: 'jira_issue',
          external_id: issue.id,
          external_key: issue.key,
          title: issue.summary,
          description: issue.description,
          content_text: contentParts.join('\n'),
          author: issue.assignee?.displayName,
          status: issue.status,
          linked_jira_key: issue.key,
          metadata: {
            issue_type: issue.issueType,
            priority: issue.priority,
            status_category: issue.statusCategory,
            status: issue.status,
            assignee: issue.assignee,
            reporter: issue.reporter,
            url: issue.url,
            due_date: issue.dueDate,
            resolution_date: issue.resolutionDate
          },
          created_at: issue.created,
          updated_at: issue.updated
        };
      });

      // Save to Supabase
      for (const update of updates) {
        await this.supabaseAdapter.saveTeamUpdate(userId, update);
      }

      // ✨ DYNAMIC DELETION: Remove JIRA issues that no longer exist
      await this._cleanupDeletedJiraIssues(userId, updates, days);

      this.logger.info('JIRA updates fetched and saved', {
        userId,
        count: updates.length
      });

      return {
        success: true,
        updates
      };

    } catch (error) {
      this.logger.error('Failed to fetch JIRA updates', {
        userId,
        error: error.message
      });
      
      // If it's a 410 error, the integration was auto-disconnected
      let errorMessage = error.message;
      if (error.message.includes('410')) {
        errorMessage = 'JIRA connection invalid. Please reconnect JIRA from Settings.';
      }
      
      return {
        success: false,
        error: errorMessage,
        updates: []
      };
    }
  }

  /**
   * Clean up deleted JIRA issues from database
   * @private
   */
  async _cleanupDeletedJiraIssues(userId, currentUpdates, days) {
    try {
      // Get list of current JIRA issue IDs from API
      const currentJiraIds = new Set(
        currentUpdates.map(update => update.external_id)
      );

      // Get all JIRA issues in database for the same time window
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      const dbResult = await this.supabaseAdapter.getTeamUpdates(userId, {
        start_date: startDate,
        update_type: 'jira_issue'
      });

      if (!dbResult.success || !dbResult.updates) {
        return;
      }

      // Find issues that are in DB but not in current JIRA response
      const issuesToDelete = dbResult.updates.filter(
        dbUpdate => !currentJiraIds.has(dbUpdate.external_id)
      );

      if (issuesToDelete.length > 0) {
        this.logger.info('Deleting removed JIRA issues', {
          userId,
          count: issuesToDelete.length,
          issues: issuesToDelete.map(u => u.external_key)
        });

        // Delete each issue
        for (const issue of issuesToDelete) {
          await this.supabaseAdapter.deleteTeamUpdate(issue.id);
        }

        this.logger.info('Deleted JIRA issues cleaned up', {
          userId,
          deletedCount: issuesToDelete.length
        });
      }

    } catch (error) {
      this.logger.error('Failed to cleanup deleted JIRA issues', {
        userId,
        error: error.message
      });
      // Don't throw - cleanup failure shouldn't break sync
    }
  }

  /**
   * Fetch GitHub updates (PRs and commits)
   */
  async fetchGitHubUpdates(userId, options = {}) {
    try {
      const { days = 7 } = options;

      if (!this.githubService || !(await this.githubService.isConnected(userId))) {
        this.logger.warn('GitHub not connected', { userId });
        return {
          success: false,
          error: 'GitHub not connected',
          updates: []
        };
      }

      this.logger.info('Fetching GitHub updates', { userId, days });

      const updates = [];

      // Fetch recent PRs
      try {
        const prs = await this.githubService.getRecentPRs(userId, { days });
        
        for (const pr of prs) {
          // Build content_text for search/filtering
          const contentParts = [
            pr.title,
            pr.body,
            `State: ${pr.state}`,
            `Repository: ${pr.repository}`,
            pr.author ? `Author: ${pr.author}` : '',
            pr.merged ? 'Merged' : 'Not merged'
          ].filter(Boolean);

          const update = {
            update_type: 'github_pr',
            external_id: `pr_${pr.id}`,
            external_key: `PR#${pr.number}`,
            title: pr.title,
            description: pr.body,
            content_text: contentParts.join('\n'),
            author: pr.author,
            status: pr.state,
            linked_jira_key: pr.jiraKeys && pr.jiraKeys.length > 0 ? pr.jiraKeys[0] : null,
            metadata: {
              pr_number: pr.number,
              state: pr.state,
              merged: pr.merged,
              repository: pr.repository,
              url: pr.url,
              jira_keys: pr.jiraKeys,
              merged_at: pr.mergedAt
            },
            created_at: pr.createdAt,
            updated_at: pr.updatedAt
          };
          
          updates.push(update);
          await this.supabaseAdapter.saveTeamUpdate(userId, update);
        }
      } catch (error) {
        this.logger.warn('Failed to fetch PRs', { userId, error: error.message });
      }

      // Fetch recent commits
      try {
        const commits = await this.githubService.getRecentCommits(userId, { days });
        
        for (const commit of commits) {
          const commitTitle = commit.message?.split('\n')[0]; // First line
          
          // Build content_text for search/filtering
          const contentParts = [
            commitTitle,
            commit.message,
            `Repository: ${commit.repository}`,
            commit.author ? `Author: ${commit.author}` : '',
            commit.authorEmail ? `Email: ${commit.authorEmail}` : ''
          ].filter(Boolean);

          const update = {
            update_type: 'github_commit',
            external_id: commit.sha,
            external_key: commit.sha.substring(0, 7),
            title: commitTitle,
            description: commit.message,
            content_text: contentParts.join('\n'),
            author: commit.author,
            status: 'committed',
            linked_jira_key: commit.jiraKeys && commit.jiraKeys.length > 0 ? commit.jiraKeys[0] : null,
            metadata: {
              sha: commit.sha,
              repository: commit.repository,
              url: commit.url,
              author_email: commit.authorEmail,
              jira_keys: commit.jiraKeys
            },
            created_at: commit.date,
            updated_at: commit.date
          };
          
          updates.push(update);
          await this.supabaseAdapter.saveTeamUpdate(userId, update);
        }
      } catch (error) {
        this.logger.warn('Failed to fetch commits', { userId, error: error.message });
      }

      this.logger.info('GitHub updates fetched and saved', {
        userId,
        count: updates.length
      });

      return {
        success: true,
        updates
      };

    } catch (error) {
      this.logger.error('Failed to fetch GitHub updates', {
        userId,
        error: error.message
      });
      return {
        success: false,
        error: error.message,
        updates: []
      };
    }
  }

  /**
   * Extract JIRA ticket key from text
   */
  _extractJiraKey(text) {
    if (!text) return null;
    
    const matches = text.match(this.ticketKeyPattern);
    return matches ? matches[0] : null;
  }

  /**
   * Link updates to meetings
   */
  async linkUpdatesToMeeting(meetingId, updateIds) {
    try {
      this.logger.info('Linking updates to meeting', {
        meetingId,
        updateCount: updateIds.length
      });

      for (const updateId of updateIds) {
        await this.supabaseAdapter.linkUpdateToMeeting(updateId, meetingId);
      }

      return {
        success: true,
        linked: updateIds.length
      };

    } catch (error) {
      this.logger.error('Failed to link updates to meeting', {
        meetingId,
        error: error.message
      });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get updates by JIRA key
   */
  async getUpdatesByJiraKey(jiraKey) {
    try {
      this.logger.info('Fetching updates by JIRA key', { jiraKey });

      const result = await this.supabaseAdapter.getTeamUpdatesByJiraKey(jiraKey);

      return result;

    } catch (error) {
      this.logger.error('Failed to fetch updates by JIRA key', {
        jiraKey,
        error: error.message
      });
      return {
        success: false,
        error: error.message,
        updates: []
      };
    }
  }
}

module.exports = TaskCodeIntelligenceService;

