/**
 * CRM + Slack Pipeline Integration Script
 * 
 * This script integrates your existing CRM analyzer with the new joint context processor
 * to implement the complete pipeline from your flowchart.
 */

// Load environment variables
require('dotenv').config();

const path = require('path');
const JointContextProcessor = require('./core/orchestration/joint-context-processor');

// Import your existing CRM analyzer
const IntelligentCRMAnalyzer = require('./crm-integration/intelligent-crm-analyzer');

class CRMPlusSlackPipeline {
  constructor(options = {}) {
    this.options = {
      logLevel: process.env.LOG_LEVEL || 'info',
      ...options
    };
    
    // Initialize components
    this.crmAnalyzer = new IntelligentCRMAnalyzer({
      logLevel: this.options.logLevel
    });
    
    this.jointProcessor = new JointContextProcessor({
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
        new winston.transports.File({ filename: 'logs/crm-slack-pipeline.log' })
      ],
      defaultMeta: { service: 'crm-slack-pipeline' }
    });
  }

  /**
   * Run the complete pipeline for an organization
   * @param {string} organizationId - Organization identifier
   * @param {string} websiteUrl - Company website URL
   * @param {Array} slackWorkflows - Slack workflow data
   * @returns {Promise<Object>} Complete pipeline results
   */
  async runCompletePipeline(organizationId, websiteUrl, slackWorkflows = []) {
    try {
      this.logger.info('Starting complete CRM + Slack pipeline', { organizationId, websiteUrl });
      
      // Step 1: Run CRM analysis using your existing analyzer
      this.logger.info('Step 1: Running CRM analysis...');
      const crmResults = await this.crmAnalyzer.runIntelligentAnalysis(websiteUrl, organizationId);
      
      if (!crmResults.success) {
        throw new Error(`CRM analysis failed: ${crmResults.error}`);
      }
      
      this.logger.info('CRM analysis completed', { 
        patternsFound: crmResults.patterns?.length || 0,
        recommendationsGenerated: crmResults.recommendations?.length || 0
      });
      
      // Step 2: Process CRM context through joint processor
      this.logger.info('Step 2: Processing CRM context...');
      const processedCRMContext = await this.jointProcessor.processCRMContext(
        crmResults.analysis_report, 
        organizationId
      );
      
      // Step 3: Process Slack workflows through joint processor
      this.logger.info('Step 3: Processing Slack workflows...');
      const processedSlackContext = await this.jointProcessor.processSlackWorkflows(
        slackWorkflows, 
        organizationId
      );
      
      // Step 4: Create joint context
      this.logger.info('Step 4: Creating joint context...');
      const jointContext = await this.jointProcessor.createJointContext(organizationId);
      
      this.logger.info('Pipeline completed successfully', { organizationId });
      
      return {
        success: true,
        organizationId,
        pipeline: {
          crm_analysis: crmResults,
          crm_context: processedCRMContext,
          slack_context: processedSlackContext,
          joint_context: jointContext
        },
        metadata: {
          processed_at: new Date(),
          crm_patterns: crmResults.patterns?.length || 0,
          slack_workflows: slackWorkflows.length,
          joint_opportunities: jointContext.integrated_recommendations?.length || 0
        }
      };
      
    } catch (error) {
      this.logger.error('Pipeline failed', { error: error.message, organizationId });
      throw error;
    }
  }

  /**
   * Generate recommendations using the joint context
   * @param {string} organizationId - Organization identifier
   * @param {string} userQuery - User's recommendation request
   * @returns {Promise<Object>} AI-driven recommendations
   */
  async generateRecommendations(organizationId, userQuery) {
    try {
      this.logger.info('Generating recommendations', { organizationId, userQuery });
      
      const recommendations = await this.jointProcessor.generateRecommendations(
        organizationId, 
        userQuery
      );
      
      this.logger.info('Recommendations generated', { 
        organizationId,
        recommendationId: recommendations.recommendationId,
        recommendationCount: recommendations.recommendations?.length || 0
      });
      
      return {
        success: true,
        recommendations,
        organizationId
      };
      
    } catch (error) {
      this.logger.error('Recommendation generation failed', { error: error.message, organizationId });
      throw error;
    }
  }

  /**
   * Handle follow-up questions
   * @param {string} recommendationId - ID of the original recommendation
   * @param {string} followUpQuery - User's follow-up question
   * @returns {Promise<Object>} Follow-up response
   */
  async handleFollowUp(recommendationId, followUpQuery) {
    try {
      this.logger.info('Handling follow-up', { recommendationId, followUpQuery });
      
      const followUpResponse = await this.jointProcessor.handleFollowUp(
        recommendationId, 
        followUpQuery
      );
      
      this.logger.info('Follow-up handled', { 
        recommendationId,
        responseLength: followUpResponse.response.length
      });
      
      return {
        success: true,
        followUp: followUpResponse
      };
      
    } catch (error) {
      this.logger.error('Follow-up handling failed', { error: error.message, recommendationId });
      throw error;
    }
  }

  /**
   * Get pipeline status for an organization
   * @param {string} organizationId - Organization identifier
   * @returns {Object} Pipeline status
   */
  getPipelineStatus(organizationId) {
    return this.jointProcessor.getContextSummary(organizationId);
  }
}

/**
 * Example usage function
 */
async function exampleUsage() {
  console.log('🚀 CRM + Slack Pipeline Integration Example\n');
  
  // Check if Anthropic API key is available
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY not found in environment variables');
    console.log('Please add ANTHROPIC_API_KEY to your .env file');
    console.log('Example: ANTHROPIC_API_KEY=your_api_key_here');
    process.exit(1);
  }
  
  try {
    // Initialize the pipeline
    const pipeline = new CRMPlusSlackPipeline({
      logLevel: 'info'
    });
    
    const organizationId = 'example_org_123';
    const websiteUrl = 'https://example.com';
    
    // Mock Slack workflows (in real usage, this would come from your Slack integration)
    const mockSlackWorkflows = [
      {
        workflow_id: 'slack_001',
        organization_id: organizationId,
        type: 'lead_notification',
        participants: ['sales_team'],
        duration_days: 1,
        efficiency_score: 0.7,
        bottlenecks: ['Manual CRM updates'],
        automation_potential: 'High'
      }
    ];
    
    console.log('📊 Running complete pipeline...');
    const results = await pipeline.runCompletePipeline(organizationId, websiteUrl, mockSlackWorkflows);
    
    console.log('✅ Pipeline completed successfully!');
    console.log('   - CRM patterns found:', results.metadata.crm_patterns);
    console.log('   - Slack workflows processed:', results.metadata.slack_workflows);
    console.log('   - Joint opportunities identified:', results.metadata.joint_opportunities);
    
    // Test recommendation generation
    console.log('\n🎯 Testing recommendation generation...');
    const recommendations = await pipeline.generateRecommendations(
      organizationId, 
      'What tools should I use to automate my sales process?'
    );
    
    console.log('✅ Recommendations generated!');
    console.log('   - Recommendation ID:', recommendations.recommendations.recommendationId);
    console.log('   - Number of recommendations:', recommendations.recommendations.recommendations?.length || 0);
    
    // Test follow-up
    if (recommendations.recommendations.follow_up_questions?.length > 0) {
      console.log('\n💬 Testing follow-up...');
      const followUp = await pipeline.handleFollowUp(
        recommendations.recommendations.recommendationId,
        recommendations.recommendations.follow_up_questions[0]
      );
      
      console.log('✅ Follow-up handled!');
      console.log('   - Response length:', followUp.followUp.response.length, 'characters');
    }
    
    console.log('\n🎉 Integration example completed successfully!');
    
  } catch (error) {
    console.error('❌ Example failed:', error);
  }
}

// Export for use in other modules
module.exports = { CRMPlusSlackPipeline, exampleUsage };

// Run example if this file is executed directly
if (require.main === module) {
  exampleUsage().catch(console.error);
}
