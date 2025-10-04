/**
 * Task Chat IPC Handlers
 * Handles per-task AI chat conversations
 */

const { ipcMain } = require('electron');

// Store task session IDs in memory
const taskSessionIds = {};

function registerTaskChatHandlers(services, logger) {
  const { dbAdapter, ai } = services;
  const userId = 'desktop-user'; // TODO: Get actual user ID

  /**
   * Send message to task-specific AI chat
   */
  ipcMain.handle('tasks:sendChatMessage', async (event, taskId, message, requestContext) => {
    try {
      logger.info('Task chat message received', { taskId, message: message.substring(0, 50) });
      
      const task = requestContext.task;
      
      // Get or create task-specific session
      if (!taskSessionIds[taskId]) {
        logger.info('Creating new chat session for task', { taskId });
        
        const sessionResult = await dbAdapter.getOrCreateActiveSession(userId, {
          workflow_type: 'task_chat',
          workflow_id: `task_${taskId}`,
          task_id: taskId,
          task_title: task.title,
          task_priority: task.priority,
          task_status: task.status
        });
        
        if (sessionResult.success) {
          taskSessionIds[taskId] = sessionResult.session.id;
          logger.info('Task chat session created', { taskId, sessionId: taskSessionIds[taskId] });
          
          // Set session title
          await dbAdapter.updateSessionTitle(taskSessionIds[taskId], `Task: ${task.title}`).catch(err =>
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
      const taskSessionId = taskSessionIds[taskId];
      
      if (!taskSessionId) {
        return {
          success: true,
          messages: []
        };
      }
      
      const historyResult = await dbAdapter.getSessionMessages(taskSessionId);
      
      if (historyResult.success) {
        return {
          success: true,
          messages: historyResult.messages.map(msg => ({
            role: msg.role,
            content: msg.content,
            timestamp: msg.created_at
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

