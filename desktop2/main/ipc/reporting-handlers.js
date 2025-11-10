/**
 * Reporting IPC Handlers
 * Handles report generation requests from frontend
 */

const { ipcMain } = require('electron');
const ReportEngine = require('../../../core/reporting/report-engine');
const JIRAService = require('../services/JIRAService');
const JIRAServiceCore = require('../../../core/integrations/jira-service');
const ConfluenceService = require('../../../core/integrations/confluence-service');

let reportEngine = null;
let jiraServiceInstance = null;

function registerReportingHandlers(services, logger) {
  /**
   * Initialize report engine with user's JIRA/Confluence tokens
   */
  async function initializeReportEngine(userId) {
    try {
      // Get user's JIRA tokens
      const { data: userData } = await services.dbAdapter.supabase
        .from('users')
        .select('integration_settings')
        .eq('id', userId)
        .single();

      const jiraSettings = userData?.integration_settings?.jira;

      if (!jiraSettings?.access_token) {
        throw new Error('JIRA not connected. Please connect JIRA first.');
      }

      // Use desktop JIRAService wrapper (not core service directly)
      if (!jiraServiceInstance) {
        jiraServiceInstance = new JIRAService({ logger, supabaseAdapter: services.dbAdapter });
      }
      
      // Initialize if not already connected
      if (!jiraServiceInstance.isConnected()) {
        const initResult = await jiraServiceInstance.initialize(userId);
        if (!initResult.success || !initResult.connected) {
          throw new Error('Failed to initialize JIRA service');
        }
      }

      // Get the core JIRA service for report engine
      const jiraCore = jiraServiceInstance.jiraCore;
      
      if (!jiraCore) {
        throw new Error('JIRA core service not available');
      }

      // Initialize Confluence service (uses same tokens)
      const confluenceService = new ConfluenceService({ logger });
      confluenceService.setTokens({
        accessToken: jiraSettings.access_token,
        cloudId: jiraSettings.cloud_id,
        siteUrl: jiraSettings.site_url
      });

      // Create report engine with core JIRA service
      reportEngine = new ReportEngine(jiraCore, confluenceService, {
        logLevel: process.env.LOG_LEVEL || 'info'
      });

      logger.info('Report engine initialized', { userId });
      return true;
    } catch (error) {
      logger.error('Failed to initialize report engine', { error: error.message });
      throw error;
    }
  }

  /**
   * Generate report
   */
  ipcMain.handle('reporting:generateReport', async (event, reportType, entityId, options = {}) => {
    try {
      const userId = services.auth?.currentUser?.id;

      if (!userId) {
        return {
          success: false,
          error: 'User not authenticated'
        };
      }

      logger.info('Generating report', { reportType, entityId, userId });

      // Initialize report engine if not already done
      if (!reportEngine) {
        await initializeReportEngine(userId);
      }

      // Generate report
      const report = await reportEngine.getReport(reportType, entityId, options);

      logger.info('Report generated successfully', {
        reportType,
        entityId,
        metricsKeys: Object.keys(report.metrics || {})
      });

      return {
        success: true,
        report
      };

    } catch (error) {
      logger.error('Failed to generate report', {
        reportType,
        entityId,
        error: error.message,
        stack: error.stack
      });

      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Get person report
   */
  ipcMain.handle('reporting:getPersonReport', async (event, personEmail, options = {}) => {
    return ipcMain.emit('reporting:generateReport', event, 'person', personEmail, options);
  });

  /**
   * Get team report
   */
  ipcMain.handle('reporting:getTeamReport', async (event, teamProjectKey, options = {}) => {
    return ipcMain.emit('reporting:generateReport', event, 'team', teamProjectKey, options);
  });

  /**
   * Get unit report
   */
  ipcMain.handle('reporting:getUnitReport', async (event, unitProjects, options = {}) => {
    return ipcMain.emit('reporting:generateReport', event, 'unit', unitProjects, options);
  });

  /**
   * Get feature report
   */
  ipcMain.handle('reporting:getFeatureReport', async (event, epicKey, options = {}) => {
    return ipcMain.emit('reporting:generateReport', event, 'feature', epicKey, options);
  });

  logger.info('Reporting handlers registered');
}

module.exports = { registerReportingHandlers };

