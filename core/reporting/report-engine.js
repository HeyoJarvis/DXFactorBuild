/**
 * Report Engine
 * Central orchestrator for all report generation
 * Manages report generators and provides unified API
 */

const PersonReportGenerator = require('./person-report-generator');
const TeamReportGenerator = require('./team-report-generator');
const UnitReportGenerator = require('./unit-report-generator');
const FeatureReportGenerator = require('./feature-report-generator');

class ReportEngine {
  constructor(jiraService, confluenceService, options = {}) {
    this.jiraService = jiraService;
    this.confluenceService = confluenceService;
    
    this.options = {
      aiEnabled: true,
      cacheTTL: 3600000, // 1 hour
      ...options
    };

    // Initialize generators
    this.generators = {
      person: new PersonReportGenerator(jiraService, confluenceService, this.options),
      team: new TeamReportGenerator(jiraService, confluenceService, this.options),
      unit: new UnitReportGenerator(jiraService, confluenceService, this.options),
      feature: new FeatureReportGenerator(jiraService, confluenceService, this.options)
    };

    // Listen for events from generators
    Object.values(this.generators).forEach(gen => {
      gen.on('report_generated', (event) => this._logEvent(event));
      gen.on('report_error', (event) => this._logError(event));
    });
  }

  /**
   * Main API: Get any type of report
   */
  async getReport(reportType, entityId, options = {}) {
    const generator = this.generators[reportType];
    if (!generator) {
      throw new Error(`Unknown report type: ${reportType}. Valid types: person, team, unit, feature`);
    }
    return generator.generateReport(entityId, options);
  }

  /**
   * Convenience methods
   */
  async getPersonReport(personEmail, options = {}) {
    return this.getReport('person', personEmail, options);
  }

  async getTeamReport(teamProjectKey, options = {}) {
    return this.getReport('team', teamProjectKey, options);
  }

  async getUnitReport(unitProjects, options = {}) {
    return this.getReport('unit', unitProjects, options);
  }

  async getFeatureReport(epicKey, options = {}) {
    return this.getReport('feature', epicKey, options);
  }

  /**
   * Bulk report generation (for dashboards)
   */
  async getBulkReports(reportSpecs) {
    return Promise.all(
      reportSpecs.map(spec =>
        this.getReport(spec.type, spec.id, spec.options)
          .catch(error => ({
            success: false,
            error: error.message,
            ...spec
          }))
      )
    );
  }

  /**
   * Event logging
   */
  _logEvent(event) {
    console.log(`✓ ${event.reportType} report generated for ${event.entityId}`);
  }

  _logError(event) {
    console.error(`✗ Error generating ${event.reportType} for ${event.entityId}: ${event.error}`);
  }
}

module.exports = ReportEngine;

