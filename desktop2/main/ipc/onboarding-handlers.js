/**
 * Onboarding IPC Handlers
 * Handles user onboarding flow: role selection, team setup, integrations
 */

const { ipcMain } = require('electron');

/**
 * Register all onboarding-related IPC handlers
 * @param {Object} services - Service instances (authService, dbAdapter, etc.)
 */
function registerOnboardingHandlers(services, logger) {
  const { auth: authService, dbAdapter } = services;
  
  // Fallback logger if not provided
  const log = logger || console;

  /**
   * Get current user's onboarding status
   */
  ipcMain.handle('onboarding:getStatus', async (event) => {
    try {
      const user = authService.currentUser;
      
      if (!user) {
        return {
          success: false,
          error: 'Not authenticated'
        };
      }

      // Fetch latest user data from database
      const { data, error } = await dbAdapter.supabase
        .from('users')
        .select('onboarding_completed, onboarding_step, user_role, integration_settings')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      return {
        success: true,
        status: {
          completed: data.onboarding_completed || false,
          currentStep: data.onboarding_step || 'role_selection',
          hasRole: !!data.user_role,
          role: data.user_role,
          hasIntegrations: Object.keys(data.integration_settings || {}).length > 0
        }
      };
    } catch (error) {
      log.error('Failed to get onboarding status', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Update user role during onboarding
   */
  ipcMain.handle('onboarding:setRole', async (event, role) => {
    try {
      const user = authService.currentUser;
      
      if (!user) {
        return {
          success: false,
          error: 'Not authenticated'
        };
      }

      // Validate role
      if (!['sales', 'developer', 'admin', 'unit_lead', 'team_lead'].includes(role)) {
        return {
          success: false,
          error: 'Invalid role. Must be "sales", "developer", "admin", "unit_lead", or "team_lead"'
        };
      }

      // Update role in database
      const result = await authService.updateUserRole(user.id, role);
      
      if (!result.success) {
        return result;
      }

      log.info('User role set during onboarding', { 
        userId: user.id, 
        role 
      });

      return {
        success: true,
        user: result.user
      };
    } catch (error) {
      log.error('Failed to set user role', { role, error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Set user's team (mock for now)
   */
  ipcMain.handle('onboarding:setTeam', async (event, teamName) => {
    try {
      const user = authService.currentUser;
      
      if (!user) {
        return {
          success: false,
          error: 'Not authenticated'
        };
      }

      // Update company/team name
      const { data, error } = await dbAdapter.supabase
        .from('users')
        .update({
          company_name: teamName,
          onboarding_step: 'integration_setup'
        })
        .eq('id', user.id)
        .select()
        .single();

      if (error) throw error;

      log.info('User team set during onboarding', { 
        userId: user.id, 
        teamName 
      });

      return {
        success: true,
        user: data
      };
    } catch (error) {
      log.error('Failed to set user team', { teamName, error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Skip integration setup (user can do it later)
   */
  ipcMain.handle('onboarding:skipIntegrations', async (event) => {
    try {
      const user = authService.currentUser;
      
      if (!user) {
        return {
          success: false,
          error: 'Not authenticated'
        };
      }

      // Complete onboarding
      const result = await authService.completeOnboarding(user.id);
      
      if (!result.success) {
        return result;
      }

      log.info('User skipped integration setup', { userId: user.id });

      return {
        success: true,
        user: result.user
      };
    } catch (error) {
      log.error('Failed to skip integrations', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Complete onboarding
   */
  ipcMain.handle('onboarding:complete', async (event) => {
    try {
      const user = authService.currentUser;
      
      if (!user) {
        return {
          success: false,
          error: 'Not authenticated'
        };
      }

      // Complete onboarding
      const result = await authService.completeOnboarding(user.id);
      
      if (!result.success) {
        return result;
      }

      log.info('User completed onboarding', { userId: user.id });

      return {
        success: true,
        user: result.user
      };
    } catch (error) {
      log.error('Failed to complete onboarding', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Save user role (alias for setRole, used by LoginFlow)
   */
  ipcMain.handle('onboarding:saveRole', async (event, role) => {
    try {
      const user = authService.currentUser;
      
      if (!user) {
        return {
          success: false,
          error: 'Not authenticated'
        };
      }

      // Validate role
      if (!['sales', 'developer', 'admin', 'unit_lead', 'team_lead'].includes(role)) {
        return {
          success: false,
          error: 'Invalid role. Must be "sales", "developer", "admin", "unit_lead", or "team_lead"'
        };
      }

      // Update role and complete onboarding in one step
      const { data, error } = await dbAdapter.supabase
        .from('users')
        .update({
          user_role: role,
          onboarding_completed: true,
          onboarding_step: 'completed'
        })
        .eq('id', user.id)
        .select()
        .single();

      if (error) throw error;

      // Update current user in auth service
      authService.currentUser = data;

      log.info('User role saved and onboarding completed', { 
        userId: user.id, 
        role 
      });

      return {
        success: true,
        user: data
      };
    } catch (error) {
      log.error('Failed to save user role', { role, error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Get recommended integrations based on role
   */
  ipcMain.handle('onboarding:getRecommendedIntegrations', async (event) => {
    try {
      const user = authService.currentUser;
      
      if (!user) {
        return {
          success: false,
          error: 'Not authenticated'
        };
      }

      // Fetch user role
      const { data, error } = await dbAdapter.supabase
        .from('users')
        .select('user_role')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      const userRole = data?.user_role || 'sales';

      // Return role-specific integrations
      const integrations = {
        sales: [
          {
            key: 'slack',
            name: 'Slack',
            description: 'Team communication and task management',
            icon: 'slack',
            required: true,
            connected: !!user.slack_user_id
          },
          {
            key: 'microsoft',
            name: 'Microsoft 365',
            description: 'Email, Calendar, and Teams',
            icon: 'microsoft',
            required: false,
            connected: false
          },
          {
            key: 'google',
            name: 'Google Workspace',
            description: 'Gmail, Calendar, and Drive',
            icon: 'google',
            required: false,
            connected: false
          },
          {
            key: 'hubspot',
            name: 'HubSpot CRM',
            description: 'Contact and deal management',
            icon: 'hubspot',
            required: false,
            connected: false
          }
        ],
        developer: [
          {
            key: 'slack',
            name: 'Slack',
            description: 'Team communication',
            icon: 'slack',
            required: true,
            connected: !!user.slack_user_id
          },
          {
            key: 'jira',
            name: 'Jira',
            description: 'Project tracking and issue management',
            icon: 'jira',
            required: false,
            connected: false
          },
          {
            key: 'github',
            name: 'GitHub',
            description: 'Code repositories and pull requests',
            icon: 'github',
            required: false,
            connected: false
          },
          {
            key: 'microsoft',
            name: 'Microsoft 365',
            description: 'Email and Calendar',
            icon: 'microsoft',
            required: false,
            connected: false
          }
        ]
      };

      return {
        success: true,
        integrations: integrations[userRole] || integrations.sales
      };
    } catch (error) {
      log.error('Failed to get recommended integrations', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  });

  log.info('Onboarding IPC handlers registered');
}

module.exports = registerOnboardingHandlers;

