/**
 * Team IPC Handlers
 * Handles team management and team-scoped queries
 */

const { ipcMain } = require('electron');
const Store = require('electron-store');
const store = new Store();

function registerTeamHandlers(services) {
  const { supabaseAdapter, teamContextEngine, timeZoneService, logger } = services;

  /**
   * List all teams for current user
   */
  ipcMain.handle('teams:list', async (event) => {
    try {
      const session = store.get('session');
      if (!session || !session.user) {
        return { success: false, error: 'No active session', teams: [] };
      }

      logger.info('Listing teams', { userId: session.user.id });

      const result = await supabaseAdapter.getTeams(session.user.id);
      
      // Enhance teams with timezone info
      if (result.success && result.teams) {
        result.teams = result.teams.map(team => ({
          ...team,
          currentTime: timeZoneService.getCurrentTimeForTeam(team.timezone),
          workingHoursStatus: timeZoneService.getWorkingHoursStatus(team.timezone),
          timezoneAbbr: timeZoneService.getTimezoneAbbreviation(team.timezone)
        }));
      }

      return result;
    } catch (error) {
      logger.error('IPC Error: teams:list', { error: error.message });
      return { success: false, error: error.message, teams: [] };
    }
  });

  /**
   * Create new team
   */
  ipcMain.handle('teams:create', async (event, teamData) => {
    try {
      const session = store.get('session');
      if (!session || !session.user) {
        return { success: false, error: 'No active session' };
      }

      logger.info('Creating team', { name: teamData.name, userId: session.user.id });

      // Create team
      const result = await supabaseAdapter.createTeam(teamData);
      
      if (result.success) {
        // Add current user as team member with 'lead' role
        await supabaseAdapter.addTeamMember(result.team.id, session.user.id, 'lead');
        
        logger.info('Team created and user added as lead', { 
          teamId: result.team.id,
          userId: session.user.id
        });
      }

      return result;
    } catch (error) {
      logger.error('IPC Error: teams:create', { error: error.message });
      return { success: false, error: error.message };
    }
  });

  /**
   * Update team
   */
  ipcMain.handle('teams:update', async (event, teamId, updates) => {
    try {
      logger.info('Updating team', { teamId, updates });

      const result = await supabaseAdapter.updateTeam(teamId, updates);
      
      return result;
    } catch (error) {
      logger.error('IPC Error: teams:update', { error: error.message });
      return { success: false, error: error.message };
    }
  });

  /**
   * Delete team
   */
  ipcMain.handle('teams:delete', async (event, teamId) => {
    try {
      logger.info('Deleting team', { teamId });

      const result = await supabaseAdapter.deleteTeam(teamId);
      
      return result;
    } catch (error) {
      logger.error('IPC Error: teams:delete', { error: error.message });
      return { success: false, error: error.message };
    }
  });

  /**
   * Get team context (meetings, tasks, repositories)
   */
  ipcMain.handle('teams:getContext', async (event, teamId) => {
    try {
      logger.info('Getting team context', { teamId });

      const result = await supabaseAdapter.getTeamContext(teamId);
      
      return result;
    } catch (error) {
      logger.error('IPC Error: teams:getContext', { error: error.message });
      return { 
        success: false, 
        error: error.message,
        meetings: [],
        tasks: [],
        repositories: []
      };
    }
  });

  /**
   * Get team by ID
   */
  ipcMain.handle('teams:getById', async (event, teamId) => {
    try {
      logger.info('Getting team by ID', { teamId });

      const result = await supabaseAdapter.getTeamById(teamId);
      
      // Enhance with timezone info
      if (result.success && result.team) {
        result.team.currentTime = timeZoneService.getCurrentTimeForTeam(result.team.timezone);
        result.team.workingHoursStatus = timeZoneService.getWorkingHoursStatus(result.team.timezone);
        result.team.timezoneAbbr = timeZoneService.getTimezoneAbbreviation(result.team.timezone);
      }

      return result;
    } catch (error) {
      logger.error('IPC Error: teams:getById', { error: error.message });
      return { success: false, error: error.message };
    }
  });

  /**
   * Assign meeting to team
   */
  ipcMain.handle('teams:assignMeeting', async (event, meetingId, teamId) => {
    try {
      logger.info('Assigning meeting to team', { meetingId, teamId });

      const result = await supabaseAdapter.assignMeetingToTeam(meetingId, teamId);
      
      return result;
    } catch (error) {
      logger.error('IPC Error: teams:assignMeeting', { error: error.message });
      return { success: false, error: error.message };
    }
  });

  /**
   * Assign task to team
   */
  ipcMain.handle('teams:assignTask', async (event, taskId, teamId) => {
    try {
      logger.info('Assigning task to team', { taskId, teamId });

      const result = await supabaseAdapter.assignTaskToTeam(taskId, teamId);
      
      return result;
    } catch (error) {
      logger.error('IPC Error: teams:assignTask', { error: error.message });
      return { success: false, error: error.message };
    }
  });

  /**
   * Assign repository to team
   */
  ipcMain.handle('teams:assignRepository', async (event, teamId, owner, repo) => {
    try {
      logger.info('Assigning repository to team', { teamId, repo: `${owner}/${repo}` });

      const result = await supabaseAdapter.assignRepositoryToTeam(teamId, owner, repo);
      
      return result;
    } catch (error) {
      logger.error('IPC Error: teams:assignRepository', { error: error.message });
      return { success: false, error: error.message };
    }
  });

  /**
   * Get unassigned meetings
   */
  ipcMain.handle('teams:getUnassignedMeetings', async (event) => {
    try {
      const session = store.get('session');
      if (!session || !session.user) {
        return { success: false, error: 'No active session', meetings: [] };
      }

      logger.info('Getting unassigned meetings', { userId: session.user.id });

      const result = await supabaseAdapter.getUnassignedMeetings(session.user.id);
      
      return result;
    } catch (error) {
      logger.error('IPC Error: teams:getUnassignedMeetings', { error: error.message });
      return { success: false, error: error.message, meetings: [] };
    }
  });

  /**
   * Get unassigned tasks
   */
  ipcMain.handle('teams:getUnassignedTasks', async (event) => {
    try {
      const session = store.get('session');
      if (!session || !session.user) {
        return { success: false, error: 'No active session', tasks: [] };
      }

      logger.info('Getting unassigned tasks', { userId: session.user.id });

      const result = await supabaseAdapter.getUnassignedTasks(session.user.id);
      
      return result;
    } catch (error) {
      logger.error('IPC Error: teams:getUnassignedTasks', { error: error.message });
      return { success: false, error: error.message, tasks: [] };
    }
  });

  /**
   * Ask question with team context
   */
  ipcMain.handle('teams:askQuestion', async (event, teamId, question, options = {}) => {
    try {
      logger.info('Team question asked', { 
        teamId, 
        question: question.substring(0, 50),
        includeCode: options.includeCode
      });

      const result = await teamContextEngine.askQuestionForTeam(teamId, question, options);
      
      return result;
    } catch (error) {
      logger.error('IPC Error: teams:askQuestion', { error: error.message });
      return { 
        success: false, 
        error: error.message,
        answer: 'Sorry, I encountered an error answering your question.'
      };
    }
  });

  logger.info('Team IPC handlers registered');
}

module.exports = { registerTeamHandlers };

