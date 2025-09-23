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

    switch (method) {
      case 'GET':
        return await handleGet(req, res, supabase, userId, query);
      
      case 'POST':
        return await handlePost(req, res, supabase, userId);
      
      case 'PUT':
        return await handlePut(req, res, supabase, userId);
      
      case 'DELETE':
        return await handleDelete(req, res, supabase, userId);
      
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
  const { action, conversation_id, limit } = query;

  switch (action) {
    case 'conversations':
      // Get user's conversations
      const conversations = await supabase.getUserConversations(userId, { 
        limit: parseInt(limit) || 20 
      });
      return res.json({ conversations });

    case 'conversation':
      // Get specific conversation with messages
      if (!conversation_id) {
        return res.status(400).json({ error: 'conversation_id is required' });
      }
      
      const conversation = await supabase.getConversationWithMessages(conversation_id, userId);
      return res.json({ conversation });

    case 'messages':
      // Get messages for a conversation
      if (!conversation_id) {
        return res.status(400).json({ error: 'conversation_id is required' });
      }
      
      const conversationData = await supabase.getConversationWithMessages(conversation_id, userId);
      return res.json({ 
        messages: conversationData.messages,
        conversation: {
          id: conversationData.id,
          title: conversationData.title,
          created_at: conversationData.created_at
        }
      });

    default:
      return res.status(400).json({ error: 'Invalid action parameter' });
  }
}

/**
 * Handle POST requests - create conversations and send messages
 */
async function handlePost(req, res, supabase, userId) {
  const { action, conversation_id, message, title, model_name } = req.body;

  switch (action) {
    case 'create_conversation':
      // Create new conversation
      const conversation = await supabase.createConversation(userId, title);
      return res.json({ conversation });

    case 'send_message':
      // Send message to conversation
      if (!conversation_id || !message) {
        return res.status(400).json({ 
          error: 'conversation_id and message are required' 
        });
      }

      // Verify user owns the conversation
      const existingConv = await supabase.getConversationWithMessages(conversation_id, userId);
      if (!existingConv) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      const startTime = Date.now();
      
      // Add user message
      const userMessage = await supabase.addMessage(
        conversation_id, 
        userId, 
        'user', 
        message,
        { model_name }
      );

      // Generate AI response (placeholder - integrate with your AI service)
      const aiResponse = await generateAIResponse(message, existingConv.messages);
      const processingTime = Date.now() - startTime;

      // Add AI message
      const aiMessage = await supabase.addMessage(
        conversation_id,
        userId,
        'assistant',
        aiResponse.content,
        {
          model_name: aiResponse.model || 'claude-3-sonnet',
          tokens_used: aiResponse.tokens || 0,
          processing_time_ms: processingTime
        }
      );

      // Auto-generate title for first message
      if (existingConv.messages.length === 0 && !existingConv.title) {
        const autoTitle = generateConversationTitle(message);
        await supabase.updateConversationTitle(conversation_id, userId, autoTitle);
      }

      return res.json({
        user_message: userMessage,
        ai_message: aiMessage,
        processing_time_ms: processingTime
      });

    default:
      return res.status(400).json({ error: 'Invalid action' });
  }
}

/**
 * Handle PUT requests - update conversations
 */
async function handlePut(req, res, supabase, userId) {
  const { action, conversation_id, title } = req.body;

  switch (action) {
    case 'update_title':
      if (!conversation_id || !title) {
        return res.status(400).json({ 
          error: 'conversation_id and title are required' 
        });
      }

      const updatedConversation = await supabase.updateConversationTitle(
        conversation_id, 
        userId, 
        title
      );
      
      return res.json({ conversation: updatedConversation });

    default:
      return res.status(400).json({ error: 'Invalid action' });
  }
}

/**
 * Handle DELETE requests - archive conversations
 */
async function handleDelete(req, res, supabase, userId) {
  const { conversation_id } = req.body;

  if (!conversation_id) {
    return res.status(400).json({ error: 'conversation_id is required' });
  }

  const archivedConversation = await supabase.archiveConversation(conversation_id, userId);
  
  return res.json({ 
    success: true,
    conversation: archivedConversation 
  });
}

/**
 * Generate AI response (placeholder - integrate with your AI service)
 */
async function generateAIResponse(userMessage, conversationHistory) {
  try {
    // This is a placeholder - integrate with Claude, GPT, or your preferred AI service
    // For now, return a simple response
    
    const responses = [
      "I understand you're asking about: " + userMessage + ". Let me help you with that.",
      "That's an interesting question. Based on what you've shared, here's my analysis...",
      "I can help you with that. Let me break this down for you:",
      "Great question! Here's what I think about " + userMessage.toLowerCase() + ":",
    ];

    const randomResponse = responses[Math.floor(Math.random() * responses.length)];

    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

    return {
      content: randomResponse + "\n\n(This is a placeholder response. Integrate with your AI service for real responses.)",
      model: 'placeholder-model',
      tokens: Math.floor(Math.random() * 100) + 50
    };

    // Example integration with Claude (uncomment and configure):
    /*
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });

    const systemPrompt = `You are HeyJarvis, an AI assistant for competitive intelligence and business analysis. 
    You help users understand market trends, competitor analysis, and strategic insights.`;

    const messages = conversationHistory.map(msg => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content
    }));

    messages.push({ role: 'user', content: userMessage });

    const response = await anthropic.messages.create({
      model: 'claude-3-sonnet-20240229',
      max_tokens: 1000,
      system: systemPrompt,
      messages: messages
    });

    return {
      content: response.content[0].text,
      model: 'claude-3-sonnet',
      tokens: response.usage.input_tokens + response.usage.output_tokens
    };
    */

  } catch (error) {
    console.error('AI response generation error:', error);
    return {
      content: "I apologize, but I'm having trouble generating a response right now. Please try again.",
      model: 'error-fallback',
      tokens: 0
    };
  }
}

/**
 * Generate conversation title from first message
 */
function generateConversationTitle(message) {
  // Simple title generation - first few words or key phrases
  const words = message.trim().split(/\s+/);
  
  if (words.length <= 6) {
    return message.trim();
  }
  
  // Take first 6 words and add ellipsis
  return words.slice(0, 6).join(' ') + '...';
}
