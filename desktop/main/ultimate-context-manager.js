/**
 * Ultimate Context Manager for Electron Desktop App
 * 
 * This module integrates your existing CRM and Slack systems with the new context bridge
 * to provide ultimate business intelligence for the desktop chat interface.
 */

// Load environment variables
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const EventEmitter = require('events');
const winston = require('winston');
const path = require('path');

// Import the ultimate context system
const { UltimateContextSystem } = require('../../integrate-existing-systems');

class UltimateContextManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      logLevel: process.env.LOG_LEVEL || 'info',
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
        new winston.transports.File({ filename: 'logs/ultimate-context-manager.log' })
      ],
      defaultMeta: { service: 'ultimate-context-manager' }
    });
    
    // Initialize the ultimate context system
    this.ultimateSystem = new UltimateContextSystem({
      logLevel: this.options.logLevel
    });
    
    // Context cache
    this.contextCache = new Map();
    this.isProcessing = false;
  }

  /**
   * Initialize the ultimate context system
   * @param {string} organizationId - Organization identifier
   * @param {Object} crmConfig - CRM configuration
   * @returns {Promise<Object>} Initialization result
   */
  async initialize(organizationId, crmConfig) {
    try {
      this.logger.info('Initializing ultimate context system', { organizationId });
      
      // Check if we already have context for this organization
      if (this.contextCache.has(organizationId)) {
        this.logger.info('Context already exists for organization', { organizationId });
        return {
          success: true,
          organizationId,
          context: this.contextCache.get(organizationId),
          fromCache: true
        };
      }
      
      // Process complete intelligence pipeline
      const results = await this.processCompleteIntelligence(organizationId, crmConfig);
      
      // Cache the results
      this.contextCache.set(organizationId, results);
      
      this.emit('context_ready', { organizationId, results });
      
      return {
        success: true,
        organizationId,
        context: results,
        fromCache: false
      };
      
    } catch (error) {
      this.logger.error('Failed to initialize ultimate context system', { 
        error: error.message, 
        organizationId 
      });
      throw error;
    }
  }

  /**
   * Process complete business intelligence pipeline
   * @param {string} organizationId - Organization identifier
   * @param {Object} crmConfig - CRM configuration
   * @returns {Promise<Object>} Complete business intelligence
   */
  async processCompleteIntelligence(organizationId, crmConfig) {
    try {
      if (this.isProcessing) {
        this.logger.warn('Already processing intelligence, skipping duplicate request');
        return null;
      }
      
      this.isProcessing = true;
      this.logger.info('Processing complete business intelligence', { organizationId });
      
      // Initialize persistent CRM context (one-time setup per organization)
      const result = await this.ultimateSystem.initializePersistentCRMContext(
        crmConfig.website_url,
        crmConfig,
        organizationId
      );
      
      // Cache the persistent CRM context
      this.contextCache.set(organizationId, result);
      
      this.isProcessing = false;
      return result;
      
    } catch (error) {
      this.isProcessing = false;
      this.logger.error('Complete intelligence pipeline failed', { 
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
      
      // Access the workflow data from your existing WorkflowIntelligenceSystem
      // This would need to be implemented based on how you store workflow data
      
      // For now, we'll create a method to extract workflows from the system
      const workflows = [];
      
      // Get workflows from the WorkflowIntelligenceSystem's internal storage
      if (this.workflowIntelligence.userWorkflows) {
        for (const [userId, channelMap] of this.workflowIntelligence.userWorkflows) {
          for (const [channelId, dateMap] of channelMap) {
            for (const [dateKey, interactions] of dateMap) {
              workflows.push(...interactions.map(interaction => ({
                ...interaction,
                organizationId,
                extractedAt: new Date()
              })));
            }
          }
        }
      }
      
      this.logger.info('Slack workflows gathered', { 
        organizationId,
        workflowCount: workflows.length
      });
      
      return workflows;
      
    } catch (error) {
      this.logger.error('Failed to gather Slack workflows', { 
        error: error.message, 
        organizationId 
      });
      return [];
    }
  }

  /**
   * Process a chat session with fresh Slack data
   * @param {string} organizationId - Organization identifier
   * @param {string} sessionId - Chat session identifier
   * @param {Array} freshSlackWorkflows - Latest Slack workflow data
   * @returns {Promise<Object>} Session context result
   */
  async processSession(organizationId, sessionId, freshSlackWorkflows = null) {
    try {
      this.logger.info('Processing chat session', { organizationId, sessionId });
      
      // Process session with fresh Slack data
      const result = await this.ultimateSystem.processSessionWithFreshSlack(
        organizationId,
        sessionId,
        freshSlackWorkflows
      );
      
      this.logger.info('Session processed successfully', { 
        organizationId, 
        sessionId,
        slackWorkflows: result.metadata.slack_workflows
      });
      
      return result;
      
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
  async generateRecommendations(organizationId, userQuery, sessionId = 'default') {
    try {
      this.logger.info('Generating recommendations from ultimate context', { 
        organizationId, 
        userQuery 
      });
      
      // Check if we have context for this organization
      if (!this.contextCache.has(organizationId)) {
        throw new Error(`No context found for organization: ${organizationId}`);
      }
      
      const recommendations = await this.ultimateSystem.generateIntelligentRecommendations(
        organizationId, 
        userQuery,
        sessionId
      );
      
      this.logger.info('Recommendations generated successfully', { 
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
   * Get ultimate context for an organization
   * @param {string} organizationId - Organization identifier
   * @returns {Object} Ultimate context
   */
  getUltimateContext(organizationId) {
    if (!this.contextCache.has(organizationId)) {
      throw new Error(`No context found for organization: ${organizationId}`);
    }
    
    return this.contextCache.get(organizationId).ultimate_context;
  }

  /**
   * Get context summary for an organization
   * @param {string} organizationId - Organization identifier
   * @returns {Object} Context summary
   */
  getContextSummary(organizationId) {
    if (!this.contextCache.has(organizationId)) {
      return {
        organizationId,
        hasContext: false,
        error: 'No context found'
      };
    }
    
    const context = this.contextCache.get(organizationId);
    return {
      organizationId,
      hasContext: true,
      hasCRMContext: !!context.crm_context,
      hasSlackContext: !!context.slack_context,
      hasCombinedContext: !!context.combined_context,
      hasUltimateContext: !!context.ultimate_context,
      metadata: context.metadata
    };
  }

  /**
   * Refresh context for an organization
   * @param {string} organizationId - Organization identifier
   * @param {Object} crmConfig - CRM configuration
   * @returns {Promise<Object>} Refreshed context
   */
  async refreshContext(organizationId, crmConfig) {
    try {
      this.logger.info('Refreshing context for organization', { organizationId });
      
      // Clear existing context
      this.contextCache.delete(organizationId);
      
      // Process new intelligence
      const results = await this.processCompleteIntelligence(organizationId, crmConfig);
      
      // Cache the new results
      this.contextCache.set(organizationId, results);
      
      this.emit('context_refreshed', { organizationId, results });
      
      return {
        success: true,
        organizationId,
        context: results
      };
      
    } catch (error) {
      this.logger.error('Failed to refresh context', { 
        error: error.message, 
        organizationId 
      });
      throw error;
    }
  }

  /**
   * Clear context for an organization
   * @param {string} organizationId - Organization identifier
   */
  clearContext(organizationId) {
    this.contextCache.delete(organizationId);
    this.contextBridge.clearContexts(organizationId);
    
    this.logger.info('Context cleared', { organizationId });
    this.emit('context_cleared', { organizationId });
  }

  /**
   * Get all cached organizations
   * @returns {Array} List of organization IDs with cached context
   */
  getCachedOrganizations() {
    return Array.from(this.contextCache.keys());
  }
}

module.exports = UltimateContextManager;
