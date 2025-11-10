/**
 * Task Chat IPC Handlers
 * Handles per-task AI chat conversations
 */

const { ipcMain } = require('electron');

// Store task session IDs in memory
const taskSessionIds = {};

function registerTaskChatHandlers(services, logger) {
  const { dbAdapter, ai } = services;

  /**
   * Helper: Resolve task ID (handles both Supabase IDs and JIRA external keys)
   */
  async function resolveTaskId(taskIdOrKey, userId) {
    logger.info('🔍 Resolving task ID', { taskIdOrKey, userId });
    
    // Try direct ID lookup first
    const { data: directTask, error: directError } = await dbAdapter.supabase
      .from('conversation_sessions')
      .select('id, user_id, workflow_metadata, session_title')
      .eq('id', taskIdOrKey)
      .eq('workflow_type', 'task')
      .single();
    
    if (directTask) {
      logger.info('✅ Found task by direct ID', { taskId: directTask.id });
      return { taskId: directTask.id, task: directTask };
    }
    
    logger.info('❌ Task not found by ID, trying external_key lookup', { 
      taskIdOrKey,
      directError: directError?.message 
    });
    
    // Try lookup by external_key (for JIRA tasks like "PROJ-123")
    // Note: Use .limit(1) instead of .single() to handle potential duplicates
    const { data: externalTasks, error: externalError } = await dbAdapter.supabase
      .from('conversation_sessions')
      .select('id, user_id, workflow_metadata, session_title')
      .eq('workflow_metadata->>external_key', taskIdOrKey)
      .eq('workflow_type', 'task')
      .order('started_at', { ascending: false }) // Get most recent
      .limit(1);
    
    const externalTask = externalTasks && externalTasks.length > 0 ? externalTasks[0] : null;
    
    if (externalTask) {
      logger.info('✅ Found task by external_key', { 
        providedId: taskIdOrKey, 
        actualTaskId: externalTask.id,
        externalKey: externalTask.workflow_metadata?.external_key
      });
      return { taskId: externalTask.id, task: externalTask };
    }
    
    logger.error('❌ Task not found by ID or external_key', { 
      taskIdOrKey,
      userId,
      externalError: externalError?.message
    });
    
    // Debug: Let's see what tasks exist
    const { data: allTasks } = await dbAdapter.supabase
      .from('conversation_sessions')
      .select('id, workflow_metadata, session_title')
      .eq('workflow_type', 'task')
      .limit(5);
    
    logger.info('📋 Sample tasks in database:', { 
      count: allTasks?.length || 0,
      samples: allTasks?.map(t => ({
        id: t.id,
        title: t.session_title,
        external_key: t.workflow_metadata?.external_key,
        external_source: t.workflow_metadata?.external_source
      }))
    });
    
    return { taskId: null, task: null };
  }

  /**
   * Send message to task-specific AI chat
   */
  ipcMain.handle('tasks:sendChatMessage', async (event, taskIdOrKey, message, requestContext, messageType = 'user') => {
    try {
      // Get current authenticated user ID
      const userId = services.auth?.currentUser?.id;

      if (!userId) {
        logger.error('Task chat: No authenticated user');
        return {
          success: false,
          error: 'User not authenticated'
        };
      }

      // Resolve actual task ID (handles JIRA external keys)
      const { taskId, task: dbTask } = await resolveTaskId(taskIdOrKey, userId);

      if (!taskId) {
        logger.error('Task not found', { taskIdOrKey });
        return {
          success: false,
          error: 'Task not found'
        };
      }

      // Extract repository from request context (if provided)
      const connectedRepo = requestContext.repository;

      logger.info('Task chat message received', {
        taskId,
        providedId: taskIdOrKey,
        userId,
        messageType,
        message: message.substring(0, 50),
        repository: connectedRepo
      });

      // Use task from request context, but ensure we have the correct ID
      const task = { ...requestContext.task, id: taskId };
      
      // If this is a report message, just save it and return (no AI processing)
      if (messageType === 'report') {
        // Get or create task-specific session
        if (!taskSessionIds[taskId]) {
          logger.info('Creating new chat session for report', { taskId, userId });
          
          const sessionResult = await dbAdapter.getOrCreateActiveSession(userId, {
            workflow_type: 'task_chat',
            workflow_id: `task_${taskId}`,
            task_id: taskId,
            task_title: task.title,
            task_priority: task.priority,
            task_status: task.status,
            route_to: task.route_to || 'tasks-sales',
            work_type: task.work_type || 'task'
          });
          
          if (sessionResult.success) {
            taskSessionIds[taskId] = sessionResult.session.id;
            logger.info('Task chat session created for report', { 
              taskId, 
              sessionId: taskSessionIds[taskId]
            });
          }
        }
        
        const taskSessionId = taskSessionIds[taskId];
        
        // Save report message with metadata
        await dbAdapter.saveMessageToSession(taskSessionId, message, 'assistant', {
          task_id: taskId,
          task_title: task.title,
          message_type: 'report',
          is_report: true
        }, userId);
        
        logger.info('Report message saved to task chat', { taskId, messageLength: message.length });
        
        return {
          success: true,
          message: message,
          isReport: true
        };
      }
      
      // Get or create task-specific session
      if (!taskSessionIds[taskId]) {
        logger.info('Creating new chat session for task', { taskId, userId });
        
        const sessionResult = await dbAdapter.getOrCreateActiveSession(userId, {
          workflow_type: 'task_chat',
          workflow_id: `task_${taskId}`,
          task_id: taskId,
          task_title: task.title,
          task_priority: task.priority,
          task_status: task.status,
          route_to: task.route_to || 'tasks-sales',
          work_type: task.work_type || 'task'
        });
        
        if (sessionResult.success) {
          taskSessionIds[taskId] = sessionResult.session.id;
          logger.info('Task chat session created', { 
            taskId, 
            sessionId: taskSessionIds[taskId],
            routeTo: task.route_to,
            workType: task.work_type
          });
          
          // Set session title (don't add prefix if already exists)
          const sessionTitle = task.title.startsWith('Task:') ? task.title : `Task: ${task.title}`;
          await dbAdapter.updateSessionTitle(taskSessionIds[taskId], sessionTitle).catch(err =>
            logger.warn('Failed to update session title', { error: err.message })
          );
        }
      }
      
      const taskSessionId = taskSessionIds[taskId];
      
      // Build context for AI (combining task info with live Slack/CRM data)
      const aiContext = {
        taskContext: task
      };

      // Query code indexer if repository is connected
      let codeContext = null;
      if (connectedRepo) {
        try {
          logger.info('Querying code indexer for repository context', {
            repository: connectedRepo,
            query: message.substring(0, 100)
          });

          // Parse repository name (format: "owner/repo")
          const repoParts = connectedRepo.split('/');
          if (repoParts.length === 2) {
            const [owner, repo] = repoParts;

            // Use the Engineering Intelligence API via HTTP
            const fetch = require('node-fetch');
            const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

            const response = await fetch(`${API_BASE_URL}/api/engineering/query`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                query: message,
                repository: { owner, repo },
                context: {
                  ticket: {
                    key: task.id,
                    summary: task.title,
                    description: task.description,
                    priority: task.priority
                  }
                },
                useSemanticParsing: true
              })
            });

            if (response.ok) {
              const data = await response.json();
              codeContext = data.result;
              aiContext.codeContext = codeContext;

              logger.info('Code indexer query successful', {
                repository: connectedRepo,
                resultsCount: codeContext.sources?.length || 0
              });
            } else {
              const errorData = await response.json();
              logger.warn('Code indexer query returned error', {
                repository: connectedRepo,
                error: errorData.error,
                status: response.status
              });
              // Set error in codeContext so AI knows it was attempted
              codeContext = {
                error: errorData.error || `HTTP ${response.status}`,
                available: false
              };
              aiContext.codeContext = codeContext;
            }
          } else {
            logger.warn('Invalid repository format', { repository: connectedRepo });
            codeContext = {
              error: 'Invalid repository format (expected "owner/repo")',
              available: false
            };
            aiContext.codeContext = codeContext;
          }
        } catch (codeIndexerError) {
          logger.warn('Code indexer query failed, continuing without code context', {
            repository: connectedRepo,
            error: codeIndexerError.message
          });
          codeContext = {
            error: codeIndexerError.message,
            available: false
          };
          aiContext.codeContext = codeContext;
        }
      }

      // Try to get JIRA data for context
      if (services.jira?.isAuthenticated?.()) {
        try {
          const JIRAService = require('../../../core/integrations/jira-service');
          const jiraService = new JIRAService({ logger, supabaseAdapter: dbAdapter });
          
          // Initialize with user's tokens
          const initResult = await jiraService.initialize(userId);
          
          if (initResult.connected) {
            // Get related JIRA issues (if this task has a JIRA key)
            const taskJiraKey = dbTask?.workflow_metadata?.external_key || task.external_key;
            
            if (taskJiraKey) {
              // Get the specific JIRA issue details
              const issueResult = await jiraService.getIssueDetails(taskJiraKey);
              
              if (issueResult.success) {
                aiContext.jiraData = {
                  connected: true,
                  currentIssue: {
                    key: issueResult.issue.key,
                    summary: issueResult.issue.fields.summary,
                    description: issueResult.issue.fields.description,
                    status: issueResult.issue.fields.status.name,
                    priority: issueResult.issue.fields.priority?.name,
                    assignee: issueResult.issue.fields.assignee?.displayName,
                    reporter: issueResult.issue.fields.reporter?.displayName,
                    created: issueResult.issue.fields.created,
                    updated: issueResult.issue.fields.updated,
                    storyPoints: issueResult.issue.fields.customfield_10000,
                    labels: issueResult.issue.fields.labels,
                    comments: issueResult.issue.fields.comment?.comments?.slice(-5) || [] // Last 5 comments
                  }
                };
                
                logger.info('Added JIRA context to task chat', {
                  taskId,
                  jiraKey: taskJiraKey,
                  status: issueResult.issue.fields.status.name
                });
              }
            } else {
              // No specific JIRA key, get user's recent issues
              const issuesResult = await jiraService.getMyIssues({
                maxResults: 5,
                status: 'In Progress,To Do,Code Review,In Review'
              });
              
              if (issuesResult.success) {
                aiContext.jiraData = {
                  connected: true,
                  recentIssues: issuesResult.issues.map(issue => ({
                    key: issue.key,
                    summary: issue.summary,
                    status: issue.status,
                    priority: issue.priority
                  }))
                };
                
                logger.info('Added JIRA recent issues to task chat', {
                  taskId,
                  issueCount: issuesResult.issues.length
                });
              }
            }
          }
        } catch (jiraError) {
          logger.warn('Could not fetch JIRA data for task chat', {
            error: jiraError.message
          });
          aiContext.jiraData = {
            connected: false,
            error: jiraError.message
          };
        }
      }
      
      // Try to get Confluence data for context
      if (services.jira?.isAuthenticated?.()) {
        try {
          const ConfluenceService = require('../../../core/integrations/confluence-service');
          const confluenceService = new ConfluenceService({ logger });
          
          // Get user's JIRA tokens (Confluence uses same OAuth)
          const { data: userData } = await dbAdapter.supabase
            .from('users')
            .select('integration_settings')
            .eq('id', userId)
            .single();
          
          const jiraSettings = userData?.integration_settings?.jira;
          
          if (jiraSettings?.access_token && jiraSettings?.cloud_id) {
            confluenceService.setTokens({
              accessToken: jiraSettings.access_token,
              cloudId: jiraSettings.cloud_id,
              siteUrl: jiraSettings.site_url
            });
            
            // Search for relevant documentation
            const taskTitle = task.title || '';
            const searchResult = await confluenceService.searchPages({
              query: taskTitle.substring(0, 50), // Use task title for search
              limit: 3
            });
            
            if (searchResult.success && searchResult.pages.length > 0) {
              aiContext.confluenceData = {
                connected: true,
                relevantPages: searchResult.pages.map(page => ({
                  id: page.id,
                  title: page.title,
                  excerpt: page.excerpt || page.body?.substring(0, 200),
                  url: page._links?.webui ? `${jiraSettings.site_url}${page._links.webui}` : null,
                  lastModified: page.version?.when
                }))
              };
              
              logger.info('Added Confluence context to task chat', {
                taskId,
                pageCount: searchResult.pages.length
              });
            } else {
              aiContext.confluenceData = {
                connected: true,
                relevantPages: []
              };
            }
          }
        } catch (confluenceError) {
          logger.warn('Could not fetch Confluence data for task chat', {
            error: confluenceError.message
          });
          aiContext.confluenceData = {
            connected: false,
            error: confluenceError.message
          };
        }
      }
      
      // Build task-specific AI prompt with business context
      let systemPrompt = `You are HeyJarvis, an AI assistant helping with a specific task.

TASK DETAILS:
- Title: ${task.title}
- Description: ${task.description || 'No description provided'}
- Priority: ${task.priority}
- Status: ${task.status}
- Created: ${task.created_at}

Your role is to help the user complete this task by:
- Providing actionable advice and suggestions based on REAL business context
- Breaking down the task into manageable steps
- Answering questions about the task
- Brainstorming solutions and approaches
- Offering relevant insights from JIRA issues and Confluence documentation
- Connecting this task to current team workflows and priorities

SPECIAL INSTRUCTIONS FOR PRODUCT REQUIREMENTS:
When asked to generate product requirements:
1. Create a structured table with columns: Requirement | Priority | Source | Status
2. Mark 2-3 requirements as coming from "JIRA Comments" (these will be highlighted in red)
3. Use realistic requirements based on the task description
4. Include a mix of sources: JIRA, Confluence, and Inferred
5. Format as markdown table for clean display

Be concise, practical, and focused on helping complete this specific task.`;

      // Add repository access information if connected
      if (connectedRepo) {
        systemPrompt += `\n\n🔗 REPOSITORY ACCESS:
You have access to the ${connectedRepo} repository through the code indexer.
When users ask questions about the codebase, you can reference code snippets and files.
The code indexer has been queried for this conversation and relevant code context is provided below.`;
      }

      // Add code context to prompt if available
      if (codeContext && codeContext.answer) {
        // The code indexer provides a business-friendly answer
        systemPrompt += `\n\n💻 CODE ANALYSIS FROM REPOSITORY (${connectedRepo}):`;
        systemPrompt += `\n${codeContext.answer}`;
        
        if (codeContext.sources && codeContext.sources.length > 0) {
          systemPrompt += `\n\nRelevant files analyzed:`;
          codeContext.sources.forEach(source => {
            const filePath = source.filePath || source.file || 'unknown';
            const language = source.language || 'unknown';
            const chunkInfo = source.chunkName ? ` (${source.chunkName})` : '';
            const lineInfo = source.startLine ? ` line ${source.startLine}` : '';
            systemPrompt += `\n- ${filePath}${chunkInfo}${lineInfo} [${language}]`;
          });
        }
        
        systemPrompt += `\n\nThe code analysis above is based on semantic search of the repository. Use this information to provide context-aware answers about the codebase.`;
      } else if (connectedRepo && codeContext && codeContext.error) {
        // Code indexer query failed
        systemPrompt += `\n\n💻 REPOSITORY ACCESS NOTE:
You are connected to the ${connectedRepo} repository, but the code indexer query encountered an error: ${codeContext.error}
You can still provide general guidance about the task, but specific code references are not available for this query.`;
      } else if (connectedRepo && (!codeContext || !codeContext.sources || codeContext.sources.length === 0)) {
        // No relevant code found
        systemPrompt += `\n\n💻 REPOSITORY ACCESS NOTE:
You are connected to the ${connectedRepo} repository. The code indexer was queried but did not find code snippets directly relevant to this specific question.
You can still provide general guidance about the task and repository.`;
      }

      // Add JIRA context to prompt if available
      if (aiContext.jiraData && aiContext.jiraData.connected) {
        if (aiContext.jiraData.currentIssue) {
          const issue = aiContext.jiraData.currentIssue;
          systemPrompt += `\n\n🎫 JIRA ISSUE CONTEXT (${issue.key}):`;
          systemPrompt += `\n- Summary: ${issue.summary}`;
          systemPrompt += `\n- Status: ${issue.status}`;
          systemPrompt += `\n- Priority: ${issue.priority || 'Not set'}`;
          systemPrompt += `\n- Assignee: ${issue.assignee || 'Unassigned'}`;
          systemPrompt += `\n- Reporter: ${issue.reporter}`;
          
          if (issue.storyPoints) {
            systemPrompt += `\n- Story Points: ${issue.storyPoints}`;
          }
          
          if (issue.labels && issue.labels.length > 0) {
            systemPrompt += `\n- Labels: ${issue.labels.join(', ')}`;
          }
          
          if (issue.description) {
            const desc = issue.description.substring(0, 300);
            systemPrompt += `\n- Description: ${desc}${issue.description.length > 300 ? '...' : ''}`;
          }
          
          if (issue.comments && issue.comments.length > 0) {
            systemPrompt += `\n\n💬 Recent JIRA Comments (${issue.comments.length}):`;
            issue.comments.slice(0, 3).forEach(comment => {
              const author = comment.author?.displayName || 'Unknown';
              const body = comment.body?.substring(0, 150) || '';
              systemPrompt += `\n- [${author}] ${body}${comment.body?.length > 150 ? '...' : ''}`;
            });
          }
        } else if (aiContext.jiraData.recentIssues && aiContext.jiraData.recentIssues.length > 0) {
          systemPrompt += `\n\n🎫 YOUR RECENT JIRA ISSUES (${aiContext.jiraData.recentIssues.length}):`;
          aiContext.jiraData.recentIssues.forEach(issue => {
            systemPrompt += `\n- [${issue.key}] ${issue.summary} - ${issue.status} (${issue.priority || 'No priority'})`;
          });
        }
      }
      
      // Add Confluence context to prompt if available
      if (aiContext.confluenceData && aiContext.confluenceData.connected) {
        if (aiContext.confluenceData.relevantPages && aiContext.confluenceData.relevantPages.length > 0) {
          systemPrompt += `\n\n📚 RELEVANT CONFLUENCE DOCUMENTATION (${aiContext.confluenceData.relevantPages.length} pages):`;
          
          aiContext.confluenceData.relevantPages.forEach(page => {
            systemPrompt += `\n\n**${page.title}**`;
            if (page.excerpt) {
              systemPrompt += `\n${page.excerpt}`;
            }
            if (page.url) {
              systemPrompt += `\n🔗 ${page.url}`;
            }
            if (page.lastModified) {
              systemPrompt += `\n📅 Last updated: ${new Date(page.lastModified).toLocaleDateString()}`;
            }
          });
          
          systemPrompt += `\n\nYou can reference these Confluence pages when providing guidance.`;
        }
      }
      
      systemPrompt += `\n\nUse this JIRA and Confluence context to provide intelligent, business-aware assistance with the task.`;

      // Get AI response with full context
      const aiResponse = await ai.sendMessage(message, {
        systemPrompt,
        ...aiContext
      });
      
      // Extract content from AI response (it returns an object with 'content' field)
      const responseContent = typeof aiResponse === 'string' ? aiResponse : aiResponse.content;
      
      // Save messages to task-specific session
      if (dbAdapter && taskSessionId) {
        logger.info('Saving messages to task session', { taskSessionId });

        // Save user message
        await dbAdapter.saveMessageToSession(taskSessionId, message, 'user', {
          task_id: taskId,
          task_title: task.title
        }, userId).catch(err => logger.warn('Failed to save user message', { error: err.message }));

        // Save AI response
        await dbAdapter.saveMessageToSession(taskSessionId, responseContent, 'assistant', {
          task_id: taskId,
          task_title: task.title
        }, userId).catch(err => logger.warn('Failed to save AI message', { error: err.message }));
      }
      
      logger.info('Task chat response generated', { taskId, responseLength: responseContent?.length });
      
      return {
        success: true,
        message: responseContent
      };
    } catch (error) {
      logger.error('Task chat error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Get chat history for a task
   */
  ipcMain.handle('tasks:getChatHistory', async (event, taskIdOrKey) => {
    try {
      // Get current authenticated user ID
      const userId = services.auth?.currentUser?.id;
      
      if (!userId) {
        logger.warn('Task chat history: No authenticated user');
        return {
          success: true,
          messages: []
        };
      }
      
      // Resolve actual task ID (handles JIRA external keys)
      const { taskId, task: taskSession } = await resolveTaskId(taskIdOrKey, userId);
      
      if (!taskId || !taskSession) {
        logger.warn('Task not found', { taskIdOrKey, userId });
        return {
          success: false,
          error: 'Task not found',
          messages: []
        };
      }

      // Get current user's Slack ID for assignment checking
      const userSlackId = services.auth?.currentUser?.slack_user_id;

      // Verify user has access to task (owner, assignee, assignor, or mentioned)
      const isOwner = taskSession.user_id === userId;
      const isAssignee = userSlackId && taskSession.workflow_metadata?.assignee === userSlackId;
      const isAssignor = userSlackId && taskSession.workflow_metadata?.assignor === userSlackId;
      const isMentioned = userSlackId && taskSession.workflow_metadata?.mentioned_users?.includes(userSlackId);

      const hasAccess = isOwner || isAssignee || isAssignor || isMentioned;

      if (!hasAccess) {
        logger.warn('Task access denied: user not associated with task', {
          taskId,
          userId,
          userSlackId,
          taskUserId: taskSession.user_id,
          isOwner,
          isAssignee,
          isAssignor,
          isMentioned
        });
        return {
          success: false,
          error: 'Access denied',
          messages: []
        };
      }

      logger.info('Task verified for chat access', {
        taskId,
        userId,
        userSlackId,
        accessType: isOwner ? 'owner' : isAssignee ? 'assignee' : isAssignor ? 'assignor' : 'mentioned',
        routeTo: taskSession.workflow_metadata?.route_to,
        workType: taskSession.workflow_metadata?.work_type
      });
      
      // Now look for the CHAT session (workflow_type='task_chat')
      let taskSessionId = taskSessionIds[taskId];
      
      // If not in memory, look up in database
      if (!taskSessionId) {
        const workflowId = `task_${taskId}`;
        logger.info('Task chat session not in cache, looking up in database', { 
          taskId, 
          userId,
          workflowId,
          lookingFor: {
            user_id: userId,
            workflow_type: 'task_chat',
            workflow_id: workflowId
          }
        });
        
        // Query for task_chat session, NOT task session
        const { data: sessions, error } = await dbAdapter.supabase
          .from('conversation_sessions')
          .select('id, workflow_id, workflow_type, started_at')
          .eq('user_id', userId)
          .eq('workflow_type', 'task_chat')  // ✅ Look for chat session
          .eq('workflow_id', workflowId)
          .order('started_at', { ascending: false })
          .limit(1);
        
        if (error) {
          logger.error('Failed to look up task chat session', { error: error.message });
        } else if (sessions && sessions.length > 0) {
          taskSessionId = sessions[0].id;
          // Cache it for future use
          taskSessionIds[taskId] = taskSessionId;
          logger.info('Found task chat session in database', { 
            taskId, 
            sessionId: taskSessionId,
            workflowId: sessions[0].workflow_id,
            startedAt: sessions[0].started_at
          });
        } else {
          logger.info('No existing task chat session found', { 
            taskId,
            workflowId,
            note: 'Session will be created when first message is sent'
          });
          return {
            success: true,
            messages: []
          };
        }
      } else {
        logger.info('Task chat session found in cache', { taskId, sessionId: taskSessionId });
      }
      
      if (!taskSessionId) {
        return {
          success: true,
          messages: []
        };
      }
      
      // Get messages from the chat session
      const historyResult = await dbAdapter.getSessionMessages(taskSessionId);
      
      if (historyResult.success) {
        logger.info('Loaded chat history', { 
          taskId, 
          messageCount: historyResult.messages.length,
          sessionId: taskSessionId,
          routeTo: taskSession.workflow_metadata?.route_to
        });
        return {
          success: true,
          messages: historyResult.messages.map(msg => ({
            id: msg.id,
            role: msg.role,
            content: msg.message_text || msg.content || '',  // Support both field names
            timestamp: msg.created_at || msg.timestamp,
            isReport: msg.metadata?.is_report || msg.metadata?.message_type === 'report' || false
          }))
        };
      }
      
      return {
        success: true,
        messages: []
      };
    } catch (error) {
      logger.error('Failed to get chat history:', error);
      return {
        success: false,
        error: error.message,
        messages: []
      };
    }
  });

  /**
   * Generate product requirements silently (without saving to chat history)
   */
  ipcMain.handle('tasks:generateProductRequirements', async (event, taskId, taskData) => {
    try {
      logger.info('Generating product requirements silently', { taskId, taskTitle: taskData.title });

      // Build specialized prompt for product requirements
      const prompt = `Based on this task, generate a product requirements table.

TASK DETAILS:
- Title: ${taskData.title}
- Description: ${typeof taskData.description === 'object' ? 'See structured description' : taskData.description}
- Priority: ${taskData.priority}
- Status: ${taskData.status}

Generate a structured table with these columns:
- Requirement: Specific, actionable requirement
- Priority: High/Medium/Low
- Source: JIRA Comments/Confluence/Inferred (mark 2-3 as "JIRA Comments" to simulate team discussions)
- Status: To Do/In Progress/Done

Format as a markdown table. Make requirements realistic and relevant to the task.
Return ONLY the table, no additional text.`;

      // Get AI response without saving to chat history
      const aiResponse = await ai.sendMessage(prompt, {
        systemPrompt: `You are a product requirements analyst. Generate realistic, actionable requirements based on the task provided. Mark 2-3 requirements as coming from "JIRA Comments" to indicate they came from team discussions in JIRA.`,
        taskContext: taskData
      });

      const requirementsText = typeof aiResponse === 'string' ? aiResponse : aiResponse.content;

      logger.info('Product requirements generated successfully', {
        taskId,
        requirementsLength: requirementsText?.length
      });

      return {
        success: true,
        requirements: requirementsText
      };
    } catch (error) {
      logger.error('Failed to generate product requirements:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Update a chat message (for editing reports)
   */
  ipcMain.handle('tasks:updateChatMessage', async (event, taskIdOrKey, messageId, newContent) => {
    try {
      // Get current authenticated user ID
      const userId = services.auth?.currentUser?.id;
      
      if (!userId) {
        logger.error('Update chat message: No authenticated user');
        return {
          success: false,
          error: 'User not authenticated'
        };
      }
      
      // Resolve actual task ID
      const { taskId } = await resolveTaskId(taskIdOrKey, userId);
      
      if (!taskId) {
        logger.error('Task not found', { taskIdOrKey });
        return {
          success: false,
          error: 'Task not found'
        };
      }
      
      // Get task session ID
      let taskSessionId = taskSessionIds[taskId];
      
      if (!taskSessionId) {
        const workflowId = `task_${taskId}`;
        const { data: sessions } = await dbAdapter.supabase
          .from('conversation_sessions')
          .select('id')
          .eq('user_id', userId)
          .eq('workflow_type', 'task_chat')
          .eq('workflow_id', workflowId)
          .limit(1);
        
        if (sessions && sessions.length > 0) {
          taskSessionId = sessions[0].id;
          taskSessionIds[taskId] = taskSessionId;
        }
      }
      
      if (!taskSessionId) {
        logger.error('Task session not found', { taskId });
        return {
          success: false,
          error: 'Task session not found'
        };
      }
      
      // Update the message
      const { error } = await dbAdapter.supabase
        .from('conversation_messages')
        .update({ 
          message_text: newContent,
          updated_at: new Date().toISOString()
        })
        .eq('id', messageId)
        .eq('session_id', taskSessionId);
      
      if (error) {
        logger.error('Failed to update message', { error: error.message, messageId });
        return {
          success: false,
          error: error.message
        };
      }
      
      logger.info('Message updated successfully', { taskId, messageId, contentLength: newContent.length });
      
      return {
        success: true
      };
      
    } catch (error) {
      logger.error('Failed to update chat message:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  logger.info('Task chat handlers registered');
}

module.exports = registerTaskChatHandlers;

