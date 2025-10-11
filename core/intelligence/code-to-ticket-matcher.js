/**
 * Code-to-Ticket Matcher
 * 
 * Links GitHub commits and PRs to JIRA tickets:
 * - Extract ticket keys from commit messages
 * - Analyze PR size vs story point estimates
 * - Track actual time spent (first commit to PR merge)
 * - Surface estimation accuracy patterns
 * 
 * Features:
 * 1. Commit message parsing for ticket references
 * 2. PR size analysis
 * 3. Estimation accuracy tracking
 * 4. Developer velocity insights
 * 5. Over/under-estimation pattern detection
 */

const winston = require('winston');
const EventEmitter = require('events');

class CodeToTicketMatcher extends EventEmitter {
  constructor(githubActionsService, jiraService, options = {}) {
    super();
    
    this.githubActionsService = githubActionsService;
    this.jiraService = jiraService;
    
    this.options = {
      logLevel: options.logLevel || 'info',
      ticketKeyPattern: options.ticketKeyPattern || /[A-Z]+-\d+/g,
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
          filename: 'logs/code-to-ticket-matcher.log',
          maxsize: 5242880, // 5MB
          maxFiles: 5
        })
      ],
      defaultMeta: { service: 'code-to-ticket-matcher' }
    });

    this.logger.info('Code-to-Ticket Matcher initialized');
  }

  /**
   * Match commits to JIRA tickets
   */
  async matchCommitsToTickets(options = {}) {
    try {
      const {
        branch = 'main',
        limit = 50
      } = options;

      this.logger.info('Matching commits to tickets', { branch, limit });

      // Get recent workflow runs (which contain commit info)
      const workflowRuns = await this.githubActionsService.getWorkflowRuns({
        branch,
        per_page: limit
      });

      const matches = [];

      for (const run of workflowRuns.workflow_runs) {
        const commitMessage = run.head_commit?.message;
        
        if (!commitMessage) continue;

        // Extract ticket keys from commit message
        const ticketKeys = this._extractTicketKeys(commitMessage);
        
        if (ticketKeys.length > 0) {
          matches.push({
            commit_sha: run.head_commit.sha,
            commit_message: commitMessage,
            commit_author: run.head_commit.author,
            workflow_run_id: run.id,
            workflow_status: run.status,
            workflow_conclusion: run.conclusion,
            created_at: run.created_at,
            ticket_keys: ticketKeys
          });
        }
      }

      this.logger.info('Commits matched to tickets', {
        totalCommits: workflowRuns.workflow_runs.length,
        matchedCommits: matches.length
      });

      return matches;

    } catch (error) {
      this.logger.error('Failed to match commits to tickets', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Analyze PR size vs story points
   */
  async analyzePREstimation(prNumber) {
    try {
      this.logger.info('Analyzing PR estimation', { prNumber });

      // This would require additional GitHub API calls to get PR details
      // For now, returning structure for future implementation
      
      const analysis = {
        pr_number: prNumber,
        lines_changed: null, // Would fetch from GitHub PR API
        files_changed: null,
        story_points_estimated: null, // Would fetch from linked JIRA ticket
        complexity_score: null,
        estimation_accuracy: 'unknown',
        recommendations: []
      };

      return analysis;

    } catch (error) {
      this.logger.error('Failed to analyze PR estimation', {
        prNumber,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Track time from first commit to PR merge
   */
  async trackTimeToMerge(ticketKey) {
    try {
      this.logger.info('Tracking time to merge for ticket', { ticketKey });

      // Get all commits that reference this ticket
      const matches = await this.matchCommitsToTickets({ limit: 100 });
      const relevantCommits = matches.filter(m => 
        m.ticket_keys.includes(ticketKey)
      );

      if (relevantCommits.length === 0) {
        return {
          ticket_key: ticketKey,
          first_commit: null,
          last_commit: null,
          time_to_complete_hours: null,
          commit_count: 0
        };
      }

      // Sort by date
      relevantCommits.sort((a, b) => 
        new Date(a.created_at) - new Date(b.created_at)
      );

      const firstCommit = relevantCommits[0];
      const lastCommit = relevantCommits[relevantCommits.length - 1];
      
      const timeToCompleteMs = new Date(lastCommit.created_at) - 
                                new Date(firstCommit.created_at);
      const timeToCompleteHours = timeToCompleteMs / (1000 * 60 * 60);

      const result = {
        ticket_key: ticketKey,
        first_commit: {
          sha: firstCommit.commit_sha,
          message: firstCommit.commit_message,
          author: firstCommit.commit_author,
          date: firstCommit.created_at
        },
        last_commit: {
          sha: lastCommit.commit_sha,
          message: lastCommit.commit_message,
          author: lastCommit.commit_author,
          date: lastCommit.created_at
        },
        time_to_complete_hours: timeToCompleteHours,
        time_to_complete_days: timeToCompleteHours / 24,
        commit_count: relevantCommits.length,
        all_commits: relevantCommits
      };

      this.logger.info('Time to merge tracked', {
        ticketKey,
        timeToCompleteHours: Math.round(timeToCompleteHours),
        commitCount: relevantCommits.length
      });

      return result;

    } catch (error) {
      this.logger.error('Failed to track time to merge', {
        ticketKey,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Analyze estimation accuracy for a sprint
   */
  async analyzeSprintEstimationAccuracy(sprintId) {
    try {
      this.logger.info('Analyzing sprint estimation accuracy', { sprintId });

      // Get sprint issues
      const issues = await this.jiraService.getSprintIssues(sprintId);

      const analysis = {
        sprint_id: sprintId,
        issues_analyzed: 0,
        accurate_estimates: 0,
        over_estimated: 0,
        under_estimated: 0,
        estimation_patterns: [],
        recommendations: []
      };

      for (const issue of issues) {
        if (!issue.story_points || issue.status?.category !== 'done') {
          continue; // Skip issues without estimates or not completed
        }

        analysis.issues_analyzed++;

        // Track time to merge for this issue
        const timeTracking = await this.trackTimeToMerge(issue.key);
        
        if (!timeTracking.time_to_complete_hours) {
          continue; // No commit data available
        }

        // Calculate expected hours based on story points
        // Rough heuristic: 1 story point = 4 hours
        const expectedHours = issue.story_points * 4;
        const actualHours = timeTracking.time_to_complete_hours;
        const variance = ((actualHours - expectedHours) / expectedHours) * 100;

        // Classify estimation accuracy
        if (Math.abs(variance) <= 20) {
          analysis.accurate_estimates++;
        } else if (variance > 20) {
          analysis.under_estimated++;
        } else {
          analysis.over_estimated++;
        }

        analysis.estimation_patterns.push({
          ticket_key: issue.key,
          summary: issue.summary,
          story_points: issue.story_points,
          expected_hours: expectedHours,
          actual_hours: Math.round(actualHours),
          variance_percent: Math.round(variance),
          accuracy: Math.abs(variance) <= 20 ? 'accurate' : 
                   variance > 20 ? 'under_estimated' : 'over_estimated'
        });
      }

      // Generate recommendations
      if (analysis.issues_analyzed > 0) {
        const underEstimateRate = (analysis.under_estimated / analysis.issues_analyzed) * 100;
        const overEstimateRate = (analysis.over_estimated / analysis.issues_analyzed) * 100;

        if (underEstimateRate > 40) {
          analysis.recommendations.push({
            priority: 'high',
            title: 'Chronic under-estimation detected',
            description: `${Math.round(underEstimateRate)}% of issues took longer than estimated. Consider increasing story point estimates or breaking down larger tasks.`
          });
        }

        if (overEstimateRate > 40) {
          analysis.recommendations.push({
            priority: 'medium',
            title: 'Frequent over-estimation',
            description: `${Math.round(overEstimateRate)}% of issues completed faster than estimated. Team may be sandbagging estimates or work is simpler than expected.`
          });
        }

        const accuracyRate = (analysis.accurate_estimates / analysis.issues_analyzed) * 100;
        if (accuracyRate > 60) {
          analysis.recommendations.push({
            priority: 'low',
            title: 'Good estimation accuracy',
            description: `${Math.round(accuracyRate)}% of estimates were accurate. Keep up the good work!`
          });
        }
      }

      this.logger.info('Sprint estimation accuracy analyzed', {
        sprintId,
        issuesAnalyzed: analysis.issues_analyzed,
        accurateEstimates: analysis.accurate_estimates
      });

      this.emit('estimation_analyzed', {
        sprint_id: sprintId,
        analysis
      });

      return analysis;

    } catch (error) {
      this.logger.error('Failed to analyze sprint estimation accuracy', {
        sprintId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Extract ticket keys from text
   */
  _extractTicketKeys(text) {
    const matches = text.match(this.options.ticketKeyPattern);
    return matches ? [...new Set(matches)] : []; // Remove duplicates
  }

  /**
   * Get developer velocity insights
   */
  async getDeveloperVelocity(developerName, sprintIds) {
    try {
      this.logger.info('Getting developer velocity', {
        developer: developerName,
        sprintCount: sprintIds.length
      });

      const insights = {
        developer: developerName,
        sprints_analyzed: sprintIds.length,
        total_commits: 0,
        total_issues_completed: 0,
        total_story_points: 0,
        average_time_per_issue_hours: null,
        estimation_accuracy: {
          accurate: 0,
          under_estimated: 0,
          over_estimated: 0
        }
      };

      for (const sprintId of sprintIds) {
        try {
          // Get sprint issues assigned to this developer
          const issues = await this.jiraService.getSprintIssues(sprintId);
          const developerIssues = issues.filter(issue => 
            issue.assignee?.display_name === developerName &&
            issue.status?.category === 'done'
          );

          insights.total_issues_completed += developerIssues.length;
          insights.total_story_points += developerIssues.reduce((sum, issue) => 
            sum + (issue.story_points || 0), 0
          );

          // Track commits for each issue
          for (const issue of developerIssues) {
            const timeTracking = await this.trackTimeToMerge(issue.key);
            if (timeTracking.commit_count > 0) {
              insights.total_commits += timeTracking.commit_count;
            }
          }

        } catch (error) {
          this.logger.warn('Failed to analyze sprint for developer', {
            sprintId,
            developer: developerName,
            error: error.message
          });
        }
      }

      // Calculate averages
      if (insights.total_issues_completed > 0) {
        insights.average_story_points_per_issue = 
          insights.total_story_points / insights.total_issues_completed;
      }

      this.logger.info('Developer velocity calculated', {
        developer: developerName,
        totalIssues: insights.total_issues_completed,
        totalStoryPoints: insights.total_story_points
      });

      return insights;

    } catch (error) {
      this.logger.error('Failed to get developer velocity', {
        developer: developerName,
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = CodeToTicketMatcher;


