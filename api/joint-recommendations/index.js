/**
 * Joint CRM + Slack Recommendations API
 * 
 * This API implements the pipeline from your flowchart:
 * 1. Processes CRM context using Anthropic API
 * 2. Processes Slack workflows using Anthropic API
 * 3. Creates joint context for recommendations
 * 4. Generates context-aware AI recommendations
 * 5. Handles follow-up conversations
 */

const JointContextProcessor = require('../../core/orchestration/joint-context-processor');
const { authenticate, rateLimit } = require('../middleware/auth');

module.exports = async (req, res) => {
  try {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    // Apply authentication middleware
    await new Promise((resolve, reject) => {
      authenticate(req, res, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    // Apply rate limiting
    await new Promise((resolve, reject) => {
      rateLimit({ max: 30, windowMs: 15 * 60 * 1000 })(req, res, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    const { method, query } = req;
    const userId = req.userId;
    const organizationId = req.user?.organization_id || 'default_org';

    // Initialize joint context processor
    const processor = new JointContextProcessor();

    switch (method) {
      case 'GET':
        return await handleGet(req, res, processor, organizationId, query);

      case 'POST':
        return await handlePost(req, res, processor, organizationId);

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }

  } catch (error) {
    console.error('Joint recommendations API error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
};

/**
 * Handle GET requests - fetch context status and recommendations
 */
async function handleGet(req, res, processor, organizationId, query) {
  try {
    const { action } = query;

    switch (action) {
      case 'context_status':
        const contextSummary = processor.getContextSummary(organizationId);
        return res.json({ context: contextSummary });

      case 'recommendation':
        const { recommendation_id } = query;
        if (!recommendation_id) {
          return res.status(400).json({ error: 'recommendation_id is required' });
        }
        
        // Get recommendation details (this would need to be implemented in the processor)
        return res.json({ 
          message: 'Recommendation details not yet implemented',
          recommendation_id 
        });

      default:
        return res.status(400).json({ error: 'Invalid action' });
    }

  } catch (error) {
    console.error('GET error:', error);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
}

/**
 * Handle POST requests - process contexts and generate recommendations
 */
async function handlePost(req, res, processor, organizationId) {
  const { action, crm_data, slack_workflows, user_query, recommendation_id, follow_up_query } = req.body;

  try {
    switch (action) {
      case 'process_crm_context':
        if (!crm_data) {
          return res.status(400).json({ error: 'crm_data is required' });
        }

        const crmContext = await processor.processCRMContext(crm_data, organizationId);
        return res.json({ 
          success: true,
          context: crmContext,
          message: 'CRM context processed successfully'
        });

      case 'process_slack_workflows':
        if (!slack_workflows || !Array.isArray(slack_workflows)) {
          return res.status(400).json({ error: 'slack_workflows array is required' });
        }

        const slackContext = await processor.processSlackWorkflows(slack_workflows, organizationId);
        return res.json({ 
          success: true,
          context: slackContext,
          message: 'Slack workflows processed successfully'
        });

      case 'create_joint_context':
        const jointContext = await processor.createJointContext(organizationId);
        return res.json({ 
          success: true,
          context: jointContext,
          message: 'Joint context created successfully'
        });

      case 'generate_recommendations':
        if (!user_query) {
          return res.status(400).json({ error: 'user_query is required' });
        }

        const recommendations = await processor.generateRecommendations(organizationId, user_query);
        return res.json({ 
          success: true,
          recommendations,
          message: 'Recommendations generated successfully'
        });

      case 'follow_up':
        if (!recommendation_id || !follow_up_query) {
          return res.status(400).json({ error: 'recommendation_id and follow_up_query are required' });
        }

        const followUpResponse = await processor.handleFollowUp(recommendation_id, follow_up_query);
        return res.json({ 
          success: true,
          follow_up: followUpResponse,
          message: 'Follow-up handled successfully'
        });

      case 'process_full_pipeline':
        // Process the complete pipeline in one request
        if (!crm_data || !slack_workflows || !user_query) {
          return res.status(400).json({ 
            error: 'crm_data, slack_workflows, and user_query are required for full pipeline' 
          });
        }

        // Process CRM context
        const processedCRM = await processor.processCRMContext(crm_data, organizationId);
        
        // Process Slack workflows
        const processedSlack = await processor.processSlackWorkflows(slack_workflows, organizationId);
        
        // Create joint context
        const jointContext = await processor.createJointContext(organizationId);
        
        // Generate recommendations
        const recommendations = await processor.generateRecommendations(organizationId, user_query);

        return res.json({ 
          success: true,
          pipeline: {
            crm_context: processedCRM,
            slack_context: processedSlack,
            joint_context: jointContext,
            recommendations
          },
          message: 'Full pipeline processed successfully'
        });

      default:
        return res.status(400).json({ error: 'Invalid action' });
    }

  } catch (error) {
    console.error('POST error:', error);
    res.status(500).json({ 
      error: 'Failed to process request',
      message: error.message 
    });
  }
}
