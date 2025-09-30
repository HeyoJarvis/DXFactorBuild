/**
 * Anthropic Claude Integration for Competitive Intelligence Analysis
 */

const https = require('https');
const winston = require('winston');

class AnthropicAnalyzer {
  constructor(options = {}) {
    this.apiKey = process.env.ANTHROPIC_API_KEY;
    this.model = options.model || 'claude-3-haiku-20240307'; // Cost-effective model
    this.maxTokens = options.maxTokens || 1000;
    
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      defaultMeta: { service: 'anthropic-analyzer' }
    });

    if (!this.apiKey) {
      this.logger.warn('ANTHROPIC_API_KEY not found - AI analysis will be disabled');
    }
  }

  /**
   * Analyze Slack messages for competitive intelligence
   */
  async analyzeCompetitiveIntelligence(messages, context = {}) {
    if (!this.apiKey) {
      return this.getMockAnalysis(messages);
    }

    try {
      const prompt = this.buildCompetitiveIntelligencePrompt(messages, context);
      const response = await this.callClaude(prompt);
      
      return this.parseCompetitiveAnalysis(response);
    } catch (error) {
      this.logger.error('Claude analysis failed', { error: error.message });
      return this.getMockAnalysis(messages);
    }
  }

  /**
   * Build prompt for competitive intelligence analysis
   */
  buildCompetitiveIntelligencePrompt(messages, context) {
    const messageText = messages.map(m => 
      `[${m.timestamp}] ${m.user}: ${m.text}`
    ).join('\n');

    return `You are a competitive intelligence analyst. Analyze these Slack messages for business insights:

CONTEXT:
- Company: ${context.company || 'Tech Company'}
- Team: ${context.team || 'Product Team'}
- Time Period: ${context.timeRange || 'Recent'}

MESSAGES:
${messageText}

ANALYSIS REQUIRED:
1. Competitive Mentions: Any references to competitors, their products, or strategies
2. Market Signals: Customer feedback, market trends, opportunities
3. Product Intelligence: Feature requests, user pain points, development priorities
4. Strategic Insights: Business decisions, partnerships, resource allocation
5. Risk Assessment: Threats, challenges, or concerns mentioned

FORMAT RESPONSE AS JSON:
{
  "competitive_signals": [
    {
      "type": "competitor_mention|market_trend|product_insight",
      "description": "Brief description",
      "confidence": 0.0-1.0,
      "priority": "high|medium|low",
      "evidence": "Quote from messages"
    }
  ],
  "key_insights": [
    {
      "category": "competitive|market|product|strategic",
      "insight": "Key finding",
      "impact": "Potential business impact",
      "action_items": ["Suggested actions"]
    }
  ],
  "sentiment": {
    "overall": "positive|neutral|negative",
    "confidence": 0.0-1.0
  }
}

Only include insights with high confidence. Focus on actionable intelligence.`;
  }

  /**
   * Generic text analysis method for task intelligence
   */
  async analyzeText(text, options = {}) {
    if (!this.apiKey) {
      this.logger.warn('No Anthropic API key - using fallback analysis');
      return this.getFallbackAnalysis(text, options);
    }

    try {
      const prompt = options.prompt || this.buildGenericPrompt(text, options);
      const response = await this.callClaude(prompt);

      // Check if response looks like HTML (API error)
      if (typeof response === 'string' && response.trim().startsWith('<')) {
        this.logger.warn('Claude returned HTML instead of JSON - using fallback');
        return this.getFallbackAnalysis(text, options);
      }

      // Try to parse as JSON first, if that fails return as text
      try {
        return JSON.parse(response);
      } catch (parseError) {
        // If it's not JSON but also not HTML, try to extract JSON from the response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            return JSON.parse(jsonMatch[0]);
          } catch (innerError) {
            this.logger.warn('Failed to extract JSON from Claude response - using fallback');
            return this.getFallbackAnalysis(text, options);
          }
        }
        return response;
      }

    } catch (error) {
      this.logger.error('Claude text analysis failed', {
        error: error.message,
        analysisType: options.analysisType
      });
      return this.getFallbackAnalysis(text, options);
    }
  }

  /**
   * Build generic analysis prompt
   */
  buildGenericPrompt(text, options) {
    if (options.prompt) {
      return options.prompt;
    }
    
    // Default prompt for task analysis
    return `Analyze this text: "${text}"
    
Please provide analysis in JSON format with relevant insights based on the context.`;
  }

  /**
   * Fallback analysis when AI is not available
   */
  getFallbackAnalysis(text, options) {
    const analysisType = options.analysisType || 'generic';
    
    switch (analysisType) {
      case 'task_extraction':
        return this.getFallbackTaskExtraction(text);
      case 'entity_matching':
        return { matches: [], overall_confidence: 0.3 };
      case 'task_crm_analysis':
        return {
          context_analysis: { criticality: 'medium', risks: [] },
          recommended_approach: { strategy: 'Standard approach', tools_needed: [], preparation: [] },
          success_factors: { key_factors: [], cautions: [] },
          confidence: 0.3
        };
      default:
        return { analysis: 'Fallback analysis', confidence: 0.3 };
    }
  }

  /**
   * Fallback task extraction
   */
  getFallbackTaskExtraction(text) {
    const taskKeywords = ['task', 'assigned', 'todo', 'deadline', 'can you', 'please', 'need you to', 'schedule', 'set up', 'arrange'];
    const urgencyKeywords = ['asap', 'urgent', 'immediately', 'today', 'tomorrow', 'by friday', 'by monday'];
    const meetingKeywords = ['demo', 'meeting', 'call', 'presentation', 'interview', 'consultation'];
    const followUpKeywords = ['follow up', 'check in', 'update', 'status', 'progress'];

    const lowerText = text.toLowerCase();
    const isTask = taskKeywords.some(keyword => lowerText.includes(keyword));
    const urgency = urgencyKeywords.some(keyword => lowerText.includes(keyword)) ? 'high' : 'medium';

    // Determine task type based on content
    let taskType = 'general';
    if (meetingKeywords.some(keyword => lowerText.includes(keyword))) {
      taskType = 'meeting';
    } else if (followUpKeywords.some(keyword => lowerText.includes(keyword))) {
      taskType = 'follow_up';
    } else if (lowerText.includes('update') || lowerText.includes('crm')) {
      taskType = 'data_entry';
    }

    // Try to extract assignee
    let assignee = null;
    const assigneeMatch = text.match(/(?:hey|hi)\s+(\w+)/i) || text.match(/(\w+),?\s+(?:can you|please|could you)/i);
    if (assigneeMatch) {
      assignee = assigneeMatch[1];
    }

    // Extract action from the text
    let action = text;
    if (lowerText.includes('schedule')) {
      action = text.replace(/.*?(schedule.*?)(\.|$)/i, '$1').trim();
    } else if (lowerText.includes('follow up')) {
      action = text.replace(/.*?(follow up.*?)(\.|$)/i, '$1').trim();
    }

    // Higher confidence for clear task patterns
    let confidence = 0.3;
    if (isTask && assignee) {
      confidence = 0.7;
    } else if (isTask) {
      confidence = 0.5;
    }

    return {
      is_task: isTask,
      assignee: assignee,
      task_type: taskType,
      action_required: action,
      mentioned_entities: [],
      deadline: null,
      urgency: urgency,
      context: text,
      confidence: confidence
    };
  }

  /**
   * Call Claude API
   */
  async callClaude(prompt) {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify({
        model: this.model,
        max_tokens: this.maxTokens,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const options = {
        hostname: 'api.anthropic.com',
        port: 443,
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': data.length,
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01'
        }
      };

      const req = https.request(options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          try {
            const result = JSON.parse(responseData);
            if (result.content && result.content[0]) {
              resolve(result.content[0].text);
            } else {
              reject(new Error('Invalid Claude response format'));
            }
          } catch (error) {
            reject(new Error(`JSON parse error: ${error.message}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.write(data);
      req.end();
    });
  }

  /**
   * Parse Claude's response into structured analysis
   */
  parseCompetitiveAnalysis(response) {
    try {
      // Extract JSON from Claude's response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      // Fallback parsing if JSON not found
      return {
        competitive_signals: [],
        key_insights: [{
          category: 'analysis',
          insight: response.substring(0, 200) + '...',
          impact: 'Requires further analysis',
          action_items: ['Review full analysis']
        }],
        sentiment: {
          overall: 'neutral',
          confidence: 0.5
        }
      };
    } catch (error) {
      this.logger.error('Failed to parse Claude response', { error: error.message });
      return this.getMockAnalysis([]);
    }
  }

  /**
   * Mock analysis when API is not available
   */
  getMockAnalysis(messages) {
    return {
      competitive_signals: [
        {
          type: 'competitor_mention',
          description: 'Competitor pricing discussion detected',
          confidence: 0.85,
          priority: 'high',
          evidence: 'Demo analysis - API key needed for real insights'
        }
      ],
      key_insights: [
        {
          category: 'competitive',
          insight: 'Team discussing market positioning relative to competitors',
          impact: 'May indicate need for pricing strategy review',
          action_items: ['Add ANTHROPIC_API_KEY for real AI analysis']
        }
      ],
      sentiment: {
        overall: 'neutral',
        confidence: 0.7
      }
    };
  }
}

module.exports = AnthropicAnalyzer;
