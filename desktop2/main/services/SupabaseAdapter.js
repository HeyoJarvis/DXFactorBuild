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
          session_title: session_title || null,
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
  async saveMessageToSession(sessionId, message, role = 'user', metadata = {}) {
    try {
      const { data, error } = await this.supabase
        .from('conversation_messages')
        .insert([{
          session_id: sessionId,
          message_text: message,
          role: role,
          metadata: metadata,
          timestamp: new Date().toISOString()
        }])
        .select();

      if (error) throw error;

      this.logger.debug('Message saved to session', { 
        session_id: sessionId,
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
          .gte('last_activity_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .order('last_activity_at', { ascending: false })
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
        .order('last_activity_at', { ascending: false })
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
        .gte('last_activity_at', cutoffTime.toISOString())
        .order('last_activity_at', { ascending: false })
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
        .order('last_activity_at', { ascending: false })
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
            route_to: taskData.routeTo || 'tasks-sales', // Where to route: 'tasks-sales' or 'mission-control'
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
        route_to: taskData.routeTo,
        work_type: taskData.workType
      });
      return { success: true, task: data };
    } catch (error) {
      this.logger.error('Failed to create task', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get user's tasks (conversation_sessions where workflow_type='task')
   */
  async getUserTasks(userId, filters = {}) {
    try {
      let query = this.supabase
        .from('conversation_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('workflow_type', 'task');

      // Filter by completion status
      if (!filters.includeCompleted) {
        query = query.eq('is_completed', false);
      }

      // Filter by priority (stored in workflow_metadata)
      if (filters.priority) {
        query = query.contains('workflow_metadata', { priority: filters.priority });
      }

      // Filter by route_to (for role-based filtering: 'tasks-sales' vs 'mission-control')
      if (filters.routeTo) {
        query = query.contains('workflow_metadata', { route_to: filters.routeTo });
      }

      // Sort by creation time
      query = query.order('started_at', { ascending: false });

      const limit = filters.limit || 50;
      query = query.limit(limit);

      const { data, error } = await query;

      if (error) throw error;

      // Transform to task format for UI compatibility
      const tasks = (data || []).map(session => ({
        id: session.id,
        user_id: session.user_id,
        title: session.session_title,
        description: session.workflow_metadata?.description || null,
        status: session.is_completed ? 'completed' : 'todo',
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
        created_at: session.started_at,
        updated_at: session.last_activity_at,
        completed_at: session.completed_at
      }));

      this.logger.info('Fetched user tasks', {
        userId,
        count: tasks.length,
        routeToFilter: filters.routeTo || 'all'
      });

      return { success: true, tasks };
    } catch (error) {
      this.logger.error('Failed to get tasks', { error: error.message });
      return { success: false, error: error.message, tasks: [] };
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
      
      if (updates.status) {
        sessionUpdate.is_completed = updates.status === 'completed';
        if (updates.status === 'completed') {
          sessionUpdate.completed_at = new Date().toISOString();
        }
      }

      // Update metadata fields
      if (updates.priority || updates.description || updates.tags || updates.dueDate || updates.assignor || updates.assignee) {
        // Get current metadata first
        const { data: current, error: fetchError } = await this.supabase
          .from('conversation_sessions')
          .select('workflow_metadata')
          .eq('id', taskId)
          .single();

        if (fetchError) throw fetchError;

        const metadata = current.workflow_metadata || {};
        
        if (updates.priority) metadata.priority = updates.priority;
        if (updates.description !== undefined) metadata.description = updates.description;
        if (updates.tags) metadata.tags = updates.tags;
        if (updates.dueDate !== undefined) metadata.due_date = updates.dueDate;
        if (updates.assignor !== undefined) metadata.assignor = updates.assignor;
        if (updates.assignee !== undefined) metadata.assignee = updates.assignee;
        
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
      const { data, error } = await this.supabase
        .from('conversation_sessions')
        .select('*')
        .eq('workflow_type', 'task')
        .contains('workflow_metadata', { externalId: externalId });

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

