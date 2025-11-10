/**
 * Person Report Generator
 * Generates individual contributor metrics and performance report
 */

const BaseReportGenerator = require('./base-report-generator');

class PersonReportGenerator extends BaseReportGenerator {
  _getReportType() {
    return 'person';
  }

  /**
   * Fetch all issues assigned to this person
   */
  async _fetchData(personEmail, options) {
    this.logger.info('Fetching person data', { personEmail });

    const periodStart = options.startDate || new Date(Date.now() - 90*24*3600*1000).toISOString().split('T')[0];
    const periodEnd = options.endDate || new Date().toISOString().split('T')[0];

    // Build JQL query for assigned issues (both completed and in-progress)
    const jql = `assignee = "${personEmail}" AND updated >= "${periodStart}" AND updated <= "${periodEnd}" ORDER BY updated DESC`;

    try {
      const issues = await this.jiraService.getIssuesByJQL(jql, {
        expand: ['changelog'],
        fields: ['*all'],
        maxResults: 100
      });

      // Fetch supporting Confluence documentation for this person's work
      let confluenceDocs = [];
      if (this.confluenceService) {
        try {
          // Search for pages mentioning this person or their recent work
          const userName = personEmail.split('@')[0];
          const searchResult = await this.confluenceService.searchPages(userName, { limit: 5 });
          confluenceDocs = searchResult?.results || [];
        } catch (confError) {
          this.logger.warn('Failed to fetch Confluence docs', { error: confError.message });
        }
      }

      return {
        personEmail,
        assignedIssues: issues || [],
        confluenceDocs,
        period: { start: periodStart, end: periodEnd }
      };
    } catch (error) {
      this.logger.error('Failed to fetch person data', { error: error.message });
      return {
        personEmail,
        assignedIssues: [],
        confluenceDocs: [],
        period: { start: periodStart, end: periodEnd },
        error: error.message
      };
    }
  }

  /**
   * Calculate person-level metrics
   */
  async _calculateMetrics(data, options) {
    this.logger.info('Calculating person metrics', { personEmail: data.personEmail });

    const assignedIssues = data.assignedIssues || [];
    const completedIssues = assignedIssues.filter(i => 
      i.fields.status.name === 'Done' || i.fields.status.name === 'Closed'
    );
    const inProgressIssues = assignedIssues.filter(i => 
      i.fields.status.name === 'In Progress' || i.fields.status.name === 'In Review'
    );

    // Issue statistics
    const issuesCompleted = completedIssues.length;
    const totalPoints = completedIssues.reduce((sum, issue) => {
      return sum + (issue.fields.customfield_10000 || 0); // story points custom field
    }, 0);

    // Cycle time analysis
    const cycleTimes = completedIssues
      .map(issue => {
        const created = new Date(issue.fields.created);
        const updated = new Date(issue.fields.updated);
        return (updated - created) / (1000 * 60 * 60 * 24); // Convert to days
      })
      .filter(ct => ct > 0);

    const avgCycleTime = cycleTimes.length > 0
      ? cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length
      : 0;

    // Quality metrics
    const reopenedCount = this._countReopened(assignedIssues);

    // Issue type distribution
    const issueTypes = {};
    assignedIssues.forEach(issue => {
      const type = issue.fields.issuetype.name;
      issueTypes[type] = (issueTypes[type] || 0) + 1;
    });

    return {
      totalIssues: assignedIssues.length,
      issuesCompleted,
      inProgressCount: inProgressIssues.length,
      storyPointsDelivered: totalPoints,
      avgCycleTimeDays: parseFloat(avgCycleTime.toFixed(1)),
      issueTypeDistribution: issueTypes,
      reopenedIssues: reopenedCount,
      qualityScore: Math.round((1 - reopenedCount / Math.max(issuesCompleted, 1)) * 100),
      period: data.period,
      recentIssues: assignedIssues.slice(0, 5) // Top 5 most recent
    };
  }

  /**
   * Generate summary in required format:
   * a) Description of the person's current work
   * b) Progress from JIRA
   * c) Supporting documentation from Confluence
   */
  async _generateBasicSummary(metrics, data) {
    let summary = '';
    
    // a) Description of the person's current work
    summary += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    summary += `👤 PERSON REPORT\n`;
    summary += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    summary += `${data.personEmail}\n`;
    summary += `Period: ${data.period.start} to ${data.period.end}\n\n`;
    
    summary += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    summary += `📋 CURRENT WORK\n`;
    summary += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    if (metrics.recentIssues && metrics.recentIssues.length > 0) {
      summary += `Working on ${metrics.totalIssues} issues:\n\n`;
      metrics.recentIssues.forEach((issue, idx) => {
        const status = issue.fields.status.name;
        const key = issue.key;
        const title = issue.fields.summary;
        const statusEmoji = status === 'Done' || status === 'Closed' ? '✅' : 
                           status === 'In Progress' ? '🔄' : '📋';
        summary += `${idx + 1}. ${statusEmoji} ${key}: ${title}\n`;
        summary += `   Status: ${status}\n\n`;
      });
    } else {
      summary += `No issues found in the specified period.\n`;
    }
    summary += `\n`;
    
    // b) Progress from JIRA
    summary += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    summary += `📊 PROGRESS METRICS\n`;
    summary += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    summary += `Completed: ${metrics.issuesCompleted} issues\n`;
    summary += `In Progress: ${metrics.inProgressCount} issues\n`;
    summary += `Story Points Delivered: ${metrics.storyPointsDelivered}\n`;
    summary += `Average Cycle Time: ${metrics.avgCycleTimeDays} days\n`;
    summary += `Quality Score: ${metrics.qualityScore}% (${metrics.reopenedIssues} reopened)\n`;
    
    if (Object.keys(metrics.issueTypeDistribution).length > 0) {
      summary += `\nIssue Types:\n`;
      Object.entries(metrics.issueTypeDistribution).forEach(([type, count]) => {
        summary += `  • ${type}: ${count}\n`;
      });
    }
    summary += `\n`;
    
    // c) Supporting documentation from Confluence
    summary += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    summary += `📚 SUPPORTING DOCUMENTATION\n`;
    summary += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    if (data.confluenceDocs && data.confluenceDocs.length > 0) {
      data.confluenceDocs.forEach((doc, idx) => {
        const title = doc.title || doc.content?.title || 'Untitled';
        const url = doc._links?.webui || doc.url || '';
        const excerpt = doc.excerpt || doc.content?.excerpt || '';
        summary += `${idx + 1}. ${title}\n`;
        if (url) {
          summary += `   ${url}\n`;
        }
        if (excerpt) {
          const cleanExcerpt = excerpt.replace(/<[^>]*>/g, '').substring(0, 150);
          summary += `   ${cleanExcerpt}...\n`;
        }
        summary += `\n`;
      });
    } else {
      summary += `No related Confluence documentation found.\n`;
    }

    return summary;
  }

  /**
   * Utility: count reopened issues
   */
  _countReopened(issues) {
    return issues.filter(issue => {
      const history = issue.changelog?.histories || [];
      const statusChanges = history.filter(h => 
        h.items?.some(i => i.field === 'status')
      );
      return statusChanges.length > 1;
    }).length;
  }

  _getEntityName(data) {
    return data.personEmail;
  }
}

module.exports = PersonReportGenerator;

