/**
 * JIRA Adapter
 * 
 * Transforms JIRA data into HeyJarvis internal schemas:
 * - Issues → Tasks
 * - Sprints → Workflow periods
 * - Projects → Team workspaces
 * 
 * Features:
 * 1. Data normalization and mapping
 * 2. Sprint velocity calculations
 * 3. Blocker and dependency detection
 * 4. Priority signal extraction
 */

const winston = require('winston');

class JIRAAdapter {
  constructor(options = {}) {
    this.options = {
      logLevel: options.logLevel || 'info',
      ...options
    };

    this.logger = winston.createLogger({
      level: this.options.logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/jira-adapter.log' })
      ],
      defaultMeta: { service: 'jira-adapter' }
    });

    this.logger.info('JIRA Adapter initialized');
  }

  /**
   * Transform JIRA issue to HeyJarvis task
   */
  issueToTask(issue, userId) {
    try {
      const task = {
        // Core fields
        id: `jira_${issue.id}`,
        external_id: issue.id,
        external_key: issue.key,
        source: 'jira',
        
        // Task details
        title: issue.summary,
        description: issue.description || '',
        status: this._mapStatus(issue.status),
        priority: this._mapPriority(issue.priority),
        
        // Assignment
        assigned_to: issue.assignee ? {
          id: issue.assignee.account_id,
          name: issue.assignee.display_name,
          email: issue.assignee.email,
          avatar_url: issue.assignee.avatar_url
        } : null,
        
        created_by: issue.reporter ? {
          id: issue.reporter.account_id,
          name: issue.reporter.display_name,
          email: issue.reporter.email
        } : null,
        
        // Metadata
        issue_type: issue.issue_type?.name,
        story_points: issue.story_points,
        labels: issue.labels || [],
        components: issue.components || [],
        
        // Timestamps
        created_at: issue.created_at,
        updated_at: issue.updated_at,
        
        // Links
        url: issue.url,
        
        // Sprint info
        sprint: issue.sprint ? {
          id: issue.sprint.id,
          name: issue.sprint.name,
          state: issue.sprint.state
        } : null,
        
        // Metadata for HeyJarvis
        metadata: {
          jira_status_category: issue.status?.category,
          jira_project_key: issue.key?.split('-')[0],
          is_blocked: this._isBlocked(issue),
          blockers: this._extractBlockers(issue)
        }
      };

      this.logger.debug('Issue transformed to task', {
        issueKey: issue.key,
        taskId: task.id
      });

      return task;

    } catch (error) {
      this.logger.error('Failed to transform issue to task', {
        issueKey: issue.key,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Map JIRA status to HeyJarvis task status
   */
  _mapStatus(jiraStatus) {
    if (!jiraStatus) return 'todo';

    const category = jiraStatus.category?.toLowerCase();
    
    switch (category) {
      case 'done':
        return 'completed';
      case 'indeterminate':
        return 'in_progress';
      case 'new':
      default:
        return 'todo';
    }
  }

  /**
   * Map JIRA priority to HeyJarvis priority
   */
  _mapPriority(jiraPriority) {
    if (!jiraPriority) return 'medium';

    const name = jiraPriority.name?.toLowerCase();
    
    if (name?.includes('highest') || name?.includes('critical')) {
      return 'critical';
    } else if (name?.includes('high')) {
      return 'high';
    } else if (name?.includes('low')) {
      return 'low';
    }
    
    return 'medium';
  }

  /**
   * Check if issue is blocked
   */
  _isBlocked(issue) {
    // Check labels for "blocked"
    if (issue.labels?.some(label => label.toLowerCase().includes('blocked'))) {
      return true;
    }
    
    // Check status name
    if (issue.status?.name?.toLowerCase().includes('blocked')) {
      return true;
    }
    
    return false;
  }

  /**
   * Extract blocker information
   */
  _extractBlockers(issue) {
    const blockers = [];
    
    // Extract from labels
    issue.labels?.forEach(label => {
      if (label.toLowerCase().includes('blocked')) {
        blockers.push({
          type: 'label',
          reason: label
        });
      }
    });
    
    // Extract from status
    if (issue.status?.name?.toLowerCase().includes('blocked')) {
      blockers.push({
        type: 'status',
        reason: issue.status.name
      });
    }
    
    return blockers;
  }

  /**
   * Calculate sprint velocity metrics
   */
  calculateSprintVelocity(issues, sprint) {
    try {
      this.logger.info('Calculating sprint velocity', {
        sprintId: sprint.id,
        issueCount: issues.length
      });

      const metrics = {
        sprint_id: sprint.id,
        sprint_name: sprint.name,
        sprint_state: sprint.state,
        
        // Counts
        total_issues: issues.length,
        completed_issues: 0,
        in_progress_issues: 0,
        todo_issues: 0,
        blocked_issues: 0,
        
        // Story points
        total_story_points: 0,
        completed_story_points: 0,
        in_progress_story_points: 0,
        todo_story_points: 0,
        
        // Rates
        completion_rate: 0,
        velocity_rate: 0,
        
        // Issue breakdown
        by_type: {},
        by_assignee: {},
        
        // Blockers
        blockers: []
      };

      issues.forEach(issue => {
        const storyPoints = issue.story_points || 0;
        const statusCategory = issue.status?.category;
        const issueType = issue.issue_type?.name || 'Unknown';
        const assignee = issue.assignee?.display_name || 'Unassigned';

        // Count by status
        metrics.total_story_points += storyPoints;
        
        if (statusCategory === 'done') {
          metrics.completed_issues++;
          metrics.completed_story_points += storyPoints;
        } else if (statusCategory === 'indeterminate') {
          metrics.in_progress_issues++;
          metrics.in_progress_story_points += storyPoints;
        } else {
          metrics.todo_issues++;
          metrics.todo_story_points += storyPoints;
        }
        
        // Count blocked issues
        if (this._isBlocked(issue)) {
          metrics.blocked_issues++;
          metrics.blockers.push({
            key: issue.key,
            summary: issue.summary,
            assignee: issue.assignee?.display_name,
            blockers: this._extractBlockers(issue)
          });
        }
        
        // Count by type
        if (!metrics.by_type[issueType]) {
          metrics.by_type[issueType] = { count: 0, story_points: 0 };
        }
        metrics.by_type[issueType].count++;
        metrics.by_type[issueType].story_points += storyPoints;
        
        // Count by assignee
        if (!metrics.by_assignee[assignee]) {
          metrics.by_assignee[assignee] = { count: 0, story_points: 0, completed: 0 };
        }
        metrics.by_assignee[assignee].count++;
        metrics.by_assignee[assignee].story_points += storyPoints;
        if (statusCategory === 'done') {
          metrics.by_assignee[assignee].completed++;
        }
      });

      // Calculate rates
      if (metrics.total_issues > 0) {
        metrics.completion_rate = metrics.completed_issues / metrics.total_issues;
      }
      
      if (metrics.total_story_points > 0) {
        metrics.velocity_rate = metrics.completed_story_points / metrics.total_story_points;
      }

      this.logger.info('Sprint velocity calculated', {
        sprintId: sprint.id,
        completionRate: metrics.completion_rate,
        velocityRate: metrics.velocity_rate,
        blockedIssues: metrics.blocked_issues
      });

      return metrics;

    } catch (error) {
      this.logger.error('Failed to calculate sprint velocity', {
        sprintId: sprint?.id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Identify bottlenecks in workflow
   */
  identifyBottlenecks(issues, sprint) {
    try {
      this.logger.info('Identifying bottlenecks', {
        sprintId: sprint?.id,
        issueCount: issues.length
      });

      const bottlenecks = [];
      
      // Check for blocked issues
      const blockedIssues = issues.filter(issue => this._isBlocked(issue));
      if (blockedIssues.length > 0) {
        bottlenecks.push({
          type: 'blocked_issues',
          severity: blockedIssues.length > 3 ? 'high' : 'medium',
          count: blockedIssues.length,
          description: `${blockedIssues.length} issue(s) are currently blocked`,
          issues: blockedIssues.map(i => ({ key: i.key, summary: i.summary }))
        });
      }
      
      // Check for issues stuck in review
      const reviewIssues = issues.filter(issue => 
        issue.status?.name?.toLowerCase().includes('review')
      );
      if (reviewIssues.length > 2) {
        bottlenecks.push({
          type: 'stuck_in_review',
          severity: 'medium',
          count: reviewIssues.length,
          description: `${reviewIssues.length} issue(s) stuck in review`,
          issues: reviewIssues.map(i => ({ key: i.key, summary: i.summary }))
        });
      }
      
      // Check for unassigned critical issues
      const unassignedCritical = issues.filter(issue => 
        !issue.assignee && 
        (issue.priority?.name?.toLowerCase().includes('high') || 
         issue.priority?.name?.toLowerCase().includes('critical'))
      );
      if (unassignedCritical.length > 0) {
        bottlenecks.push({
          type: 'unassigned_critical',
          severity: 'high',
          count: unassignedCritical.length,
          description: `${unassignedCritical.length} critical issue(s) are unassigned`,
          issues: unassignedCritical.map(i => ({ key: i.key, summary: i.summary }))
        });
      }
      
      // Check for overloaded assignees
      const assigneeWorkload = {};
      issues.forEach(issue => {
        if (issue.assignee && issue.status?.category !== 'done') {
          const name = issue.assignee.display_name;
          if (!assigneeWorkload[name]) {
            assigneeWorkload[name] = { count: 0, story_points: 0 };
          }
          assigneeWorkload[name].count++;
          assigneeWorkload[name].story_points += (issue.story_points || 0);
        }
      });
      
      Object.entries(assigneeWorkload).forEach(([name, workload]) => {
        if (workload.count > 5) {
          bottlenecks.push({
            type: 'overloaded_assignee',
            severity: workload.count > 8 ? 'high' : 'medium',
            assignee: name,
            count: workload.count,
            story_points: workload.story_points,
            description: `${name} has ${workload.count} open issues (${workload.story_points} points)`
          });
        }
      });

      this.logger.info('Bottlenecks identified', {
        sprintId: sprint?.id,
        bottleneckCount: bottlenecks.length
      });

      return bottlenecks;

    } catch (error) {
      this.logger.error('Failed to identify bottlenecks', {
        sprintId: sprint?.id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Extract dependencies between issues
   */
  extractDependencies(issues) {
    // Note: This is a basic implementation
    // Full implementation would parse issue links and dependencies from JIRA
    const dependencies = [];
    
    issues.forEach(issue => {
      // Check description for ticket references
      const ticketPattern = /[A-Z]+-\d+/g;
      const matches = issue.description?.match(ticketPattern) || [];
      
      matches.forEach(match => {
        if (match !== issue.key) {
          dependencies.push({
            from: issue.key,
            to: match,
            type: 'mentioned_in_description'
          });
        }
      });
    });
    
    return dependencies;
  }
}

module.exports = JIRAAdapter;

