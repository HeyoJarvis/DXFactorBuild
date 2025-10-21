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
   * Send message to task-specific AI chat
   */
  ipcMain.handle('tasks:sendChatMessage', async (event, taskId, message, requestContext) => {
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
      
      logger.info('Task chat message received', { taskId, userId, message: message.substring(0, 50) });
      
      const task = requestContext.task;
      
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
      
      // Try to get Slack data for context
      if (services.slack?.isInitialized) {
        try {
          const recentMessages = await services.slack.getRecentMessages(10);
          const slackStatus = services.slack.getStatus();
          
          aiContext.slackData = {
            connected: slackStatus.connected,
            recentMessages: recentMessages,
            messageCount: recentMessages.length,
            mentions: await services.slack.getUserMentions()
          };
          
          logger.info('Added Slack context to task chat', {
            taskId,
            messageCount: recentMessages.length,
            mentions: aiContext.slackData.mentions.length
          });
        } catch (slackError) {
          logger.warn('Could not fetch Slack data for task chat', {
            error: slackError.message
          });
          aiContext.slackData = {
            connected: false,
            recentMessages: [],
            messageCount: 0,
            mentions: []
          };
        }
      }
      
      // Try to get CRM data for context
      if (services.crm?.isInitialized) {
        try {
          aiContext.crmData = await services.crm.getData();
          logger.info('Added CRM context to task chat', { taskId });
        } catch (crmError) {
          logger.warn('Could not fetch CRM data for task chat', {
            error: crmError.message
          });
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
- Offering relevant insights from live Slack/CRM data
- Connecting this task to current team workflows and priorities

Be concise, practical, and focused on helping complete this specific task.`;

      // Add Slack context to prompt if available
      if (aiContext.slackData && aiContext.slackData.connected && aiContext.slackData.messageCount > 0) {
        systemPrompt += `\n\n📱 LIVE SLACK CONTEXT (${aiContext.slackData.messageCount} recent messages):`;
        
        // Add recent relevant messages
        const relevantMessages = aiContext.slackData.recentMessages.slice(0, 5);
        relevantMessages.forEach(msg => {
          systemPrompt += `\n- [${msg.type}] ${msg.text?.substring(0, 100) || 'No text'}${msg.urgent ? ' (URGENT)' : ''}`;
        });
        
        if (aiContext.slackData.mentions.length > 0) {
          systemPrompt += `\n\n⚠️ You have ${aiContext.slackData.mentions.length} mentions requiring attention.`;
        }
      }
      
      // Add CRM context to prompt if available
      if (aiContext.crmData && aiContext.crmData.success) {
        if (aiContext.crmData.insights?.length > 0) {
          systemPrompt += `\n\n💼 CRM INSIGHTS:`;
          aiContext.crmData.insights.slice(0, 3).forEach(insight => {
            systemPrompt += `\n- [${insight.type}] ${insight.title}: ${insight.message}`;
          });
        }
        
        if (aiContext.crmData.recommendations?.length > 0) {
          systemPrompt += `\n\nRECOMMENDATIONS:`;
          aiContext.crmData.recommendations.slice(0, 3).forEach(rec => {
            systemPrompt += `\n- ${rec.title} (${rec.priority})`;
          });
        }
      }
      
      systemPrompt += `\n\nUse this live context to provide intelligent, business-aware assistance with the task.`;

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
        }).catch(err => logger.warn('Failed to save user message', { error: err.message }));
        
        // Save AI response
        await dbAdapter.saveMessageToSession(taskSessionId, responseContent, 'assistant', {
          task_id: taskId,
          task_title: task.title
        }).catch(err => logger.warn('Failed to save AI message', { error: err.message }));
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
  ipcMain.handle('tasks:getChatHistory', async (event, taskId) => {
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
      
      // First, verify the TASK exists and user has access to it
      const { data: taskSession, error: taskError } = await dbAdapter.supabase
        .from('conversation_sessions')
        .select('id, user_id, workflow_metadata, session_title')
        .eq('id', taskId)
        .eq('workflow_type', 'task')  // ✅ Verify the task itself
        .single();

      if (taskError || !taskSession) {
        logger.warn('Task not found', { taskId, userId, error: taskError?.message });
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
            role: msg.role,
            content: msg.message_text || msg.content || '',  // Support both field names
            timestamp: msg.created_at || msg.timestamp
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

  logger.info('Task chat handlers registered');
}

module.exports = registerTaskChatHandlers;

