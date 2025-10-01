/**
 * Workflow Tools API
 * 
 * Integrates workflow analysis with tool execution
 * Provides endpoints for executing tools based on workflow patterns
 */

const ToolExecutor = require('../../core/actions/tool-executor');
const WorkflowIntelligenceSystem = require('../../core/intelligence/workflow-analyzer');
const { authenticate } = require('../middleware/auth');

let toolExecutor = null;
let workflowIntelligence = null;

module.exports = async (req, res) => {
  try {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    // Initialize systems
    if (!toolExecutor) {
      toolExecutor = new ToolExecutor();
    }
    if (!workflowIntelligence) {
      workflowIntelligence = new WorkflowIntelligenceSystem();
    }

    // Authentication
    await new Promise((resolve, reject) => {
      authenticate(req, res, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    const { method } = req;
    const { action } = req.query;
    const userId = req.userId;
    const userContext = {
      userId,
      userName: req.user?.name || req.user?.real_name,
      userRole: req.user?.is_admin ? 'admin' : 'member',
      slackUserId: req.user?.slack_user_id
    };

    switch (method) {
      case 'GET':
        return await handleGetRequest(req, res, action, toolExecutor, workflowIntelligence, userContext);
      
      case 'POST':
        return await handlePostRequest(req, res, action, toolExecutor, workflowIntelligence, userContext);
      
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }

  } catch (error) {
    console.error('Workflow tools API error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
};

/**
 * Handle GET requests
 */
async function handleGetRequest(req, res, action, toolExecutor, workflowIntelligence, userContext) {
  switch (action) {
    case 'tools':
      // Get available tools
      const tools = toolExecutor.getAvailableTools();
      return res.json({
        tools: tools,
        count: tools.length,
        categories: [...new Set(tools.map(t => t.category))]
      });

    case 'status':
      // Get execution status
      const status = toolExecutor.getExecutionStatus();
      return res.json({
        status: 'active',
        execution_status: status,
        workflow_intelligence: 'active'
      });

    case 'recent-executions':
      // Get recent tool executions (mock for now)
      return res.json({
        executions: [
          {
            id: 'exec_1',
            workflow_id: 'wf_123',
            tools_used: ['web_search', 'email_draft'],
            status: 'completed',
            executed_at: new Date(Date.now() - 3600000)
          }
        ],
        count: 1
      });

    case 'workflow-patterns':
      // Get user workflow patterns
      try {
        const patterns = await workflowIntelligence.analyzeUserPatterns(userContext.userId, 7);
        return res.json({
          patterns: patterns,
          user_id: userContext.userId,
          analysis_period: 7
        });
      } catch (error) {
        return res.status(500).json({
          error: 'Failed to analyze workflow patterns',
          message: error.message
        });
      }

    default:
      return res.json({
        status: 'workflow_tools_api_ready',
        available_actions: ['tools', 'status', 'recent-executions', 'workflow-patterns'],
        endpoints: {
          'GET /api/workflow-tools?action=tools': 'Get available tools',
          'GET /api/workflow-tools?action=status': 'Get system status',
          'GET /api/workflow-tools?action=recent-executions': 'Get recent executions',
          'GET /api/workflow-tools?action=workflow-patterns': 'Get workflow patterns',
          'POST /api/workflow-tools?action=execute': 'Execute workflow tools',
          'POST /api/workflow-tools?action=analyze': 'Analyze message for tools'
        }
      });
  }
}

/**
 * Handle POST requests
 */
async function handlePostRequest(req, res, action, toolExecutor, workflowIntelligence, userContext) {
  switch (action) {
    case 'execute':
      return await executeWorkflowTools(req, res, toolExecutor, workflowIntelligence, userContext);
    
    case 'analyze':
      return await analyzeMessageForTools(req, res, toolExecutor, workflowIntelligence, userContext);
    
    case 'execute-tool':
      return await executeSingleTool(req, res, toolExecutor, userContext);
    
    default:
      return res.status(400).json({
        error: 'Invalid action',
        available_actions: ['execute', 'analyze', 'execute-tool']
      });
  }
}

/**
 * Execute workflow tools based on message/request
 */
async function executeWorkflowTools(req, res, toolExecutor, workflowIntelligence, userContext) {
  try {
    const { message, channelId, workflowId, context } = req.body;

    if (!message) {
      return res.status(400).json({ 
        error: 'Message is required for workflow execution' 
      });
    }

    console.log('🔧 Executing workflow tools for message:', message.substring(0, 100) + '...');

    // Capture inbound request in workflow intelligence
    const workflowData = await workflowIntelligence.captureInboundRequest(
      userContext.userId,
      channelId || 'direct',
      message,
      {
        source: 'chat_api',
        workflow_id: workflowId,
        ...context
      }
    );

    // Execute tools based on workflow analysis
    const executionResult = await toolExecutor.executeFromWorkflow(workflowData, userContext);

    if (executionResult.success) {
      console.log('✅ Workflow tools executed successfully:', {
        workflow_id: executionResult.workflow_id,
        tools_used: executionResult.tools_executed
      });

      return res.json({
        success: true,
        workflow_id: executionResult.workflow_id,
        tools_executed: executionResult.tools_executed,
        execution_time: executionResult.execution_time,
        output: executionResult.output,
        results: executionResult.results,
        message: 'Workflow tools executed successfully'
      });
    } else {
      return res.status(500).json({
        success: false,
        error: executionResult.error,
        workflow_id: executionResult.workflow_id,
        message: 'Workflow tool execution failed'
      });
    }

  } catch (error) {
    console.error('Workflow execution error:', error);
    return res.status(500).json({
      error: 'Workflow execution failed',
      message: error.message
    });
  }
}

/**
 * Analyze message for potential tool usage
 */
async function analyzeMessageForTools(req, res, toolExecutor, workflowIntelligence, userContext) {
  try {
    const { message, channelId, context } = req.body;

    if (!message) {
      return res.status(400).json({ 
        error: 'Message is required for analysis' 
      });
    }

    console.log('🔍 Analyzing message for tools:', message.substring(0, 100) + '...');

    // Create temporary workflow data for analysis
    const workflowData = {
      id: `temp_${Date.now()}`,
      userId: userContext.userId,
      channelId: channelId || 'direct',
      content: message,
      timestamp: new Date(),
      type: 'inbound',
      context: context || {}
    };

    // Analyze for tool recommendations
    const recommendations = await toolExecutor.analyzeWorkflowForTools(workflowData);

    return res.json({
      message: message,
      recommendations: recommendations,
      tool_count: recommendations.length,
      analysis_timestamp: new Date(),
      can_execute: recommendations.length > 0
    });

  } catch (error) {
    console.error('Message analysis error:', error);
    return res.status(500).json({
      error: 'Message analysis failed',
      message: error.message
    });
  }
}

/**
 * Execute a single tool directly
 */
async function executeSingleTool(req, res, toolExecutor, userContext) {
  try {
    const { toolId, inputs, context } = req.body;

    if (!toolId) {
      return res.status(400).json({ 
        error: 'Tool ID is required' 
      });
    }

    console.log('🛠️ Executing single tool:', toolId);

    const result = await toolExecutor.executeTool(toolId, inputs || {}, {
      userContext,
      ...context
    });

    return res.json({
      success: true,
      tool_id: toolId,
      result: result,
      executed_at: new Date(),
      message: 'Tool executed successfully'
    });

  } catch (error) {
    console.error('Single tool execution error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      tool_id: req.body.toolId,
      message: 'Tool execution failed'
    });
  }
}
