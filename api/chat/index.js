/**
 * Chat API Endpoints for HeyJarvis
 * 
 * Handles:
 * 1. Conversation management
 * 2. Message sending/receiving
 * 3. Chat history
 * 4. Real-time updates
 */

const SupabaseClient = require('../../data/storage/supabase-client');
const { authenticate, rateLimit } = require('../middleware/auth');

module.exports = async (req, res) => {
  try {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    // Initialize Supabase client
    const supabase = new SupabaseClient();

    // Apply authentication middleware
    await new Promise((resolve, reject) => {
      authenticate(req, res, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    // Apply rate limiting
    await new Promise((resolve, reject) => {
      rateLimit({ max: 50, windowMs: 15 * 60 * 1000 })(req, res, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    const { method, query } = req;
    const userId = req.userId;

    // Check if we're in fallback mode (no database)
    if (req.user?.fallback) {
      return await handleFallbackMode(req, res, method, query);
    }

    switch (method) {
      case 'GET':
        return await handleGet(req, res, supabase, userId, query);

      case 'POST':
        return await handlePost(req, res, supabase, userId);

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }

  } catch (error) {
    console.error('Chat API error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
};

/**
 * Handle GET requests - fetch conversations and messages
 */
async function handleGet(req, res, supabase, userId, query) {
  const { action, conversation_id: getConversationId, limit = 20 } = query;

  try {
    switch (action) {
      case 'conversations':
        const conversations = await supabase.getUserConversations(userId, limit);
        return res.json({
          conversations: conversations || [],
          user_id: userId
        });

      case 'conversation':
      case 'messages':
        if (!getConversationId) {
          return res.status(400).json({ error: 'conversation_id is required' });
        }

        const conversation = await supabase.getConversationWithMessages(getConversationId, userId);
        if (!conversation) {
          return res.status(404).json({ error: 'Conversation not found' });
        }

        return res.json({
          conversation,
          messages: conversation.messages || []
        });

      default:
        const user = await supabase.getUser(userId);
        return res.json({
          user: {
            id: user?.id || userId,
            name: user?.name || 'User',
            email: user?.email || 'user@example.com'
          }
        });
    }

  } catch (error) {
    console.error('GET error:', error);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
}

/**
 * Handle POST requests - create conversations and send messages
 */
async function handlePost(req, res, supabase, userId) {
  const { action, conversation_id: postConversationId, message, title } = req.body;

  try {
    switch (action) {
      case 'create_conversation':
        const newConversation = await supabase.createConversation(userId, title || 'New Conversation');
        return res.json({ conversation: newConversation });

      case 'send_message':
        if (!postConversationId || !message) {
          return res.status(400).json({ error: 'conversation_id and message are required' });
        }

        // Verify conversation exists and belongs to user
        const conversation = await supabase.getConversation(postConversationId, userId);
        if (!conversation) {
          return res.status(404).json({ error: 'Conversation not found' });
        }

        // Add user message
        const userMessage = await supabase.addMessage(postConversationId, userId, 'user', message);

        // Generate AI response
        const aiResponse = await generateAIResponse(message, conversation, req.user);

        // Add AI message
        const aiMessage = await supabase.addMessage(
          postConversationId, 
          userId, 
          'assistant', 
          aiResponse.content,
          {
            model_name: aiResponse.model,
            tokens_used: aiResponse.tokens,
            processing_time_ms: aiResponse.processing_time
          }
        );

        return res.json({
          user_message: userMessage,
          ai_message: aiMessage,
          processing_time_ms: aiResponse.processing_time
        });

      default:
        return res.status(400).json({ error: 'Invalid action' });
    }

  } catch (error) {
    console.error('POST error:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
}

/**
 * Handle fallback mode (when database is unavailable)
 */
async function handleFallbackMode(req, res, method, query) {
  const user = req.user;
  
  // In-memory storage for fallback mode
  if (!global.fallbackConversations) {
    global.fallbackConversations = new Map();
  }
  
  const userConversations = global.fallbackConversations.get(user.id) || [];

  switch (method) {
    case 'GET':
      const { action, conversation_id: getConversationId } = query;
      
      switch (action) {
        case 'conversations':
          return res.json({
            conversations: userConversations,
            fallback: true
          });

        case 'conversation':
        case 'messages':
          const conversation = userConversations.find(c => c.id === getConversationId);
          if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
          }
          return res.json({
            conversation,
            messages: conversation.messages || [],
            fallback: true
          });

        default:
          return res.json({
            user: {
              id: user.id,
              name: user.name,
              email: user.email
            },
            fallback: true
          });
      }

    case 'POST':
      const { action: postAction, conversation_id: postConversationId, message, title } = req.body;
      
      switch (postAction) {
        case 'create_conversation':
          const newConversation = {
            id: `fallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            title: title || 'New Conversation',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            messages: []
          };
          
          userConversations.unshift(newConversation);
          global.fallbackConversations.set(user.id, userConversations);
          return res.json({ conversation: newConversation, fallback: true });

        case 'send_message':
          if (!postConversationId || !message) {
            return res.status(400).json({ error: 'conversation_id and message are required' });
          }

          const targetConversation = userConversations.find(c => c.id === postConversationId);
          if (!targetConversation) {
            return res.status(404).json({ error: 'Conversation not found' });
          }

          // Add user message
          const userMessage = {
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            conversation_id: postConversationId,
            role: 'user',
            content: message,
            created_at: new Date().toISOString(),
            metadata: {}
          };

          targetConversation.messages.push(userMessage);

          // Generate AI response
          const aiResponse = await generateAIResponse(message, targetConversation, user);

          // Add AI message
          const aiMessage = {
            id: `msg_${Date.now() + 1}_${Math.random().toString(36).substr(2, 9)}`,
            conversation_id: postConversationId,
            role: 'assistant',
            content: aiResponse.content,
            created_at: new Date().toISOString(),
            metadata: {
              model_name: aiResponse.model,
              tokens_used: aiResponse.tokens,
              processing_time_ms: aiResponse.processing_time
            }
          };

          targetConversation.messages.push(aiMessage);
          targetConversation.updated_at = new Date().toISOString();

          // Auto-generate title for first message
          if (targetConversation.messages.length === 2 && targetConversation.title === 'New Conversation') {
            targetConversation.title = generateConversationTitle(message);
          }

          global.fallbackConversations.set(user.id, userConversations);

          return res.json({
            user_message: userMessage,
            ai_message: aiMessage,
            processing_time_ms: aiResponse.processing_time,
            fallback: true
          });

        default:
          return res.status(400).json({ error: 'Invalid action' });
      }

    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

/**
 * Generate AI response using Anthropic
 */
async function generateAIResponse(userMessage, conversation, userContext) {
  const startTime = Date.now();
  
  try {
    // Import AI analyzer
    const AIAnalyzer = require('../../core/signals/enrichment/ai-analyzer');
    const aiAnalyzer = new AIAnalyzer();

    const systemPrompt = getGeneralAssistantPrompt();

    // Create conversation context for AI
    const messages = (conversation.messages || []).slice(-10).map(msg => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content
    }));

    // Add current message
    messages.push({
      role: 'user',
      content: userMessage
    });

    // Use AI analyzer for response
    const mockSignal = {
      id: 'chat_' + Date.now(),
      title: `Chat: ${userMessage.substring(0, 50)}...`,
      content: userMessage,
      url: 'internal://chat',
      metadata: {
        user_context: userContext,
        conversation_history: messages.slice(0, -1)
      }
    };

    const analysis = await aiAnalyzer.analyzeSignal(mockSignal, {
      systemPrompt,
      messages,
      maxTokens: 1000,
      temperature: 0.7
    });

    return {
      content: analysis.summary || 'I apologize, but I encountered an issue generating a response. Please try again.',
      model: 'claude-3-sonnet',
      tokens: analysis.metadata?.tokens_used || 0,
      processing_time: Date.now() - startTime
    };

  } catch (error) {
    console.error('AI response generation error:', error);
    
    return {
      content: 'I apologize, but I encountered an issue processing your request. Please try again.',
      model: 'fallback',
      tokens: 0,
      processing_time: Date.now() - startTime
    };
  }
}

/**
 * Get general assistant prompt
 */
function getGeneralAssistantPrompt() {
  return `You are HeyJarvis, a helpful AI assistant focused on productivity and tooling. You help with:

- Code and development tasks
- Project management and organization  
- Workflow optimization
- Tool recommendations
- General problem-solving
- Task automation ideas
- File organization and management
- Process improvement

Be concise, practical, and actionable. Focus on helping the user be more productive. When possible, provide specific steps or code examples.`;
}

/**
 * Generate conversation title from first message
 */
function generateConversationTitle(message) {
  const words = message.split(' ').slice(0, 8).join(' ');
  return words.length < message.length ? words + '...' : words;
}
