/**
 * Team Report Generator
 * Generates team velocity, capacity, and health metrics
 */

const BaseReportGenerator = require('./base-report-generator');

class TeamReportGenerator extends BaseReportGenerator {
  constructor(jiraService, confluenceService, options = {}) {
    super(jiraService, confluenceService, options);
    this.sprintCount = options.sprintCount || 5; // Last N sprints
  }

  _getReportType() {
    return 'team';
  }

  /**
   * Fetch team's project and issues
   */
  async _fetchData(teamProjectKey, options) {
    this.logger.info('Fetching team data', { teamProjectKey });

    const periodStart = options.startDate || new Date(Date.now() - 90*24*3600*1000).toISOString().split('T')[0];
    const periodEnd = options.endDate || new Date().toISOString().split('T')[0];

    try {
      // Get all issues in the project for the period
      const jql = `project = "${teamProjectKey}" AND updated >= "${periodStart}" AND updated <= "${periodEnd}" ORDER BY created DESC`;
      
      const issues = await this.jiraService.getIssuesByJQL(jql, {
        expand: ['changelog'],
        fields: ['*all'],
        maxResults: 200
      });

      // Get project details
      let projectInfo = null;
      try {
        const projects = await this.jiraService.getProjects();
        projectInfo = projects.find(p => p.key === teamProjectKey);
      } catch (error) {
        this.logger.warn('Could not fetch project info', { error: error.message });
      }

      return {
        teamProjectKey,
        projectInfo,
        issues: issues || [],
        period: { start: periodStart, end: periodEnd }
      };
    } catch (error) {
      this.logger.error('Failed to fetch team data', { error: error.message });
      return {
        teamProjectKey,
        issues: [],
        period: { start: periodStart, end: periodEnd },
        error: error.message
      };
    }
  }

  /**
   * Calculate team metrics
   */
  async _calculateMetrics(data, options) {
    this.logger.info('Calculating team metrics', { teamProjectKey: data.teamProjectKey });

    const issues = data.issues || [];
    
    // Calculate velocity (completed story points)
    const completedIssues = issues.filter(i => i.fields.status.name === 'Done' || i.fields.status.name === 'Closed');
    const velocity = completedIssues.reduce((sum, i) => sum + (i.fields.customfield_10000 || 0), 0);

    // Total planned points
    const totalPoints = issues.reduce((sum, i) => sum + (i.fields.customfield_10000 || 0), 0);

    // Team member count
    const teamMembers = new Set(
      issues
        .map(i => i.fields.assignee?.emailAddress)
        .filter(Boolean)
    );

    // Blocker analysis
    const blockers = issues.filter(issue => {
      return issue.fields.labels?.includes('blocked') || 
             issue.fields.status.name === 'Blocked';
    });

    // Throughput (issues completed)
    const throughput = completedIssues.length;

    // Issue type distribution
    const issueTypes = {};
    issues.forEach(issue => {
      const type = issue.fields.issuetype.name;
      issueTypes[type] = (issueTypes[type] || 0) + 1;
    });

    // Capacity utilization
    const capacityUtilization = totalPoints > 0 ? velocity / totalPoints : 0;

    return {
      velocity,
      totalPoints,
      completionRate: Math.round((velocity / Math.max(totalPoints, 1)) * 100),
      teamSize: teamMembers.size,
      capacityUtilization: parseFloat(capacityUtilization.toFixed(2)),
      currentBlockers: blockers.length,
      throughput,
      issueTypeDistribution: issueTypes,
      period: data.period
    };
  }

  /**
   * Generate summary
   */
  _generateBasicSummary(metrics, data) {
    return `Team ${data.teamProjectKey} (${metrics.teamSize} members) completed ${metrics.velocity} story points out of ${metrics.totalPoints} planned (${metrics.completionRate}% completion rate). ${metrics.currentBlockers} blockers identified.`;
  }

  _getEntityName(data) {
    return data.projectInfo?.name || data.teamProjectKey;
  }
}

module.exports = TeamReportGenerator;

