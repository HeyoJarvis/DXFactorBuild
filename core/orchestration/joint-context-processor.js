/**
 * Joint CRM + Slack Context Processor
 * 
 * This module implements the core pipeline from your flowchart:
 * 1. CRM Context: Parsed and packaged by Anthropic API
 * 2. Slack Workflows: Parsed and packaged by Anthropic API  
 * 3. Joint Context: Combined CRM + Slack workflow context
 * 4. Recommendations: Context-aware AI recommendations with follow-up support
 */

// Load environment variables
require('dotenv').config();

const EventEmitter = require('events');
const winston = require('winston');

class JointContextProcessor extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      logLevel: process.env.LOG_LEVEL || 'info',
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
      ...options
    };
    
    // Initialize logger
    this.logger = winston.createLogger({
      level: this.options.logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/joint-context-processor.log' })
      ],
      defaultMeta: { service: 'joint-context-processor' }
    });
    
    // Context storage
    this.contexts = new Map();
    this.recommendations = new Map();
    
    // Initialize Anthropic client
    this.initializeAnthropicClient();
  }

  /**
   * Initialize Anthropic API client
   */
  initializeAnthropicClient() {
    try {
      const Anthropic = require('@anthropic-ai/sdk');
      
      // Check if API key is available
      if (!this.options.anthropicApiKey) {
        throw new Error('ANTHROPIC_API_KEY is required but not provided. Please set it in your .env file.');
      }
      
      this.anthropic = new Anthropic({
        apiKey: this.options.anthropicApiKey
      });
      this.logger.info('Anthropic client initialized');
    } catch (error) {
      this.logger.error('Failed to initialize Anthropic client:', error);
      throw error;
    }
  }

  /**
   * Process CRM context using Anthropic API
   * @param {Object} crmData - Raw CRM data from the analyzer
   * @param {string} organizationId - Organization identifier
   * @returns {Promise<Object>} Parsed and packaged CRM context
   */
  async processCRMContext(crmData, organizationId) {
    try {
      this.logger.info('Processing CRM context', { organizationId });
      
      const prompt = `
You are an expert CRM analyst. Parse and package the following CRM data into a structured context that can be used for AI-driven recommendations.

CRM Data:
${JSON.stringify(crmData, null, 2)}

Please extract and structure the following information and return ONLY valid JSON (no additional text or explanations):

1. Company intelligence summary
2. Workflow patterns and bottlenecks
3. Performance metrics and KPIs
4. Integration opportunities
5. Automation gaps
6. Key challenges and pain points
7. Technology stack insights
8. Process maturity assessment

Return the response as a valid JSON object with this structure:
{
  "company_intelligence": {
    "company_name": "string",
    "industry": "string",
    "key_challenges": ["string"],
    "integration_opportunities": ["string"]
  },
  "workflow_analysis": {
    "patterns_discovered": number,
    "performance_metrics": {},
    "key_insights": ["string"]
  },
  "automation_gaps": ["string"],
  "technology_stack": {},
  "process_maturity": {}
}
`;

      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        temperature: 0.3,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const parsedContext = JSON.parse(response.content[0].text);
      
      // Store the processed context
      this.contexts.set(`${organizationId}_crm`, {
        type: 'crm',
        organizationId,
        processedAt: new Date(),
        data: parsedContext,
        rawData: crmData
      });

      this.logger.info('CRM context processed successfully', { 
        organizationId,
        contextKeys: Object.keys(parsedContext)
      });

      return parsedContext;

    } catch (error) {
      this.logger.error('Failed to process CRM context:', error);
      throw error;
    }
  }

  /**
   * Process Slack workflows using Anthropic API
   * @param {Array} slackWorkflows - Array of Slack workflow data
   * @param {string} organizationId - Organization identifier
   * @returns {Promise<Object>} Parsed and packaged Slack workflow context
   */
  async processSlackWorkflows(slackWorkflows, organizationId) {
    try {
      this.logger.info('Processing Slack workflows', { 
        organizationId,
        workflowCount: slackWorkflows.length 
      });
      
      const prompt = `
You are an expert workflow analyst. Parse and package the following Slack workflow data into a structured context that can be used for AI-driven recommendations.

Slack Workflow Data:
${JSON.stringify(slackWorkflows, null, 2)}

Please extract and structure the following information and return ONLY valid JSON (no additional text or explanations):

1. Communication patterns and channels
2. Workflow efficiency metrics
3. Collaboration bottlenecks
4. Automation opportunities
5. Team productivity insights
6. Process gaps and inefficiencies
7. Integration needs
8. User behavior patterns

Return the response as a valid JSON object with this structure:
{
  "communication_patterns": ["string"],
  "workflow_efficiency": {
    "avg_efficiency_score": number,
    "bottlenecks": ["string"]
  },
  "automation_opportunities": ["string"],
  "team_productivity": {},
  "process_gaps": ["string"],
  "integration_needs": ["string"],
  "user_behavior": {}
}
`;

      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        temperature: 0.3,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const parsedContext = JSON.parse(response.content[0].text);
      
      // Store the processed context
      this.contexts.set(`${organizationId}_slack`, {
        type: 'slack',
        organizationId,
        processedAt: new Date(),
        data: parsedContext,
        rawData: slackWorkflows
      });

      this.logger.info('Slack workflows processed successfully', { 
        organizationId,
        contextKeys: Object.keys(parsedContext)
      });

      return parsedContext;

    } catch (error) {
      this.logger.error('Failed to process Slack workflows:', error);
      throw error;
    }
  }

  /**
   * Create joint CRM + Slack workflow context
   * @param {string} organizationId - Organization identifier
   * @returns {Promise<Object>} Combined context for recommendations
   */
  async createJointContext(organizationId) {
    try {
      this.logger.info('Creating joint context', { organizationId });
      
      const crmContext = this.contexts.get(`${organizationId}_crm`);
      const slackContext = this.contexts.get(`${organizationId}_slack`);
      
      if (!crmContext || !slackContext) {
        throw new Error('Both CRM and Slack contexts must be processed first');
      }

      const prompt = `
You are an expert business intelligence analyst. Combine the following CRM and Slack workflow contexts to create a comprehensive joint context for AI-driven recommendations.

CRM Context:
${JSON.stringify(crmContext.data, null, 2)}

Slack Workflow Context:
${JSON.stringify(slackContext.data, null, 2)}

Please create a joint context that identifies synergies and opportunities. Return ONLY valid JSON (no additional text or explanations) with this structure:

{
  "synergies": ["string"],
  "cross_functional_opportunities": ["string"],
  "integrated_automation_potential": ["string"],
  "unified_process_insights": ["string"],
  "integrated_recommendations": ["string"],
  "end_to_end_optimization": {
    "opportunities": ["string"],
    "priority_areas": ["string"]
  }
}
`;

      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 5000,
        temperature: 0.3,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const jointContext = JSON.parse(response.content[0].text);
      
      // Store the joint context
      this.contexts.set(`${organizationId}_joint`, {
        type: 'joint',
        organizationId,
        processedAt: new Date(),
        data: jointContext,
        crmContext: crmContext.data,
        slackContext: slackContext.data
      });

      this.logger.info('Joint context created successfully', { 
        organizationId,
        contextKeys: Object.keys(jointContext)
      });

      return jointContext;

    } catch (error) {
      this.logger.error('Failed to create joint context:', error);
      throw error;
    }
  }

  /**
   * Generate context-aware recommendations
   * @param {string} organizationId - Organization identifier
   * @param {string} userQuery - User's specific recommendation request
   * @returns {Promise<Object>} AI-driven recommendations with follow-up support
   */
  async generateRecommendations(organizationId, userQuery) {
    try {
      this.logger.info('Generating recommendations', { organizationId, userQuery });
      
      const jointContext = this.contexts.get(`${organizationId}_joint`);
      if (!jointContext) {
        throw new Error('Joint context must be created first');
      }

      const prompt = `
You are an expert business consultant. Based on the joint CRM + Slack workflow context, provide specific recommendations for the user's query.

Joint Context:
${JSON.stringify(jointContext.data, null, 2)}

User Query: "${userQuery}"

Please provide recommendations and return ONLY valid JSON (no additional text or explanations) with this structure:

{
  "recommendations": [
    {
      "title": "string",
      "description": "string",
      "justification": "string",
      "roi_estimates": "string",
      "time_savings": "string",
      "implementation_complexity": "Low/Medium/High"
    }
  ],
  "follow_up_questions": ["string"],
  "alternatives": ["string"]
}
`;

      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 3000,
        temperature: 0.4,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const recommendations = JSON.parse(response.content[0].text);
      
      // Store recommendations for follow-up
      const recommendationId = `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      this.recommendations.set(recommendationId, {
        id: recommendationId,
        organizationId,
        userQuery,
        recommendations: recommendations,
        createdAt: new Date(),
        context: jointContext.data
      });

      this.logger.info('Recommendations generated successfully', { 
        organizationId,
        recommendationId,
        recommendationCount: recommendations.recommendations?.length || 0
      });

      return {
        recommendationId,
        ...recommendations
      };

    } catch (error) {
      this.logger.error('Failed to generate recommendations:', error);
      throw error;
    }
  }

  /**
   * Handle follow-up questions about recommendations
   * @param {string} recommendationId - ID of the original recommendation
   * @param {string} followUpQuery - User's follow-up question
   * @returns {Promise<Object>} Detailed follow-up response
   */
  async handleFollowUp(recommendationId, followUpQuery) {
    try {
      this.logger.info('Handling follow-up', { recommendationId, followUpQuery });
      
      const originalRecommendation = this.recommendations.get(recommendationId);
      if (!originalRecommendation) {
        throw new Error('Recommendation not found');
      }

      const prompt = `
You are an expert business consultant. Answer the user's follow-up question about the previous recommendations.

Original Recommendations:
${JSON.stringify(originalRecommendation.recommendations, null, 2)}

Original Context:
${JSON.stringify(originalRecommendation.context, null, 2)}

Follow-up Question: "${followUpQuery}"

Provide a detailed, specific answer that:
1. Directly addresses the follow-up question
2. References the original recommendations
3. Provides additional context or clarification
4. Includes specific numbers, timelines, or metrics when relevant
5. Suggests next steps if appropriate

Be conversational but professional, and provide actionable insights.
`;

      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        temperature: 0.4,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const followUpResponse = response.content[0].text;
      
      this.logger.info('Follow-up handled successfully', { 
        recommendationId,
        responseLength: followUpResponse.length
      });

      return {
        recommendationId,
        followUpQuery,
        response: followUpResponse,
        timestamp: new Date()
      };

    } catch (error) {
      this.logger.error('Failed to handle follow-up:', error);
      throw error;
    }
  }

  /**
   * Get context summary for an organization
   * @param {string} organizationId - Organization identifier
   * @returns {Object} Summary of all contexts
   */
  getContextSummary(organizationId) {
    const crmContext = this.contexts.get(`${organizationId}_crm`);
    const slackContext = this.contexts.get(`${organizationId}_slack`);
    const jointContext = this.contexts.get(`${organizationId}_joint`);
    
    return {
      organizationId,
      hasCRMContext: !!crmContext,
      hasSlackContext: !!slackContext,
      hasJointContext: !!jointContext,
      crmProcessedAt: crmContext?.processedAt,
      slackProcessedAt: slackContext?.processedAt,
      jointProcessedAt: jointContext?.processedAt,
      totalRecommendations: Array.from(this.recommendations.values())
        .filter(rec => rec.organizationId === organizationId).length
    };
  }

  /**
   * Clear contexts for an organization
   * @param {string} organizationId - Organization identifier
   */
  clearContexts(organizationId) {
    this.contexts.delete(`${organizationId}_crm`);
    this.contexts.delete(`${organizationId}_slack`);
    this.contexts.delete(`${organizationId}_joint`);
    
    // Clear related recommendations
    for (const [id, rec] of this.recommendations.entries()) {
      if (rec.organizationId === organizationId) {
        this.recommendations.delete(id);
      }
    }
    
    this.logger.info('Contexts cleared', { organizationId });
  }
}

module.exports = JointContextProcessor;
