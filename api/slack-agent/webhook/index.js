/**
 * Slack Agent Webhook - Processes incoming Slack events and messages
 * 
 * This endpoint receives Slack events via webhook and processes them
 * through the conversation agent for relevance analysis and storage.
 */

const SlackConversationAgent = require('./index');
const { authenticate } = require('../middleware/auth');

// Initialize the conversation agent
const conversationAgent = new SlackConversationAgent({
  relevanceThreshold: 0.6, // Lower threshold for demo purposes
  storageMode: 'auto'
});

module.exports = async (req, res) => {
  try {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    const { method, body, query } = req;

    switch (method) {
      case 'POST':
        return await handleSlackEvent(req, res, conversationAgent);
      
      case 'GET':
        return await handleGetContexts(req, res, conversationAgent, query);
      
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }

  } catch (error) {
    console.error('Slack agent webhook error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
};

/**
 * Handle incoming Slack events
 */
async function handleSlackEvent(req, res, conversationAgent) {
  const { type, challenge, event } = req.body;

  // Handle Slack URL verification
  if (type === 'url_verification') {
    return res.json({ challenge });
  }

  // Handle Slack events
  if (type === 'event_callback' && event) {
    try {
      // Process different event types
      switch (event.type) {
        case 'message':
          // Skip message edits, deletes, and bot messages
          if (event.subtype && event.subtype !== 'bot_message') {
            return res.json({ status: 'ignored', reason: 'message_subtype' });
          }

          const result = await conversationAgent.processMessage(event);
          
          console.log('Message processed:', {
            channel: event.channel,
            user: event.user,
            action: result.action,
            relevance_score: result.relevance_score
          });

          return res.json({
            status: 'processed',
            result
          });

        case 'app_mention':
          // Handle direct mentions of the bot
          const mentionResult = await conversationAgent.processMessage({
            ...event,
            text: event.text.replace(/<@[^>]+>/g, '').trim() // Remove mention
          });

          return res.json({
            status: 'mention_processed',
            result: mentionResult
          });

        default:
          return res.json({ 
            status: 'ignored', 
            reason: 'unsupported_event_type',
            event_type: event.type 
          });
      }

    } catch (error) {
      console.error('Error processing Slack event:', error);
      return res.status(500).json({ 
        error: 'Event processing failed',
        message: error.message 
      });
    }
  }

  // Handle manual conversation processing (for testing)
  if (req.body.action === 'process_conversation') {
    const { channel_id, message_ts, thread_ts } = req.body;
    
    if (!channel_id || !message_ts) {
      return res.status(400).json({ 
        error: 'Missing required fields: channel_id, message_ts' 
      });
    }

    try {
      const mockEvent = {
        channel: channel_id,
        ts: message_ts,
        thread_ts,
        user: 'manual_trigger',
        text: 'Manual conversation processing'
      };

      const result = await conversationAgent.processMessage(mockEvent);
      
      return res.json({
        status: 'manually_processed',
        result
      });

    } catch (error) {
      return res.status(500).json({
        error: 'Manual processing failed',
        message: error.message
      });
    }
  }

  return res.json({ status: 'ignored', reason: 'unknown_payload' });
}

/**
 * Handle GET requests for contexts and agent status
 */
async function handleGetContexts(req, res, conversationAgent, query) {
  const { action, context_id } = query;

  // Apply basic authentication for GET requests
  try {
    await new Promise((resolve, reject) => {
      authenticate(req, res, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  } catch (authError) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  switch (action) {
    case 'contexts':
      // Get available conversation contexts
      const contexts = conversationAgent.getAvailableContexts();
      return res.json({
        contexts,
        count: contexts.length,
        agent_status: 'active'
      });

    case 'context':
      // Get specific context
      if (!context_id) {
        return res.status(400).json({ error: 'context_id required' });
      }

      const context = conversationAgent.getContext(context_id);
      if (!context) {
        return res.status(404).json({ error: 'Context not found' });
      }

      return res.json({ context });

    case 'status':
      // Get agent status
      const contexts_count = conversationAgent.getAvailableContexts().length;
      const conversations_count = conversationAgent.conversationStore.size;
      
      return res.json({
        status: 'active',
        contexts_available: contexts_count,
        conversations_stored: conversations_count,
        storage_mode: conversationAgent.options.storageMode,
        relevance_threshold: conversationAgent.options.relevanceThreshold,
        has_supabase: !!conversationAgent.supabase
      });

    case 'cleanup':
      // Clean up expired contexts
      conversationAgent.cleanupExpiredContexts();
      return res.json({ 
        status: 'cleaned',
        remaining_contexts: conversationAgent.getAvailableContexts().length 
      });

    default:
      return res.status(400).json({ 
        error: 'Invalid action',
        available_actions: ['contexts', 'context', 'status', 'cleanup']
      });
  }
}
