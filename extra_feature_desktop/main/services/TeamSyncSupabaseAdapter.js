/**
 * Team Sync Supabase Adapter
 * Handles all Supabase interactions for Team Sync Intelligence app
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });
const SupabaseClient = require('../../../data/storage/supabase-client');

class TeamSyncSupabaseAdapter {
  constructor(options = {}) {
    const supabaseOptions = {
      useServiceRole: true,
      ...options
    };
    
    const supabaseClient = new SupabaseClient(supabaseOptions);
    this.supabase = supabaseClient.getClient();
    this.logger = options.logger || console;
    
    if (this.logger.info) {
      this.logger.info('Team Sync Supabase adapter initialized');
    }
  }

  /**
   * Save meeting to database
   */
  async saveMeeting(meetingData) {
    try {
      const { data, error } = await this.supabase
        .from('team_meetings')
        .upsert([meetingData], {
          onConflict: 'meeting_id'
        })
        .select()
        .single();

      if (error) throw error;

      this.logger.debug?.('Meeting saved', { meeting_id: meetingData.meeting_id });
      
      return { success: true, meeting: data };
    } catch (error) {
      this.logger.error?.('Failed to save meeting', { 
        error: error.message,
        meeting_id: meetingData.meeting_id 
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get meeting by ID
   */
  async getMeeting(meetingId) {
    try {
      const { data, error } = await this.supabase
        .from('team_meetings')
        .select('*')
        .eq('meeting_id', meetingId)
        .single();

      if (error) throw error;

      // Flatten metadata fields to top level
      const meeting = data ? {
        ...data,
        online_meeting_url: data.metadata?.online_meeting_url || null,
        location: data.metadata?.location || data.location,
        organizer: data.metadata?.organizer || data.organizer,
        importance_score: data.metadata?.importance_score || 50
      } : null;

      return { success: true, meeting };
    } catch (error) {
      this.logger.error?.('Failed to get meeting', { 
        error: error.message,
        meetingId 
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get meetings for user in date range
   */
  async getMeetings(userId, options = {}) {
    try {
      const {
        start_date,
        end_date,
        important_only = false
      } = options;

      let query = this.supabase
        .from('team_meetings')
        .select('*')
        .eq('user_id', userId);

      if (start_date) {
        query = query.gte('start_time', start_date);
      }

      if (end_date) {
        query = query.lte('start_time', end_date);
      }

      if (important_only) {
        query = query.eq('is_important', true);
      }

      query = query.order('start_time', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;

      // Transform meetings to flatten metadata
      const meetings = (data || []).map(meeting => ({
        ...meeting,
        // Flatten metadata fields to top level for easier access
        online_meeting_url: meeting.metadata?.online_meeting_url || null,
        location: meeting.metadata?.location || meeting.location,
        organizer: meeting.metadata?.organizer || meeting.organizer,
        importance_score: meeting.metadata?.importance_score || 50
      }));

      return { success: true, meetings };
    } catch (error) {
      this.logger.error?.('Failed to get meetings', { 
        error: error.message,
        userId
      });
      return { success: false, error: error.message, meetings: [] };
    }
  }

  /**
   * Update meeting notes
   */
  async updateMeetingNotes(meetingId, notes) {
    try {
      const { data, error } = await this.supabase
        .from('team_meetings')
        .update(notes)
        .eq('meeting_id', meetingId)
        .select()
        .single();

      if (error) throw error;

      return { success: true, meeting: data };
    } catch (error) {
      this.logger.error?.('Failed to update meeting notes', { 
        error: error.message,
        meetingId
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Update meeting summary
   */
  async updateMeetingSummary(meetingId, summary) {
    try {
      const { data, error } = await this.supabase
        .from('team_meetings')
        .update(summary)
        .eq('meeting_id', meetingId)
        .select()
        .single();

      if (error) throw error;

      return { success: true, meeting: data };
    } catch (error) {
      this.logger.error?.('Failed to update meeting summary', { 
        error: error.message,
        meetingId
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Save team update (JIRA/GitHub)
   */
  async saveTeamUpdate(userId, updateData) {
    try {
      const fullData = {
        user_id: userId,
        ...updateData
      };

      const { data, error } = await this.supabase
        .from('team_updates')
        .upsert([fullData], {
          onConflict: 'external_id'
        })
        .select()
        .single();

      if (error) throw error;

      this.logger.debug?.('Team update saved', { 
        external_id: updateData.external_id 
      });
      
      return { success: true, update: data };
    } catch (error) {
      this.logger.error?.('Failed to save team update', { 
        error: error.message,
        external_id: updateData.external_id 
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get team updates for user
   */
  async getTeamUpdates(userId, options = {}) {
    try {
      const {
        start_date,
        end_date,
        update_type
      } = options;

      let query = this.supabase
        .from('team_updates')
        .select('*')
        .eq('user_id', userId);

      if (start_date) {
        query = query.gte('updated_at', start_date);  // ← Fixed: use updated_at
      }

      if (end_date) {
        query = query.lte('updated_at', end_date);  // ← Fixed: use updated_at
      }

      if (update_type) {
        query = query.eq('update_type', update_type);
      }

      query = query.order('updated_at', { ascending: false });  // ← Fixed: order by updated_at

      const { data, error } = await query;

      if (error) throw error;

      return { success: true, updates: data || [] };
    } catch (error) {
      this.logger.error?.('Failed to get team updates', { 
        error: error.message,
        userId
      });
      return { success: false, error: error.message, updates: [] };
    }
  }

  /**
   * Get updates by JIRA key
   */
  async getTeamUpdatesByJiraKey(jiraKey) {
    try {
      const { data, error } = await this.supabase
        .from('team_updates')
        .select('*')
        .eq('linked_jira_key', jiraKey)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return { success: true, updates: data || [] };
    } catch (error) {
      this.logger.error?.('Failed to get updates by JIRA key', { 
        error: error.message,
        jiraKey
      });
      return { success: false, error: error.message, updates: [] };
    }
  }

  /**
   * Link update to meeting
   */
  async linkUpdateToMeeting(updateId, meetingId) {
    try {
      const { data, error } = await this.supabase
        .from('team_updates')
        .update({ linked_meeting_id: meetingId })
        .eq('id', updateId)
        .select()
        .single();

      if (error) throw error;

      return { success: true, update: data };
    } catch (error) {
      this.logger.error?.('Failed to link update to meeting', { 
        error: error.message,
        updateId,
        meetingId
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete team update (for cleanup of deleted issues)
   */
  async deleteTeamUpdate(updateId) {
    try {
      const { error } = await this.supabase
        .from('team_updates')
        .delete()
        .eq('id', updateId);

      if (error) throw error;

      this.logger.debug?.('Team update deleted', { updateId });
      
      return { success: true };
    } catch (error) {
      this.logger.error?.('Failed to delete team update', { 
        error: error.message,
        updateId
      });
      return { success: false, error: error.message };
    }
  }

  // ==================== TEAMS MANAGEMENT ====================

  /**
   * Create a new team
   */
  async createTeam(teamData) {
    try {
      const { data, error } = await this.supabase
        .from('app_teams')
        .insert([teamData])
        .select()
        .single();

      if (error) throw error;

      this.logger.info?.('Team created', { team_id: data.id, name: teamData.name });
      
      return { success: true, team: data };
    } catch (error) {
      this.logger.error?.('Failed to create team', { 
        error: error.message,
        teamData
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Update team
   */
  async updateTeam(teamId, updates) {
    try {
      const { data, error } = await this.supabase
        .from('app_teams')
        .update(updates)
        .eq('id', teamId)
        .select()
        .single();

      if (error) throw error;

      this.logger.info?.('Team updated', { team_id: teamId });
      
      return { success: true, team: data };
    } catch (error) {
      this.logger.error?.('Failed to update team', { 
        error: error.message,
        teamId
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete team
   */
  async deleteTeam(teamId) {
    try {
      const { error } = await this.supabase
        .from('app_teams')
        .delete()
        .eq('id', teamId);

      if (error) throw error;

      this.logger.info?.('Team deleted', { team_id: teamId });
      
      return { success: true };
    } catch (error) {
      this.logger.error?.('Failed to delete team', { 
        error: error.message,
        teamId
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get all teams for a user
   */
  async getTeams(userId) {
    try {
      const { data, error } = await this.supabase
        .from('app_team_members')
        .select(`
          team_id,
          role,
          app_teams:team_id (*)
        `)
        .eq('user_id', userId);

      if (error) throw error;

      // Flatten the structure
      const teams = (data || []).map(item => ({
        ...item.app_teams,
        user_role: item.role
      }));

      return { success: true, teams };
    } catch (error) {
      this.logger.error?.('Failed to get teams', { 
        error: error.message,
        userId
      });
      return { success: false, error: error.message, teams: [] };
    }
  }

  /**
   * Get team by ID
   */
  async getTeamById(teamId) {
    try {
      const { data, error } = await this.supabase
        .from('app_teams')
        .select('*')
        .eq('id', teamId)
        .single();

      if (error) throw error;

      return { success: true, team: data };
    } catch (error) {
      this.logger.error?.('Failed to get team', { 
        error: error.message,
        teamId
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Add team member
   */
  async addTeamMember(teamId, userId, role = 'member') {
    try {
      const { data, error } = await this.supabase
        .from('app_team_members')
        .insert([{ team_id: teamId, user_id: userId, role }])
        .select()
        .single();

      if (error) throw error;

      this.logger.info?.('Team member added', { team_id: teamId, user_id: userId });
      
      return { success: true, member: data };
    } catch (error) {
      this.logger.error?.('Failed to add team member', { 
        error: error.message,
        teamId,
        userId
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Remove team member
   */
  async removeTeamMember(teamId, userId) {
    try {
      const { error } = await this.supabase
        .from('app_team_members')
        .delete()
        .eq('app_team_id', teamId)
        .eq('user_id', userId);

      if (error) throw error;

      this.logger.info?.('Team member removed', { team_id: teamId, user_id: userId });
      
      return { success: true };
    } catch (error) {
      this.logger.error?.('Failed to remove team member', { 
        error: error.message,
        teamId,
        userId
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get team members
   */
  async getTeamMembers(teamId) {
    try {
      const { data, error } = await this.supabase
        .from('app_team_members')
        .select('*')
        .eq('app_team_id', teamId);

      if (error) throw error;

      return { success: true, members: data || [] };
    } catch (error) {
      this.logger.error?.('Failed to get team members', { 
        error: error.message,
        teamId
      });
      return { success: false, error: error.message, members: [] };
    }
  }

  /**
   * Assign meeting to team
   */
  async assignMeetingToTeam(meetingId, teamId) {
    try {
      const { data, error } = await this.supabase
        .from('team_meetings')
        .update({ app_team_id: teamId })
        .eq('meeting_id', meetingId)
        .select()
        .single();

      if (error) throw error;

      this.logger.info?.('Meeting assigned to team', { meeting_id: meetingId, team_id: teamId });
      
      return { success: true, meeting: data };
    } catch (error) {
      this.logger.error?.('Failed to assign meeting to team', { 
        error: error.message,
        meetingId,
        teamId
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Assign task/update to team
   */
  async assignTaskToTeam(updateId, teamId) {
    try {
      const { data, error } = await this.supabase
        .from('team_updates')
        .update({ app_team_id: teamId })
        .eq('id', updateId)
        .select()
        .single();

      if (error) throw error;

      this.logger.info?.('Task assigned to team', { update_id: updateId, team_id: teamId });
      
      return { success: true, update: data };
    } catch (error) {
      this.logger.error?.('Failed to assign task to team', { 
        error: error.message,
        updateId,
        teamId
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Assign repository to team
   */
  async assignRepositoryToTeam(teamId, owner, repo) {
    try {
      const { data, error } = await this.supabase
        .from('app_team_repositories')
        .insert([{
          team_id: teamId,
          repository_owner: owner,
          repository_name: repo
        }])
        .select()
        .single();

      if (error) throw error;

      this.logger.info?.('Repository assigned to team', { team_id: teamId, repo: `${owner}/${repo}` });
      
      return { success: true, repository: data };
    } catch (error) {
      this.logger.error?.('Failed to assign repository to team', { 
        error: error.message,
        teamId,
        owner,
        repo
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get team repositories
   */
  async getTeamRepositories(teamId) {
    try {
      const { data, error } = await this.supabase
        .from('app_team_repositories')
        .select('*')
        .eq('team_id', teamId);

      if (error) throw error;

      return { success: true, repositories: data || [] };
    } catch (error) {
      this.logger.error?.('Failed to get team repositories', { 
        error: error.message,
        teamId
      });
      return { success: false, error: error.message, repositories: [] };
    }
  }

  /**
   * Get team context (meetings, tasks, repositories)
   */
  async getTeamContext(teamId, options = {}) {
    try {
      const { start_date, end_date } = options;

      // Fetch meetings
      let meetingsQuery = this.supabase
        .from('team_meetings')
        .select('*')
        .eq('app_team_id', teamId)
        .order('start_time', { ascending: false });

      if (start_date) {
        meetingsQuery = meetingsQuery.gte('start_time', start_date);
      }
      if (end_date) {
        meetingsQuery = meetingsQuery.lte('start_time', end_date);
      }

      // Fetch tasks
      let tasksQuery = this.supabase
        .from('team_updates')
        .select('*')
        .eq('app_team_id', teamId)
        .order('updated_at', { ascending: false });

      if (start_date) {
        tasksQuery = tasksQuery.gte('updated_at', start_date);
      }
      if (end_date) {
        tasksQuery = tasksQuery.lte('updated_at', end_date);
      }

      // Fetch repositories
      const repositoriesQuery = this.supabase
        .from('app_team_repositories')
        .select('*')
        .eq('team_id', teamId);

      const [meetingsResult, tasksResult, repositoriesResult] = await Promise.all([
        meetingsQuery,
        tasksQuery,
        repositoriesQuery
      ]);

      if (meetingsResult.error) throw meetingsResult.error;
      if (tasksResult.error) throw tasksResult.error;
      if (repositoriesResult.error) throw repositoriesResult.error;

      return {
        success: true,
        meetings: meetingsResult.data || [],
        tasks: tasksResult.data || [],
        repositories: repositoriesResult.data || []
      };
    } catch (error) {
      this.logger.error?.('Failed to get team context', { 
        error: error.message,
        teamId
      });
      return {
        success: false,
        error: error.message,
        meetings: [],
        tasks: [],
        repositories: []
      };
    }
  }

  /**
   * Get unassigned meetings (no team_id)
   */
  async getUnassignedMeetings(userId) {
    try {
      const { data, error } = await this.supabase
        .from('team_meetings')
        .select('*')
        .eq('user_id', userId)
        .is('app_team_id', null)
        .order('start_time', { ascending: false })
        .limit(50);

      if (error) throw error;

      return { success: true, meetings: data || [] };
    } catch (error) {
      this.logger.error?.('Failed to get unassigned meetings', { 
        error: error.message,
        userId
      });
      return { success: false, error: error.message, meetings: [] };
    }
  }

  /**
   * Get unassigned tasks (no team_id)
   */
  async getUnassignedTasks(userId) {
    try {
      const { data, error } = await this.supabase
        .from('team_updates')
        .select('*')
        .eq('user_id', userId)
        .eq('update_type', 'jira_issue')  // Only JIRA issues
        .is('app_team_id', null)
        .order('updated_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      return { success: true, tasks: data || [] };
    } catch (error) {
      this.logger.error?.('Failed to get unassigned tasks', { 
        error: error.message,
        userId
      });
      return { success: false, error: error.message, tasks: [] };
    }
  }
}

module.exports = TeamSyncSupabaseAdapter;


