/**
 * Team Chat IPC Handlers
 * Handles team-based context-aware chat conversations
 */

const { ipcMain } = require('electron');

function registerTeamChatHandlers(services, logger) {
  const { dbAdapter, ai } = services;

  /**
   * Load user's teams
   */
  ipcMain.handle('team-chat:load-teams', async (event) => {
    try {
      logger.info('📋 Loading teams for user');

      // Get current user from auth service
      const userId = services.auth?.currentUser?.id;

      if (!userId) {
        logger.warn('Cannot load teams: No authenticated user');
        return { success: false, error: 'User not authenticated' };
      }

      // Query teams directly with a join
      const { data: teamMemberships, error } = await dbAdapter.supabase
        .from('team_members')
        .select(`
          team_id,
          teams (
            id,
            name,
            description,
            slug
          )
        `)
        .eq('user_id', userId)
        .eq('is_active', true);

      if (error) {
        logger.error('Failed to load teams', { error: error.message });
        return { success: false, error: error.message };
      }

      // Transform to simpler format
      const teams = (teamMemberships || [])
        .filter(tm => tm.teams) // Filter out any null teams
        .map(tm => ({
          id: tm.teams.id,
          name: tm.teams.name,
          description: tm.teams.description || '',
          slug: tm.teams.slug
        }));

      logger.info(`✅ Loaded ${teams.length} teams`, { teams: teams.map(t => t.name) });

      return {
        success: true,
        teams
      };
    } catch (error) {
      logger.error('Error loading teams', { error: error.message });
      return { success: false, error: error.message };
    }
  });

  /**
   * Get chat history and context for a team
   */
  ipcMain.handle('team-chat:get-history', async (event, teamId) => {
    try {
      logger.info('📜 Loading team chat history', { teamId });

      // Get current user from auth service
      const userId = services.auth?.currentUser?.id;

      if (!userId) {
        logger.warn('Cannot load chat history: No authenticated user');
        return { success: false, error: 'User not authenticated' };
      }

      // Find or create conversation session for this team
      let sessionId;
      const { data: existingSessions, error: sessionFindError } = await dbAdapter.supabase
        .from('conversation_sessions')
        .select('id')
        .eq('user_id', userId)
        .eq('workflow_type', 'team_chat')
        .eq('workflow_id', teamId)
        .limit(1);

      if (sessionFindError) {
        logger.error('Error finding session', { error: sessionFindError.message });
        throw sessionFindError;
      }

      if (existingSessions && existingSessions.length > 0) {
        sessionId = existingSessions[0].id;
        logger.info('✅ Found existing session', { sessionId });
      } else {
        // Create new session
        const { data: newSession, error: sessionCreateError } = await dbAdapter.supabase
          .from('conversation_sessions')
          .insert({
            user_id: userId,
            workflow_type: 'team_chat',
            workflow_id: teamId,
            session_title: `Team Chat`,
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

      // Build context summary with details and settings
      const { context, contextDetails, contextSettings } = await buildTeamContext(teamId, userId, dbAdapter, logger);

      logger.info(`✅ Loaded ${formattedMessages.length} messages and context`, {
        teamId,
        messagesCount: formattedMessages.length,
        contextSummary: context
      });

      return {
        success: true,
        sessionId,
        messages: formattedMessages,
        context,
        contextDetails,
        contextSettings
      };
    } catch (error) {
      logger.error('Error getting team chat history', { error: error.message });
      return { success: false, error: error.message };
    }
  });

  /**
   * Send a message in team chat
   */
  ipcMain.handle('team-chat:send-message', async (event, teamId, message) => {
    try {
      logger.info('💬 Sending team chat message', { teamId, message: message.substring(0, 50) });

      // Get current user from auth service
      const userId = services.auth?.currentUser?.id;

      if (!userId) {
        logger.warn('Cannot send message: No authenticated user');
        return { success: false, error: 'User not authenticated' };
      }

      // Find conversation session for this team
      const { data: sessions, error: sessionFindError } = await dbAdapter.supabase
        .from('conversation_sessions')
        .select('id')
        .eq('user_id', userId)
        .eq('workflow_type', 'team_chat')
        .eq('workflow_id', teamId)
        .limit(1);

      if (sessionFindError || !sessions || sessions.length === 0) {
        throw new Error('Chat session not found. Please load chat history first.');
      }

      const sessionId = sessions[0].id;

      // Save user message
      await dbAdapter.saveMessageToSession(sessionId, message, 'user', {}, userId);

      // Build context for AI
      const { context, contextDetails } = await buildTeamContext(teamId, userId, dbAdapter, logger);

      // Build system prompt with detailed context
      let systemPrompt = `You are an AI assistant helping a team member with their work. You have access to the team's context:

**Team Context:**
${context.summary || 'No context available'}`;

      // Add detailed meetings if available
      if (contextDetails.meetings && contextDetails.meetings.length > 0) {
        systemPrompt += `\n\n**Recent Meetings:**\n`;
        contextDetails.meetings.slice(0, 5).forEach(m => {
          systemPrompt += `- ${m.title} (${new Date(m.meeting_date).toLocaleDateString()})\n`;
          if (m.summary) systemPrompt += `  ${m.summary.substring(0, 100)}...\n`;
        });
      }

      // Add detailed tasks if available
      if (contextDetails.tasks && contextDetails.tasks.length > 0) {
        systemPrompt += `\n\n**Active Tasks:**\n`;
        contextDetails.tasks.slice(0, 10).forEach(t => {
          systemPrompt += `- ${t.title}`;
          if (t.external_key) systemPrompt += ` (${t.external_key})`;
          systemPrompt += `\n`;
        });
      }

      // Add code repos if available
      if (contextDetails.code_repos && contextDetails.code_repos.length > 0) {
        systemPrompt += `\n\n**Code Repositories:**\n`;
        contextDetails.code_repos.forEach(r => {
          systemPrompt += `- ${r.name}: ${r.file_count} files indexed\n`;
        });
      }

      systemPrompt += `\n\nUse this context to provide relevant, helpful responses. Reference specific meetings, tasks, or code when relevant.`;

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

      // Get AI response using the last user message
      logger.info('🤖 Requesting AI response');
      const aiResponse = await ai.sendMessage(message, { systemPrompt });

      if (!aiResponse || !aiResponse.content) {
        throw new Error('AI service returned empty response');
      }

      // Save AI response
      await dbAdapter.saveMessageToSession(sessionId, aiResponse.content, 'assistant', {}, userId);

      logger.info('✅ Team chat message processed successfully');

      return {
        success: true,
        response: aiResponse.content
      };
    } catch (error) {
      logger.error('Error sending team chat message', { error: error.message, stack: error.stack });
      return { success: false, error: error.message };
    }
  });

  /**
   * Save context settings for a team
   */
  ipcMain.handle('team-chat:save-context-settings', async (event, teamId, settings) => {
    try {
      logger.info('💾 Saving context settings', { teamId, settings });

      // Get current user from auth service
      const userId = services.auth?.currentUser?.id;

      if (!userId) {
        logger.warn('Cannot save settings: No authenticated user');
        return { success: false, error: 'User not authenticated' };
      }

      // Upsert context settings
      const { data, error } = await dbAdapter.supabase
        .from('team_chat_context_settings')
        .upsert({
          user_id: userId,
          team_id: teamId,
          include_meetings: settings.include_meetings,
          include_tasks: settings.include_tasks,
          include_code: settings.include_code,
          selected_repo_paths: settings.selected_repo_paths || [],
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,team_id'
        })
        .select()
        .single();

      if (error) {
        logger.error('Failed to save context settings', { error: error.message });
        return { success: false, error: error.message };
      }

      logger.info('✅ Context settings saved');

      return {
        success: true,
        settings: data
      };
    } catch (error) {
      logger.error('Error saving context settings', { error: error.message });
      return { success: false, error: error.message };
    }
  });

  logger.info('✅ Team Chat handlers registered');
}

/**
 * Build team context from meetings, tasks, and code
 * Returns both summary counts and detailed items
 */
async function buildTeamContext(teamId, userId, dbAdapter, logger) {
  try {
    // Load user's context settings
    const { data: settings } = await dbAdapter.supabase
      .from('team_chat_context_settings')
      .select('*')
      .eq('user_id', userId)
      .eq('team_id', teamId)
      .single();

    // Default settings if none exist
    const contextSettings = settings || {
      include_meetings: true,
      include_tasks: true,
      include_code: true
    };

    const context = {
      meetings_count: 0,
      tasks_count: 0,
      code_files_count: 0,
      summary: ''
    };

    const contextDetails = {
      meetings: [],
      tasks: [],
      code_repos: []
    };

    // Get recent team meetings if enabled
    if (contextSettings.include_meetings) {
      const { data: meetings, error: meetingsError } = await dbAdapter.supabase
        .from('team_meetings')
        .select('id, title, summary, meeting_date')
        .eq('team_id', teamId)
        .order('meeting_date', { ascending: false })
        .limit(10);

      if (!meetingsError && meetings) {
        context.meetings_count = meetings.length;
        contextDetails.meetings = meetings;
      }
    }

    // Get JIRA tickets if enabled
    if (contextSettings.include_tasks) {
      // Get team members to find their JIRA tickets
      const { data: teamMembers, error: membersError } = await dbAdapter.supabase
        .from('team_members')
        .select('user_id')
        .eq('team_id', teamId)
        .eq('is_active', true);

      if (!membersError && teamMembers && teamMembers.length > 0) {
        // Try to get JIRA issues for the current user
        // Note: JIRA integration is per-user, so we get the requesting user's JIRA tickets
        try {
          const { data: userData } = await dbAdapter.supabase
            .from('users')
            .select('integration_settings')
            .eq('id', userId)
            .single();

          if (userData?.integration_settings?.jira?.access_token) {
            // User has JIRA connected - use JIRA service
            const JIRAService = require('../services/JIRAService');
            const jiraService = new JIRAService({
              logger,
              supabaseAdapter: dbAdapter
            });

            const initResult = await jiraService.initialize(userId);
            if (initResult.connected) {
              const issuesResult = await jiraService.getMyIssues({
                maxResults: 20,
                status: 'In Progress,To Do,Code Review,In Review'
              });

              if (issuesResult.success && issuesResult.issues) {
                context.tasks_count = issuesResult.issues.length;
                contextDetails.tasks = issuesResult.issues.map(issue => ({
                  id: issue.key,
                  title: issue.summary,
                  external_key: issue.key,
                  status: issue.status
                }));
              }
            }
          }
        } catch (jiraError) {
          logger.warn('Could not load JIRA tickets', { error: jiraError.message });
        }
      }
    }

    // Get code repos if enabled
    if (contextSettings.include_code) {
      // Get unique repo names from code_embeddings
      const { data: codeFiles, error: codeError } = await dbAdapter.supabase
        .from('code_embeddings')
        .select('metadata')
        .limit(1000);

      if (!codeError && codeFiles) {
        // Group by repository path
        const repoMap = new Map();
        codeFiles.forEach(file => {
          const repoPath = file.metadata?.repository_path || file.metadata?.repository || 'Unknown';
          const repoName = file.metadata?.repository_name || repoPath.split('/').pop() || repoPath;

          if (!repoMap.has(repoPath)) {
            repoMap.set(repoPath, {
              path: repoPath,
              name: repoName,
              file_count: 0,
              selected: !contextSettings.selected_repo_paths ||
                        contextSettings.selected_repo_paths.length === 0 ||
                        contextSettings.selected_repo_paths.includes(repoPath)
            });
          }
          repoMap.get(repoPath).file_count++;
        });

        // Get all repos with their selection state
        const allRepos = Array.from(repoMap.values());
        contextDetails.code_repos = allRepos;

        // Count only selected repos
        const selectedRepos = allRepos.filter(r => r.selected);
        context.code_files_count = selectedRepos.reduce((sum, r) => sum + r.file_count, 0);
      }
    }

    // Build summary
    const summaryParts = [];
    if (context.meetings_count > 0) {
      summaryParts.push(`${context.meetings_count} recent meetings`);
    }
    if (context.tasks_count > 0) {
      summaryParts.push(`${context.tasks_count} active tasks`);
    }
    if (context.code_files_count > 0) {
      summaryParts.push(`${context.code_files_count} indexed code files`);
    }

    context.summary = summaryParts.length > 0
      ? `Team has ${summaryParts.join(', ')}.`
      : 'No recent activity found.';

    logger.debug('Built team context', { teamId, context, detailCounts: {
      meetings: contextDetails.meetings.length,
      tasks: contextDetails.tasks.length,
      repos: contextDetails.code_repos.length
    }});

    return { context, contextDetails, contextSettings };
  } catch (error) {
    logger.error('Error building team context', { error: error.message });
    return {
      context: {
        meetings_count: 0,
        tasks_count: 0,
        code_files_count: 0,
        summary: 'Unable to load team context.'
      },
      contextDetails: {
        meetings: [],
        tasks: [],
        code_repos: []
      },
      contextSettings: {
        include_meetings: true,
        include_tasks: true,
        include_code: true
      }
    };
  }
}

module.exports = registerTeamChatHandlers;
