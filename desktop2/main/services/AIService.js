/**
 * AI Service
 * Handles communication with Claude API and conversation management using Enhanced BI System
 */

const fetch = require('node-fetch');
const path = require('path');

class AIService {
  constructor({ logger }) {
    this.logger = logger;
    this.apiKey = process.env.ANTHROPIC_API_KEY;
    this.conversationHistory = [];
    this.isInitialized = false;
    this.enhancedBI = null;
  }

  /**
   * Initialize the AI service
   */
  async initialize() {
    if (!this.apiKey) {
      this.logger.warn('ANTHROPIC_API_KEY not set');
      return;
    }

    try {
      // Load Enhanced Business Intelligence System
      const EnhancedBusinessIntelligenceSystem = require(path.join(__dirname, '../../../enhanced-business-intelligence-system.js'));
      this.enhancedBI = new EnhancedBusinessIntelligenceSystem();
      
      this.isInitialized = true;
      this.logger.info('AI Service initialized with Enhanced BI System');
    } catch (error) {
      this.logger.error('Failed to load Enhanced BI System:', error);
      this.isInitialized = false;
    }
  }

  /**
   * Send a message to Claude with Enhanced BI processing
   */
  async sendMessage(message, context = {}) {
    if (!this.isInitialized) {
      throw new Error('AI Service not initialized');
    }

    try {
      // Add user message to history
      this.conversationHistory.push({
        role: 'user',
        content: message,
        timestamp: new Date().toISOString()
      });

      // Skip Enhanced BI for task-specific chats (faster response)
      // Enhanced BI is good for general queries but adds overhead for focused tasks
      let biResponse = null;
      const skipBI = context.taskContext || context.systemPrompt; // Skip if custom system prompt provided
      
      if (this.enhancedBI && !skipBI) {
        try {
          biResponse = await this.enhancedBI.processMessage(message);
          this.logger.info('Enhanced BI processing completed', {
            type: biResponse.classification?.type,
            confidence: biResponse.classification?.confidence
          });
        } catch (error) {
          this.logger.warn('Enhanced BI processing failed, falling back to direct Claude:', error.message);
        }
      } else if (skipBI) {
        this.logger.info('Skipping Enhanced BI processing for focused/custom prompt chat');
      }

      // Build comprehensive system prompt with context
      // Use custom systemPrompt if provided, otherwise build default
      const systemPrompt = context.systemPrompt || this.buildSystemPrompt(context, biResponse);

      // Call Claude API
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 4096,
          system: systemPrompt,
          messages: this.conversationHistory.slice(-10).map(msg => ({
            role: msg.role,
            content: msg.content
          }))
        })
      });

      if (!response.ok) {
        throw new Error(`Claude API error: ${response.statusText}`);
      }

      const data = await response.json();
      let assistantMessage = data.content[0].text;

      // Enhance response with contextual insights
      if (context.slackData && context.slackData.recentMessages?.length > 0) {
        assistantMessage += `\n\n📱 **Live Slack Context**: ${context.slackData.recentMessages.length} recent messages monitored. `;
        
        const mentions = context.slackData.recentMessages.filter(msg => msg.type === 'mention');
        if (mentions.length > 0) {
          assistantMessage += `${mentions.length} mentions require attention.`;
        }
      }

      if (context.crmData && context.crmData.insights?.length > 0) {
        assistantMessage += `\n\n💼 **CRM Insights**: ${context.crmData.insights.length} workflow patterns detected.`;
      }

      // Add assistant response to history
      this.conversationHistory.push({
        role: 'assistant',
        content: assistantMessage,
        timestamp: new Date().toISOString(),
        biClassification: biResponse?.classification,
        contextUsed: {
          slack: !!context.slackData,
          crm: !!context.crmData
        }
      });

      this.logger.info('AI message processed successfully', {
        historyLength: this.conversationHistory.length,
        usedSlackContext: !!context.slackData,
        usedCrmContext: !!context.crmData
      });

      return {
        content: assistantMessage,
        timestamp: new Date().toISOString(),
        classification: biResponse?.classification,
        contextUsed: {
          slack: !!context.slackData,
          crm: !!context.crmData,
          enhancedBI: !!biResponse
        }
      };
    } catch (error) {
      this.logger.error('AI Service error:', error);
      throw error;
    }
  }

  /**
   * Build comprehensive system prompt with context
   */
  buildSystemPrompt(context, biResponse) {
    let prompt = `You are HeyJarvis, an AI assistant for competitive intelligence and business monitoring.

You help users with:
- Competitive intelligence analysis
- CRM insights and recommendations  
- Slack monitoring and summaries
- Task management and prioritization
- Business intelligence queries
- Workflow optimization

CONTEXT AWARENESS: You have access to real-time data from Slack and CRM systems. Use this context to provide intelligent, actionable responses.

Be concise, helpful, and actionable. Always consider the live data context when responding.`;

    // Add Enhanced BI classification context
    if (biResponse?.classification) {
      prompt += `\n\nMESSAGE CLASSIFICATION:
- Type: ${biResponse.classification.type}
- Confidence: ${biResponse.classification.confidence}%
- Keywords: ${biResponse.classification.keywords?.join(', ') || 'none'}
- Urgency: ${biResponse.classification.urgency || 'normal'}`;
    }

    // Add conversation history context
    if (this.conversationHistory.length > 1) {
      const recentHistory = this.conversationHistory.slice(-6, -1); // Last 3 exchanges (excluding current)
      prompt += `\n\nCONVERSATION HISTORY:`;
      recentHistory.forEach((msg, i) => {
        prompt += `\n${msg.role.toUpperCase()}: ${msg.content.substring(0, 200)}${msg.content.length > 200 ? '...' : ''}`;
      });
    }

    // Add Slack context if available
    if (context.slackData) {
      prompt += `\n\nLIVE SLACK DATA:
Status: ${context.slackData.connected ? 'Connected' : 'Disconnected'}
Recent Messages: ${context.slackData.recentMessages?.length || 0}`;

      if (context.slackData.recentMessages?.length > 0) {
        prompt += `\nRecent Activity:`;
        context.slackData.recentMessages.slice(0, 5).forEach(msg => {
          prompt += `\n- [${msg.type.toUpperCase()}] ${msg.text?.substring(0, 100) || 'No text'}${msg.urgent ? ' (URGENT)' : ''}`;
        });
      }
    }

    // Add CRM context if available
    if (context.crmData) {
      prompt += `\n\nLIVE CRM DATA:
Status: ${context.crmData.success ? 'Connected' : 'Error'}`;

      if (context.crmData.insights?.length > 0) {
        prompt += `\nKey Insights:`;
        context.crmData.insights.slice(0, 3).forEach(insight => {
          prompt += `\n- [${insight.type.toUpperCase()}] ${insight.title}: ${insight.message}`;
        });
      }

      if (context.crmData.recommendations?.length > 0) {
        prompt += `\nRecommendations:`;
        context.crmData.recommendations.slice(0, 3).forEach(rec => {
          prompt += `\n- ${rec.title} (${rec.priority}): ${rec.description}`;
        });
      }
    }

    return prompt;
  }

  /**
   * Clear conversation history
   */
  clearHistory() {
    this.conversationHistory = [];
    this.logger.info('Conversation history cleared');
  }

  /**
   * Get conversation history
   */
  getHistory() {
    return this.conversationHistory;
  }

  /**
   * Cleanup
   */
  cleanup() {
    this.conversationHistory = [];
    this.logger.info('AI Service cleaned up');
  }
}

module.exports = AIService;

