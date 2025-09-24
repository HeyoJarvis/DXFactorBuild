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
 * Handle fallback mode (no database) - memory-based chat
 */
async function handleFallbackMode(req, res, method, query) {
  const userId = req.userId;
  const user = req.user;

  // In-memory conversation storage (this would reset on server restart)
  if (!global.fallbackConversations) {
    global.fallbackConversations = new Map();
  }
  
  if (!global.fallbackConversations.has(userId)) {
    global.fallbackConversations.set(userId, []);
  }

  const userConversations = global.fallbackConversations.get(userId);

  switch (method) {
    case 'GET':
      const { action, conversation_id } = query;
      
      switch (action) {
        case 'conversations':
          return res.json({
            conversations: userConversations,
            fallback: true
          });

        case 'conversation':
        case 'messages':
          const conversation = userConversations.find(c => c.id === conversation_id);
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
      const { action, conversation_id, message, title } = req.body;
      
      switch (action) {
        case 'create_conversation':
          const newConversation = {
            id: `fallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            title: title || 'New Conversation',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            messages: []
          };
          
          userConversations.unshift(newConversation);
          return res.json({ conversation: newConversation, fallback: true });

        case 'send_message':
          if (!conversation_id || !message) {
            return res.status(400).json({ error: 'conversation_id and message are required' });
          }

          const targetConversation = userConversations.find(c => c.id === conversation_id);
          if (!targetConversation) {
            return res.status(404).json({ error: 'Conversation not found' });
          }

          // Add user message
          const userMessage = {
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            conversation_id,
            role: 'user',
            content: message,
            created_at: new Date().toISOString(),
            metadata: {}
          };

          targetConversation.messages.push(userMessage);

          // Generate AI response for sales tools
          const aiResponse = await generateSalesToolsResponse(message, targetConversation.messages, user);

          // Add AI message
          const aiMessage = {
            id: `msg_${Date.now() + 1}_${Math.random().toString(36).substr(2, 9)}`,
            conversation_id,
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
 * Generate AI response for sales tools and context-aware assistance
 */
async function generateSalesToolsResponse(userMessage, conversationHistory, userContext) {
  const startTime = Date.now();
  
  try {
    // Import AI analyzer
    const AIAnalyzer = require('../../core/signals/enrichment/ai-analyzer');
    const aiAnalyzer = new AIAnalyzer();

    // Detect if this is a sales tools question or has Slack context
    const hasSlackContext = userMessage.toLowerCase().includes('slack') || 
                           userMessage.toLowerCase().includes('outbound') ||
                           userMessage.toLowerCase().includes('context');

    const systemPrompt = hasSlackContext ? 
      getSalesToolsContextPrompt(userContext) : 
      getSalesToolsGeneralPrompt();

    // Create conversation context for AI
    const messages = conversationHistory.map(msg => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content
    }));

    // Use AI analyzer for sales tools response
    const mockSignal = {
      id: 'sales_tools_chat',
      title: `Sales Tools Query: ${userMessage.substring(0, 50)}...`,
      content: userMessage,
      url: 'internal://sales-chat',
      metadata: {
        user_context: userContext,
        conversation_length: conversationHistory.length,
        has_slack_context: hasSlackContext
      }
    };

    const analysis = await aiAnalyzer.analyzeSignal(mockSignal, {
      systemPrompt,
      analysisType: 'sales_tools_assistance',
      maxTokens: 1000
    });

    return {
      content: analysis.analysis || analysis.summary || generateFallbackSalesResponse(userMessage),
      model: 'claude-3-5-sonnet-sales',
      tokens: analysis.tokens || 500,
      processing_time: Date.now() - startTime
    };

  } catch (error) {
    console.error('Sales tools AI response error:', error);
    return {
      content: generateFallbackSalesResponse(userMessage),
      model: 'fallback-sales',
      tokens: 0,
      processing_time: Date.now() - startTime
    };
  }
}

/**
 * Get system prompt for general sales tools questions
 */
function getSalesToolsGeneralPrompt() {
  return `You are HeyJarvis, an AI sales assistant specialized in sales tools, CRM systems, and sales automation.

Your expertise includes:
- CRM platforms (Salesforce, HubSpot, Pipedrive, etc.)
- Sales automation tools (Outreach, SalesLoft, Apollo, etc.)
- Lead generation tools (ZoomInfo, LinkedIn Sales Navigator, etc.)
- Email marketing platforms (Mailchimp, Constant Contact, etc.)
- Sales analytics and reporting tools
- Integration and workflow optimization
- Best practices for sales processes

You can answer questions about:
- Tool recommendations and comparisons
- Setup and configuration guidance
- Integration possibilities
- Pricing and feature analysis
- Sales process optimization
- Workflow automation

Be helpful, specific, and actionable in your responses. If you don't know something, be honest about it.`;
}

/**
 * Get system prompt for context-aware sales assistance
 */
function getSalesToolsContextPrompt(userContext) {
  return `You are HeyJarvis, an AI sales assistant with access to Slack conversation context and sales intelligence.

Your capabilities include:
- Analyzing outbound sales conversations from Slack
- Providing context-aware sales tool recommendations
- Identifying sales opportunities and next steps
- Suggesting follow-up actions based on conversation context
- Recommending tools and processes for specific situations

Context: You're assisting ${userContext.userName || 'a sales professional'} who may have Slack conversations or sales context to analyze.

When provided with conversation context:
- Analyze the sales situation
- Identify key insights and opportunities
- Suggest specific tools and actions
- Provide strategic recommendations

Be proactive and context-aware in your responses.`;
}

/**
 * Generate fallback response for sales tools questions
 */
function generateFallbackSalesResponse(message) {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('crm')) {
    return "I can help you with CRM selection! Popular options include Salesforce (enterprise), HubSpot (all-in-one), and Pipedrive (simple). What's your team size and main requirements?";
  }
  
  if (lowerMessage.includes('email') || lowerMessage.includes('outreach')) {
    return "For email outreach, I recommend tools like Outreach.io, SalesLoft, or Apollo.io. They offer automation, personalization, and tracking. What type of outreach are you planning?";
  }
  
  if (lowerMessage.includes('lead') || lowerMessage.includes('prospect')) {
    return "For lead generation, consider ZoomInfo, LinkedIn Sales Navigator, or Apollo for data. What industry and company size are you targeting?";
  }
  
  return `I'm here to help with sales tools and processes! I can assist with:

• CRM recommendations and setup
• Sales automation tools
• Lead generation platforms  
• Email marketing solutions
• Integration guidance
• Process optimization

What specific sales challenge can I help you solve?`;
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
