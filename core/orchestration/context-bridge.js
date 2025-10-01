/**
 * Context Bridge - Converts JSON data to AI-understood text contexts
 * 
 * This module bridges your existing CRM and Slack integrations by:
 * 1. Converting CRM JSON analysis to AI-understood text context
 * 2. Converting Slack workflow JSON to AI-understood text context  
 * 3. Combining both contexts for ultimate chatbot intelligence
 */

// Load environment variables
require('dotenv').config();

const EventEmitter = require('events');
const winston = require('winston');

class ContextBridge extends EventEmitter {
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
        new winston.transports.File({ filename: 'logs/context-bridge.log' })
      ],
      defaultMeta: { service: 'context-bridge' }
    });
    
    // Initialize Anthropic client
    this.initializeAnthropicClient();
    
    // Context storage - separated by type
    this.persistentContexts = new Map(); // CRM contexts that persist per organization
    this.dynamicContexts = new Map();    // Slack contexts that refresh
    this.sessionContexts = new Map();    // Combined contexts per chat session
  }

  /**
   * Initialize Anthropic API client
   */
  initializeAnthropicClient() {
    try {
      const Anthropic = require('@anthropic-ai/sdk');
      
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
   * Convert CRM JSON analysis to persistent AI-understood text context
   * This context persists per organization and doesn't change during chat sessions
   * @param {Object} crmAnalysis - The JSON output from your CRM analyzer
   * @param {string} organizationId - Organization identifier
   * @returns {Promise<Object>} AI-understood CRM context
   */
  async convertCRMToPersistentContext(crmAnalysis, organizationId) {
    try {
      this.logger.info('Converting CRM analysis to AI context', { organizationId });
      
      const prompt = `
You are an expert business analyst. Convert this CRM analysis JSON into a comprehensive, AI-understood text context that captures the company's business situation, challenges, and opportunities.

CRM Analysis Data:
${JSON.stringify(crmAnalysis, null, 2)}

Please create a detailed text context that includes:

1. **Company Overview**: Business model, industry, size, and current state
2. **Sales Pipeline Health**: Current pipeline status, deal flow, and performance metrics
3. **Key Challenges**: Specific business problems and bottlenecks identified
4. **Opportunities**: Growth potential and optimization areas
5. **Technology Stack**: Current tools and systems in use
6. **Process Maturity**: How sophisticated their sales and business processes are
7. **Recommendations**: Specific tools and actions that would help
8. **Urgent Issues**: Critical problems that need immediate attention

Format as a comprehensive business context that an AI assistant can understand and use to provide intelligent recommendations.

Return ONLY the text context (no JSON, no explanations, just the context).
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

      const crmContext = response.content[0].text;
      
      // Store the persistent CRM context
      this.persistentContexts.set(`${organizationId}_crm`, {
        type: 'persistent_crm',
        organizationId,
        processedAt: new Date(),
        context: crmContext,
        originalData: crmAnalysis
      });

      this.logger.info('CRM context converted successfully', { 
        organizationId,
        contextLength: crmContext.length
      });

      return {
        organizationId,
        type: 'crm_context',
        context: crmContext,
        metadata: {
          originalDataKeys: Object.keys(crmAnalysis),
          contextLength: crmContext.length,
          processedAt: new Date()
        }
      };

    } catch (error) {
      this.logger.error('Failed to convert CRM to context:', error);
      throw error;
    }
  }

  /**
   * Convert Slack workflow data to dynamic AI-understood text context
   * This context refreshes with new Slack data for each chat interaction
   * @param {Array} slackWorkflows - Array of Slack workflow data from WorkflowIntelligenceSystem
   * @param {string} organizationId - Organization identifier
   * @param {string} sessionId - Chat session identifier
   * @returns {Promise<Object>} AI-understood Slack context
   */
  async convertSlackToDynamicContext(slackWorkflows, organizationId, sessionId = 'default') {
    try {
      this.logger.info('Converting Slack workflows to AI context', { 
        organizationId,
        workflowCount: slackWorkflows.length 
      });
      
      const prompt = `
You are an expert workflow analyst. Convert this Slack workflow data into a comprehensive, AI-understood text context that captures the team's communication patterns, workflow efficiency, and collaboration dynamics.

Slack Workflow Data:
${JSON.stringify(slackWorkflows, null, 2)}

Please create a detailed text context that includes:

1. **Team Communication Patterns**: How the team communicates, frequency, channels used
2. **Workflow Efficiency**: How well processes flow, bottlenecks, and inefficiencies
3. **Collaboration Dynamics**: How team members work together, handoffs, dependencies
4. **Tool Usage**: What tools are mentioned or used in workflows
5. **Process Gaps**: Missing steps, unclear processes, or broken workflows
6. **Automation Opportunities**: Where manual processes could be automated
7. **Team Productivity**: Overall team efficiency and productivity indicators
8. **Integration Needs**: What systems or tools need to be connected

Format as a comprehensive workflow context that an AI assistant can understand and use to provide intelligent recommendations.

Return ONLY the text context (no JSON, no explanations, just the context).
`;

      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 3000,
        temperature: 0.3,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const slackContext = response.content[0].text;
      
      // Store the dynamic Slack context (refreshes each time)
      this.dynamicContexts.set(`${organizationId}_${sessionId}_slack`, {
        type: 'dynamic_slack',
        organizationId,
        sessionId,
        processedAt: new Date(),
        context: slackContext,
        originalData: slackWorkflows
      });

      this.logger.info('Slack context converted successfully', { 
        organizationId,
        contextLength: slackContext.length
      });

      return {
        organizationId,
        type: 'slack_context',
        context: slackContext,
        metadata: {
          workflowCount: slackWorkflows.length,
          contextLength: slackContext.length,
          processedAt: new Date()
        }
      };

    } catch (error) {
      this.logger.error('Failed to convert Slack to context:', error);
      throw error;
    }
  }

  /**
   * Combine persistent CRM context with dynamic Slack context for a chat session
   * @param {string} organizationId - Organization identifier
   * @param {string} sessionId - Chat session identifier
   * @returns {Promise<Object>} Combined context for ultimate chatbot intelligence
   */
  async combineContextsForSession(organizationId, sessionId = 'default') {
    try {
      this.logger.info('Combining persistent CRM and dynamic Slack contexts', { 
        organizationId, 
        sessionId 
      });
      
      const crmContext = this.persistentContexts.get(`${organizationId}_crm`);
      const slackContext = this.dynamicContexts.get(`${organizationId}_${sessionId}_slack`);
      
      if (!crmContext) {
        throw new Error('Persistent CRM context must be available first');
      }
      
      if (!slackContext) {
        this.logger.warn('No dynamic Slack context found, using CRM context only', { 
          organizationId, 
          sessionId 
        });
      }

      const prompt = `
You are an expert business intelligence analyst. Combine these two business contexts to create the ultimate understanding of this company's needs, challenges, and opportunities.

PERSISTENT CRM Business Context (Foundational Intelligence):
${crmContext.context}

DYNAMIC Slack Workflow Context (Current Team Activity):
${slackContext ? slackContext.context : 'No current Slack workflow data available - focus on CRM context only.'}

Please create a comprehensive combined context that:

1. **Unified Business Understanding**: Complete picture of the company's business situation
2. **Cross-System Insights**: How CRM and Slack workflows interact and affect each other
3. **Integrated Challenges**: Business problems that span both systems
4. **Holistic Opportunities**: Solutions that address both CRM and workflow issues
5. **Technology Integration Needs**: How to connect and optimize both systems
6. **Priority Actions**: What to focus on first based on both contexts
7. **Success Metrics**: How to measure improvement across both areas
8. **Implementation Roadmap**: Step-by-step approach to address all issues

Format as the ultimate business intelligence context that gives an AI assistant complete understanding of what this company needs.

Return ONLY the combined context (no JSON, no explanations, just the context).
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

      const combinedContext = response.content[0].text;
      
      // Store the session-specific combined context
      this.sessionContexts.set(`${organizationId}_${sessionId}_combined`, {
        type: 'session_combined',
        organizationId,
        sessionId,
        processedAt: new Date(),
        context: combinedContext,
        crmContext: crmContext.context,
        slackContext: slackContext ? slackContext.context : null
      });

      this.logger.info('Contexts combined successfully', { 
        organizationId,
        contextLength: combinedContext.length
      });

      return {
        organizationId,
        type: 'combined_context',
        context: combinedContext,
        metadata: {
          crmContextLength: crmContext.context.length,
          slackContextLength: slackContext.context.length,
          combinedContextLength: combinedContext.length,
          processedAt: new Date()
        }
      };

    } catch (error) {
      this.logger.error('Failed to combine contexts:', error);
      throw error;
    }
  }

  /**
   * Get or create fresh Slack workflow context for a session
   * @param {Array} freshSlackWorkflows - Latest Slack workflow data
   * @param {string} organizationId - Organization identifier
   * @param {string} sessionId - Chat session identifier
   * @returns {Promise<Object>} Fresh dynamic Slack context
   */
  async refreshSlackContext(freshSlackWorkflows, organizationId, sessionId = 'default') {
    try {
      this.logger.info('Refreshing Slack context with fresh data', { 
        organizationId, 
        sessionId,
        workflowCount: freshSlackWorkflows.length
      });
      
      // Convert fresh Slack data to dynamic context
      const slackContext = await this.convertSlackToDynamicContext(
        freshSlackWorkflows, 
        organizationId, 
        sessionId
      );
      
      return slackContext;
      
    } catch (error) {
      this.logger.error('Failed to refresh Slack context:', error);
      throw error;
    }
  }

  /**
   * Get the ultimate context for a specific chat session
   * @param {string} organizationId - Organization identifier
   * @param {string} sessionId - Chat session identifier
   * @returns {Object} Ultimate context for AI recommendations
   */
  getUltimateContextForSession(organizationId, sessionId = 'default') {
    const combinedContext = this.sessionContexts.get(`${organizationId}_${sessionId}_combined`);
    const crmContext = this.persistentContexts.get(`${organizationId}_crm`);
    const slackContext = this.dynamicContexts.get(`${organizationId}_${sessionId}_slack`);
    
    if (!combinedContext) {
      throw new Error(`Combined context not found for session ${sessionId}. Run combineContextsForSession() first.`);
    }

    return {
      organizationId,
      sessionId,
      ultimateContext: combinedContext.context,
      crmContext: crmContext?.context,
      slackContext: slackContext?.context,
      metadata: {
        hasCRMContext: !!crmContext,
        hasSlackContext: !!slackContext,
        hasCombinedContext: !!combinedContext,
        crmProcessedAt: crmContext?.processedAt,
        slackProcessedAt: slackContext?.processedAt,
        combinedProcessedAt: combinedContext.processedAt,
        isPersistentCRM: true,
        isDynamicSlack: true
      }
    };
  }

  /**
   * Generate AI recommendations based on session-specific ultimate context
   * @param {string} organizationId - Organization identifier
   * @param {string} userQuery - User's question or request
   * @param {string} sessionId - Chat session identifier
   * @returns {Promise<Object>} AI-driven recommendations
   */
  async generateRecommendationsForSession(organizationId, userQuery, sessionId = 'default') {
    try {
      this.logger.info('Generating recommendations from ultimate context', { 
        organizationId, 
        userQuery 
      });
      
      const ultimateContext = this.getUltimateContextForSession(organizationId, sessionId);
      
      const prompt = `
You are an expert business consultant with complete understanding of this company's situation. Based on the ultimate business context below, provide specific, actionable recommendations for the user's query.

Ultimate Business Context:
${ultimateContext.ultimateContext}

User Query: "${userQuery}"

Please provide:

1. **Specific Recommendations**: Concrete actions and tools to address their needs
2. **Implementation Priority**: What to do first, second, third
3. **Expected Outcomes**: What results they can expect
4. **Resource Requirements**: What they'll need (time, money, people)
5. **Success Metrics**: How to measure progress
6. **Potential Challenges**: What might go wrong and how to avoid it
7. **Next Steps**: Immediate actions they can take

Be specific, practical, and actionable. Reference the actual business context to justify your recommendations.

Return ONLY the recommendations (no JSON, no explanations, just the recommendations).
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

      const recommendations = response.content[0].text;
      
      this.logger.info('Recommendations generated successfully', { 
        organizationId,
        recommendationLength: recommendations.length
      });

      return {
        organizationId,
        userQuery,
        recommendations,
        contextUsed: ultimateContext.ultimateContext.substring(0, 200) + '...',
        generatedAt: new Date()
      };

    } catch (error) {
      this.logger.error('Failed to generate recommendations:', error);
      throw error;
    }
  }

  /**
   * Get context summary for an organization
   * @param {string} organizationId - Organization identifier
   * @returns {Object} Summary of all contexts
   */
  getContextSummary(organizationId) {
    const crmContext = this.contexts.get(`${organizationId}_crm_text`);
    const slackContext = this.contexts.get(`${organizationId}_slack_text`);
    const combinedContext = this.contexts.get(`${organizationId}_combined`);
    
    return {
      organizationId,
      hasCRMContext: !!crmContext,
      hasSlackContext: !!slackContext,
      hasCombinedContext: !!combinedContext,
      crmProcessedAt: crmContext?.processedAt,
      slackProcessedAt: slackContext?.processedAt,
      combinedProcessedAt: combinedContext?.processedAt,
      crmContextLength: crmContext?.context?.length || 0,
      slackContextLength: slackContext?.context?.length || 0,
      combinedContextLength: combinedContext?.context?.length || 0
    };
  }

  /**
   * Clear contexts for an organization
   * @param {string} organizationId - Organization identifier
   */
  clearContexts(organizationId) {
    this.contexts.delete(`${organizationId}_crm_text`);
    this.contexts.delete(`${organizationId}_slack_text`);
    this.contexts.delete(`${organizationId}_combined`);
    
    this.logger.info('Contexts cleared', { organizationId });
  }
}

module.exports = ContextBridge;
