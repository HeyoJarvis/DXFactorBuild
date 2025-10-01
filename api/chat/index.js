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
 * Generate AI response using Joint CRM + Slack Context Pipeline
 */
async function generateAIResponse(userMessage, conversation, userContext) {
  const startTime = Date.now();
  
  try {
    // Check if this is a recommendation request that needs CRM + Slack context
    if (isRecommendationRequest(userMessage)) {
      return await generateJointContextResponse(userMessage, conversation, userContext, startTime);
    }

    // Import Enhanced Business Intelligence System for other queries
    const EnhancedBusinessIntelligenceSystem = require('../../enhanced-business-intelligence-system');
    const biSystem = new EnhancedBusinessIntelligenceSystem();

    // Process message through business intelligence system
    const biResponse = await biSystem.processMessage(userMessage, {
      userId: userContext.id,
      userName: userContext.name,
      organizationId: userContext.organization_id || 'default_org'
    });

    // Format response based on type
    let formattedResponse = '';
    
    switch (biResponse.type) {
      case 'task_assignment':
        formattedResponse = formatTaskAssignmentResponse(biResponse);
        break;
      case 'tool_comparison':
        formattedResponse = formatToolComparisonResponse(biResponse);
        break;
      case 'workflow_analysis':
        formattedResponse = formatWorkflowAnalysisResponse(biResponse);
        break;
      case 'general_business_query':
        formattedResponse = formatGeneralBusinessResponse(biResponse);
        break;
      default:
        formattedResponse = biResponse.response || 'I can help you with business intelligence, task management, and tool recommendations. What would you like to explore?';
    }

    return {
      content: formattedResponse,
      model: 'enhanced-bi-system',
      tokens: 0,
      processing_time: Date.now() - startTime,
      bi_metadata: {
        response_type: biResponse.type,
        confidence: biResponse.confidence,
        classification: biResponse.classification
      }
    };

  } catch (error) {
    console.error('Enhanced BI response generation error:', error);
    
    // Fallback to basic AI analyzer
    try {
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

    } catch (fallbackError) {
      console.error('Fallback AI response generation error:', fallbackError);
      
      return {
        content: 'I apologize, but I encountered an issue processing your request. Please try again.',
        model: 'fallback',
        tokens: 0,
        processing_time: Date.now() - startTime
      };
    }
  }
}

/**
 * Check if the user message is a recommendation request
 */
function isRecommendationRequest(message) {
  const recommendationKeywords = [
    'recommend', 'suggestion', 'tool', 'software', 'automation',
    'workflow', 'process', 'optimize', 'improve', 'efficiency',
    'productivity', 'integrate', 'connect', 'sync', 'crm', 'slack'
  ];
  
  const lowerMessage = message.toLowerCase();
  return recommendationKeywords.some(keyword => lowerMessage.includes(keyword));
}

/**
 * Generate response using Ultimate Context System
 */
async function generateJointContextResponse(userMessage, conversation, userContext, startTime) {
  try {
    console.log('Using Ultimate Context System for recommendation request');
    
    // Import the Ultimate Context System
    const { UltimateContextSystem } = require('../../integrate-existing-systems');
    const system = new UltimateContextSystem();
    
    const organizationId = userContext.organization_id || 'default_org';
    
    // Check if we already have ultimate context for this organization
    let ultimateContext;
    try {
      ultimateContext = system.getUltimateContext(organizationId);
    } catch (error) {
      // If no context exists, we need to process it first
      console.log('No ultimate context found, processing complete intelligence...');
      
      // This would need to be configured with actual CRM config
      const crmConfig = {
        type: 'hubspot',
        organization_id: organizationId,
        access_token: process.env.HUBSPOT_ACCESS_TOKEN
      };
      
      // For now, use a placeholder website URL
      const websiteUrl = 'https://example.com';
      
      const results = await system.processCompleteIntelligence(websiteUrl, crmConfig, organizationId);
      ultimateContext = results.pipeline.ultimate_context;
    }
    
    // Generate recommendations using the ultimate context
    const recommendations = await system.generateIntelligentRecommendations(
      organizationId, 
      userMessage
    );
    
    return {
      content: recommendations.recommendations.recommendations,
      model: 'ultimate-context-system',
      tokens: 0,
      processing_time: Date.now() - startTime,
      ultimate_metadata: {
        organization_id: organizationId,
        has_crm_context: ultimateContext.metadata.hasCRMContext,
        has_slack_context: ultimateContext.metadata.hasSlackContext,
        has_combined_context: ultimateContext.metadata.hasCombinedContext,
        context_length: ultimateContext.ultimateContext.length
      }
    };
    
  } catch (error) {
    console.error('Ultimate context system error:', error);
    
    // Fallback to basic recommendation response
    return {
      content: `I understand you're looking for recommendations. While I'm having trouble accessing your complete business context right now, I can still help with general business tool recommendations. Could you tell me more about what specific process or workflow you'd like to optimize?`,
      model: 'fallback-recommendation',
      tokens: 0,
      processing_time: Date.now() - startTime
    };
  }
}

/**
 * Get CRM data from the CRM integration
 */
async function getCRMData(organizationId) {
  try {
    // This would integrate with your existing CRM analyzer
    // For now, return mock data structure
    return {
      organization_id: organizationId,
      deals: [],
      contacts: [],
      companies: [],
      workflows: [],
      patterns: [],
      recommendations: []
    };
  } catch (error) {
    console.error('Failed to get CRM data:', error);
    return null;
  }
}

/**
 * Get Slack workflow data
 */
async function getSlackWorkflowData(organizationId) {
  try {
    // This would integrate with your existing Slack workflow capture
    // For now, return mock data structure
    return [
      {
        workflow_id: 'slack_workflow_1',
        organization_id: organizationId,
        type: 'communication',
        participants: [],
        duration_days: 0,
        efficiency_score: 0.8
      }
    ];
  } catch (error) {
    console.error('Failed to get Slack workflow data:', error);
    return [];
  }
}

/**
 * Format joint recommendations response
 */
function formatJointRecommendationsResponse(recommendations) {
  let response = '🎯 **AI-Driven Recommendations**\n\n';
  
  if (recommendations.recommendations && recommendations.recommendations.length > 0) {
    recommendations.recommendations.forEach((rec, index) => {
      response += `**${index + 1}. ${rec.title || 'Recommendation'}**\n`;
      response += `${rec.description || rec.justification}\n\n`;
      
      if (rec.roi_estimates) {
        response += `💰 **ROI**: ${rec.roi_estimates}\n`;
      }
      if (rec.time_savings) {
        response += `⏱️ **Time Saved**: ${rec.time_savings}\n`;
      }
      if (rec.implementation_complexity) {
        response += `🔧 **Complexity**: ${rec.implementation_complexity}\n`;
      }
      response += '\n';
    });
  }
  
  if (recommendations.follow_up_questions && recommendations.follow_up_questions.length > 0) {
    response += '**💬 Follow-up Questions You Can Ask:**\n';
    recommendations.follow_up_questions.forEach((question, index) => {
      response += `${index + 1}. ${question}\n`;
    });
  }
  
  response += '\n*Ask me about pricing, implementation details, or alternatives for any recommendation!*';
  
  return response;
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
 * Format task assignment response
 */
function formatTaskAssignmentResponse(biResponse) {
  let response = '🎯 **Task Assignment Detected**\n\n';
  
  if (biResponse.task_context) {
    const task = biResponse.task_context;
    if (task.assignee) response += `👤 **Assignee:** ${task.assignee}\n`;
    if (task.deadline) response += `📅 **Deadline:** ${task.deadline}\n`;
    if (task.priority) response += `⚡ **Priority:** ${task.priority}\n`;
  }
  
  if (biResponse.actionable_items?.length > 0) {
    response += '\n✅ **Action Items:**\n';
    biResponse.actionable_items.forEach((item, index) => {
      response += `${index + 1}. ${item}\n`;
    });
  }
  
  if (biResponse.recommendations?.tools?.length > 0) {
    response += '\n🛠️ **Recommended Tools:**\n';
    biResponse.recommendations.tools.forEach(tool => {
      response += `• ${tool}\n`;
    });
  }
  
  return response;
}

/**
 * Format tool comparison response
 */
function formatToolComparisonResponse(biResponse) {
  let response = '🔧 **Tool Analysis & Recommendations**\n\n';
  
  response += biResponse.analysis + '\n\n';
  
  if (biResponse.comparison_factors?.length > 0) {
    response += '📊 **Key Comparison Factors:**\n';
    biResponse.comparison_factors.forEach(factor => {
      response += `• ${factor}\n`;
    });
    response += '\n';
  }
  
  if (biResponse.next_steps?.length > 0) {
    response += '🚀 **Next Steps:**\n';
    biResponse.next_steps.forEach((step, index) => {
      response += `${index + 1}. ${step}\n`;
    });
  }
  
  return response;
}

/**
 * Format workflow analysis response
 */
function formatWorkflowAnalysisResponse(biResponse) {
  let response = '⚙️ **Workflow Analysis & Optimization**\n\n';
  
  response += biResponse.analysis + '\n\n';
  
  if (biResponse.optimization_areas?.length > 0) {
    response += '🎯 **Optimization Opportunities:**\n';
    biResponse.optimization_areas.forEach(area => {
      response += `• ${area}\n`;
    });
    response += '\n';
  }
  
  if (biResponse.recommended_actions?.length > 0) {
    response += '💡 **Recommended Actions:**\n';
    biResponse.recommended_actions.forEach((action, index) => {
      response += `${index + 1}. ${action}\n`;
    });
  }
  
  return response;
}

/**
 * Format general business response
 */
function formatGeneralBusinessResponse(biResponse) {
  let response = '💼 **Business Intelligence Insights**\n\n';
  
  response += biResponse.response + '\n\n';
  
  if (biResponse.related_topics?.length > 0) {
    response += '🔗 **Related Topics:**\n';
    biResponse.related_topics.forEach(topic => {
      response += `• ${topic}\n`;
    });
    response += '\n';
  }
  
  if (biResponse.data_sources?.length > 0) {
    response += '📊 **Relevant Data Sources:**\n';
    biResponse.data_sources.forEach(source => {
      response += `• ${source}\n`;
    });
  }
  
  return response;
}

/**
 * Generate conversation title from first message
 */
function generateConversationTitle(message) {
  const words = message.split(' ').slice(0, 8).join(' ');
  return words.length < message.length ? words + '...' : words;
}
