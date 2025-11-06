/**
 * User Productivity Chat IPC Handlers
 * Handles user-specific productivity chat with context from tasks, GitHub activity, and metrics
 */

const { ipcMain } = require('electron');

function registerUserChatHandlers(services, logger) {
  const { dbAdapter, ai } = services;

  /**
   * Get user information by ID
   */
  ipcMain.handle('user-chat:get-user-info', async (_event, userId) => {
    try {
      logger.info('📋 Loading user info', { userId });

      const { data: user, error } = await dbAdapter.supabase
        .from('users')
        .select('id, name, email, user_role, integration_settings')
        .eq('id', userId)
        .single();

      if (error) {
        logger.error('Failed to load user info', { error: error.message });
        return { success: false, error: error.message };
      }

      logger.info('✅ User info loaded', { userId, userName: user.name });

      return {
        success: true,
        user
      };
    } catch (error) {
      logger.error('Error loading user info', { error: error.message });
      return { success: false, error: error.message };
    }
  });

  /**
   * Load user productivity context (tasks, GitHub activity, metrics)
   */
  ipcMain.handle('user-chat:load-context', async (_event, targetUserId) => {
    try {
      logger.info('📋 Loading user productivity context', { targetUserId });

      const currentUserId = services.auth?.currentUser?.id;

      if (!currentUserId) {
        logger.warn('Cannot load context: No authenticated user');
        return { success: false, error: 'User not authenticated' };
      }

      // Build context for the target user
      const { context, contextDetails } = await buildUserProductivityContext(
        targetUserId,
        dbAdapter,
        logger
      );

      logger.info('✅ Loaded user productivity context', {
        targetUserId,
        tasks: contextDetails.tasks.length,
        githubActivity: contextDetails.github_activity.length,
        meetings: contextDetails.meetings.length
      });

      return {
        success: true,
        context: contextDetails,
        summary: context.summary
      };
    } catch (error) {
      logger.error('Error loading user context', { error: error.message });
      return { success: false, error: error.message };
    }
  });

  /**
   * Get chat history for a user's productivity chat
   */
  ipcMain.handle('user-chat:get-history', async (_event, targetUserId) => {
    try {
      logger.info('📜 Loading user productivity chat history', { targetUserId });

      const currentUserId = services.auth?.currentUser?.id;

      if (!currentUserId) {
        logger.warn('Cannot load chat history: No authenticated user');
        return { success: false, error: 'User not authenticated' };
      }

      // Find or create conversation session for this user's productivity chat
      let sessionId;
      const { data: existingSessions, error: sessionFindError } = await dbAdapter.supabase
        .from('conversation_sessions')
        .select('id')
        .eq('user_id', currentUserId)
        .eq('workflow_type', 'user_productivity')
        .eq('workflow_id', targetUserId)
        .limit(1);

      if (sessionFindError) {
        logger.error('Error finding session', { error: sessionFindError.message });
        throw sessionFindError;
      }

      if (existingSessions && existingSessions.length > 0) {
        sessionId = existingSessions[0].id;
        logger.info('✅ Found existing session', { sessionId });
      } else {
        // Get target user name for session title
        const { data: targetUser } = await dbAdapter.supabase
          .from('users')
          .select('name, email')
          .eq('id', targetUserId)
          .single();

        const userName = targetUser?.name || targetUser?.email || 'User';

        // Create new session
        const { data: newSession, error: sessionCreateError } = await dbAdapter.supabase
          .from('conversation_sessions')
          .insert({
            user_id: currentUserId,
            workflow_type: 'user_productivity',
            workflow_id: targetUserId,
            session_title: `${userName} - Productivity Chat`,
            started_at: new Date().toISOString(),
            last_message_at: new Date().toISOString()
          })
          .select()
          .single();

        if (sessionCreateError) {
          logger.error('Error creating session', { error: sessionCreateError.message });
          throw sessionCreateError;
        }

        sessionId = newSession.id;
        logger.info('✅ Created new session', { sessionId });
      }

      // Get messages for this session
      const { data: messages, error: messagesError } = await dbAdapter.supabase
        .from('conversation_messages')
        .select('role, message_text, timestamp')
        .eq('session_id', sessionId)
        .order('timestamp', { ascending: true });

      // Transform to expected format
      const formattedMessages = (messages || []).map(msg => ({
        role: msg.role,
        content: msg.message_text,
        timestamp: msg.timestamp
      }));

      if (messagesError) {
        logger.error('Error loading messages', { error: messagesError.message });
        throw messagesError;
      }

      // Build context
      const { context, contextDetails } = await buildUserProductivityContext(
        targetUserId,
        dbAdapter,
        logger
      );

      logger.info(`✅ Loaded ${formattedMessages.length} messages and context`, {
        targetUserId,
        messagesCount: formattedMessages.length
      });

      return {
        success: true,
        sessionId,
        messages: formattedMessages,
        context,
        contextDetails
      };
    } catch (error) {
      logger.error('Error getting user productivity chat history', { error: error.message });
      return { success: false, error: error.message };
    }
  });

  /**
   * Send a message in user productivity chat
   */
  ipcMain.handle('user-chat:send-message', async (_event, targetUserId, message) => {
    try {
      logger.info('💬 Sending user productivity chat message', {
        targetUserId,
        message: message.substring(0, 50)
      });

      const currentUserId = services.auth?.currentUser?.id;

      if (!currentUserId) {
        logger.warn('Cannot send message: No authenticated user');
        return { success: false, error: 'User not authenticated' };
      }

      // Find existing session
      const { data: sessions, error: sessionFindError } = await dbAdapter.supabase
        .from('conversation_sessions')
        .select('id')
        .eq('user_id', currentUserId)
        .eq('workflow_type', 'user_productivity')
        .eq('workflow_id', targetUserId)
        .limit(1);

      if (sessionFindError || !sessions || sessions.length === 0) {
        throw new Error('Chat session not found. Please load chat history first.');
      }

      const sessionId = sessions[0].id;

      // Save user message
      await dbAdapter.saveMessageToSession(sessionId, message, 'user', {}, currentUserId);

      // Build context for AI
      const { context, contextDetails } = await buildUserProductivityContext(
        targetUserId,
        dbAdapter,
        logger
      );

      // Get target user info
      const { data: targetUser } = await dbAdapter.supabase
        .from('users')
        .select('name, email, user_role')
        .eq('id', targetUserId)
        .single();

      const userName = targetUser?.name || targetUser?.email || 'User';
      const userRole = targetUser?.user_role || 'user';

      // Build system prompt with detailed context
      let systemPrompt = `You are HeyJarvis, an AI assistant for productivity tracking and analysis.

USER PRODUCTIVITY CONTEXT - ${userName} (${userRole}):

You are analyzing productivity data for ${userName}. Provide insights, answer questions about their work, and help track their progress.

`;

      // Add detailed tasks if available
      if (contextDetails.tasks && contextDetails.tasks.length > 0) {
        systemPrompt += `📋 ACTIVE TASKS (${contextDetails.tasks.length}):\n\n`;
        contextDetails.tasks.slice(0, 15).forEach((t, idx) => {
          systemPrompt += `${idx + 1}. "${t.title}" [${t.external_key || t.id}]\n`;
          if (t.status) systemPrompt += `   - Status: ${t.status}\n`;
          if (t.priority) systemPrompt += `   - Priority: ${t.priority}\n`;
          if (t.source) systemPrompt += `   - Source: ${t.source.toUpperCase()}\n`;
          if (t.description) systemPrompt += `   - Description: ${t.description.substring(0, 150)}...\n`;
          if (t.created_at) systemPrompt += `   - Created: ${new Date(t.created_at).toLocaleDateString()}\n`;
          systemPrompt += `\n`;
        });
      } else {
        systemPrompt += `No active tasks found for ${userName}.\n\n`;
      }

      // Add GitHub activity if available
      if (contextDetails.github_activity && contextDetails.github_activity.length > 0) {
        systemPrompt += `\n💻 GITHUB ACTIVITY (${contextDetails.github_activity.length} recent items):\n\n`;
        contextDetails.github_activity.slice(0, 10).forEach((activity, idx) => {
          systemPrompt += `${idx + 1}. ${activity.type}: ${activity.title || activity.description}\n`;
          if (activity.repository) systemPrompt += `   - Repository: ${activity.repository}\n`;
          if (activity.created_at) systemPrompt += `   - Date: ${new Date(activity.created_at).toLocaleDateString()}\n`;
          if (activity.url) systemPrompt += `   - URL: ${activity.url}\n`;
          systemPrompt += `\n`;
        });
      } else {
        systemPrompt += `\nNo recent GitHub activity found for ${userName}.\n\n`;
      }

      // Add meetings if available
      if (contextDetails.meetings && contextDetails.meetings.length > 0) {
        systemPrompt += `\n📅 RECENT MEETINGS (${contextDetails.meetings.length}):\n\n`;
        contextDetails.meetings.slice(0, 5).forEach((m, idx) => {
          systemPrompt += `${idx + 1}. **${m.title}** (${new Date(m.start_time).toLocaleDateString()})\n`;
          if (m.ai_summary) {
            systemPrompt += `\n${m.ai_summary}\n\n`;
            systemPrompt += `---\n\n`;
          }
        });
      }

      // Add productivity metrics
      systemPrompt += `\n📊 PRODUCTIVITY METRICS:\n`;
      systemPrompt += `- Total Tasks: ${contextDetails.tasks.length}\n`;
      systemPrompt += `- Completed Tasks: ${contextDetails.tasks.filter(t => t.status === 'completed' || t.status === 'done').length}\n`;
      systemPrompt += `- In Progress: ${contextDetails.tasks.filter(t => t.status === 'in_progress' || t.status === 'in progress').length}\n`;
      systemPrompt += `- GitHub Commits: ${contextDetails.github_activity.filter(a => a.type === 'commit' || a.type === 'push').length}\n`;
      systemPrompt += `- Pull Requests: ${contextDetails.github_activity.filter(a => a.type === 'pull_request' || a.type === 'pr').length}\n`;
      systemPrompt += `\n`;

      systemPrompt += `\nIMPORTANT RESPONSE GUIDELINES:
- Be concise and professional - avoid lengthy explanations
- Use natural language without markdown formatting (no **, __, or emojis)
- Structure responses with clear sections using simple line breaks
- Reference specific tasks and data points when relevant
- Provide actionable insights in 2-3 sentences per point
- Use numbered lists for steps, bullet points for options
- Keep responses focused and scannable
- No chatbot-style greetings or sign-offs

When the user asks about productivity, progress, or work status, reference the specific tasks and GitHub activity listed above. Be direct, data-driven, and focused on helping track and improve productivity.`;

      // Log the context being sent to AI
      logger.info(`🤖 Sending context to AI for user ${targetUserId}:`, {
        tasksCount: contextDetails.tasks?.length || 0,
        githubActivityCount: contextDetails.github_activity?.length || 0,
        meetingsCount: contextDetails.meetings?.length || 0,
        systemPromptLength: systemPrompt.length
      });

      // Get conversation history
      const { data: historyMessages, error: historyError } = await dbAdapter.supabase
        .from('conversation_messages')
        .select('role, message_text')
        .eq('session_id', sessionId)
        .order('timestamp', { ascending: true })
        .limit(20); // Last 20 messages for context

      if (historyError) {
        logger.warn('Failed to load history', { error: historyError.message });
      }

      // Get AI response with full context
      logger.info('🤖 Requesting AI response');
      const aiResponse = await ai.sendMessage(message, { systemPrompt });

      if (!aiResponse || !aiResponse.content) {
        throw new Error('AI service returned empty response');
      }

      // Clean up the AI response - remove markdown formatting and emojis
      let cleanedResponse = aiResponse.content
        // Remove emoji patterns (including the "Live Slack Context" footer)
        .replace(/📱\s*\*\*Live Slack Context\*\*.*$/gm, '')
        .replace(/[📋💻📅📊🤖✅💬🔍📈📉🎯⚡️🚀💡🔔⏰📌🎉👍👎❌✔️]/g, '')
        // Convert markdown bold to clean text (keep the text, remove **)
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        // Convert markdown italic to clean text
        .replace(/\*([^*]+)\*/g, '$1')
        // Clean up any remaining markdown emphasis
        .replace(/__([^_]+)__/g, '$1')
        .replace(/_([^_]+)_/g, '$1')
        // Remove excessive newlines
        .replace(/\n{3,}/g, '\n\n')
        // Trim whitespace
        .trim();

      // Save cleaned AI response
      await dbAdapter.saveMessageToSession(sessionId, cleanedResponse, 'assistant', {}, currentUserId);

      logger.info('✅ User productivity chat message processed successfully');

      return {
        success: true,
        response: cleanedResponse
      };
    } catch (error) {
      logger.error('Error sending user productivity chat message', { error: error.message, stack: error.stack });
      return { success: false, error: error.message };
    }
  });

  logger.info('✅ User Productivity Chat handlers registered');
}

/**
 * Build user productivity context from tasks, GitHub activity, and meetings
 */
async function buildUserProductivityContext(targetUserId, dbAdapter, logger) {
  try {
    const context = {
      tasks_count: 0,
      github_activity_count: 0,
      meetings_count: 0,
      summary: ''
    };

    const contextDetails = {
      tasks: [],
      github_activity: [],
      meetings: []
    };

    // Get user's tasks from database
    try {
      const { data: userTasks, error: tasksError } = await dbAdapter.supabase
        .from('tasks')
        .select('id, title, status, priority, external_id, external_source, external_url, metadata, created_at, updated_at')
        .eq('assigned_to', targetUserId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!tasksError && userTasks && userTasks.length > 0) {
        context.tasks_count = userTasks.length;
        contextDetails.tasks = userTasks.map(task => ({
          id: task.id,
          title: task.title,
          external_key: task.metadata?.jira_key || task.external_id || task.id,
          status: task.status,
          priority: task.priority,
          source: task.external_source || 'unknown',
          description: task.metadata?.description || '',
          created_at: task.created_at,
          updated_at: task.updated_at
        }));

        logger.info(`✅ Loaded ${userTasks.length} tasks for user`, { targetUserId });
      }
    } catch (tasksError) {
      logger.warn('Could not load tasks', { error: tasksError.message });
    }

    // Get user's GitHub activity (commits, PRs, etc.)
    try {
      // Check if user has GitHub integration
      const { data: userData } = await dbAdapter.supabase
        .from('users')
        .select('integration_settings')
        .eq('id', targetUserId)
        .single();

      if (userData?.integration_settings?.github) {
        // Get GitHub activity from code_chunks or a dedicated github_activity table
        // For now, we'll query commits and PRs from code_chunks metadata
        const { data: githubActivity, error: githubError } = await dbAdapter.supabase
          .from('code_chunks')
          .select('repository_owner, repository_name, file_path, metadata, created_at')
          .eq('metadata->>author_id', targetUserId)
          .order('created_at', { ascending: false })
          .limit(20);

        if (!githubError && githubActivity && githubActivity.length > 0) {
          context.github_activity_count = githubActivity.length;
          contextDetails.github_activity = githubActivity.map(activity => ({
            type: activity.metadata?.type || 'commit',
            title: activity.metadata?.commit_message || activity.file_path,
            description: activity.metadata?.description || '',
            repository: `${activity.repository_owner}/${activity.repository_name}`,
            created_at: activity.created_at,
            url: activity.metadata?.url || ''
          }));

          logger.info(`✅ Loaded ${githubActivity.length} GitHub activities for user`, { targetUserId });
        }
      }
    } catch (githubError) {
      logger.warn('Could not load GitHub activity', { error: githubError.message });
    }

    // Get user's meetings (where they are an attendee)
    try {
      const { data: userMeetings, error: meetingsError } = await dbAdapter.supabase
        .from('team_meetings')
        .select('id, title, start_time, end_time, ai_summary, attendees')
        .contains('attendees', [targetUserId])
        .order('start_time', { ascending: false })
        .limit(10);

      if (!meetingsError && userMeetings && userMeetings.length > 0) {
        context.meetings_count = userMeetings.length;
        contextDetails.meetings = userMeetings;

        logger.info(`✅ Loaded ${userMeetings.length} meetings for user`, { targetUserId });
      }
    } catch (meetingsError) {
      logger.warn('Could not load meetings', { error: meetingsError.message });
    }

    // Build summary
    const summaryParts = [];
    if (context.tasks_count > 0) {
      summaryParts.push(`${context.tasks_count} tasks`);
    }
    if (context.github_activity_count > 0) {
      summaryParts.push(`${context.github_activity_count} GitHub activities`);
    }
    if (context.meetings_count > 0) {
      summaryParts.push(`${context.meetings_count} meetings`);
    }

    context.summary = summaryParts.length > 0
      ? `User has ${summaryParts.join(', ')}.`
      : 'No recent activity found.';

    logger.debug('Built user productivity context', {
      targetUserId,
      context,
      detailCounts: {
        tasks: contextDetails.tasks.length,
        github_activity: contextDetails.github_activity.length,
        meetings: contextDetails.meetings.length
      }
    });

    return { context, contextDetails };
  } catch (error) {
    logger.error('Error building user productivity context', { error: error.message });
    return {
      context: {
        tasks_count: 0,
        github_activity_count: 0,
        meetings_count: 0,
        summary: 'Unable to load user context.'
      },
      contextDetails: {
        tasks: [],
        github_activity: [],
        meetings: []
      }
    };
  }
}

module.exports = registerUserChatHandlers;

