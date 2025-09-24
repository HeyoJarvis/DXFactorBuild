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
      return res.json({
        error: 'Chat functionality requires database setup',
        message: 'Please configure Supabase environment variables for full chat functionality',
        fallback: true,
        user: {
          id: req.user.id,
          name: req.user.name,
          email: req.user.email
        }
      });
    }

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

      // Generate AI response with user context for workflow analysis
      const userContext = {
        userId,
        userName: req.user?.name || req.user?.real_name,
        userRole: req.user?.is_admin ? 'admin' : 'member',
        slackUserId: req.user?.slack_user_id
      };
      
      const aiResponse = await generateAIResponse(message, existingConv.messages, userContext);
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
 * Generate AI workflow analysis response using Claude
 */
async function generateAIResponse(userMessage, conversationHistory, userContext = {}) {
  try {
    // Import AI analyzer and workflow intelligence
    const AIAnalyzer = require('../../core/signals/enrichment/ai-analyzer');
    const WorkflowIntelligence = require('../../core/intelligence/workflow-analyzer');
    
    const aiAnalyzer = new AIAnalyzer();
    const workflowIntelligence = new WorkflowIntelligence();

    // Determine if this is a workflow analysis request
    const isWorkflowRequest = await detectWorkflowAnalysisRequest(userMessage);
    
    if (isWorkflowRequest) {
      return await generateWorkflowAnalysis(userMessage, conversationHistory, aiAnalyzer, workflowIntelligence, userContext);
    } else {
      return await generateGeneralResponse(userMessage, conversationHistory, aiAnalyzer);
    }

  } catch (error) {
    console.error('AI response generation error:', error);
    return {
      content: "I apologize, but I'm having trouble generating a response right now. Please try again later.",
      model: 'error-fallback',
      tokens: 0
    };
  }
}

/**
 * Detect if user message is requesting workflow analysis
 */
async function detectWorkflowAnalysisRequest(message) {
  const workflowKeywords = [
    'workflow', 'process', 'efficiency', 'productivity', 'task', 'request',
    'outbound', 'communication', 'team', 'member', 'ceo', 'admin',
    'analyze', 'analysis', 'pattern', 'improvement', 'optimization'
  ];
  
  const lowerMessage = message.toLowerCase();
  return workflowKeywords.some(keyword => lowerMessage.includes(keyword));
}

/**
 * Generate workflow-specific AI analysis
 */
async function generateWorkflowAnalysis(userMessage, conversationHistory, aiAnalyzer, workflowIntelligence, userContext) {
  const systemPrompt = `You are HeyJarvis, an AI-powered workflow analysis assistant specializing in CEO-to-team member communication patterns and productivity optimization.

Your expertise includes:
- Analyzing outbound requests from leadership to team members
- Identifying communication patterns and bottlenecks
- Measuring response times and engagement
- Suggesting workflow improvements
- Tracking task completion and follow-ups

Context: You're analyzing workflows between Sundeep (CEO/Admin) and Avi (Team Member).

Respond with actionable insights, patterns you notice, and specific recommendations for improving communication efficiency.`;

  // Create conversation context
  const messages = conversationHistory.map(msg => ({
    role: msg.role === 'assistant' ? 'assistant' : 'user',
    content: msg.content
  }));
  
  messages.push({ role: 'user', content: userMessage });

  // Use AI analyzer for workflow-specific analysis
  const mockSignal = {
    id: 'workflow_analysis',
    title: `Workflow Analysis: ${userMessage.substring(0, 50)}...`,
    content: userMessage,
    url: 'internal://workflow-chat',
    metadata: {
      user_context: userContext,
      conversation_length: conversationHistory.length,
      analysis_type: 'workflow_communication'
    }
  };

  const analysis = await aiAnalyzer.analyzeSignal(mockSignal, {
    systemPrompt,
    analysisType: 'workflow_analysis',
    maxTokens: 1000
  });

  return {
    content: analysis.analysis || analysis.summary || "I've analyzed your workflow request and here are my insights...",
    model: 'claude-3-5-sonnet-workflow',
    tokens: analysis.tokens || 500,
    analysis_type: 'workflow'
  };
}

/**
 * Generate general AI response
 */
async function generateGeneralResponse(userMessage, conversationHistory, aiAnalyzer) {
  const systemPrompt = `You are HeyJarvis, an AI assistant for business intelligence and productivity. You help users with:
- Competitive analysis and market insights
- Workflow optimization
- Team communication improvement
- Strategic planning and decision making

Be helpful, concise, and actionable in your responses.`;

  const mockSignal = {
    id: 'general_chat',
    title: userMessage.substring(0, 50),
    content: userMessage,
    url: 'internal://general-chat'
  };

  const analysis = await aiAnalyzer.analyzeSignal(mockSignal, {
    systemPrompt,
    analysisType: 'general_assistance',
    maxTokens: 800
  });

  return {
    content: analysis.analysis || analysis.summary || "I understand your question. Let me help you with that...",
    model: 'claude-3-5-sonnet-general',
    tokens: analysis.tokens || 400,
    analysis_type: 'general'
  };
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
