/**
 * Auto Sync Service
 * Automatically syncs all data when app starts
 */

class AutoSyncService {
  constructor({ meetingService, taskService, logger }) {
    this.meetingService = meetingService;
    this.taskService = taskService;
    this.logger = logger || console;
  }

  async syncAll(userId) {
    try {
      this.logger.info('Starting auto-sync for user', { userId });

      // Sync meetings
      try {
        const meetingsResult = await this.meetingService.getUpcomingMeetings(userId, {
          days: 30,
          saveToDatabase: true
        });
        this.logger.info('Meetings synced', { 
          count: meetingsResult.meetings?.length || 0 
        });
      } catch (error) {
        this.logger.error('Failed to sync meetings', { error: error.message });
      }

      // Sync JIRA/GitHub
      try {
        const updatesResult = await this.taskService.fetchAllUpdates(userId, {
          days: 30
        });
        this.logger.info('Updates synced', {
          total: updatesResult.updates?.length || 0
        });
      } catch (error) {
        this.logger.error('Failed to sync updates', { error: error.message });
      }

      this.logger.info('Auto-sync completed', { userId });
      return { success: true };

    } catch (error) {
      this.logger.error('Auto-sync failed', { error: error.message });
      return { success: false, error: error.message };
    }
  }
}

module.exports = AutoSyncService;

