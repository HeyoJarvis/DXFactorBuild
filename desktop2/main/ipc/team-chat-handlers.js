/**
 * Team Chat IPC Handlers
 * Handles team-based context-aware chat conversations
 */

const { ipcMain } = require('electron');

function registerTeamChatHandlers(services, logger) {
  const { dbAdapter, ai } = services;

  /**
   * Get upcoming meetings for a team
   */
  async function getUpcomingMeetings(teamId) {
    try {
      logger.info('📅 Getting upcoming meetings for team', { teamId });

      const now = new Date().toISOString();

      const { data: meetings, error } = await dbAdapter.supabase
        .from('team_meetings')
        .select('id, title, start_time, end_time, attendees, metadata, is_important')
        .eq('team_id', teamId)
        .gte('start_time', now) // Only future meetings
        .order('start_time', { ascending: true })
        .limit(20);

      if (error) {
        logger.error('❌ Error fetching upcoming meetings', { error: error.message, teamId });
        return { success: false, error: error.message };
      }

      logger.info(`✅ Found ${meetings?.length || 0} upcoming meetings for team`, { teamId, count: meetings?.length });

      return {
        success: true,
        meetings: meetings || []
      };
    } catch (error) {
      logger.error('❌ Error in getUpcomingMeetings', { error: error.message, teamId });
      return { success: false, error: error.message };
    }
  }

  /**
   * Load user's teams
   * ALL users can see ALL teams (cross-team collaboration enabled)
   */
  ipcMain.handle('team-chat:load-teams', async (event) => {
    try {
      logger.info('📋 Loading ALL teams for cross-team collaboration');

      // Get current user from auth service
      const userId = services.auth?.currentUser?.id;

      if (!userId) {
        logger.warn('Cannot load teams: No authenticated user');
        return { success: false, error: 'User not authenticated' };
      }

      // Fetch ALL teams (cross-team access enabled)
      const { data: allTeams, error } = await dbAdapter.supabase
        .from('teams')
        .select('id, name, description, slug')
        .order('name');

      if (error) {
        logger.error('Failed to load teams', { error: error.message });
        return { success: false, error: error.message };
      }

      const teams = allTeams || [];

      logger.info(`✅ Loaded ${teams.length} teams (all visible to all users)`, { 
        teams: teams.map(t => t.name)
      });

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
   * Add repository to team
   */
  ipcMain.handle('team-chat:add-repository-to-team', async (_event, teamId, owner, name, branch, url) => {
    try {
      logger.info('Adding repository to team', { teamId, owner, name, branch });

      const userId = services.auth?.currentUser?.id;
      if (!userId) {
        return { success: false, error: 'User not authenticated' };
      }

      const { data, error } = await dbAdapter.supabase
        .from('team_repositories')
        .insert({
          team_id: teamId,
          repository_owner: owner,
          repository_name: name,
          repository_branch: branch || 'main',
          repository_url: url,
          created_by: userId,
          indexed_at: new Date().toISOString(),
          is_active: true
        })
        .select()
        .single();

      if (error) {
        // Check if it's a duplicate error (repository already exists)
        if (error.code === '23505') {
          // Update existing record to be active
          const { data: updated, error: updateError } = await dbAdapter.supabase
            .from('team_repositories')
            .update({
              is_active: true,
              indexed_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('team_id', teamId)
            .eq('repository_owner', owner)
            .eq('repository_name', name)
            .eq('repository_branch', branch || 'main')
            .select()
            .single();

          if (updateError) {
            throw updateError;
          }

          logger.info('Repository already existed, reactivated', { teamId, owner, name });
          return { success: true, data: updated };
        }
        throw error;
      }

      logger.info('✅ Repository added to team successfully', { id: data.id });
      return { success: true, data };

    } catch (error) {
      logger.error('Failed to add repository to team', { error: error.message });
      return { success: false, error: error.message };
    }
  });

  /**
   * Load team context (meetings, tasks, code repos) without chat history
   */
  ipcMain.handle('team-chat:load-team-context', async (_event, teamId) => {
    try {
      logger.info('📋 Loading team context', { teamId });

      // Get current user from auth service
      const userId = services.auth?.currentUser?.id;

      if (!userId) {
        logger.warn('Cannot load team context: No authenticated user');
        return { success: false, error: 'User not authenticated' };
      }

      // Build context summary with details and settings
      const { context, contextDetails, contextSettings } = await buildTeamContext(teamId, userId, dbAdapter, logger);

      logger.info(`✅ Loaded team context`, {
        teamId,
        meetings: contextDetails.meetings.length,
        tasks: contextDetails.tasks.length,
        repos: contextDetails.code_repos.length
      });

      return {
        success: true,
        context: contextDetails, // Send full details
        summary: context.summary,
        settings: contextSettings
      };
    } catch (error) {
      logger.error('Error loading team context', { error: error.message });
      return { success: false, error: error.message };
    }
  });

  /**
   * Get upcoming meetings for a team
   */
  ipcMain.handle('team-chat:get-upcoming-meetings', async (event, teamId) => {
    return await getUpcomingMeetings(teamId);
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

      // Perform semantic code search if repos are indexed
      let codeSearchResults = null;
      let searchedRepoOwner = null;
      let searchedRepoName = null;
      
      if (contextDetails.code_repos && contextDetails.code_repos.length > 0) {
        try {
          logger.info('🔍 Performing semantic code search for team chat');
          const fetch = require('node-fetch');
          const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

          // Try to search BeachBaby repo first, or use first available repo
          const primaryRepo = contextDetails.code_repos.find(r => r.name.includes('BeachBaby')) || contextDetails.code_repos[0];
          const owner = primaryRepo.owner;
          const repo = primaryRepo.name;
          searchedRepoOwner = owner;
          searchedRepoName = repo;

          logger.info('🔎 Querying code for repository', { owner, repo, query: message.substring(0, 50) });

          const response = await fetch(`${API_BASE_URL}/api/engineering/query`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              query: message,
              repository: { owner, repo }
            })
          });

          if (response.ok) {
            const data = await response.json();
            codeSearchResults = data.result; // API returns { result: { sources, answer, confidence } }
            logger.info('✅ Code search results obtained', {
              sourcesFound: codeSearchResults?.sources?.length || 0,
              hasAnswer: !!codeSearchResults?.answer,
              confidence: codeSearchResults?.confidence || 'unknown',
              answerPreview: codeSearchResults?.answer?.substring(0, 100)
            });
          } else {
            const errorData = await response.json().catch(() => ({}));
            logger.warn('Code search API returned error', { 
              status: response.status,
              error: errorData.error || 'Unknown error'
            });
          }
        } catch (error) {
          logger.warn('Code search failed', { error: error.message });
        }
      }

      // Build system prompt with detailed context (similar to task-chat-handlers.js)
      let systemPrompt = `You are HeyJarvis, an AI assistant for team collaboration and project management.

TEAM CONTEXT - CURRENT ACTIVE WORK:
`;

      // Add detailed tasks if available - MAKE THIS PROMINENT
      if (contextDetails.tasks && contextDetails.tasks.length > 0) {
        systemPrompt += `The team currently has ${contextDetails.tasks.length} active tasks:\n\n`;
        contextDetails.tasks.slice(0, 10).forEach((t, idx) => {
          systemPrompt += `${idx + 1}. "${t.title}" [${t.external_key || 'N/A'}]\n`;
          if (t.assignee) systemPrompt += `   - Assigned to: ${t.assignee}\n`;
          if (t.description) systemPrompt += `   - Description: ${t.description.substring(0, 150)}...\n`;
          if (t.source) systemPrompt += `   - Source: ${t.source.toUpperCase()}\n`;
          systemPrompt += `\n`;
        });
      } else {
        systemPrompt += `No active tasks assigned to this team yet.\n\n`;
      }

      // Add detailed meetings if available
      if (contextDetails.meetings && contextDetails.meetings.length > 0) {
        systemPrompt += `\n📅 RECENT TEAM MEETINGS (${contextDetails.meetings.length}):\n\n`;
        contextDetails.meetings.slice(0, 3).forEach((m, idx) => {
          systemPrompt += `${idx + 1}. **${m.title}** (${new Date(m.meeting_date).toLocaleDateString()})\n`;
          if (m.summary) {
            systemPrompt += `\n${m.summary}\n\n`;
            systemPrompt += `---\n\n`;
          }
        });
      }

      // Add code repos if available
      if (contextDetails.code_repos && contextDetails.code_repos.length > 0) {
        systemPrompt += `\nCODE REPOSITORIES:\n`;
        contextDetails.code_repos.forEach(r => {
          systemPrompt += `- ${r.name}: ${r.file_count} files indexed\n`;
        });
        systemPrompt += `\n`;
      }

      // Add code search results to system prompt if available
      if (codeSearchResults && codeSearchResults.sources && codeSearchResults.sources.length > 0) {
        const repoPath = searchedRepoOwner && searchedRepoName ? `${searchedRepoOwner}/${searchedRepoName}` : 'repository';
        systemPrompt += `\n💻 RELEVANT CODE CONTEXT (from semantic search of ${repoPath}):\n\n`;
        
        // Add AI analysis first if available
        if (codeSearchResults.answer) {
          systemPrompt += `Code Analysis:\n${codeSearchResults.answer}\n\n`;
        }
        
        systemPrompt += `Relevant Code Files (${codeSearchResults.sources.length} found):\n\n`;
        
        codeSearchResults.sources.forEach((source, idx) => {
          systemPrompt += `${idx + 1}. ${source.file_path || source.file}`;
          if (source.start_line) {
            systemPrompt += ` (lines ${source.start_line}-${source.end_line || source.start_line})`;
          }
          systemPrompt += `\n`;
          
          if (source.code || source.snippet) {
            systemPrompt += `\`\`\`${source.language || ''}\n${source.code || source.snippet}\n\`\`\`\n`;
          }
          
          if (source.explanation || source.summary) {
            systemPrompt += `Context: ${source.explanation || source.summary}\n`;
          }
          systemPrompt += `\n`;
        });

        systemPrompt += `Use the above code analysis and file references to provide accurate, code-aware answers.\n\n`;
      } else if (contextDetails.code_repos && contextDetails.code_repos.length > 0) {
        systemPrompt += `\n💻 CODE NOTE: The team has indexed repositories, but no code was found directly relevant to this specific question.\n\n`;
      }

      systemPrompt += `\nWhen the user asks about team progress, recent work, or project updates, reference the specific tasks listed above by name and ticket number. Provide actionable insights based on the task list.

Be concise, practical, and focused on helping the team track their work.`;

      // Log the context being sent to AI
      logger.info(`🤖 Sending context to AI for team ${teamId}:`, {
        tasksCount: contextDetails.tasks?.length || 0,
        meetingsCount: contextDetails.meetings?.length || 0,
        reposCount: contextDetails.code_repos?.length || 0,
        systemPromptLength: systemPrompt.length
      });
      logger.info('📝 Full system prompt:', { systemPrompt });

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

    // Get PAST team meetings with transcripts/context (for historical reference)
    // Upcoming meetings are shown in the calendar on the right side
    if (contextSettings.include_meetings) {
      const now = new Date().toISOString();
      
      const { data: meetings, error: meetingsError} = await dbAdapter.supabase
        .from('team_meetings')
        .select('id, title, ai_summary, start_time')
        .eq('team_id', teamId)
        .lt('start_time', now) // Only past meetings with context
        .not('ai_summary', 'is', null) // Only meetings with transcripts/summaries
        .order('start_time', { ascending: false })
        .limit(10);

      if (!meetingsError && meetings) {
        context.meetings_count = meetings.length;
        // Map ai_summary to summary for compatibility
        contextDetails.meetings = meetings.map(m => ({
          id: m.id,
          title: m.title,
          summary: m.ai_summary,
          meeting_date: m.start_time
        }));
        
        logger.info(`✅ Loaded ${meetings.length} past meetings with context for team`, { teamId });
      }
    }

    // Get JIRA and Slack tasks if enabled
    if (contextSettings.include_tasks) {
      // Get team members to find their tasks
      const { data: teamMembers, error: membersError } = await dbAdapter.supabase
        .from('team_members')
        .select('user_id')
        .eq('team_id', teamId)
        .eq('is_active', true);

      logger.info(`🔍 Team member lookup for teamId: ${teamId}`, {
        found: teamMembers?.length || 0,
        memberIds: teamMembers?.map(m => m.user_id) || [],
        teamIdUsedInQuery: teamId
      });

      // DIAGNOSTIC: Log if we have no members or all members
      if (!teamMembers || teamMembers.length === 0) {
        logger.warn(`⚠️ NO team members found for team ${teamId}. This means NO tasks will be shown.`);
      } else {
        logger.info(`✅ Found ${teamMembers.length} team member(s) for team ${teamId}`);
      }

      if (!membersError && teamMembers && teamMembers.length > 0) {
        const allTasks = [];
        const teamMemberIds = teamMembers.map(m => m.user_id);

        logger.info(`📊 Fetching tasks for ${teamMemberIds.length} team members of team ${teamId}`);

        // Try to get JIRA issues for ALL team members
        // Note: JIRA integration is per-user, so we check each team member
        try {
          const { data: usersData } = await dbAdapter.supabase
            .from('users')
            .select('id, email, integration_settings')
            .in('id', teamMemberIds);

          if (usersData && usersData.length > 0) {
            const JIRAService = require('../services/JIRAService');
            
            // Fetch JIRA tasks for each team member who has JIRA connected
            for (const teamUser of usersData) {
              if (teamUser?.integration_settings?.jira?.access_token) {
                try {
                  const jiraService = new JIRAService({
                    logger,
                    supabaseAdapter: dbAdapter
                  });

                  const initResult = await jiraService.initialize(teamUser.id);
                  if (initResult.connected) {
                    const issuesResult = await jiraService.getMyIssues({
                      maxResults: 50,
                      status: 'In Progress,To Do,Code Review,In Review'
                    });

                    if (issuesResult.success && issuesResult.issues) {
                      // Add JIRA tasks to allTasks (avoid duplicates by key)
                      issuesResult.issues.forEach(issue => {
                        if (!allTasks.find(t => t.external_key === issue.key)) {
                          allTasks.push({
                            id: issue.key,
                            title: issue.summary,
                            external_key: issue.key,
                            status: issue.status,
                            source: 'jira',
                            assignee: issue.assignee?.displayName || teamUser.email || 'Unassigned'
                          });
                        }
                      });
                      logger.info(`✅ Loaded ${issuesResult.issues.length} JIRA tasks for ${teamUser.email}`);
                    }
                  }
                } catch (userJiraError) {
                  logger.warn(`Could not load JIRA for user ${teamUser.email}`, { error: userJiraError.message });
                }
              }
            }
          }
        } catch (jiraError) {
          logger.warn('Could not load JIRA tickets', { error: jiraError.message });
        }

        // Get ALL tasks from database (assigned to team members) - any source
        try {
          const { data: dbTasks, error: dbTasksError } = await dbAdapter.supabase
            .from('tasks')
            .select('id, title, status, external_id, external_source, external_url, assigned_to, metadata')
            .in('status', ['pending', 'in_progress'])
            .in('assigned_to', teamMemberIds)  // Get tasks assigned to team members
            .order('created_at', { ascending: false })
            .limit(100);

          if (!dbTasksError && dbTasks && dbTasks.length > 0) {
            // Get assignee names
            const { data: assigneeUsers } = await dbAdapter.supabase
              .from('users')
              .select('id, name, email')
              .in('id', teamMemberIds);
            
            const userMap = {};
            assigneeUsers?.forEach(u => {
              userMap[u.id] = u.name || u.email;
            });

            // Add database tasks to allTasks (avoid duplicates from live JIRA)
            dbTasks.forEach(task => {
              const existingKey = task.metadata?.jira_key || task.external_id || task.id;
              if (!allTasks.find(t => t.external_key === existingKey)) {
                allTasks.push({
                  id: task.id,
                  title: task.title,
                  external_key: existingKey,
                  status: task.status,
                  source: task.external_source || 'unknown',
                  assignee: task.metadata?.assigned_engineer || userMap[task.assigned_to] || 'Unassigned',
                  description: task.metadata?.jira_type || task.metadata?.priority || ''
                });
              }
            });
            
            // Log by source
            const bySource = {};
            dbTasks.forEach(t => {
              const src = t.external_source || 'unknown';
              bySource[src] = (bySource[src] || 0) + 1;
            });
            
            logger.info(`✅ Loaded ${dbTasks.length} tasks from database for team`, {
              sources: bySource
            });
          }
        } catch (dbTasksError) {
          logger.warn('Could not load tasks from database', { error: dbTasksError.message });
        }

        // Get Slack tasks from the database for ALL team members
        try {
          const { data: slackTasks, error: slackError } = await dbAdapter.supabase
            .from('tasks')
            .select('id, title, status, external_id, external_source, assigned_to, created_by')
            .eq('external_source', 'slack')
            .in('status', ['pending', 'in_progress'])
            .in('created_by', teamMemberIds)  // Get tasks created by ANY team member
            .order('created_at', { ascending: false })
            .limit(50);

          if (!slackError && slackTasks && slackTasks.length > 0) {
            // Add Slack tasks to allTasks
            allTasks.push(...slackTasks.map(task => ({
              id: task.id,
              title: task.title,
              external_key: task.external_id || task.id,
              status: task.status,
              source: 'slack',
              assignee: task.assigned_to || 'Unassigned'
            })));
            logger.info(`✅ Loaded ${slackTasks.length} Slack tasks for team`);
          }
        } catch (slackError) {
          logger.warn('Could not load Slack tasks', { error: slackError.message });
        }

        // Update context with combined tasks
        context.tasks_count = allTasks.length;
        contextDetails.tasks = allTasks;
        logger.info(`📋 Total team tasks loaded for team ${teamId}: ${allTasks.length}`, {
          jiraTasks: allTasks.filter(t => t.source === 'jira').length,
          slackTasks: allTasks.filter(t => t.source === 'slack').length,
          taskTitles: allTasks.map(t => `${t.source}: ${t.title}`).slice(0, 5)
        });
      } else {
        logger.info(`⚠️ No team members found for team ${teamId}, showing 0 tasks`);
        contextDetails.tasks = [];
        context.tasks_count = 0;
      }
    }

    // Get code repos from GitHub if enabled
    if (contextSettings.include_code) {
<<<<<<< HEAD
      // First, get team-specific repositories from team_repositories table
      const { data: teamRepos, error: teamReposError } = await dbAdapter.supabase
        .from('team_repositories')
        .select('repository_owner, repository_name, repository_branch, indexed_at')
        .eq('team_id', teamId)
        .eq('is_active', true);
=======
      // Get unique repos from code_chunks (GitHub indexed repos)
      const { data: codeFiles, error: codeError } = await dbAdapter.supabase
        .from('code_chunks')
        .select('repository_owner, repository_name, repository_branch')
        .limit(1000);
>>>>>>> origin/Combinations/all

      if (!teamReposError && teamRepos && teamRepos.length > 0) {
        logger.info('Loading team-specific repositories', { count: teamRepos.length });

        // For each team repo, get file counts from code_embeddings
        const repoMap = new Map();

        for (const teamRepo of teamRepos) {
          const repoPath = `${teamRepo.repository_owner}/${teamRepo.repository_name}`;

          // Count files for this specific repository
          const { count, error: countError } = await dbAdapter.supabase
            .from('code_embeddings')
            .select('*', { count: 'exact', head: true })
            .eq('repository_owner', teamRepo.repository_owner)
            .eq('repository_name', teamRepo.repository_name)
            .eq('repository_branch', teamRepo.repository_branch);

          if (!countError) {
            repoMap.set(repoPath, {
              path: repoPath,
              name: teamRepo.repository_name,
              owner: teamRepo.repository_owner,
              branch: teamRepo.repository_branch,
              file_count: count || 0,
              indexed_at: teamRepo.indexed_at,
              source: 'github',
              selected: true // Team repos are always selected by default
            });
          }
        }

        contextDetails.code_repos = Array.from(repoMap.values());
        context.code_files_count = contextDetails.code_repos.reduce((sum, r) => sum + r.file_count, 0);
        logger.info('Loaded team repositories', {
          repos: contextDetails.code_repos.length,
          total_files: context.code_files_count
        });
      } else {
        // Fallback: If no team-specific repos, show all indexed repos (old behavior)
        logger.info('No team-specific repos, loading all indexed repositories');

        const { data: codeFiles, error: codeError } = await dbAdapter.supabase
          .from('code_embeddings')
          .select('repository_owner, repository_name, repository_branch')
          .limit(1000);

        if (!codeError && codeFiles) {
          const repoMap = new Map();
          codeFiles.forEach(file => {
            const repoOwner = file.repository_owner || 'Unknown';
            const repoName = file.repository_name || 'Unknown';
            const repoBranch = file.repository_branch || 'main';
            const repoPath = `${repoOwner}/${repoName}`;

            if (!repoMap.has(repoPath)) {
              repoMap.set(repoPath, {
                path: repoPath,
                name: repoName,
                owner: repoOwner,
                branch: repoBranch,
                file_count: 0,
                source: 'github',
                selected: !contextSettings.selected_repo_paths ||
                          contextSettings.selected_repo_paths.length === 0 ||
                          contextSettings.selected_repo_paths.includes(repoPath)
              });
            }
            repoMap.get(repoPath).file_count++;
          });

          contextDetails.code_repos = Array.from(repoMap.values());
          const selectedRepos = contextDetails.code_repos.filter(r => r.selected);
          context.code_files_count = selectedRepos.reduce((sum, r) => sum + r.file_count, 0);
        }
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
