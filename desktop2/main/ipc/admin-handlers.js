/**
 * Admin IPC Handlers with Role-Based Access Control
 * 
 * Roles:
 * - admin: Full access to everything
 * - team_lead: Can create units, manage users in their department
 * - unit_lead: Can manage users in their specific units only
 */

const { ipcMain } = require('electron');

function registerAdminHandlers(services, logger) {
  const { dbAdapter, auth } = services;

  /**
   * Role hierarchy helpers
   */
  const isAdmin = () => {
    return auth.currentUser?.user_role === 'admin';
  };

  const isTeamLead = () => {
    const role = auth.currentUser?.user_role;
    return role === 'team_lead' || role === 'admin';
  };

  const isUnitLead = () => {
    const role = auth.currentUser?.user_role;
    return role === 'unit_lead' || role === 'team_lead' || role === 'admin';
  };

  /**
   * Get teams/units that the current user can manage
   */
  const getManagedTeams = async () => {
    const user = auth.currentUser;
    
    if (!user) return [];
    
    // Admin can manage all teams
    if (user.user_role === 'admin') {
      const { data } = await dbAdapter.supabase
        .from('teams')
        .select('*');
      return data || [];
    }
    
    // Team/Unit leads can only manage teams where they are listed as a lead
    const { data } = await dbAdapter.supabase
      .from('team_members')
      .select(`
        team_id,
        teams (*)
      `)
      .eq('user_id', user.id)
      .in('role', ['unit_lead', 'team_lead']);
    
    return data?.map(m => m.teams).filter(Boolean) || [];
  };

  /**
   * Check if user can manage a specific team
   */
  const canManageTeam = async (teamId) => {
    const user = auth.currentUser;
    
    if (!user) return false;
    
    // Admin can manage everything
    if (user.user_role === 'admin') return true;
    
    // Check if user is a lead of this team
    const { data } = await dbAdapter.supabase
      .from('team_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('team_id', teamId)
      .in('role', ['unit_lead', 'team_lead'])
      .single();
    
    return !!data;
  };

  /**
   * Get user's department (for team leads)
   */
  const getUserDepartment = async () => {
    const user = auth.currentUser;
    
    if (!user || user.user_role === 'admin') return null;
    
    // Get the department from the first team they lead
    const { data } = await dbAdapter.supabase
      .from('team_members')
      .select(`
        teams (
          department
        )
      `)
      .eq('user_id', user.id)
      .in('role', ['unit_lead', 'team_lead'])
      .limit(1)
      .single();
    
    return data?.teams?.department || null;
  };

  /**
   * Create or update a team/unit
   * - Admins: Can create/update any team
   * - Team Leads: Can create new units within their department
   */
  ipcMain.handle('admin:createOrUpdateTeam', async (event, teamData) => {
    try {
      const userId = auth.currentUser?.id;
      const userRole = auth.currentUser?.user_role;
      
      if (!userId) {
        return { success: false, error: 'Not authenticated' };
      }

      // Check permissions
      if (teamData.id) {
        // Updating existing team - need to verify permissions
        const canManage = await canManageTeam(teamData.id);
        if (!canManage) {
          logger.warn('Unauthorized team update attempt', { userId, teamId: teamData.id, userRole });
          return { success: false, error: 'You do not have permission to modify this team' };
        }
      } else {
        // Creating new team - team leads can create units in their department
        if (!isTeamLead()) {
          logger.warn('Unauthorized team creation attempt', { userId, userRole });
          return { success: false, error: 'Only Team Leads and Admins can create new units' };
        }
        
        // Team leads can only create units in their department
        if (userRole === 'team_lead') {
          const userDept = await getUserDepartment();
          if (teamData.department && teamData.department !== userDept) {
            logger.warn('Team lead tried to create unit in different department', { 
              userId, 
              attemptedDept: teamData.department,
              userDept 
            });
            return { success: false, error: `You can only create units in your department (${userDept})` };
          }
          // Set department to user's department if not specified
          teamData.department = teamData.department || userDept;
        }
      }

      logger.info('User creating/updating team', { teamData, userId, userRole });

      // Validate required fields
      if (!teamData.name || !teamData.department) {
        return { success: false, error: 'Name and department are required' };
      }

      // Generate slug if not provided
      const slug = teamData.slug || generateSlug(teamData.name);

      if (teamData.id) {
        // Update existing team
        const { data, error } = await dbAdapter.supabase
          .from('teams')
          .update({
            name: teamData.name,
            slug: slug,
            department: teamData.department,
            description: teamData.description || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', teamData.id)
          .select()
          .single();

        if (error) throw error;

        logger.info('✅ Team updated', { teamId: teamData.id, name: teamData.name });

        return {
          success: true,
          team: data
        };
      } else {
        // Create new team
        const { data, error } = await dbAdapter.supabase
          .from('teams')
          .insert({
            name: teamData.name,
            slug: slug,
            department: teamData.department,
            description: teamData.description || null,
            created_by: userId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();

        if (error) throw error;

        logger.info('✅ Team created', { teamId: data.id, name: teamData.name });

        return {
          success: true,
          team: data
        };
      }
    } catch (error) {
      logger.error('Failed to create/update team', { error: error.message, teamData });
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Delete a team/unit
   * - Admins: Can delete any team
   * - Team Leads: Can delete units in their department  
   * - Unit Leads: Cannot delete teams
   */
  ipcMain.handle('admin:deleteTeam', async (event, teamId) => {
    try {
      const userId = auth.currentUser?.id;
      const userRole = auth.currentUser?.user_role;
      
      if (!userId) {
        return { success: false, error: 'Not authenticated' };
      }

      // Only admins and team leads can delete teams
      if (!isTeamLead()) {
        logger.warn('Unauthorized team delete attempt', { userId, teamId, userRole });
        return { success: false, error: 'Only Team Leads and Admins can delete units' };
      }

      // Check if user can manage this team
      const canManage = await canManageTeam(teamId);
      if (!canManage) {
        logger.warn('User tried to delete team they cannot manage', { userId, teamId, userRole });
        return { success: false, error: 'You do not have permission to delete this team' };
      }

      logger.info('User deleting team', { teamId, userId, userRole });

      // Delete the team
      const { error } = await dbAdapter.supabase
        .from('teams')
        .delete()
        .eq('id', teamId);

      if (error) throw error;

      logger.info('✅ Team deleted', { teamId });

      return {
        success: true
      };
    } catch (error) {
      logger.error('Failed to delete team', { error: error.message, teamId });
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Get members of a specific team
   * - Returns users who are members of the team
   */
  ipcMain.handle('admin:getTeamMembers', async (event, teamId) => {
    try {
      const userId = auth.currentUser?.id;
      const userRole = auth.currentUser?.user_role;
      
      if (!userId) {
        return { success: false, error: 'Not authenticated' };
      }

      if (!isUnitLead()) {
        logger.warn('Unauthorized team members access attempt', { userId, teamId, userRole });
        return { success: false, error: 'You do not have permission to view team members' };
      }

      // Check if user can manage this team
      const canManage = await canManageTeam(teamId);
      if (!canManage) {
        logger.warn('User tried to view members of team they cannot manage', { userId, teamId, userRole });
        return { success: false, error: 'You do not have permission to view this team' };
      }

      logger.info('Loading team members', { teamId, userRole });

      // Get team members
      const { data: members, error } = await dbAdapter.supabase
        .from('team_members')
        .select('user_id')
        .eq('team_id', teamId);

      if (error) throw error;

      if (!members || members.length === 0) {
        logger.info('✅ Loaded team members', { teamId, memberCount: 0 });
        return {
          success: true,
          members: []
        };
      }

      // Get user details separately to avoid relationship ambiguity
      const userIds = members.map(m => m.user_id);
      const { data: users, error: usersError } = await dbAdapter.supabase
        .from('users')
        .select('id, name, email, user_role')
        .in('id', userIds);

      if (usersError) throw usersError;

      const membersList = users || [];

      logger.info('✅ Loaded team members', { teamId, memberCount: membersList.length });

      return {
        success: true,
        members: membersList
      };
    } catch (error) {
      logger.error('Failed to load team members', { error: error.message, teamId });
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Get all teams that the user can manage
   * - Admins: See all teams
   * - Team Leads: See teams in their department
   * - Unit Leads: See only their units
   */
  ipcMain.handle('admin:getAllTeams', async (event) => {
    try {
      const userId = auth.currentUser?.id;
      const userRole = auth.currentUser?.user_role;
      
      if (!userId) {
        return { success: false, error: 'Not authenticated' };
      }

      // Check if user has any management role
      if (!isUnitLead()) {
        logger.warn('Unauthorized access to team management', { userId, userRole });
        return { success: false, error: 'You do not have permission to manage teams' };
      }

      let teams;

      if (isAdmin()) {
        // Admin sees all teams
        const { data, error } = await dbAdapter.supabase
          .from('teams')
          .select('*')
          .order('department', { ascending: true })
          .order('name', { ascending: true });

        if (error) throw error;
        teams = data || [];
        
      } else if (userRole === 'team_lead') {
        // Team leads see all teams in their department
        const userDept = await getUserDepartment();
        
        const { data, error } = await dbAdapter.supabase
          .from('teams')
          .select('*')
          .eq('department', userDept)
          .order('name', { ascending: true });

        if (error) throw error;
        teams = data || [];
        
      } else {
        // Unit leads see only their units
        teams = await getManagedTeams();
      }

      logger.info(`✅ User loaded ${teams.length} teams`, { userId, userRole });

      return {
        success: true,
        teams: teams || [],
        userRole: userRole
      };
    } catch (error) {
      logger.error('Failed to load teams', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Get all users (filtered by what the current user can see)
   * - Admins: See all users
   * - Team Leads: See users in their department teams
   * - Unit Leads: See users in their units
   */
  ipcMain.handle('admin:getAllUsers', async (event) => {
    try {
      const userId = auth.currentUser?.id;
      const userRole = auth.currentUser?.user_role;
      
      if (!userId) {
        return { success: false, error: 'Not authenticated' };
      }

      if (!isUnitLead()) {
        logger.warn('Unauthorized access to user management', { userId, userRole });
        return { success: false, error: 'You do not have permission to manage users' };
      }

      logger.info('Admin fetching users', { userRole });

      // ALL management roles (admin, team_lead, unit_lead) can see all users
      // This allows them to add new people to their teams/units
      const { data, error: usersError } = await dbAdapter.supabase
        .from('users')
        .select('id, name, email, user_role, last_active')
        .order('name', { ascending: true });

      if (usersError) {
        logger.error('Failed to fetch users', { error: usersError.message });
        throw usersError;
      }

      const users = data || [];

      if (users.length === 0) {
        logger.info('No users found for this role', { userRole });
        return {
          success: true,
          users: []
        };
      }

      logger.info(`Fetched ${users.length} users, now getting team counts`);

      // Get team counts for each user
      const usersWithCounts = await Promise.all(
        users.map(async (user) => {
          try {
            const { count, error: countError } = await dbAdapter.supabase
              .from('team_members')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id);

            if (countError) {
              logger.warn('Failed to get team count for user', { 
                userId: user.id, 
                error: countError.message 
              });
            }

            return {
              id: user.id,
              name: user.name,
              email: user.email,
              user_role: user.user_role,
              last_active: user.last_active,
              team_count: count || 0
            };
          } catch (error) {
            logger.warn('Error getting team count', { userId: user.id, error: error.message });
            return {
              id: user.id,
              name: user.name,
              email: user.email,
              user_role: user.user_role,
              last_active: user.last_active,
              team_count: 0
            };
          }
        })
      );

      logger.info(`✅ Admin loaded ${usersWithCounts.length} users with team counts`, { userRole });

      return {
        success: true,
        users: usersWithCounts
      };
    } catch (error) {
      logger.error('Failed to load users for admin', { 
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
   * Get teams for a specific user
   * - Admins: Can see all teams for any user
   * - Team Leads: Can see teams in their department for any user
   * - Unit Leads: Can see teams they manage for users in those teams
   */
  ipcMain.handle('admin:getUserTeams', async (event, targetUserId) => {
    try {
      const userId = auth.currentUser?.id;
      const userRole = auth.currentUser?.user_role;
      
      if (!userId) {
        return { success: false, error: 'Not authenticated' };
      }

      if (!isUnitLead()) {
        logger.warn('Unauthorized user teams access attempt', { userId, userRole });
        return { success: false, error: 'You do not have permission to manage users' };
      }

      logger.info('Loading user teams', { targetUserId, userRole });

      // Get user's team memberships
      const { data: memberships, error } = await dbAdapter.supabase
        .from('team_members')
        .select(`
          team_id,
          teams (
            id,
            name,
            slug,
            department
          )
        `)
        .eq('user_id', targetUserId);

      if (error) throw error;

      let filteredMemberships = memberships || [];

      // Filter teams based on role
      if (!isAdmin()) {
        if (userRole === 'team_lead') {
          // Team leads see only teams in their department
          const userDept = await getUserDepartment();
          filteredMemberships = filteredMemberships.filter(m => 
            m.teams?.department === userDept
          );
        } else {
          // Unit leads see only teams they manage
          const managedTeams = await getManagedTeams();
          const managedTeamIds = managedTeams.map(t => t.id);
          filteredMemberships = filteredMemberships.filter(m => 
            managedTeamIds.includes(m.team_id)
          );
        }
      }

      logger.info(`✅ Loaded ${filteredMemberships.length} team memberships for user`, { 
        targetUserId, 
        userRole 
      });

      return {
        success: true,
        teams: filteredMemberships
      };
    } catch (error) {
      logger.error('Failed to load user teams', { error: error.message, targetUserId });
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Add user to team
   * - All leads: Can add users to teams they manage
   */
  ipcMain.handle('admin:addUserToTeam', async (event, targetUserId, teamId) => {
    try {
      const userId = auth.currentUser?.id;
      const userRole = auth.currentUser?.user_role;
      
      if (!userId) {
        return { success: false, error: 'Not authenticated' };
      }

      if (!isUnitLead()) {
        logger.warn('Unauthorized user addition attempt', { userId, userRole });
        return { success: false, error: 'You do not have permission to manage team members' };
      }

      // Check if user can manage this team
      const canManage = await canManageTeam(teamId);
      if (!canManage) {
        logger.warn('User tried to add member to team they cannot manage', { userId, teamId, userRole });
        return { success: false, error: 'You do not have permission to manage this team' };
      }

      logger.info('User adding member to team', { targetUserId, teamId, managerId: userId, managerRole: userRole });

      // Check if membership already exists
      const { data: existing, error: checkError } = await dbAdapter.supabase
        .from('team_members')
        .select('id')
        .eq('user_id', targetUserId)
        .eq('team_id', teamId)
        .single();

      if (existing) {
        return {
          success: false,
          error: 'User is already a member of this team'
        };
      }

      // Add team membership
      const { data, error } = await dbAdapter.supabase
        .from('team_members')
        .insert({
          user_id: targetUserId,
          team_id: teamId,
          role: 'member',
          joined_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      logger.info('✅ User added to team', { targetUserId, teamId });

      return {
        success: true,
        membership: data
      };
    } catch (error) {
      logger.error('Failed to add user to team', { error: error.message, targetUserId, teamId });
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Remove user from team
   * - All leads: Can remove users from teams they manage
   */
  ipcMain.handle('admin:removeUserFromTeam', async (event, targetUserId, teamId) => {
    try {
      const userId = auth.currentUser?.id;
      const userRole = auth.currentUser?.user_role;
      
      if (!userId) {
        return { success: false, error: 'Not authenticated' };
      }

      if (!isUnitLead()) {
        logger.warn('Unauthorized user removal attempt', { userId, userRole });
        return { success: false, error: 'You do not have permission to manage team members' };
      }

      // Check if user can manage this team
      const canManage = await canManageTeam(teamId);
      if (!canManage) {
        logger.warn('User tried to remove member from team they cannot manage', { userId, teamId, userRole });
        return { success: false, error: 'You do not have permission to manage this team' };
      }

      logger.info('User removing member from team', { targetUserId, teamId, managerId: userId, managerRole: userRole });

      // Remove team membership
      const { error } = await dbAdapter.supabase
        .from('team_members')
        .delete()
        .eq('user_id', targetUserId)
        .eq('team_id', teamId);

      if (error) throw error;

      logger.info('✅ User removed from team', { targetUserId, teamId });

      return {
        success: true
      };
    } catch (error) {
      logger.error('Failed to remove user from team', { error: error.message, targetUserId, teamId });
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Update user role
   * - Only admins can change user roles
   * - For unit_lead/team_lead, also assigns them to manage specific teams
   */
  ipcMain.handle('admin:updateUserRole', async (event, targetUserId, newRole, leadTeamIds = []) => {
    try {
      const userId = auth.currentUser?.id;
      const userRole = auth.currentUser?.user_role;
      
      if (!userId) {
        return { success: false, error: 'Not authenticated' };
      }

      // Only admins can change roles
      if (!isAdmin()) {
        logger.warn('Unauthorized role update attempt', { userId, userRole });
        return { success: false, error: 'Only admins can change user roles' };
      }

      // Validate role
      const validRoles = ['sales', 'developer', 'admin', 'team_lead', 'unit_lead'];
      if (!validRoles.includes(newRole)) {
        return { success: false, error: `Invalid role. Must be one of: ${validRoles.join(', ')}` };
      }

      logger.info('Admin updating user role', { targetUserId, newRole, leadTeamIds, adminId: userId });

      // Update user role
      const { error: roleError } = await dbAdapter.supabase
        .from('users')
        .update({ 
          user_role: newRole,
          updated_at: new Date().toISOString()
        })
        .eq('id', targetUserId);

      if (roleError) throw roleError;

      // If unit_lead or team_lead, manage their lead assignments
      if (newRole === 'unit_lead' || newRole === 'team_lead') {
        // First, remove all existing lead assignments
        const { error: removeError } = await dbAdapter.supabase
          .from('team_members')
          .delete()
          .eq('user_id', targetUserId)
          .in('role', ['unit_lead', 'team_lead']);

        if (removeError) throw removeError;

        // Then add new lead assignments
        if (leadTeamIds && leadTeamIds.length > 0) {
          const leadAssignments = leadTeamIds.map(teamId => ({
            user_id: targetUserId,
            team_id: teamId,
            role: newRole,
            joined_at: new Date().toISOString()
          }));

          const { error: assignError } = await dbAdapter.supabase
            .from('team_members')
            .insert(leadAssignments);

          if (assignError) throw assignError;
        }
      } else {
        // For non-management roles, remove any lead assignments
        const { error: removeError } = await dbAdapter.supabase
          .from('team_members')
          .delete()
          .eq('user_id', targetUserId)
          .in('role', ['unit_lead', 'team_lead']);

        if (removeError) throw removeError;
      }

      logger.info('✅ User role updated with lead assignments', { 
        targetUserId, 
        newRole, 
        leadTeamsCount: leadTeamIds?.length || 0 
      });

      return {
        success: true
      };
    } catch (error) {
      logger.error('Failed to update user role', { error: error.message, targetUserId, newRole });
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Get teams where user is a lead (unit_lead or team_lead)
   */
  ipcMain.handle('admin:getUserLeadTeams', async (event, targetUserId) => {
    try {
      const userId = auth.currentUser?.id;
      const userRole = auth.currentUser?.user_role;
      
      if (!userId) {
        return { success: false, error: 'Not authenticated' };
      }

      if (!isAdmin()) {
        logger.warn('Unauthorized lead teams access', { userId, userRole });
        return { success: false, error: 'Only admins can view lead assignments' };
      }

      logger.info('Admin fetching user lead teams', { targetUserId });

      // Get teams where user has a lead role
      const { data, error } = await dbAdapter.supabase
        .from('team_members')
        .select('team_id, role')
        .eq('user_id', targetUserId)
        .in('role', ['unit_lead', 'team_lead']);

      if (error) throw error;

      logger.info(`✅ Loaded ${data?.length || 0} lead assignments`, { targetUserId });

      return {
        success: true,
        teams: data || []
      };
    } catch (error) {
      logger.error('Failed to load user lead teams', { error: error.message, targetUserId });
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Get current user's management capabilities
   */
  ipcMain.handle('admin:getCapabilities', async (event) => {
    try {
      const user = auth.currentUser;
      
      if (!user) {
        return { success: false, error: 'Not authenticated' };
      }

      const managedTeams = await getManagedTeams();
      const department = await getUserDepartment();

      const capabilities = {
        role: user.user_role,
        canCreateTeams: isTeamLead(),
        canDeleteTeams: isTeamLead(),
        canManageUsers: isUnitLead(),
        canSeeAllUsers: isUnitLead(), // All management roles can see all users (to add them to teams)
        canSeeAllTeams: isAdmin(), // Only admins can see all teams
        managedTeamsCount: managedTeams.length,
        department: department,
        isAdmin: isAdmin(),
        isTeamLead: isTeamLead(),
        isUnitLead: isUnitLead()
      };

      logger.info('User capabilities retrieved', { userId: user.id, role: user.user_role, capabilities });

      return {
        success: true,
        capabilities
      };
    } catch (error) {
      logger.error('Failed to get user capabilities', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  });

  logger.info('✅ Admin IPC handlers with RBAC registered');
}

/**
 * Generate slug from name
 */
function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

module.exports = registerAdminHandlers;

