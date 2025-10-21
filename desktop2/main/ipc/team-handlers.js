/**
 * Team/Workspace IPC Handlers
 * Handles team selection and management during onboarding
 */

const { ipcMain } = require('electron');

function registerTeamHandlers(services, logger) {
  logger.info('🔧 Registering Team handlers...');

  /**
   * Get available teams for selection
   */
  ipcMain.handle('teams:getAvailable', async () => {
    try {
      logger.info('Fetching available teams...');

      const { data, error } = await services.dbAdapter.supabase
        .rpc('get_available_teams');

      if (error) {
        throw error;
      }

      logger.info('Available teams fetched', { count: data?.length || 0 });

      return {
        success: true,
        teams: data || []
      };

    } catch (error) {
      logger.error('Failed to fetch available teams:', error);
      return {
        success: false,
        error: error.message,
        teams: []
      };
    }
  });

  /**
   * Get user's teams
   */
  ipcMain.handle('teams:getUserTeams', async () => {
    try {
      const userId = services.auth?.currentUser?.id;

      if (!userId) {
        throw new Error('User not authenticated');
      }

      logger.info('Fetching user teams', { userId });

      const { data, error } = await services.dbAdapter.supabase
        .rpc('get_user_teams', { user_uuid: userId });

      if (error) {
        throw error;
      }

      logger.info('User teams fetched', { 
        userId, 
        count: data?.length || 0 
      });

      return {
        success: true,
        teams: data || []
      };

    } catch (error) {
      logger.error('Failed to fetch user teams:', error);
      return {
        success: false,
        error: error.message,
        teams: []
      };
    }
  });

  /**
   * Join a team
   */
  ipcMain.handle('teams:join', async (_event, teamId, role = 'member') => {
    try {
      const userId = services.auth?.currentUser?.id;

      if (!userId) {
        throw new Error('User not authenticated');
      }

      if (!teamId) {
        throw new Error('Team ID is required');
      }

      logger.info('Adding user to team', { userId, teamId, role });

      const { data, error } = await services.dbAdapter.supabase
        .rpc('add_user_to_team', {
          p_user_id: userId,
          p_team_id: teamId,
          p_role: role,
          p_invited_by: null
        });

      if (error) {
        throw error;
      }

      // Fetch the updated team info
      const { data: teamData, error: teamError } = await services.dbAdapter.supabase
        .from('teams')
        .select('*')
        .eq('id', teamId)
        .single();

      if (teamError) {
        logger.warn('Failed to fetch team data after join:', teamError);
      }

      // Update current user's team in auth service
      if (services.auth?.currentUser) {
        services.auth.currentUser.team_id = teamId;
        services.auth.currentUser.team = teamData;
      }

      logger.info('User added to team successfully', { 
        userId, 
        teamId,
        teamName: teamData?.name 
      });

      return {
        success: true,
        team: teamData,
        membershipId: data
      };

    } catch (error) {
      logger.error('Failed to join team:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Leave a team
   */
  ipcMain.handle('teams:leave', async (_event, teamId) => {
    try {
      const userId = services.auth?.currentUser?.id;

      if (!userId) {
        throw new Error('User not authenticated');
      }

      if (!teamId) {
        throw new Error('Team ID is required');
      }

      logger.info('Removing user from team', { userId, teamId });

      const { error } = await services.dbAdapter.supabase
        .from('team_members')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('team_id', teamId);

      if (error) {
        throw error;
      }

      // Update user's team_id to null if this was their active team
      const { data: userData } = await services.dbAdapter.supabase
        .from('users')
        .select('team_id')
        .eq('id', userId)
        .single();

      if (userData?.team_id === teamId) {
        await services.dbAdapter.supabase
          .from('users')
          .update({ team_id: null })
          .eq('id', userId);

        // Update current user in auth service
        if (services.auth?.currentUser) {
          services.auth.currentUser.team_id = null;
          services.auth.currentUser.team = null;
        }
      }

      logger.info('User removed from team successfully', { userId, teamId });

      return {
        success: true
      };

    } catch (error) {
      logger.error('Failed to leave team:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Create a new team
   */
  ipcMain.handle('teams:create', async (_event, teamData) => {
    try {
      const userId = services.auth?.currentUser?.id;

      if (!userId) {
        throw new Error('User not authenticated');
      }

      const { name, slug, description, department } = teamData;

      if (!name || !slug) {
        throw new Error('Team name and slug are required');
      }

      logger.info('Creating new team', { userId, name, slug });

      // Create the team
      const { data: newTeam, error: createError } = await services.dbAdapter.supabase
        .from('teams')
        .insert({
          name,
          slug,
          description,
          department,
          created_by: userId,
          subscription_tier: 'trial',
          subscription_status: 'active'
        })
        .select()
        .single();

      if (createError) {
        throw createError;
      }

      // Add creator as owner
      const { error: memberError } = await services.dbAdapter.supabase
        .rpc('add_user_to_team', {
          p_user_id: userId,
          p_team_id: newTeam.id,
          p_role: 'owner',
          p_invited_by: null
        });

      if (memberError) {
        logger.error('Failed to add creator as team owner:', memberError);
        // Don't fail the whole operation
      }

      logger.info('Team created successfully', { 
        userId, 
        teamId: newTeam.id,
        teamName: newTeam.name 
      });

      return {
        success: true,
        team: newTeam
      };

    } catch (error) {
      logger.error('Failed to create team:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  logger.info('✅ Team handlers registered');
}

module.exports = registerTeamHandlers;

