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
