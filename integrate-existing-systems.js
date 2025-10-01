/**
 * Integration Script for Existing CRM and Slack Systems
 * 
 * This script connects your existing CRM analyzer and Slack workflow detection
 * with the new context bridge to provide ultimate chatbot intelligence.
 */

// Load environment variables
require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });

const path = require('path');
const ContextBridge = require('./core/orchestration/context-bridge');

// Import your existing systems
const IntelligentCRMAnalyzer = require('./crm-integration/intelligent-crm-analyzer');
const WorkflowIntelligenceSystem = require('./core/intelligence/workflow-analyzer');

class UltimateContextSystem {
  constructor(options = {}) {
    this.options = {
      logLevel: process.env.LOG_LEVEL || 'info',
      ...options
    };
    
    // Initialize components
    this.crmAnalyzer = new IntelligentCRMAnalyzer({
      logLevel: this.options.logLevel
    });
    
    this.workflowIntelligence = new WorkflowIntelligenceSystem({
      logLevel: this.options.logLevel
    });
    
    this.contextBridge = new ContextBridge({
      logLevel: this.options.logLevel
    });
    
    const winston = require('winston');
    this.logger = winston.createLogger({
      level: this.options.logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/ultimate-context-system.log' })
      ],
      defaultMeta: { service: 'ultimate-context-system' }
    });
  }

  /**
   * Initialize persistent CRM context for an organization (one-time setup)
   * @param {string} websiteUrl - Company website URL
   * @param {Object} crmConfig - CRM configuration
   * @param {string} organizationId - Organization identifier
   * @returns {Promise<Object>} Persistent CRM context
   */
  async initializePersistentCRMContext(websiteUrl, crmConfig, organizationId) {
    try {
      this.logger.info('Initializing persistent CRM context', { 
        websiteUrl, 
        organizationId 
      });
      
      // Step 1: Run your existing CRM analysis (one-time for organization)
      this.logger.info('Step 1: Running CRM analysis...');
      const crmResults = await this.crmAnalyzer.analyzeCompanyWorkflows(websiteUrl, crmConfig, { organizationId });
      
      if (!crmResults) {
        throw new Error('CRM analysis failed: No results returned');
      }
      
      this.logger.info('CRM analysis completed', { 
        patternsFound: crmResults.patterns?.length || 0,
        recommendationsGenerated: crmResults.recommendations?.length || 0
      });
      
      // Step 2: Convert CRM JSON to persistent AI context
      this.logger.info('Step 2: Converting CRM analysis to persistent AI context...');
      const crmContext = await this.contextBridge.convertCRMToPersistentContext(
        crmResults, 
        organizationId
      );
      
      this.logger.info('Persistent CRM context initialized', { organizationId });
      
      return {
        success: true,
        organizationId,
        crm_analysis: crmResults,
        crm_context: crmContext,
        metadata: {
          processed_at: new Date(),
          crm_patterns: crmResults.patterns?.length || 0,
          crm_context_length: crmContext.context.length,
          type: 'persistent_crm_context'
        }
      };
      
    } catch (error) {
      this.logger.error('Complete intelligence pipeline failed', { 
        error: error.message, 
        organizationId 
      });
      throw error;
    }
  }

  /**
   * Process chat session with fresh Slack data and persistent CRM context
   * @param {string} organizationId - Organization identifier
   * @param {string} sessionId - Chat session identifier
   * @param {Array} freshSlackWorkflows - Latest Slack workflow data from your bot
   * @returns {Promise<Object>} Session-ready context
   */
  async processSessionWithFreshSlack(organizationId, sessionId, freshSlackWorkflows = null) {
    try {
      this.logger.info('Processing chat session with fresh Slack data', { 
        organizationId, 
        sessionId,
        slackWorkflowCount: freshSlackWorkflows?.length || 0
      });
      
      // Get fresh Slack workflows if not provided
      if (!freshSlackWorkflows) {
        freshSlackWorkflows = await this.gatherSlackWorkflows(organizationId);
      }
      
      // Convert fresh Slack data to dynamic context
      this.logger.info('Converting fresh Slack workflows to dynamic context...');
      const slackContext = await this.contextBridge.refreshSlackContext(
        freshSlackWorkflows, 
        organizationId, 
        sessionId
      );
      
      // Combine persistent CRM context with fresh Slack context
      this.logger.info('Combining persistent CRM with dynamic Slack context...');
      const combinedContext = await this.contextBridge.combineContextsForSession(
        organizationId, 
        sessionId
      );
      
      this.logger.info('Session context ready', { organizationId, sessionId });
      
      return {
        success: true,
        organizationId,
        sessionId,
        slack_context: slackContext,
        combined_context: combinedContext,
        metadata: {
          processed_at: new Date(),
          slack_workflows: freshSlackWorkflows.length,
          slack_context_length: slackContext.context.length,
          combined_context_length: combinedContext.context.length,
          type: 'session_context'
        }
      };
      
    } catch (error) {
      this.logger.error('Session processing failed', { 
        error: error.message, 
        organizationId,
        sessionId
      });
      throw error;
    }
  }

  /**
   * Generate AI recommendations using session-specific ultimate context
   * @param {string} organizationId - Organization identifier
   * @param {string} userQuery - User's question or request
   * @param {string} sessionId - Chat session identifier
   * @returns {Promise<Object>} AI-driven recommendations
   */
  async generateIntelligentRecommendations(organizationId, userQuery, sessionId = 'default') {
    try {
      this.logger.info('Generating intelligent recommendations', { 
        organizationId, 
        userQuery 
      });
      
      const recommendations = await this.contextBridge.generateRecommendationsForSession(
        organizationId, 
        userQuery,
        sessionId
      );
      
      this.logger.info('Intelligent recommendations generated', { 
        organizationId,
        recommendationLength: recommendations.recommendations.length
      });
      
      return {
        success: true,
        recommendations,
        organizationId
      };
      
    } catch (error) {
      this.logger.error('Recommendation generation failed', { 
        error: error.message, 
        organizationId 
      });
      throw error;
    }
  }

  /**
   * Gather Slack workflow data from your existing WorkflowIntelligenceSystem
   * @param {string} organizationId - Organization identifier
   * @returns {Promise<Array>} Slack workflow data
   */
  async gatherSlackWorkflows(organizationId) {
    try {
      this.logger.info('Gathering Slack workflows from WorkflowIntelligenceSystem', { organizationId });
      
      const workflows = [];
      
      // Access the workflow data from your existing WorkflowIntelligenceSystem
      if (this.workflowIntelligence.userWorkflows && this.workflowIntelligence.userWorkflows.size > 0) {
        // Extract workflows from the WorkflowIntelligenceSystem's internal storage
        for (const [userId, channelMap] of this.workflowIntelligence.userWorkflows) {
          for (const [channelId, dateMap] of channelMap) {
            for (const [dateKey, interactions] of dateMap) {
              workflows.push(...interactions.map(interaction => ({
                ...interaction,
                organizationId,
                extractedAt: new Date(),
                source: 'WorkflowIntelligenceSystem'
              })));
            }
          }
        }
        
        this.logger.info('Real Slack workflows extracted', { 
          organizationId,
          workflowCount: workflows.length,
          userCount: this.workflowIntelligence.userWorkflows.size
        });
        
        return workflows;
      }
      
      // If no real workflows found, return a small sample of realistic mock data
      // This represents the type of data your Slack integration would capture
      const sampleWorkflows = [
        {
          id: 'sample_001',
          userId: 'U12345',
          channelId: 'C67890',
          timestamp: new Date(Date.now() - 86400000), // 1 day ago
          type: 'inbound',
          content: 'Can someone help me update this deal in HubSpot? The contact info changed.',
          context: {
            messageType: 'request',
            urgency: 'medium',
            intent: { intent: 'crm_help', confidence: 0.85 },
            entities: ['deal', 'HubSpot', 'contact info'],
            tools_mentioned: ['HubSpot'],
            sentiment: 'neutral',
            channel_name: 'sales-team'
          }
        },
        {
          id: 'sample_002',
          userId: 'U54321',
          channelId: 'C67890',
          timestamp: new Date(Date.now() - 43200000), // 12 hours ago
          type: 'outbound',
          content: 'Deal updated! Changed the contact email and moved to next stage.',
          context: {
            actionType: 'crm_update',
            completion_status: 'completed',
            success: true,
            tools_used: ['HubSpot'],
            follow_up_needed: false,
            channel_name: 'sales-team'
          }
        },
        {
          id: 'sample_003',
          userId: 'U98765',
          channelId: 'C11111',
          timestamp: new Date(Date.now() - 21600000), // 6 hours ago
          type: 'inbound',
          content: 'The lead qualification process seems slow. Any automation tools we can use?',
          context: {
            messageType: 'process_inquiry',
            urgency: 'low',
            intent: { intent: 'process_optimization', confidence: 0.9 },
            entities: ['lead qualification', 'automation', 'tools'],
            tools_mentioned: [],
            sentiment: 'constructive',
            channel_name: 'process-improvement'
          }
        }
      ];
      
      this.logger.info('Sample Slack workflows provided (no real data found)', { 
        organizationId,
        workflowCount: sampleWorkflows.length,
        note: 'To get real data, ensure your Slack integration is capturing workflows'
      });
      
      return sampleWorkflows;
      
    } catch (error) {
      this.logger.error('Failed to gather Slack workflows', { 
        error: error.message, 
        organizationId 
      });
      return [];
    }
  }

  /**
   * Get ultimate context for an organization
   * @param {string} organizationId - Organization identifier
   * @returns {Object} Ultimate context
   */
  getUltimateContext(organizationId) {
    return this.contextBridge.getUltimateContext(organizationId);
  }

  /**
   * Get context summary for an organization
   * @param {string} organizationId - Organization identifier
   * @returns {Object} Context summary
   */
  getContextSummary(organizationId) {
    return this.contextBridge.getContextSummary(organizationId);
  }
}

/**
 * Example usage function
 */
async function exampleUsage() {
  console.log('🚀 Ultimate Context System Integration Example\n');
  
  try {
    // Initialize the system
    const system = new UltimateContextSystem({
      logLevel: 'info'
    });
    
    const organizationId = 'example_org_123';
    const websiteUrl = 'https://example.com';
    const crmConfig = {
      type: 'hubspot',
      organization_id: organizationId,
      access_token: process.env.HUBSPOT_API_KEY
    };
    
    console.log('📊 Processing complete business intelligence...');
    const results = await system.processCompleteIntelligence(websiteUrl, crmConfig, organizationId);
    
    console.log('✅ Complete intelligence processed!');
    console.log('   - CRM patterns found:', results.metadata.crm_patterns);
    console.log('   - Slack workflows processed:', results.metadata.slack_workflows);
    console.log('   - CRM context length:', results.metadata.crm_context_length, 'characters');
    console.log('   - Slack context length:', results.metadata.slack_context_length, 'characters');
    console.log('   - Combined context length:', results.metadata.combined_context_length, 'characters');
    
    // Test recommendation generation
    console.log('\n🎯 Testing intelligent recommendations...');
    const recommendations = await system.generateIntelligentRecommendations(
      organizationId, 
      'What should I focus on to improve my sales process?'
    );
    
    console.log('✅ Intelligent recommendations generated!');
    console.log('   - Recommendation length:', recommendations.recommendations.recommendations.length, 'characters');
    console.log('   - Context used:', recommendations.recommendations.contextUsed);
    
    // Show ultimate context
    console.log('\n🧠 Ultimate Context Summary:');
    const ultimateContext = system.getUltimateContext(organizationId);
    console.log('   - Has CRM context:', ultimateContext.metadata.hasCRMContext);
    console.log('   - Has Slack context:', ultimateContext.metadata.hasSlackContext);
    console.log('   - Has combined context:', ultimateContext.metadata.hasCombinedContext);
    console.log('   - Ultimate context preview:', ultimateContext.ultimateContext.substring(0, 200) + '...');
    
    console.log('\n🎉 Ultimate Context System integration completed successfully!');
    
  } catch (error) {
    console.error('❌ Example failed:', error);
  }
}

// Export for use in other modules
module.exports = { UltimateContextSystem, exampleUsage };

// Run example if this file is executed directly
if (require.main === module) {
  exampleUsage().catch(console.error);
}
