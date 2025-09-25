/**
 * AI Analyzer - Uses Anthropic Claude for signal analysis and enrichment
 * 
 * Features:
 * 1. Content summarization and analysis
 * 2. Competitive impact assessment
 * 3. Sentiment analysis
 * 4. Key insight extraction
 * 5. Business relevance scoring
 */

const Anthropic = require('@anthropic-ai/sdk');
const winston = require('winston');

class AIAnalyzer {
  constructor(options = {}) {
    this.options = {
      model: 'claude-3-5-sonnet-20241022',
      maxTokens: 1000,
      temperature: 0.3,
      logLevel: 'info',
      ...options
    };
    
    this.logger = winston.createLogger({
      level: this.options.logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      defaultMeta: { service: 'ai-analyzer' },
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        })
      ]
    });
    
    // Initialize Anthropic client
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || 'demo-key'
    });
  }
  
  /**
   * Analyze signal content for competitive intelligence insights
   */
  async analyzeSignal(signal, userContext = {}) {
    try {
      this.logger.info('Analyzing signal with Claude', {
        signal_id: signal.id,
        title: signal.title
      });
      
      const analysis = await this.performAnalysis(signal, userContext);
      
      this.logger.info('Signal analysis completed', {
        signal_id: signal.id,
        insights_count: analysis.insights?.length || 0,
        impact_score: analysis.impact_assessment?.competitive_threat || 0
      });
      
      return analysis;
      
    } catch (error) {
      this.logger.error('Signal analysis failed', {
        signal_id: signal.id,
        error: error.message
      });
      
      // Return default analysis on error
      return this.getDefaultAnalysis(signal);
    }
  }
  
  /**
   * Perform comprehensive signal analysis using Claude
   */
  async performAnalysis(signal, userContext) {
    const prompt = this.buildAnalysisPrompt(signal, userContext);
    
    const response = await this.anthropic.messages.create({
      model: this.options.model,
      max_tokens: this.options.maxTokens,
      temperature: this.options.temperature,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });
    
    const analysisText = response.content[0].text;
    return this.parseAnalysisResponse(analysisText, signal);
  }
  
  /**
   * Build analysis prompt for Claude
   */
  buildAnalysisPrompt(signal, userContext) {
    const competitorsList = (userContext && userContext.competitors) ? 
      userContext.competitors.join(', ') : 'Not specified';
    
    const productsList = (userContext && userContext.our_products) ? 
      userContext.our_products.map(p => p.name).join(', ') : 'Not specified';
    
    const focusAreas = (userContext && userContext.focus_areas) ? 
      userContext.focus_areas.join(', ') : 'Not specified';
    
    return `You are a competitive intelligence analyst. Please analyze the following signal and provide structured insights.

SIGNAL INFORMATION:
Title: ${signal.title}
Category: ${signal.category}
Summary: ${signal.summary}
Content: ${signal.content || 'Not available'}
Source: ${signal.source_name || 'Unknown'}
Published: ${signal.published_at}

USER CONTEXT:
Role: ${userContext.role || 'Not specified'}
Competitors: ${competitorsList}
Our Products: ${productsList}
Focus Areas: ${focusAreas}
Industry: ${userContext.industry || 'Not specified'}

Please provide your analysis in the following JSON format:

{
  "summary": "Brief 2-3 sentence summary of the key points",
  "impact_assessment": {
    "competitive_threat": 0.8,
    "market_opportunity": 0.6,
    "strategic_importance": 0.7,
    "urgency": 0.9,
    "confidence": 0.8,
    "reasoning": "Explanation of the impact scores"
  },
  "insights": [
    "Key insight 1",
    "Key insight 2",
    "Key insight 3"
  ],
  "sentiment": 0.2,
  "business_implications": [
    "Implication 1",
    "Implication 2"
  ],
  "recommended_actions": [
    "Action 1",
    "Action 2"
  ],
  "relevance_explanation": "Why this signal is relevant to the user's context"
}

Scoring guidelines:
- All scores should be between 0.0 and 1.0
- competitive_threat: How much this threatens our competitive position
- market_opportunity: Potential opportunities this creates
- strategic_importance: Long-term strategic significance
- urgency: How quickly we need to respond
- confidence: How confident you are in your assessment
- sentiment: -1.0 (very negative) to 1.0 (very positive)

Focus on actionable insights and be specific about business implications.`;
  }
  
  /**
   * Parse Claude's analysis response
   */
  parseAnalysisResponse(analysisText, signal) {
    try {
      // Try to extract JSON from the response
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0]);
        
        // Validate and clean the analysis
        return this.validateAnalysis(analysis, signal);
      }
      
      // If no JSON found, create analysis from text
      return this.createAnalysisFromText(analysisText, signal);
      
    } catch (error) {
      this.logger.warn('Failed to parse analysis response', {
        signal_id: signal.id,
        error: error.message
      });
      
      return this.createAnalysisFromText(analysisText, signal);
    }
  }
  
  /**
   * Validate and clean analysis response
   */
  validateAnalysis(analysis, signal) {
    // Ensure all required fields exist with defaults
    const validated = {
      summary: analysis.summary || signal.summary || 'No summary available',
      impact_assessment: {
        competitive_threat: this.clampScore(analysis.impact_assessment?.competitive_threat, 0.5),
        market_opportunity: this.clampScore(analysis.impact_assessment?.market_opportunity, 0.5),
        strategic_importance: this.clampScore(analysis.impact_assessment?.strategic_importance, 0.5),
        urgency: this.clampScore(analysis.impact_assessment?.urgency, 0.5),
        confidence: this.clampScore(analysis.impact_assessment?.confidence, 0.5),
        reasoning: analysis.impact_assessment?.reasoning || 'Analysis completed'
      },
      insights: Array.isArray(analysis.insights) ? analysis.insights.slice(0, 5) : [],
      sentiment: this.clampScore(analysis.sentiment, 0, -1, 1),
      business_implications: Array.isArray(analysis.business_implications) ? 
        analysis.business_implications.slice(0, 3) : [],
      recommended_actions: Array.isArray(analysis.recommended_actions) ? 
        analysis.recommended_actions.slice(0, 3) : [],
      relevance_explanation: analysis.relevance_explanation || 
        'Signal contains relevant competitive intelligence information',
      analysis_timestamp: new Date(),
      model_used: this.options.model
    };
    
    return validated;
  }
  
  /**
   * Create analysis from unstructured text response
   */
  createAnalysisFromText(text, signal) {
    // Extract key information from text using simple heuristics
    const lines = text.split('\n').filter(line => line.trim());
    
    const insights = lines
      .filter(line => line.includes('•') || line.includes('-') || line.includes('*'))
      .map(line => line.replace(/^[•\-*\s]+/, '').trim())
      .slice(0, 3);
    
    return {
      summary: signal.summary || 'Analysis completed',
      impact_assessment: {
        competitive_threat: 0.6,
        market_opportunity: 0.5,
        strategic_importance: 0.6,
        urgency: 0.5,
        confidence: 0.7,
        reasoning: 'Automated analysis from unstructured response'
      },
      insights: insights.length > 0 ? insights : ['Signal requires further analysis'],
      sentiment: 0.0,
      business_implications: ['Impact assessment needed'],
      recommended_actions: ['Review signal for strategic implications'],
      relevance_explanation: 'Signal flagged for competitive intelligence review',
      analysis_timestamp: new Date(),
      model_used: this.options.model
    };
  }
  
  /**
   * Clamp score to valid range
   */
  clampScore(value, defaultValue = 0.5, min = 0, max = 1) {
    if (typeof value !== 'number' || isNaN(value)) {
      return defaultValue;
    }
    return Math.max(min, Math.min(max, value));
  }
  
  /**
   * Generate summary for signal
   */
  async generateSummary(content, maxLength = 200) {
    try {
      const prompt = `Please provide a concise summary of the following content in ${maxLength} characters or less:

${content}

Summary:`;

      const response = await this.anthropic.messages.create({
        model: this.options.model,
        max_tokens: 150,
        temperature: 0.1,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });
      
      return response.content[0].text.trim();
      
    } catch (error) {
      this.logger.error('Summary generation failed', { error: error.message });
      
      // Fallback to simple truncation
      return content.substring(0, maxLength) + '...';
    }
  }
  
  /**
   * Extract key insights from signal
   */
  async extractInsights(signal, userContext = {}) {
    try {
      const prompt = `As a competitive intelligence analyst, extract 3-5 key insights from this signal:

Title: ${signal.title}
Content: ${signal.summary || signal.content || 'Limited content available'}

User Context:
- Role: ${userContext.role || 'General'}
- Competitors: ${userContext.competitors?.join(', ') || 'Not specified'}
- Focus Areas: ${userContext.focus_areas?.join(', ') || 'Not specified'}

Please provide insights as a JSON array of strings:
["insight 1", "insight 2", "insight 3"]

Focus on actionable, business-relevant insights.`;

      const response = await this.anthropic.messages.create({
        model: this.options.model,
        max_tokens: 300,
        temperature: 0.2,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });
      
      const responseText = response.content[0].text;
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      // Fallback: extract insights from response text
      return responseText.split('\n')
        .filter(line => line.trim())
        .slice(0, 3)
        .map(line => line.replace(/^[•\-*\d.\s]+/, '').trim());
        
    } catch (error) {
      this.logger.error('Insight extraction failed', { error: error.message });
      return ['Signal requires manual analysis'];
    }
  }
  
  /**
   * Assess competitive impact
   */
  async assessCompetitiveImpact(signal, userContext = {}) {
    try {
      const competitors = userContext.competitors?.join(', ') || 'competitors';
      
      const prompt = `Assess the competitive impact of this signal:

Title: ${signal.title}
Summary: ${signal.summary || 'No summary available'}
Category: ${signal.category}

Context:
- Our competitors: ${competitors}
- Our products: ${userContext.our_products?.map(p => p.name).join(', ') || 'Not specified'}

Rate the impact on a scale of 0.0 to 1.0 for:
1. Competitive threat (how much this threatens our position)
2. Market opportunity (opportunities this creates)
3. Strategic importance (long-term significance)
4. Urgency (how quickly we need to respond)

Respond with JSON:
{
  "competitive_threat": 0.7,
  "market_opportunity": 0.4,
  "strategic_importance": 0.6,
  "urgency": 0.8,
  "reasoning": "Brief explanation of the assessment"
}`;

      const response = await this.anthropic.messages.create({
        model: this.options.model,
        max_tokens: 200,
        temperature: 0.1,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });
      
      const responseText = response.content[0].text;
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const assessment = JSON.parse(jsonMatch[0]);
        return {
          competitive_threat: this.clampScore(assessment.competitive_threat, 0.5),
          market_opportunity: this.clampScore(assessment.market_opportunity, 0.5),
          strategic_importance: this.clampScore(assessment.strategic_importance, 0.5),
          urgency: this.clampScore(assessment.urgency, 0.5),
          confidence: 0.8,
          reasoning: assessment.reasoning || 'AI assessment completed'
        };
      }
      
      return this.getDefaultImpactAssessment();
      
    } catch (error) {
      this.logger.error('Impact assessment failed', { error: error.message });
      return this.getDefaultImpactAssessment();
    }
  }
  
  /**
   * Get default analysis when AI fails
   */
  getDefaultAnalysis(signal) {
    return {
      summary: signal.summary || signal.title || 'Signal analysis unavailable',
      impact_assessment: this.getDefaultImpactAssessment(),
      insights: ['Signal requires manual review'],
      sentiment: 0.0,
      business_implications: ['Impact assessment needed'],
      recommended_actions: ['Review signal content'],
      relevance_explanation: 'Signal flagged for review',
      analysis_timestamp: new Date(),
      model_used: 'fallback'
    };
  }
  
  /**
   * Get default impact assessment
   */
  getDefaultImpactAssessment() {
    return {
      competitive_threat: 0.5,
      market_opportunity: 0.5,
      strategic_importance: 0.5,
      urgency: 0.5,
      confidence: 0.3,
      reasoning: 'Default assessment - manual review recommended'
    };
  }
  
  /**
   * Check if API is configured
   */
  isConfigured() {
    return Boolean(process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'demo-key');
  }
  
  /**
   * Get usage statistics
   */
  getStats() {
    return {
      model: this.options.model,
      max_tokens: this.options.maxTokens,
      temperature: this.options.temperature,
      is_configured: this.isConfigured()
    };
  }
}

module.exports = AIAnalyzer;
