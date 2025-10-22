/**
 * Meeting IPC Handlers
 * Handles all meeting-related IPC communication
 */

const { ipcMain } = require('electron');
const Store = require('electron-store');
const store = new Store();

function registerMeetingHandlers(services) {
  const { meetingIntelligenceService, logger } = services;

  /**
   * Get upcoming meetings
   */
  ipcMain.handle('meeting:getUpcoming', async (event, options) => {
    try {
      // Get userId from session
      const session = store.get('session');
      if (!session || !session.user) {
        return { success: false, error: 'No active session' };
      }
      
      logger.info('IPC: meeting:getUpcoming', { userId: session.user.id, options });
      return await meetingIntelligenceService.getUpcomingMeetings(session.user.id, options);
    } catch (error) {
      logger.error('IPC Error: meeting:getUpcoming', { error: error.message });
      return { success: false, error: error.message };
    }
  });

  /**
   * Save meeting
   */
  ipcMain.handle('meeting:save', async (event, userId, meetingData, options) => {
    try {
      logger.info('IPC: meeting:save', { meeting_id: meetingData.meeting_id });
      return await meetingIntelligenceService.saveMeeting(userId, meetingData, options);
    } catch (error) {
      logger.error('IPC Error: meeting:save', { error: error.message });
      return { success: false, error: error.message };
    }
  });

  /**
   * Upload manual notes
   */
  ipcMain.handle('meeting:uploadNotes', async (event, userId, meetingId, notes) => {
    try {
      logger.info('IPC: meeting:uploadNotes', { meetingId });
      return await meetingIntelligenceService.uploadManualNotes(userId, meetingId, notes);
    } catch (error) {
      logger.error('IPC Error: meeting:uploadNotes', { error: error.message });
      return { success: false, error: error.message };
    }
  });

  /**
   * Generate summary
   */
  ipcMain.handle('meeting:generateSummary', async (event, userId, meetingId) => {
    try {
      logger.info('IPC: meeting:generateSummary', { meetingId });
      return await meetingIntelligenceService.generateSummary(userId, meetingId);
    } catch (error) {
      logger.error('IPC Error: meeting:generateSummary', { error: error.message });
      return { success: false, error: error.message };
    }
  });

  /**
   * Get meeting summaries
   */
  ipcMain.handle('meeting:getSummaries', async (event, options) => {
    try {
      // Get userId from session
      const session = store.get('session');
      if (!session || !session.user) {
        return { success: false, error: 'No active session' };
      }
      
      logger.info('IPC: meeting:getSummaries', { userId: session.user.id, options });
      return await meetingIntelligenceService.getMeetingSummaries(session.user.id, options);
    } catch (error) {
      logger.error('IPC Error: meeting:getSummaries', { error: error.message });
      return { success: false, error: error.message };
    }
  });

  /**
   * Check meeting Copilot readiness
   */
  ipcMain.handle('meeting:checkCopilotReadiness', async (event, meetingId) => {
    try {
      // Get userId from session
      const session = store.get('session');
      if (!session || !session.user) {
        return { success: false, error: 'No active session' };
      }
      
      logger.info('IPC: meeting:checkCopilotReadiness', { userId: session.user.id, meetingId });
      return await meetingIntelligenceService.checkMeetingCopilotReadiness(session.user.id, meetingId);
    } catch (error) {
      logger.error('IPC Error: meeting:checkCopilotReadiness', { error: error.message });
      return { success: false, error: error.message };
    }
  });

  /**
   * Fetch Copilot notes for a meeting
   */
  ipcMain.handle('meeting:fetchCopilotNotes', async (event, meetingId) => {
    try {
      // Get userId from session
      const session = store.get('session');
      if (!session || !session.user) {
        return { success: false, error: 'No active session' };
      }
      
      logger.info('IPC: meeting:fetchCopilotNotes', { userId: session.user.id, meetingId });
      return await meetingIntelligenceService.fetchCopilotNotes(session.user.id, meetingId);
    } catch (error) {
      logger.error('IPC Error: meeting:fetchCopilotNotes', { error: error.message });
      return { success: false, error: error.message };
    }
  });

  logger.info('Meeting IPC handlers registered');
}

module.exports = { registerMeetingHandlers };


