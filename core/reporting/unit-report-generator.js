/**
 * Unit Report Generator
 * Generates organizational/department metrics across multiple teams
 */

const BaseReportGenerator = require('./base-report-generator');

class UnitReportGenerator extends BaseReportGenerator {
  _getReportType() {
    return 'unit';
  }

  /**
   * Fetch data from multiple projects in the unit
   */
  async _fetchData(unitProjects, options) {
    this.logger.info('Fetching unit data', { unitProjects });

    const periodStart = options.startDate || new Date(Date.now() - 90*24*3600*1000).toISOString().split('T')[0];
    const periodEnd = options.endDate || new Date().toISOString().split('T')[0];

    // unitProjects should be an array like ['PROJ1', 'PROJ2', 'PROJ3']
    const projectKeys = Array.isArray(unitProjects) ? unitProjects : [unitProjects];

    try {
      // Fetch issues from all projects
      const allIssues = [];
      
      for (const projectKey of projectKeys) {
        const jql = `project = "${projectKey}" AND updated >= "${periodStart}" AND updated <= "${periodEnd}" ORDER BY created DESC`;
        
        try {
          const issues = await this.jiraService.getIssuesByJQL(jql, {
            expand: ['changelog'],
            fields: ['*all'],
            maxResults: 200
          });
          
          allIssues.push(...(issues || []));
        } catch (error) {
          this.logger.warn(`Failed to fetch issues for project ${projectKey}`, { error: error.message });
        }
      }

      return {
        unitProjects: projectKeys,
        issues: allIssues,
        period: { start: periodStart, end: periodEnd }
      };
    } catch (error) {
      this.logger.error('Failed to fetch unit data', { error: error.message });
      return {
        unitProjects: projectKeys,
        issues: [],
        period: { start: periodStart, end: periodEnd },
        error: error.message
      };
    }
  }

  /**
   * Calculate unit-level metrics
   */
  async _calculateMetrics(data, options) {
    this.logger.info('Calculating unit metrics', { unitProjects: data.unitProjects });

    const issues = data.issues || [];
    
    // Aggregate velocity across all projects
    const completedIssues = issues.filter(i => i.fields.status.name === 'Done' || i.fields.status.name === 'Closed');
    const aggregateVelocity = completedIssues.reduce((sum, i) => sum + (i.fields.customfield_10000 || 0), 0);

    // Total planned points
    const totalPoints = issues.reduce((sum, i) => sum + (i.fields.customfield_10000 || 0), 0);

    // Cross-team blockers
    const crossTeamBlockers = issues.filter(issue => {
      return issue.fields.labels?.includes('blocked') || 
             issue.fields.status.name === 'Blocked';
    });

    // Resource utilization (unique team members across all projects)
    const allTeamMembers = new Set(
      issues
        .map(i => i.fields.assignee?.emailAddress)
        .filter(Boolean)
    );

    // Feature completion rate
    const epics = issues.filter(i => i.fields.issuetype.name === 'Epic');
    const completedEpics = epics.filter(i => i.fields.status.name === 'Done' || i.fields.status.name === 'Closed');
    const featureCompletionRate = epics.length > 0 ? (completedEpics.length / epics.length) * 100 : 0;

    // Project breakdown
    const projectBreakdown = {};
    data.unitProjects.forEach(projectKey => {
      const projectIssues = issues.filter(i => i.fields.project.key === projectKey);
      const projectCompleted = projectIssues.filter(i => i.fields.status.name === 'Done' || i.fields.status.name === 'Closed');
      const projectVelocity = projectCompleted.reduce((sum, i) => sum + (i.fields.customfield_10000 || 0), 0);
      
      projectBreakdown[projectKey] = {
        totalIssues: projectIssues.length,
        completedIssues: projectCompleted.length,
        velocity: projectVelocity
      };
    });

    // Capacity utilization
    const capacityUtilization = totalPoints > 0 ? aggregateVelocity / totalPoints : 0;

    return {
      aggregateVelocity,
      totalPoints,
      completionRate: Math.round((aggregateVelocity / Math.max(totalPoints, 1)) * 100),
      crossTeamBlockers: crossTeamBlockers.length,
      resourceCount: allTeamMembers.size,
      featureCompletionRate: parseFloat(featureCompletionRate.toFixed(1)),
      capacityUtilization: parseFloat(capacityUtilization.toFixed(2)),
      projectCount: data.unitProjects.length,
      projectBreakdown,
      period: data.period
    };
  }

  /**
   * Generate summary
   */
  _generateBasicSummary(metrics, data) {
    return `Unit with ${metrics.projectCount} projects and ${metrics.resourceCount} team members delivered ${metrics.aggregateVelocity} story points (${metrics.completionRate}% completion rate). ${metrics.crossTeamBlockers} cross-team blockers identified. Feature completion rate: ${metrics.featureCompletionRate}%.`;
  }

  _getEntityName(data) {
    return `Unit (${data.unitProjects.join(', ')})`;
  }
}

module.exports = UnitReportGenerator;

