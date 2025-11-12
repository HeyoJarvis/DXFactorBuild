/**
 * Desktop Supabase Adapter
 * Handles all Supabase interactions for the Desktop Electron app
 * - Saves Slack messages
 * - Saves copilot conversations
 * - Tracks user activity
 * - Manages tasks
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });
const SupabaseClient = require('../../../data/storage/supabase-client');
const { mapJiraStatusToInternal } = require('../utils/jira-status-mapper');

class DesktopSupabaseAdapter {
  constructor(options = {}) {
    const supabaseOptions = {
      useServiceRole: true, // Desktop app runs as privileged user
      ...options
    };
    
    const supabaseClient = new SupabaseClient(supabaseOptions);
    this.supabase = supabaseClient.getClient(); // Get the actual Supabase client instance
    this.logger = options.logger || console;
    
    if (this.logger.info) {
      this.logger.info('Desktop Supabase adapter initialized');
    }
  }

  /**
   * Save a Slack message to Supabase
   */
  async saveSlackMessage(message) {
    try {
      const { data, error } = await this.supabase
        .from('slack_messages')
        .insert([{
          message_id: message.id,
          user_id: message.user,
          channel_id: message.channel,
          message_text: message.text,
          message_type: message.type,
          is_urgent: message.urgent || false,
          timestamp: message.timestamp,
          raw_data: message.raw
        }])
        .select();

      if (error) throw error;

      this.logger.debug('Slack message saved to Supabase', { 
        message_id: message.id 
      });
      
      return { success: true, data };
    } catch (error) {
      this.logger.error('Failed to save Slack message to Supabase', { 
        error: error.message,
        message_id: message.id 
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Create a new conversation session
   */
  async createConversationSession(userId, metadata = {}) {
    try {
      // Extract top-level fields from metadata
      const {
        workflow_id,
        workflow_type,
        workflow_intent,
        session_title,
        ...remainingMetadata
      } = metadata;

      const { data, error } = await this.supabase
        .from('conversation_sessions')
        .insert([{
          user_id: userId,
          workflow_id: workflow_id || null,
          workflow_type: workflow_type || 'general',
          workflow_intent: workflow_intent || null,
          session_title: session_title || `Chat Session ${new Date().toISOString()}`,
          metadata: remainingMetadata,  // Store remaining metadata
          is_active: true
        }])
        .select()
        .single();

      if (error) throw error;

      this.logger.info('Conversation session created', { 
        session_id: data.id,
        workflow_type: data.workflow_type,
        workflow_id: data.workflow_id
      });
      
      return { success: true, session: data };
    } catch (error) {
      this.logger.error('Failed to create conversation session', { 
        error: error.message 
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Save a message to a conversation session
   */
  async saveMessageToSession(sessionId, message, role = 'user', metadata = {}, userId = null) {
    try {
      // If userId not provided, try to get from session
      if (!userId) {
        const { data: session } = await this.supabase
          .from('conversation_sessions')
          .select('user_id')
          .eq('id', sessionId)
          .single();

        userId = session?.user_id;
      }

      if (!userId) {
        throw new Error('user_id is required for message insertion');
      }

      const { data, error } = await this.supabase
        .from('conversation_messages')
        .insert([{
          session_id: sessionId,
          user_id: userId,  // ✅ Added required field
          message_text: message,
          role: role,
          metadata: metadata,  // ✅ Use actual column name from schema
          timestamp: new Date().toISOString()
        }])
        .select();

      if (error) throw error;

      // Update session's last_message_at and message_count manually (since trigger might fail)
      // Note: We rely on the database trigger to update message_count
      await this.supabase
        .from('conversation_sessions')
        .update({
          last_message_at: new Date().toISOString()
        })
        .eq('id', sessionId)
        .catch(err => this.logger.warn('Failed to update session metadata', { error: err.message }));

      this.logger.debug('Message saved to session', {
        session_id: sessionId,
        user_id: userId,
        role,
        message_length: message.length
      });

      return { success: true, data };
    } catch (error) {
      this.logger.error('Failed to save message to session', {
        error: error.message,
        session_id: sessionId
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Update session title (auto-generate from first message)
   */
  async updateSessionTitle(sessionId, title) {
    try {
      const { data, error } = await this.supabase
        .from('conversation_sessions')
        .update({ session_title: title })
        .eq('id', sessionId)
        .select();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      this.logger.error('Failed to update session title', { 
        error: error.message 
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get active session for a user (or create new one)
   */
  async getOrCreateActiveSession(userId, metadata = {}) {
    try {
      // If workflow_id is provided, look for that specific session
      if (metadata.workflow_id) {
        const { data: specificSession, error: specificError } = await this.supabase
          .from('conversation_sessions')
          .select('*')
          .eq('user_id', userId)
          .eq('workflow_id', metadata.workflow_id)
          .eq('workflow_type', metadata.workflow_type || 'general')
          .order('started_at', { ascending: false })
          .limit(1);

        if (specificError) throw specificError;

        if (specificSession && specificSession.length > 0) {
          this.logger.info('Using existing specific session', { 
            session_id: specificSession[0].id,
            workflow_id: metadata.workflow_id,
            workflow_type: metadata.workflow_type
          });
          return { success: true, session: specificSession[0], isNew: false };
        }
      }

      // For general chat (no workflow_id), try to get an active session from the last 24 hours
      if (!metadata.workflow_id || metadata.workflow_type === 'general') {
        const { data: existingSessions, error: fetchError } = await this.supabase
          .from('conversation_sessions')
          .select('*')
          .eq('user_id', userId)
          .eq('is_active', true)
          .eq('workflow_type', 'general')
          .gte('last_message_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .order('last_message_at', { ascending: false })
          .limit(1);

        if (fetchError) throw fetchError;

        if (existingSessions && existingSessions.length > 0) {
          this.logger.info('Using existing active general session', { 
            session_id: existingSessions[0].id 
          });
          return { success: true, session: existingSessions[0], isNew: false };
        }
      }

      // No existing session, create a new one
      this.logger.info('Creating new session', {
        workflow_id: metadata.workflow_id,
        workflow_type: metadata.workflow_type
      });
      return await this.createConversationSession(userId, metadata);
    } catch (error) {
      this.logger.error('Failed to get or create session', { 
        error: error.message 
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Close a conversation session
   */
  async closeSession(sessionId) {
    try {
      const { data, error } = await this.supabase
        .from('conversation_sessions')
        .update({ is_active: false })
        .eq('id', sessionId)
        .select();

      if (error) throw error;

      this.logger.info('Session closed', { session_id: sessionId });
      return { success: true, data };
    } catch (error) {
      this.logger.error('Failed to close session', { 
        error: error.message 
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get recent Slack messages from Supabase
   */
  async getRecentSlackMessages(limit = 20) {
    try {
      const { data, error } = await this.supabase
        .from('slack_messages')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return { success: true, messages: data };
    } catch (error) {
      this.logger.error('Failed to get Slack messages from Supabase', { 
        error: error.message 
      });
      return { success: false, error: error.message, messages: [] };
    }
  }

  /**
   * Get conversation sessions for a user
   */
  async getUserSessions(userId, limit = 10) {
    try {
      const { data, error } = await this.supabase
        .from('conversation_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('last_message_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return { success: true, sessions: data };
    } catch (error) {
      this.logger.error('Failed to get user sessions', { 
        error: error.message 
      });
      return { success: false, error: error.message, sessions: [] };
    }
  }

  /**
   * Get messages for a specific session
   */
  async getSessionMessages(sessionId, limit = 100) {
    try {
      const { data, error } = await this.supabase
        .from('conversation_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('timestamp', { ascending: true })
        .limit(limit);

      if (error) throw error;

      // Log first message for debugging
      if (data && data.length > 0) {
        this.logger.debug('Sample message from DB', {
          session_id: sessionId,
          sample: {
            role: data[0].role,
            has_message_text: !!data[0].message_text,
            has_content: !!data[0].content,
            text_length: data[0].message_text?.length || data[0].content?.length || 0
          }
        });
      }

      return { success: true, messages: data };
    } catch (error) {
      this.logger.error('Failed to get session messages', { 
        error: error.message 
      });
      return { success: false, error: error.message, messages: [] };
    }
  }

  /**
   * Track user activity
   */
  async trackActivity(userId, activityType, metadata = {}) {
    try {
      const { data, error } = await this.supabase
        .from('user_activity')
        .insert([{
          user_id: userId,
          activity_type: activityType,
          metadata: metadata,
          timestamp: new Date().toISOString()
        }])
        .select();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      this.logger.error('Failed to track activity', { 
        error: error.message 
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Create a new workflow session (always creates new session for each workflow)
   * Workflow type is stored as metadata/context, not used for grouping
   */
  async createWorkflowSession(userId, workflowData) {
    try {
      const {
        workflowType = 'general_inquiry',
        workflowIntent = 'information_seeking',
        sourceChannelId = null,
        sourceMessageId = null,
        urgency = 'low',
        toolsMentioned = [],
        entities = {}
      } = workflowData;

      // Build workflow metadata
      const workflowMetadata = {
        urgency,
        tools_mentioned: toolsMentioned,
        entities,
        detected_at: new Date().toISOString()
      };

      // Always create a new session for each workflow
      const workflowId = `${userId}_workflow_${Date.now()}`;
      
      const { data: newSession, error: createError } = await this.supabase
        .from('conversation_sessions')
        .insert([{
          user_id: userId,
          workflow_id: workflowId,
          workflow_type: workflowType,
          workflow_intent: workflowIntent,
          workflow_metadata: workflowMetadata,
          source_channel_id: sourceChannelId,
          source_message_id: sourceMessageId,
          session_title: this.generateWorkflowTitle(workflowType, workflowIntent),
          is_active: true,
          is_completed: false
        }])
        .select()
        .single();

      if (createError) throw createError;

      this.logger.info('Created new workflow session', { 
        session_id: newSession.id,
        workflow_type: workflowType,
        workflow_intent: workflowIntent,
        workflow_id: workflowId
      });

      return { success: true, session: newSession, isNew: true };
      
    } catch (error) {
      this.logger.error('Failed to create workflow session', { 
        error: error.message,
        user_id: userId,
        workflow_type: workflowData.workflowType
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get user's current active session (most recent, regardless of workflow type)
   * Useful for continuing a conversation without detecting workflow again
   */
  async getUserActiveSession(userId, maxAgeHours = 1) {
    try {
      const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
      
      const { data: sessions, error } = await this.supabase
        .from('conversation_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .eq('is_completed', false)
        .gte('last_message_at', cutoffTime.toISOString())
        .order('last_message_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (sessions && sessions.length > 0) {
        this.logger.debug('Found active session', { 
          session_id: sessions[0].id,
          workflow_type: sessions[0].workflow_type
        });
        return { success: true, session: sessions[0] };
      }

      return { success: true, session: null };
      
    } catch (error) {
      this.logger.error('Failed to get active session', { 
        error: error.message,
        user_id: userId
      });
      return { success: false, error: error.message, session: null };
    }
  }

  /**
   * Generate a descriptive title for a workflow session
   */
  generateWorkflowTitle(workflowType, workflowIntent) {
    const titles = {
      'task_automation': '🤖 Task Automation',
      'tool_recommendation': '🛠️ Tool Recommendations',
      'integration_help': '🔗 Integration Support',
      'workflow_optimization': '⚡ Workflow Optimization',
      'problem_solving': '🔍 Problem Solving',
      'information_seeking': '💡 Information & Help',
      'learning': '📚 Learning & Tutorials',
      'reporting_request': '📊 Reporting & Analytics',
      'help_request': '❓ Help Request',
      'automation_inquiry': '🔄 Automation Inquiry',
      'integration_request': '🔌 Integration Request',
      'scheduling_request': '📅 Scheduling',
      'issue_report': '🐛 Issue Report',
      'feature_request': '✨ Feature Request',
      'tool_inquiry': '🔧 Tool Inquiry',
      'general_inquiry': '💬 General Chat'
    };

    return titles[workflowType] || titles[workflowIntent] || '💬 General Conversation';
  }

  /**
   * Get all workflow sessions for a user (grouped by workflow type)
   */
  async getUserWorkflowSessions(userId, options = {}) {
    try {
      const {
        workflowType = null,
        includeCompleted = false,
        limit = 20
      } = options;

      let query = this.supabase
        .from('conversation_sessions')
        .select('*')
        .eq('user_id', userId);

      if (workflowType) {
        query = query.eq('workflow_type', workflowType);
      }

      if (!includeCompleted) {
        query = query.eq('is_completed', false);
      }

      query = query
        .order('last_message_at', { ascending: false })
        .limit(limit);

      const { data, error } = await query;

      if (error) throw error;

      // Group sessions by workflow type
      const groupedSessions = {};
      (data || []).forEach(session => {
        const type = session.workflow_type || 'general_inquiry';
        if (!groupedSessions[type]) {
          groupedSessions[type] = [];
        }
        groupedSessions[type].push(session);
      });

      return { 
        success: true, 
        sessions: data || [],
        groupedByWorkflow: groupedSessions 
      };
      
    } catch (error) {
      this.logger.error('Failed to get user workflow sessions', { 
        error: error.message,
        user_id: userId
      });
      return { success: false, error: error.message, sessions: [] };
    }
  }

  /**
   * Complete a workflow session (mark as done)
   */
  async completeWorkflowSession(sessionId) {
    try {
      const { data, error } = await this.supabase
        .from('conversation_sessions')
        .update({ 
          is_completed: true,
          is_active: false,
          completed_at: new Date().toISOString()
        })
        .eq('id', sessionId)
        .select();

      if (error) throw error;

      this.logger.info('Workflow session completed', { session_id: sessionId });
      return { success: true, data };
    } catch (error) {
      this.logger.error('Failed to complete workflow session', { 
        error: error.message 
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get workflow summary for a user
   */
  async getUserWorkflowSummary(userId, days = 7) {
    try {
      const { data, error } = await this.supabase
        .rpc('get_user_workflow_summary', {
          p_user_id: userId,
          p_days: days
        });

      if (error) throw error;

      return { success: true, summary: data || [] };
    } catch (error) {
      this.logger.error('Failed to get workflow summary', { 
        error: error.message,
        user_id: userId
      });
      return { success: false, error: error.message, summary: [] };
    }
  }

  // ===== TASK MANAGEMENT METHODS (using conversation_sessions) =====

  /**
   * Create a new task (stored as a conversation_session with workflow_type='task')
   */
  async createTask(userId, taskData) {
    try {
      // Get user's role to set default route_to
      const { data: userData } = await this.supabase
        .from('users')
        .select('user_role')
        .eq('id', userId)
        .single();

      const userRole = userData?.user_role || 'sales';
      const defaultRoute = userRole === 'developer' ? 'mission-control' : 'tasks-sales';

      const workflowId = `${userId}_task_${Date.now()}`;
      
      const { data, error } = await this.supabase
        .from('conversation_sessions')
        .insert([{
          user_id: userId,
          workflow_id: workflowId,
          workflow_type: 'task',
          workflow_intent: 'task_management',
          session_title: taskData.title,
          workflow_metadata: {
            priority: taskData.priority || 'medium',
            description: taskData.description || null,
            tags: taskData.tags || [],
            due_date: taskData.dueDate || null,
            parent_session_id: taskData.parentSessionId || null, // Link to chat that spawned this task
            assignor: taskData.assignor || null, // Who assigned/created the task
            assignee: taskData.assignee || null, // Who the task is assigned to
            mentioned_users: taskData.mentionedUsers || [], // All mentioned users
            route_to: taskData.routeTo || defaultRoute, // Auto-route based on user role
            work_type: taskData.workType || 'task', // Type: 'task', 'calendar', 'outreach'
            external_id: taskData.externalId || null, // For JIRA/external sync
            external_key: taskData.externalKey || null,
            external_url: taskData.externalUrl || null,
            external_source: taskData.externalSource || null,
            jira_status: taskData.jira_status || null,
            jira_issue_type: taskData.jira_issue_type || null,
            jira_priority: taskData.jira_priority || null,
            story_points: taskData.story_points || null,
            sprint: taskData.sprint || null,
            labels: taskData.labels || []
          },
          is_active: true,
          is_completed: false
        }])
        .select()
        .single();

      if (error) throw error;

      this.logger.info('Task created', { 
        task_id: data.id, 
        title: taskData.title,
        user_role: userRole,
        route_to: taskData.routeTo || defaultRoute,
        work_type: taskData.workType || 'task',
        assignee: taskData.assignee,
        assignor: taskData.assignor,
        mentioned_users: taskData.mentionedUsers,
        external_key: taskData.externalKey,
        external_id: taskData.externalId,
        external_source: taskData.externalSource
      });
      return { success: true, task: data };
    } catch (error) {
      this.logger.error('Failed to create task', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get user's tasks (conversation_sessions where workflow_type='task')
   * With dual-routing support for calendar and email tasks
   * With user assignment filtering (owner/assignee/assignor/mentioned)
   * With external source filtering based on user role
   */
  async getUserTasks(userId, filters = {}) {
    try {
      let query = this.supabase
        .from('conversation_sessions')
        .select('*')
        .eq('workflow_type', 'task');

      // IMPORTANT: Don't filter by user_id at SQL level - we need to check assignment fields
      // Tasks can be owned by user OR assigned to them OR they're mentioned

      // Filter by completion status
      if (!filters.includeCompleted) {
        query = query.eq('is_completed', false);
      }

      // Filter by priority (stored in workflow_metadata)
      if (filters.priority) {
        query = query.contains('workflow_metadata', { priority: filters.priority });
      }

      // Sort by creation time
      query = query.order('started_at', { ascending: false });

      const limit = filters.limit || 100;
      query = query.limit(limit);

      const { data, error } = await query;

      if (error) throw error;

      // Transform to task format for UI compatibility
      let tasks = (data || [])
        // Filter out JIRA deleted tasks unless explicitly requested
        .filter(session => {
          if (filters.includeDeleted) return true;
          return !session.workflow_metadata?.jira_deleted;
        })
        .map(session => {
          const jiraStatus = session.workflow_metadata?.jira_status;
          
          // Map JIRA status to internal status using centralized utility
          let internalStatus = 'todo';
          if (session.is_completed) {
            internalStatus = 'completed';
          } else if (jiraStatus) {
            internalStatus = mapJiraStatusToInternal(jiraStatus);
          }
          
          return {
            id: session.id,
            user_id: session.user_id,
            title: session.session_title,
            description: session.workflow_metadata?.description || null,
            status: internalStatus,
            priority: session.workflow_metadata?.priority || 'medium',
            tags: session.workflow_metadata?.tags || [],
            due_date: session.workflow_metadata?.due_date || null,
            parent_session_id: session.workflow_metadata?.parent_session_id || null,
            assignor: session.workflow_metadata?.assignor || null,
            assignee: session.workflow_metadata?.assignee || null,
            mentioned_users: session.workflow_metadata?.mentioned_users || [],
            route_to: session.workflow_metadata?.route_to || 'tasks-sales',
            work_type: session.workflow_metadata?.work_type || 'task',
            external_id: session.workflow_metadata?.external_id || null,
            external_key: session.workflow_metadata?.external_key || null,
            external_url: session.workflow_metadata?.external_url || null,
            external_source: session.workflow_metadata?.external_source || null,
            jira_status: jiraStatus || null,
            jira_issue_type: session.workflow_metadata?.jira_issue_type || null,
            jira_priority: session.workflow_metadata?.jira_priority || null,
            jira_deleted: session.workflow_metadata?.jira_deleted || false,
            created_at: session.started_at,
            updated_at: session.last_message_at,
            completed_at: session.completed_at
          };
        });

      // Get user's Slack ID for assignment filtering
      const userSlackId = filters.slackUserId;

      this.logger.debug('Task assignment filtering', {
        totalTasksBeforeFilter: tasks.length,
        userId,
        userSlackId
      });

      // Apply team filtering if requested (for viewing team dev tasks)
      // SKIP if skipTeamFilter is true (load ALL tasks)
      if (filters.filterByTeam && filters.teamId && !filters.skipTeamFilter) {
        this.logger.info('Applying team filtering', {
          teamId: filters.teamId,
          tasksBeforeFilter: tasks.length
        });

        // Get all users in the same team
        const { data: teamMembers, error: teamError } = await this.supabase
          .from('users')
          .select('id, slack_user_id')
          .eq('team_id', filters.teamId);

        if (teamError) {
          this.logger.warn('Failed to fetch team members', { error: teamError.message });
        } else {
          const teamMemberIds = teamMembers.map(member => member.id);
          const teamMemberSlackIds = teamMembers.map(member => member.slack_user_id).filter(Boolean);

          this.logger.info('Team members found', {
            teamId: filters.teamId,
            memberCount: teamMemberIds.length,
            slackIdCount: teamMemberSlackIds.length
          });

          // Filter tasks to show team tasks - either created by team members OR assigned to team members
          tasks = tasks.filter(task => {
            const isCreatedByTeam = teamMemberIds.includes(task.user_id);
            const isAssignedToTeam = task.assignee && teamMemberSlackIds.includes(task.assignee);
            const isAssignedByTeam = task.assignor && teamMemberSlackIds.includes(task.assignor);
            const hasMentionedTeamMember = task.mentioned_users?.some(userId =>
              teamMemberSlackIds.includes(userId)
            );

            const shouldInclude = isCreatedByTeam || isAssignedToTeam || isAssignedByTeam || hasMentionedTeamMember;

            // Log tasks that pass the filter
            if (shouldInclude) {
              this.logger.info('✅ Team task INCLUDED', {
                task_id: task.id,
                task_title: task.title,
                external_source: task.external_source,
                external_key: task.external_key,
                isCreatedByTeam,
                isAssignedToTeam,
                isAssignedByTeam,
                hasMentionedTeamMember
              });
            } else {
              this.logger.debug('❌ Task EXCLUDED from team view', {
                task_id: task.id,
                task_title: task.title,
                task_user_id: task.user_id,
                task_assignee: task.assignee,
                task_assignor: task.assignor,
                external_source: task.external_source
              });
            }

            return shouldInclude;
          });

          this.logger.info('Tasks after team filtering', {
            count: tasks.length,
            teamMemberIds: teamMemberIds.slice(0, 3),
            teamMemberSlackIds: teamMemberSlackIds.slice(0, 3)
          });
        }
      } else {
        // Apply user assignment filtering - user must be owner, assignee, assignor, or mentioned
        tasks = tasks.filter(task => {
          const isOwner = task.user_id === userId;
          const isAssignee = userSlackId && task.assignee === userSlackId;
          const isAssignor = userSlackId && task.assignor === userSlackId;
          const isMentioned = userSlackId && task.mentioned_users?.includes(userSlackId);
          
          const hasAccess = isOwner || isAssignee || isAssignor || isMentioned;

          if (!hasAccess) {
            this.logger.debug('Task filtered out', {
              task_id: task.id,
              task_title: task.title,
              task_assignee: task.assignee,
              task_assignor: task.assignor,
              task_mentioned_users: task.mentioned_users,
              isOwner,
              isAssignee,
              isAssignor,
              isMentioned
            });
          }

          return hasAccess;
        });
      }

      // Apply assignment view filtering (for "My Tasks", "Assigned by Me", "Assigned to Me" tabs)
      if (filters.assignmentView && userSlackId) {
        tasks = tasks.filter(task => {
          switch (filters.assignmentView) {
            case 'assigned_to_me':
              return task.assignee === userSlackId;
            case 'assigned_by_me':
              return task.assignor === userSlackId && task.assignee !== userSlackId;
            case 'my_tasks':
              return task.user_id === userId;
            default:
              return true;
          }
        });
      }

      // Get user's role for route-based filtering
      const { data: userData } = await this.supabase
        .from('users')
        .select('user_role')
        .eq('id', userId)
        .single();
      
      const userRole = filters.userRole || userData?.user_role || 'sales';

      // Apply role-based route filtering
      // SKIP this when viewing team dev tasks (we want to see developer tasks, not filter by sales role)
      if (!filters.filterByTeam) {
        if (filters.routeTo) {
          // Specific route requested
          tasks = tasks.filter(task => {
            const isDualRoute = task.work_type === 'calendar' || task.work_type === 'email';
            if (isDualRoute) {
              // Dual-route tasks appear in both views
              return filters.routeTo === 'tasks-sales' || filters.routeTo === 'mission-control';
            }
            return task.route_to === filters.routeTo;
          });
        } else {
          // Auto-filter by user role
          tasks = tasks.filter(task => {
            const isDualRoute = task.work_type === 'calendar' || task.work_type === 'email';
            if (isDualRoute) return true; // Always show dual-route tasks
            
            if (userRole === 'sales') {
              return task.route_to === 'tasks-sales';
            } else if (userRole === 'developer') {
              return task.route_to === 'mission-control';
            }
            return true; // Admin sees all
          });
        }
      }

      // Apply external source filtering based on user role
      // SKIP this filtering when viewing team dev tasks (filterByTeam mode)
      if (userRole && !filters.filterByTeam) {
        tasks = tasks.filter(task => {
          const externalSource = task.external_source;

          // Sales users see JIRA tasks (team-wide) and manual tasks (no external source)
          if (userRole === 'sales') {
            return externalSource === 'jira' || externalSource === null || externalSource === 'manual';
          }

          // Developer users see JIRA tasks and manual tasks
          if (userRole === 'developer') {
            return externalSource === 'jira' || externalSource === null || externalSource === 'manual';
          }

          // Admin sees everything
          return true;
        });
      }
      
      // Apply external source filter if specified (for JIRA, GitHub, etc.)
      if (filters.externalSource) {
        this.logger.info('Applying external source filter', {
          externalSource: filters.externalSource,
          tasksBeforeFilter: tasks.length,
          filterByTeam: filters.filterByTeam || false
        });
        tasks = tasks.filter(task => task.external_source === filters.externalSource);
        this.logger.info('Tasks after external source filter', {
          count: tasks.length
        });
      }

      // Apply route_to filtering with dual-routing logic
      // SKIP this when viewing team dev tasks (we want to see developer tasks, not sales tasks)
      if (filters.routeTo && !filters.filterByTeam) {
        tasks = tasks.filter(task => {
          const taskRoute = task.route_to;
          const workType = task.work_type;

          // Calendar and email tasks appear in both views
          const isDualRouteTask = workType === 'calendar' || workType === 'email';

          if (isDualRouteTask) {
            // Show in both sales tasks and mission control
            return filters.routeTo === 'tasks-sales' || filters.routeTo === 'mission-control';
          }

          // Regular tasks follow their route_to assignment
          return taskRoute === filters.routeTo;
        });
      }

      // Apply work_type filtering if specified
      if (filters.workType) {
        tasks = tasks.filter(task => task.work_type === filters.workType);
      }

      this.logger.info('Fetched user tasks', {
        userId,
        userSlackId,
        count: tasks.length,
        routeToFilter: filters.routeTo || 'all',
        workTypeFilter: filters.workType || 'all',
        userRoleFilter: filters.userRole || 'none',
        assignmentViewFilter: filters.assignmentView || 'all',
        teamFilter: filters.filterByTeam ? filters.teamId : 'none',
        dualRouteTasks: tasks.filter(t => t.work_type === 'calendar' || t.work_type === 'email').length
      });

      return { success: true, tasks };
    } catch (error) {
      this.logger.error('Failed to get tasks', { error: error.message });
      return { success: false, error: error.message, tasks: [] };
    }
  }

  /**
   * Get all tasks from a specific external source (e.g., 'jira', 'github')
   * Only returns non-deleted tasks by default
   * @param {string} userId - User ID (can be null to get all users' tasks)
   * @param {string} externalSource - External source (e.g., 'jira', 'github')
   * @param {boolean} includeDeleted - Include deleted/completed tasks
   * @param {boolean} allUsers - If true, get tasks from all users (for sync purposes)
   */
  async getTasksBySource(userId, externalSource, includeDeleted = false, allUsers = false) {
    try {
      let query = this.supabase
        .from('conversation_sessions')
        .select('*')
        .eq('workflow_type', 'task')
        .contains('workflow_metadata', { external_source: externalSource });

      // Only filter by user_id if not fetching for all users
      if (!allUsers && userId) {
        query = query.eq('user_id', userId);
      }

      // Filter out completed/deleted tasks unless explicitly requested
      if (!includeDeleted) {
        query = query.eq('is_completed', false);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Map to consistent format and filter out jira_deleted tasks
      const tasks = (data || [])
        .filter(session => {
          // Always filter out jira_deleted tasks unless includeDeleted is true
          if (!includeDeleted && session.workflow_metadata?.jira_deleted) {
            return false;
          }
          return true;
        })
        .map(session => {
          const jiraStatus = session.workflow_metadata?.jira_status;
          
          // Map JIRA status to internal status using centralized utility
          let internalStatus = 'active';
          if (session.is_completed) {
            internalStatus = 'completed';
          } else if (jiraStatus) {
            const mapped = mapJiraStatusToInternal(jiraStatus);
            // Convert 'todo' to 'active' for this method's return format
            internalStatus = mapped === 'todo' ? 'active' : mapped;
          }
          
          return {
            id: session.id,
            user_id: session.user_id, // Include user_id for debugging
            title: session.session_title,
            description: session.workflow_metadata?.description,
            priority: session.workflow_metadata?.priority,
            status: internalStatus,
            external_id: session.workflow_metadata?.external_id,
            external_key: session.workflow_metadata?.external_key,
            external_url: session.workflow_metadata?.external_url,
            external_source: session.workflow_metadata?.external_source,
            jira_status: jiraStatus,
            jira_issue_type: session.workflow_metadata?.jira_issue_type,
            jira_priority: session.workflow_metadata?.jira_priority,
            jira_deleted: session.workflow_metadata?.jira_deleted || false,
            created_at: session.started_at,
            updated_at: session.updated_at
          };
        });

      this.logger.info('Fetched tasks by source', {
        externalSource,
        totalTasks: tasks.length,
        includeDeleted,
        allUsers,
        userId: allUsers ? 'all' : userId
      });

      return tasks;
    } catch (error) {
      this.logger.error('Failed to get tasks by source', { 
        error: error.message, 
        externalSource 
      });
      return [];
    }
  }

  /**
   * Update a task
   */
  async updateTask(taskId, updates) {
    try {
      // Build update object
      const sessionUpdate = {};
      
      if (updates.title) {
        sessionUpdate.session_title = updates.title;
      }
      
      // Handle status updates from both task and kanban formats
      if (updates.status) {
        sessionUpdate.is_completed = updates.status === 'completed';
        if (updates.status === 'completed') {
          sessionUpdate.completed_at = new Date().toISOString();
        }
      } else if (updates.is_completed !== undefined) {
        sessionUpdate.is_completed = updates.is_completed;
        if (updates.is_completed && updates.completed_at) {
          sessionUpdate.completed_at = updates.completed_at;
        } else if (updates.is_completed) {
          sessionUpdate.completed_at = new Date().toISOString();
        }
      }
      
      // Handle JIRA status
      if (updates.jira_status) {
        // Get current metadata first
        const { data: current, error: fetchError } = await this.supabase
          .from('conversation_sessions')
          .select('workflow_metadata')
          .eq('id', taskId)
          .single();

        if (fetchError) throw fetchError;

        const metadata = current?.workflow_metadata || {};
        metadata.jira_status = updates.jira_status;
        sessionUpdate.workflow_metadata = metadata;
      }

      // Update metadata fields (including JIRA-related fields)
      if (updates.priority || updates.description || updates.tags || updates.dueDate || updates.assignor || updates.assignee || updates.jira_deleted !== undefined || updates.jira_status || updates.jira_issue_type || updates.jira_priority || updates.story_points || updates.sprint || updates.labels || updates.externalId || updates.externalKey || updates.externalUrl || updates.externalSource) {
        // Get current metadata first
        const { data: current, error: fetchError } = await this.supabase
          .from('conversation_sessions')
          .select('workflow_metadata')
          .eq('id', taskId)
          .single();

        if (fetchError) throw fetchError;

        const metadata = current?.workflow_metadata || {};
        
        if (updates.priority) metadata.priority = updates.priority;
        if (updates.description !== undefined) metadata.description = updates.description;
        if (updates.tags) metadata.tags = updates.tags;
        if (updates.dueDate !== undefined) metadata.due_date = updates.dueDate;
        if (updates.assignor !== undefined) metadata.assignor = updates.assignor;
        if (updates.assignee !== undefined) metadata.assignee = updates.assignee;
        if (updates.jira_deleted !== undefined) metadata.jira_deleted = updates.jira_deleted;
        
        // JIRA-specific fields
        if (updates.jira_status !== undefined) metadata.jira_status = updates.jira_status;
        if (updates.jira_issue_type !== undefined) metadata.jira_issue_type = updates.jira_issue_type;
        if (updates.jira_priority !== undefined) metadata.jira_priority = updates.jira_priority;
        if (updates.story_points !== undefined) metadata.story_points = updates.story_points;
        if (updates.sprint !== undefined) metadata.sprint = updates.sprint;
        if (updates.labels !== undefined) metadata.labels = updates.labels;
        
        // External source fields
        if (updates.externalId !== undefined) metadata.external_id = updates.externalId;
        if (updates.externalKey !== undefined) metadata.external_key = updates.externalKey;
        if (updates.externalUrl !== undefined) metadata.external_url = updates.externalUrl;
        if (updates.externalSource !== undefined) metadata.external_source = updates.externalSource;
        
        sessionUpdate.workflow_metadata = metadata;
      }

      const { data, error } = await this.supabase
        .from('conversation_sessions')
        .update(sessionUpdate)
        .eq('id', taskId)
        .select()
        .single();

      if (error) throw error;

      this.logger.info('Task updated', { task_id: taskId });
      return { success: true, task: data };
    } catch (error) {
      this.logger.error('Failed to update task', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete a task
   */
  async deleteTask(taskId) {
    try {
      const { error } = await this.supabase
        .from('conversation_sessions')
        .delete()
        .eq('id', taskId)
        .eq('workflow_type', 'task'); // Safety check

      if (error) throw error;

      this.logger.info('Task deleted', { task_id: taskId });
      return { success: true };
    } catch (error) {
      this.logger.error('Failed to delete task', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get task by external ID (e.g., JIRA issue ID)
   */
  async getTaskByExternalId(externalId) {
    try {
      // Use JSONB operator to query external_id field
      const { data, error } = await this.supabase
        .from('conversation_sessions')
        .select('*')
        .eq('workflow_type', 'task')
        .eq('workflow_metadata->>external_id', externalId)
        .order('started_at', { ascending: false })
        .limit(1);

      if (error && error.code !== 'PGRST116') { // Ignore "not found" error
        throw error;
      }

      // Return first match (should only be one)
      const task = data && data.length > 0 ? data[0] : null;
      
      if (task) {
        if (this.logger.info) {
          this.logger.info('Task found by external ID', { 
            external_id: externalId,
            task_id: task.id 
          });
        }
      } else {
        if (this.logger.info) {
          this.logger.info('Task NOT found by external ID', { 
            external_id: externalId
          });
        }
      }

      return task;
    } catch (error) {
      if (this.logger.error) {
        this.logger.error('Failed to get task by external ID', { 
          external_id: externalId,
          error: error.message 
        });
      }
      return null;
    }
  }

  /**
   * Get chat history for a specific task
   */
  async getTaskChatHistory(taskId) {
    try {
      if (this.logger.info) {
        this.logger.info('Fetching task chat history', { task_id: taskId });
      }

      const { data, error } = await this.supabase
        .from('conversation_messages')
        .select('*')
        .eq('metadata->>task_id', taskId)
        .eq('metadata->>message_type', 'task_chat')
        .order('timestamp', { ascending: true });

      if (error) throw error;

      const messages = (data || []).map(msg => ({
        role: msg.role,
        content: msg.message_text,
        timestamp: msg.timestamp
      }));

      if (this.logger.info) {
        this.logger.info('Task chat history loaded', { 
          task_id: taskId,
          message_count: messages.length 
        });
      }

      return { success: true, messages };
    } catch (error) {
      if (this.logger.error) {
        this.logger.error('Failed to get task chat history', { 
          task_id: taskId,
          error: error.message 
        });
      }
      return { success: false, error: error.message, messages: [] };
    }
  }

  /**
   * Get task statistics
   */
  async getTaskStats(userId) {
    try {
      const { data, error } = await this.supabase
        .from('conversation_sessions')
        .select('is_completed, workflow_metadata')
        .eq('user_id', userId)
        .eq('workflow_type', 'task');

      if (error) throw error;

      const tasks = data || [];
      const todoCount = tasks.filter(t => !t.is_completed).length;
      const completedCount = tasks.filter(t => t.is_completed).length;
      
      // Count by priority
      const urgentCount = tasks.filter(t => 
        !t.is_completed && t.workflow_metadata?.priority === 'urgent'
      ).length;

      return { 
        success: true, 
        stats: {
          total_tasks: tasks.length,
          todo_count: todoCount,
          in_progress_count: 0, // Could add this as a status field later
          completed_count: completedCount,
          urgent_count: urgentCount
        }
      };
    } catch (error) {
      this.logger.error('Failed to get task stats', { error: error.message });
      return { success: false, error: error.message, stats: {} };
    }
  }

  /**
   * Toggle task completion status
   */
  async toggleTaskCompletion(taskId, currentStatus) {
    const newStatus = currentStatus === 'completed' ? 'todo' : 'completed';
    return this.updateTask(taskId, { status: newStatus });
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('count')
        .limit(1);

      if (error) throw error;

      return { success: true, connected: true };
    } catch (error) {
      this.logger.error('Supabase health check failed', { 
        error: error.message 
      });
      return { success: false, connected: false, error: error.message };
    }
  }
}

module.exports = DesktopSupabaseAdapter;

