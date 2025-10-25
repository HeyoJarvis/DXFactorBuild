/**
 * Chat IPC Handlers
 * Handles all chat-related IPC communication
 */

const { ipcMain } = require('electron');

function registerChatHandlers(services, logger) {
  /**
   * Get recent Slack messages
   */
  ipcMain.handle('slack:getRecentMessages', async (_event, limit = 20) => {
    try {
      if (!services.slack?.isInitialized) {
        return {
          success: false,
          error: 'Slack not initialized',
          messages: []
        };
      }

      const messages = await services.slack.getRecentMessages(limit);
      
      logger.info('Slack recent messages fetched', { count: messages.length });
      
      return {
        success: true,
        messages
      };
    } catch (error) {
      logger.error('Failed to get Slack messages', { error: error.message });
      return {
        success: false,
        error: error.message,
        messages: []
      };
    }
  });

  /**
   * Get Slack mentions
   */
  ipcMain.handle('slack:getUserMentions', async () => {
    try {
      if (!services.slack?.isInitialized) {
        return {
          success: false,
          error: 'Slack not initialized',
          mentions: []
        };
      }

      const mentions = await services.slack.getUserMentions();
      
      logger.info('Slack mentions fetched', { count: mentions.length });
      
      return {
        success: true,
        mentions
      };
    } catch (error) {
      logger.error('Failed to get Slack mentions', { error: error.message });
      return {
        success: false,
        error: error.message,
        mentions: []
      };
    }
  });

  /**
   * Get Slack status
   */
  ipcMain.handle('slack:getStatus', async () => {
    try {
      if (!services.slack) {
        return {
          success: false,
          connected: false,
          initialized: false
        };
      }

      const status = services.slack.getStatus();
      
      return {
        success: true,
        ...status
      };
    } catch (error) {
      logger.error('Failed to get Slack status', { error: error.message });
      return {
        success: false,
        connected: false,
        initialized: false,
        error: error.message
      };
    }
  });

  /**
   * Send a chat message
   */
  ipcMain.handle('chat:send', async (event, message) => {
    try {
      logger.info('Chat message received', { message });

      // Get context from other services (non-blocking)
      const context = {};

      // Try to get Slack data, but don't fail if unavailable
      if (services.slack?.isInitialized) {
        try {
          const recentMessages = await services.slack.getRecentMessages(5);
          const slackStatus = services.slack.getStatus();
          
          context.slackData = {
            connected: slackStatus.connected,
            recentMessages: recentMessages,
            messageCount: recentMessages.length,
            mentions: await services.slack.getUserMentions()
          };
          
          logger.info('Added Slack context', { 
            messageCount: recentMessages.length,
            connected: slackStatus.connected,
            mentions: context.slackData.mentions.length
          });
        } catch (slackError) {
          logger.warn('Could not fetch Slack data, continuing without it', { 
            error: slackError.message 
          });
          context.slackData = {
            connected: false,
            recentMessages: [],
            messageCount: 0,
            mentions: [],
            error: slackError.message
          };
        }
      }

      // Try to get CRM data, but don't fail if unavailable
      if (services.crm?.isInitialized) {
        try {
          context.crmData = await services.crm.getData();
        } catch (crmError) {
          logger.warn('Could not fetch CRM data, continuing without it', { 
            error: crmError.message 
          });
        }
      }

      // Send to AI service (this should always work)
      const response = await services.ai.sendMessage(message, context);

      return {
        success: true,
        data: response
      };
    } catch (error) {
      logger.error('Chat send error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Clear chat history
   */
  ipcMain.handle('chat:clear', async () => {
    try {
      services.ai.clearHistory();
      logger.info('Chat history cleared');

      return {
        success: true
      };
    } catch (error) {
      logger.error('Chat clear error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Get chat history
   */
  ipcMain.handle('chat:getHistory', async () => {
    try {
      const history = services.ai.getHistory();

      return {
        success: true,
        data: history
      };
    } catch (error) {
      logger.error('Chat getHistory error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Generate email draft using AI
   */
  ipcMain.handle('ai:generateEmailDraft', async (event, prompt) => {
    try {
      logger.info('Generating email draft with AI');

      // Use AI service to generate email draft
      const response = await services.ai.sendMessage(prompt, {});

      return {
        success: true,
        draft: response.content || response.text || response
      };
    } catch (error) {
      logger.error('AI generateEmailDraft error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  logger.info('Chat handlers registered');
}

module.exports = registerChatHandlers;

