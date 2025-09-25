/**
 * Slack Conversation Agent - Captures and stores relevant conversations
 * 
 * Features:
 * 1. Real-time conversation monitoring
 * 2. AI-powered conversation relevance detection
 * 3. Automatic conversation storage and context creation
 * 4. Integration with chat interface for context-aware responses
 */

const { WebClient } = require('@slack/web-api');
const AIAnalyzer = require('../../core/signals/enrichment/ai-analyzer');
const SupabaseClient = require('../../data/storage/supabase-client');

class SlackConversationAgent {
  constructor(options = {}) {
    this.options = {
      relevanceThreshold: 0.7,
      maxConversationLength: 20, // messages
      contextWindow: 5, // messages before/after
      storageMode: 'auto', // 'auto', 'manual', 'all'
      ...options
    };

    // Initialize clients
    this.slackClient = new WebClient(process.env.SLACK_BOT_TOKEN);
    this.aiAnalyzer = new AIAnalyzer();
    this.supabase = process.env.SUPABASE_URL ? new SupabaseClient() : null;
    
    // In-memory storage for when Supabase isn't available
    this.conversationStore = new Map();
    this.contextQueue = new Map();
    
    console.log('Slack Conversation Agent initialized', {
      hasSupabase: !!this.supabase,
      storageMode: this.options.storageMode
    });
  }

  /**
   * Process incoming Slack message and determine if conversation should be captured
   */
  async processMessage(messageEvent) {
    try {
      const { user, channel, text, ts, thread_ts } = messageEvent;
      
      // Skip bot messages
      if (messageEvent.subtype === 'bot_message' || messageEvent.bot_id) {
        return { action: 'skipped', reason: 'bot_message' };
      }

      // Get conversation context
      const conversationContext = await this.getConversationContext(channel, ts, thread_ts);
      
      // Analyze conversation relevance
      const relevanceAnalysis = await this.analyzeConversationRelevance(conversationContext);
      
      if (relevanceAnalysis.relevance_score >= this.options.relevanceThreshold) {
        // Store conversation with context
        const storedConversation = await this.storeConversation(conversationContext, relevanceAnalysis);
        
        // Create context for chat interface
        await this.createChatContext(storedConversation, relevanceAnalysis);
        
        return {
          action: 'captured',
          conversation_id: storedConversation.id,
          relevance_score: relevanceAnalysis.relevance_score,
          context_created: true
        };
      }

      return {
        action: 'ignored',
        relevance_score: relevanceAnalysis.relevance_score,
        reason: 'below_threshold'
      };

    } catch (error) {
      console.error('Error processing message:', error);
      return { action: 'error', error: error.message };
    }
  }

  /**
   * Get conversation context around a message
   */
  async getConversationContext(channel, messageTs, threadTs = null) {
    try {
      let messages = [];
      
      if (threadTs) {
        // Get thread conversation
        const threadResponse = await this.slackClient.conversations.replies({
          channel,
          ts: threadTs,
          limit: this.options.maxConversationLength
        });
        messages = threadResponse.messages || [];
      } else {
        // Get channel conversation around the message
        const historyResponse = await this.slackClient.conversations.history({
          channel,
          latest: messageTs,
          limit: this.options.contextWindow,
          inclusive: true
        });
        
        const olderMessages = historyResponse.messages || [];
        
        const futureResponse = await this.slackClient.conversations.history({
          channel,
          oldest: messageTs,
          limit: this.options.contextWindow,
          inclusive: false
        });
        
        const newerMessages = futureResponse.messages || [];
        
        messages = [...olderMessages.reverse(), ...newerMessages];
      }

      // Get channel info
      const channelInfo = await this.slackClient.conversations.info({ channel });
      
      // Get user info for participants
      const userIds = [...new Set(messages.map(m => m.user).filter(Boolean))];
      const users = await Promise.all(
        userIds.map(async (userId) => {
          try {
            const userInfo = await this.slackClient.users.info({ user: userId });
            return userInfo.user;
          } catch (error) {
            return { id: userId, name: `User ${userId}` };
          }
        })
      );

      return {
        channel_id: channel,
        channel_name: channelInfo.channel?.name || 'unknown',
        channel_type: channelInfo.channel?.is_private ? 'private' : 'public',
        messages: messages.map(msg => ({
          user: msg.user,
          text: msg.text,
          timestamp: msg.ts,
          thread_ts: msg.thread_ts
        })),
        participants: users,
        captured_at: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error getting conversation context:', error);
      throw error;
    }
  }

  /**
   * Analyze if conversation is relevant for storage using AI
   */
  async analyzeConversationRelevance(conversationContext) {
    try {
      const conversationText = conversationContext.messages
        .map(m => `${m.user}: ${m.text}`)
        .join('\n');

      const systemPrompt = `Analyze this Slack conversation for business relevance and sales context.

Determine if this conversation contains:
- Sales discussions or opportunities
- Customer interactions
- Business strategy conversations
- Project planning or execution
- Problem-solving discussions
- Decision-making processes
- Team collaboration on important topics

Rate relevance from 0.0 to 1.0 where:
- 0.0-0.3: Casual chat, irrelevant
- 0.4-0.6: Somewhat relevant, minor business context
- 0.7-0.9: Highly relevant, important business discussion
- 0.9-1.0: Critical business conversation, must capture

Also identify:
- Key topics discussed
- Action items or decisions made
- Participants' roles in the conversation
- Potential follow-up needs

Respond with JSON: {
  "relevance_score": 0.8,
  "key_topics": ["topic1", "topic2"],
  "action_items": ["item1", "item2"],
  "conversation_type": "sales_discussion",
  "summary": "Brief summary of conversation"
}`;

      const mockSignal = {
        id: 'conversation_analysis',
        title: `Conversation Analysis: ${conversationContext.channel_name}`,
        content: conversationText,
        url: 'internal://slack-conversation',
        metadata: {
          channel: conversationContext.channel_id,
          participants: conversationContext.participants.length,
          message_count: conversationContext.messages.length
        }
      };

      const analysis = await this.aiAnalyzer.analyzeSignal(mockSignal, {
        systemPrompt,
        analysisType: 'conversation_relevance',
        maxTokens: 500
      });

      // Parse AI response
      let parsedAnalysis;
      try {
        parsedAnalysis = JSON.parse(analysis.analysis || analysis.summary || '{}');
      } catch (parseError) {
        // Fallback parsing
        parsedAnalysis = {
          relevance_score: 0.5,
          key_topics: ['general discussion'],
          action_items: [],
          conversation_type: 'general',
          summary: analysis.analysis || analysis.summary || 'Analysis failed'
        };
      }

      return {
        ...parsedAnalysis,
        analysis_timestamp: new Date().toISOString(),
        ai_model: 'claude-3-5-sonnet'
      };

    } catch (error) {
      console.error('Error analyzing conversation relevance:', error);
      // Return default low relevance on error
      return {
        relevance_score: 0.3,
        key_topics: ['analysis_failed'],
        action_items: [],
        conversation_type: 'unknown',
        summary: 'Failed to analyze conversation',
        error: error.message
      };
    }
  }

  /**
   * Store conversation in database or memory
   */
  async storeConversation(conversationContext, relevanceAnalysis) {
    const conversationData = {
      id: `slack_conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      source: 'slack',
      channel_id: conversationContext.channel_id,
      channel_name: conversationContext.channel_name,
      channel_type: conversationContext.channel_type,
      messages: conversationContext.messages,
      participants: conversationContext.participants,
      relevance_score: relevanceAnalysis.relevance_score,
      key_topics: relevanceAnalysis.key_topics,
      action_items: relevanceAnalysis.action_items,
      conversation_type: relevanceAnalysis.conversation_type,
      summary: relevanceAnalysis.summary,
      captured_at: conversationContext.captured_at,
      created_at: new Date().toISOString()
    };

    try {
      if (this.supabase) {
        // Store in Supabase
        await this.supabase.storeSlackConversation(conversationData);
        console.log('Conversation stored in Supabase:', conversationData.id);
      } else {
        // Store in memory
        this.conversationStore.set(conversationData.id, conversationData);
        console.log('Conversation stored in memory:', conversationData.id);
      }

      return conversationData;
    } catch (error) {
      console.error('Error storing conversation:', error);
      // Fallback to memory storage
      this.conversationStore.set(conversationData.id, conversationData);
      return conversationData;
    }
  }

  /**
   * Create chat context that can be used by the AI chat interface
   */
  async createChatContext(conversationData, relevanceAnalysis) {
    const chatContext = {
      id: `context_${conversationData.id}`,
      conversation_id: conversationData.id,
      title: `Slack: ${conversationData.summary.substring(0, 50)}...`,
      context_type: 'slack_conversation',
      source_data: {
        channel: conversationData.channel_name,
        participants: conversationData.participants.map(p => p.name || p.id),
        message_count: conversationData.messages.length,
        key_topics: relevanceAnalysis.key_topics,
        action_items: relevanceAnalysis.action_items
      },
      context_prompt: this.generateContextPrompt(conversationData, relevanceAnalysis),
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
    };

    // Store context for chat interface
    this.contextQueue.set(chatContext.id, chatContext);
    
    console.log('Chat context created:', chatContext.id);
    return chatContext;
  }

  /**
   * Generate context prompt for AI chat interface
   */
  generateContextPrompt(conversationData, relevanceAnalysis) {
    const participantNames = conversationData.participants.map(p => p.name || p.id).join(', ');
    const conversationText = conversationData.messages
      .map(m => `${m.user}: ${m.text}`)
      .join('\n');

    return `SLACK CONVERSATION CONTEXT:

Channel: #${conversationData.channel_name} (${conversationData.channel_type})
Participants: ${participantNames}
Topics: ${relevanceAnalysis.key_topics.join(', ')}
Type: ${relevanceAnalysis.conversation_type}

CONVERSATION SUMMARY:
${relevanceAnalysis.summary}

ACTION ITEMS:
${relevanceAnalysis.action_items.map(item => `• ${item}`).join('\n')}

FULL CONVERSATION:
${conversationText}

---

Based on this Slack conversation, provide context-aware assistance and recommendations. Focus on the key topics, action items, and business implications discussed.`;
  }

  /**
   * Get available contexts for chat interface
   */
  getAvailableContexts() {
    return Array.from(this.contextQueue.values())
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 10); // Return latest 10 contexts
  }

  /**
   * Get specific context by ID
   */
  getContext(contextId) {
    return this.contextQueue.get(contextId);
  }

  /**
   * Clean up expired contexts
   */
  cleanupExpiredContexts() {
    const now = new Date();
    for (const [contextId, context] of this.contextQueue.entries()) {
      if (new Date(context.expires_at) < now) {
        this.contextQueue.delete(contextId);
      }
    }
  }
}

module.exports = SlackConversationAgent;
