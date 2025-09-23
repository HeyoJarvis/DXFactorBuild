/**
 * Workflow Analytics API Server
 * 
 * Provides REST API endpoints for workflow intelligence data:
 * 1. User workflow analytics
 * 2. Team productivity metrics  
 * 3. Insight management
 * 4. Real-time workflow monitoring
 */

const express = require('express');
const cors = require('cors');
const winston = require('winston');
const WorkflowIntelligenceSystem = require('../../core/intelligence/workflow-analyzer');

class WorkflowAnalyticsAPI {
  constructor(options = {}) {
    this.options = {
      port: process.env.ANALYTICS_PORT || 3001,
      logLevel: process.env.LOG_LEVEL || 'info',
      corsOrigin: process.env.CORS_ORIGIN || '*',
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
        new winston.transports.File({ filename: 'logs/workflow-analytics-api.log' })
      ],
      defaultMeta: { service: 'workflow-analytics-api' }
    });
    
    // Initialize Workflow Intelligence System
    this.workflowIntelligence = new WorkflowIntelligenceSystem({
      logLevel: this.options.logLevel
    });
    
    // Initialize Express app
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * Setup Express middleware
   */
  setupMiddleware() {
    // CORS
    this.app.use(cors({
      origin: this.options.corsOrigin,
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization']
    }));
    
    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // Request logging
    this.app.use((req, res, next) => {
      this.logger.debug('API Request', {
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      next();
    });
    
    // Error handling
    this.app.use((err, req, res, next) => {
      this.logger.error('API Error', {
        error: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method
      });
      
      res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
      });
    });
  }

  /**
   * Setup API routes
   */
  setupRoutes() {
    // Health check
    this.app.get('/api/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'workflow-analytics-api',
        version: '1.0.0'
      });
    });

    // User workflow analytics (with access control)
    this.app.get('/api/users/:userId/analytics', async (req, res) => {
      try {
        const { userId } = req.params;
        const days = parseInt(req.query.days) || 7;
        const includeInsights = req.query.include_insights === 'true';
        const requestingUserId = req.headers['x-user-id']; // Get from header or JWT token
        const sessionId = req.headers['x-session-id'];
        
        if (!requestingUserId) {
          return res.status(401).json({ error: 'Missing user authentication' });
        }
        
        const analytics = await this.workflowIntelligence.getUserWorkflowAnalytics(
          userId, 
          days, 
          requestingUserId, 
          sessionId
        );
        
        const response = {
          user_id: userId,
          requesting_user: requestingUserId,
          analytics,
          generated_at: new Date().toISOString()
        };
        
        if (includeInsights) {
          response.insights = await this.workflowIntelligence.getUserActionableInsights(
            userId, 
            10, 
            requestingUserId, 
            sessionId
          );
        }
        
        res.json(response);
        
      } catch (error) {
        this.logger.error('User analytics error', { 
          error: error.message, 
          userId: req.params.userId,
          requestingUserId: req.headers['x-user-id']
        });
        
        if (error.message.includes('Access denied')) {
          res.status(403).json({ error: error.message });
        } else {
          res.status(500).json({ error: 'Failed to retrieve user analytics' });
        }
      }
    });

    // User insights
    this.app.get('/api/users/:userId/insights', async (req, res) => {
      try {
        const { userId } = req.params;
        const limit = parseInt(req.query.limit) || 10;
        const includeCompleted = req.query.include_completed === 'true';
        
        let insights = await this.workflowIntelligence.getUserActionableInsights(userId, limit);
        
        if (includeCompleted) {
          // Get all insights including completed ones (would need modification to workflow analyzer)
          insights = insights.concat(
            (this.workflowIntelligence.actionableInsights.get(userId) || [])
              .filter(insight => insight.completed)
              .slice(0, 5)
          );
        }
        
        res.json({
          user_id: userId,
          insights,
          total_count: insights.length,
          generated_at: new Date().toISOString()
        });
        
      } catch (error) {
        this.logger.error('User insights error', { error: error.message, userId: req.params.userId });
        res.status(500).json({ error: 'Failed to retrieve user insights' });
      }
    });

    // Mark insight as completed
    this.app.post('/api/users/:userId/insights/:insightId/complete', async (req, res) => {
      try {
        const { userId, insightId } = req.params;
        
        await this.workflowIntelligence.markInsightCompleted(userId, insightId);
        
        res.json({
          success: true,
          message: 'Insight marked as completed',
          completed_at: new Date().toISOString()
        });
        
      } catch (error) {
        this.logger.error('Complete insight error', { error: error.message, userId: req.params.userId });
        res.status(500).json({ error: 'Failed to complete insight' });
      }
    });

    // Dismiss insight
    this.app.post('/api/users/:userId/insights/:insightId/dismiss', async (req, res) => {
      try {
        const { userId, insightId } = req.params;
        
        await this.workflowIntelligence.dismissInsight(userId, insightId);
        
        res.json({
          success: true,
          message: 'Insight dismissed',
          dismissed_at: new Date().toISOString()
        });
        
      } catch (error) {
        this.logger.error('Dismiss insight error', { error: error.message, userId: req.params.userId });
        res.status(500).json({ error: 'Failed to dismiss insight' });
      }
    });

    // Record workflow event (for external integrations)
    this.app.post('/api/users/:userId/events', async (req, res) => {
      try {
        const { userId } = req.params;
        const { type, data, context = {} } = req.body;
        
        if (!type || !data) {
          return res.status(400).json({ error: 'Missing required fields: type, data' });
        }
        
        let result;
        
        if (type === 'inbound') {
          result = await this.workflowIntelligence.captureInboundRequest(
            userId,
            context.channelId || 'api',
            data.message || JSON.stringify(data),
            {
              ...context,
              source: 'api',
              timestamp: new Date()
            }
          );
        } else if (type === 'outbound') {
          result = await this.workflowIntelligence.captureOutboundAction(
            userId,
            context.channelId || 'api',
            data,
            {
              ...context,
              source: 'api',
              timestamp: new Date()
            }
          );
        } else {
          return res.status(400).json({ error: 'Invalid event type. Must be "inbound" or "outbound"' });
        }
        
        res.json({
          success: true,
          event_id: result.id,
          message: 'Event recorded successfully'
        });
        
      } catch (error) {
        this.logger.error('Record event error', { error: error.message, userId: req.params.userId });
        res.status(500).json({ error: 'Failed to record event' });
      }
    });

    // Team analytics (with access control)
    this.app.get('/api/team/analytics', async (req, res) => {
      try {
        const days = parseInt(req.query.days) || 7;
        const requestingUserId = req.headers['x-user-id'];
        const sessionId = req.headers['x-session-id'];
        
        if (!requestingUserId) {
          return res.status(401).json({ error: 'Missing user authentication' });
        }
        
        const teamData = await this.workflowIntelligence.getFilteredTeamAnalytics(
          requestingUserId, 
          days, 
          sessionId
        );
        
        res.json({
          requesting_user: requestingUserId,
          team_analytics: teamData,
          period_days: days,
          generated_at: new Date().toISOString()
        });
        
      } catch (error) {
        this.logger.error('Team analytics error', { 
          error: error.message, 
          requestingUserId: req.headers['x-user-id'] 
        });
        
        if (error.message.includes('Access denied')) {
          res.status(403).json({ error: error.message });
        } else {
          res.status(500).json({ error: 'Failed to retrieve team analytics' });
        }
      }
    });

    // Popular tools across team
    this.app.get('/api/team/tools', async (req, res) => {
      try {
        const toolData = this.aggregateTeamToolUsage();
        
        res.json({
          tool_usage: toolData,
          generated_at: new Date().toISOString()
        });
        
      } catch (error) {
        this.logger.error('Team tools error', { error: error.message });
        res.status(500).json({ error: 'Failed to retrieve team tool usage' });
      }
    });

    // Top workflow patterns across team
    this.app.get('/api/team/patterns', async (req, res) => {
      try {
        const patterns = this.aggregateTeamPatterns();
        
        res.json({
          workflow_patterns: patterns,
          generated_at: new Date().toISOString()
        });
        
      } catch (error) {
        this.logger.error('Team patterns error', { error: error.message });
        res.status(500).json({ error: 'Failed to retrieve team patterns' });
      }
    });

    // Real-time workflow monitoring
    this.app.get('/api/monitoring/realtime', async (req, res) => {
      try {
        const realtimeData = this.getRealtimeMetrics();
        
        res.json({
          realtime_metrics: realtimeData,
          timestamp: new Date().toISOString()
        });
        
      } catch (error) {
        this.logger.error('Realtime monitoring error', { error: error.message });
        res.status(500).json({ error: 'Failed to retrieve realtime metrics' });
      }
    });

    // Export user data
    this.app.get('/api/users/:userId/export', async (req, res) => {
      try {
        const { userId } = req.params;
        const format = req.query.format || 'json';
        const days = parseInt(req.query.days) || 30;
        
        const exportData = await this.exportUserData(userId, days);
        
        if (format === 'csv') {
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', `attachment; filename="workflow-data-${userId}.csv"`);
          res.send(this.convertToCSV(exportData));
        } else {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Content-Disposition', `attachment; filename="workflow-data-${userId}.json"`);
          res.json(exportData);
        }
        
      } catch (error) {
        this.logger.error('Export error', { error: error.message, userId: req.params.userId });
        res.status(500).json({ error: 'Failed to export user data' });
      }
    });

    // Workflow recommendations
    this.app.get('/api/users/:userId/recommendations', async (req, res) => {
      try {
        const { userId } = req.params;
        const category = req.query.category; // 'tools', 'automation', 'workflow'
        
        const recommendations = await this.generateRecommendations(userId, category);
        
        res.json({
          user_id: userId,
          category: category || 'all',
          recommendations,
          generated_at: new Date().toISOString()
        });
        
      } catch (error) {
        this.logger.error('Recommendations error', { error: error.message, userId: req.params.userId });
        res.status(500).json({ error: 'Failed to generate recommendations' });
      }
    });

    // Productivity score
    this.app.get('/api/users/:userId/productivity-score', async (req, res) => {
      try {
        const { userId } = req.params;
        const days = parseInt(req.query.days) || 7;
        
        const productivityScore = await this.calculateProductivityScore(userId, days);
        
        res.json({
          user_id: userId,
          productivity_score: productivityScore,
          period_days: days,
          generated_at: new Date().toISOString()
        });
        
      } catch (error) {
        this.logger.error('Productivity score error', { error: error.message, userId: req.params.userId });
        res.status(500).json({ error: 'Failed to calculate productivity score' });
      }
    });
  }

  /**
   * Aggregate team analytics
   */
  aggregateTeamAnalytics(days) {
    const allUserWorkflows = Array.from(this.workflowIntelligence.userWorkflows.entries());
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    let totalInteractions = 0;
    let totalUsers = 0;
    let totalInsights = 0;
    const intentCounts = {};
    const toolCounts = {};
    
    allUserWorkflows.forEach(([userId, workflows]) => {
      const recentWorkflows = workflows.filter(w => new Date(w.timestamp) >= cutoffDate);
      
      if (recentWorkflows.length > 0) {
        totalUsers++;
        totalInteractions += recentWorkflows.length;
        
        // Count intents
        recentWorkflows.forEach(workflow => {
          if (workflow.context?.intent?.intent) {
            const intent = workflow.context.intent.intent;
            intentCounts[intent] = (intentCounts[intent] || 0) + 1;
          }
          
          // Count tools
          (workflow.context?.tools_mentioned || []).forEach(tool => {
            toolCounts[tool] = (toolCounts[tool] || 0) + 1;
          });
        });
      }
      
      // Count insights
      const userInsights = this.workflowIntelligence.actionableInsights.get(userId) || [];
      totalInsights += userInsights.filter(i => !i.dismissed && !i.completed).length;
    });
    
    return {
      total_users: totalUsers,
      total_interactions: totalInteractions,
      total_active_insights: totalInsights,
      average_interactions_per_user: totalUsers > 0 ? Math.round(totalInteractions / totalUsers) : 0,
      top_intents: Object.entries(intentCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([intent, count]) => ({ intent, count })),
      top_tools: Object.entries(toolCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([tool, count]) => ({ tool, count }))
    };
  }

  /**
   * Aggregate team tool usage
   */
  aggregateTeamToolUsage() {
    const toolCounts = {};
    const toolUsers = {};
    
    this.workflowIntelligence.userWorkflows.forEach((workflows, userId) => {
      const userTools = new Set();
      
      workflows.forEach(workflow => {
        (workflow.context?.tools_mentioned || []).forEach(tool => {
          toolCounts[tool] = (toolCounts[tool] || 0) + 1;
          userTools.add(tool);
        });
      });
      
      userTools.forEach(tool => {
        toolUsers[tool] = (toolUsers[tool] || 0) + 1;
      });
    });
    
    return Object.entries(toolCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 20)
      .map(([tool, count]) => ({
        tool,
        total_mentions: count,
        unique_users: toolUsers[tool] || 0,
        adoption_rate: Math.round((toolUsers[tool] || 0) / this.workflowIntelligence.userWorkflows.size * 100)
      }));
  }

  /**
   * Aggregate team workflow patterns
   */
  aggregateTeamPatterns() {
    const patterns = {
      common_intents: {},
      automation_opportunities: {},
      integration_requests: {},
      peak_hours: {}
    };
    
    this.workflowIntelligence.userWorkflows.forEach((workflows) => {
      workflows.forEach(workflow => {
        // Common intents
        if (workflow.context?.intent?.intent) {
          const intent = workflow.context.intent.intent;
          patterns.common_intents[intent] = (patterns.common_intents[intent] || 0) + 1;
        }
        
        // Peak hours
        const hour = new Date(workflow.timestamp).getHours();
        patterns.peak_hours[hour] = (patterns.peak_hours[hour] || 0) + 1;
      });
    });
    
    return {
      most_common_intents: Object.entries(patterns.common_intents)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([intent, count]) => ({ intent, count })),
      peak_activity_hours: Object.entries(patterns.peak_hours)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([hour, count]) => ({ hour: parseInt(hour), count }))
    };
  }

  /**
   * Get real-time metrics
   */
  getRealtimeMetrics() {
    const now = new Date();
    const lastHour = new Date(now.getTime() - 60 * 60 * 1000);
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    let recentInteractions = 0;
    let activeUsers = new Set();
    let recentInsights = 0;
    
    this.workflowIntelligence.userWorkflows.forEach((workflows, userId) => {
      const recentWorkflows = workflows.filter(w => new Date(w.timestamp) >= lastHour);
      
      if (recentWorkflows.length > 0) {
        activeUsers.add(userId);
        recentInteractions += recentWorkflows.length;
      }
      
      const userInsights = this.workflowIntelligence.actionableInsights.get(userId) || [];
      recentInsights += userInsights.filter(i => new Date(i.timestamp) >= last24Hours).length;
    });
    
    return {
      active_users_last_hour: activeUsers.size,
      interactions_last_hour: recentInteractions,
      new_insights_last_24h: recentInsights,
      total_users: this.workflowIntelligence.userWorkflows.size,
      system_uptime: process.uptime()
    };
  }

  /**
   * Export user data
   */
  async exportUserData(userId, days) {
    const analytics = await this.workflowIntelligence.getUserWorkflowAnalytics(userId, days);
    const insights = await this.workflowIntelligence.getUserActionableInsights(userId, 100);
    const workflows = await this.workflowIntelligence.getUserRecentWorkflow(userId, null, days);
    
    return {
      user_id: userId,
      export_date: new Date().toISOString(),
      period_days: days,
      analytics,
      insights,
      workflow_data: workflows,
      summary: {
        total_interactions: workflows.length,
        total_insights: insights.length,
        data_points: workflows.length + insights.length
      }
    };
  }

  /**
   * Convert data to CSV format
   */
  convertToCSV(data) {
    // Simplified CSV conversion - would need more sophisticated implementation
    const csvLines = [];
    csvLines.push('Type,Timestamp,Content,Category,Status');
    
    // Add workflow data
    data.workflow_data.forEach(workflow => {
      const line = [
        workflow.type,
        workflow.timestamp,
        JSON.stringify(workflow.content || workflow.action).replace(/"/g, '""'),
        workflow.context?.messageType || workflow.context?.actionType || 'unknown',
        'completed'
      ].join(',');
      csvLines.push(line);
    });
    
    // Add insights data
    data.insights.forEach(insight => {
      insight.actionable_suggestions?.forEach(suggestion => {
        const line = [
          'insight',
          insight.timestamp,
          suggestion.suggestion.replace(/"/g, '""'),
          suggestion.category,
          insight.completed ? 'completed' : insight.dismissed ? 'dismissed' : 'active'
        ].join(',');
        csvLines.push(line);
      });
    });
    
    return csvLines.join('\n');
  }

  /**
   * Generate personalized recommendations
   */
  async generateRecommendations(userId, category) {
    const analytics = await this.workflowIntelligence.getUserWorkflowAnalytics(userId);
    const insights = await this.workflowIntelligence.getUserActionableInsights(userId);
    
    const recommendations = [];
    
    // Tool recommendations
    if (!category || category === 'tools') {
      const topIntents = analytics.top_intents.slice(0, 3);
      topIntents.forEach(intent => {
        const toolSuggestions = this.getToolSuggestionsForIntent(intent.intent);
        recommendations.push(...toolSuggestions);
      });
    }
    
    // Automation recommendations
    if (!category || category === 'automation') {
      insights.forEach(insight => {
        if (insight.automation_opportunities?.length > 0) {
          recommendations.push(...insight.automation_opportunities.map(opp => ({
            type: 'automation',
            ...opp
          })));
        }
      });
    }
    
    // Workflow recommendations
    if (!category || category === 'workflow') {
      const workflowSuggestions = this.getWorkflowSuggestions(analytics);
      recommendations.push(...workflowSuggestions);
    }
    
    return recommendations.slice(0, 10); // Limit to top 10
  }

  /**
   * Get tool suggestions for specific intent
   */
  getToolSuggestionsForIntent(intent) {
    const toolMap = {
      'task_automation': [
        { name: 'Zapier', category: 'automation', rationale: 'Great for connecting apps and automating workflows' },
        { name: 'Microsoft Power Automate', category: 'automation', rationale: 'Enterprise-grade workflow automation' }
      ],
      'tool_recommendation': [
        { name: 'Notion', category: 'productivity', rationale: 'All-in-one workspace for notes, docs, and databases' },
        { name: 'Airtable', category: 'productivity', rationale: 'Flexible database with spreadsheet interface' }
      ],
      'integration_help': [
        { name: 'Zapier', category: 'integration', rationale: 'Connect 5000+ apps without coding' },
        { name: 'Pipedream', category: 'integration', rationale: 'Developer-friendly integration platform' }
      ]
    };
    
    return (toolMap[intent] || []).map(tool => ({
      type: 'tool',
      ...tool
    }));
  }

  /**
   * Get workflow suggestions based on analytics
   */
  getWorkflowSuggestions(analytics) {
    const suggestions = [];
    
    // High urgency pattern
    if (analytics.urgency_distribution.high > analytics.urgency_distribution.low) {
      suggestions.push({
        type: 'workflow',
        category: 'time_management',
        suggestion: 'Implement better task prioritization',
        rationale: 'You have many high-urgency requests - better planning could help'
      });
    }
    
    // Tool switching pattern
    if (analytics.tool_usage.length > 5) {
      suggestions.push({
        type: 'workflow',
        category: 'tool_consolidation',
        suggestion: 'Consider consolidating tools',
        rationale: `You use ${analytics.tool_usage.length} different tools - integration could streamline your workflow`
      });
    }
    
    return suggestions;
  }

  /**
   * Calculate productivity score
   */
  async calculateProductivityScore(userId, days) {
    const analytics = await this.workflowIntelligence.getUserWorkflowAnalytics(userId, days);
    const insights = await this.workflowIntelligence.getUserActionableInsights(userId);
    
    let score = 50; // Base score
    
    // Activity level (0-25 points)
    const activityScore = Math.min(25, analytics.total_interactions * 2);
    score += activityScore;
    
    // Intent diversity (0-15 points)
    const uniqueIntents = analytics.top_intents.length;
    const diversityScore = Math.min(15, uniqueIntents * 3);
    score += diversityScore;
    
    // Insight completion (0-10 points)
    const completedInsights = insights.filter(i => i.completed).length;
    const completionScore = Math.min(10, completedInsights * 2);
    score += completionScore;
    
    // Urgency balance (-10 to +10 points)
    const urgencyTotal = analytics.urgency_distribution.high + 
                        analytics.urgency_distribution.medium + 
                        analytics.urgency_distribution.low;
    
    if (urgencyTotal > 0) {
      const highUrgencyRatio = analytics.urgency_distribution.high / urgencyTotal;
      if (highUrgencyRatio > 0.5) {
        score -= 10; // Too many high urgency items
      } else if (highUrgencyRatio < 0.2) {
        score += 10; // Good balance
      }
    }
    
    // Cap score at 100
    score = Math.min(100, Math.max(0, score));
    
    return {
      overall_score: Math.round(score),
      breakdown: {
        activity: Math.round(activityScore),
        diversity: Math.round(diversityScore),
        completion: Math.round(completionScore),
        balance: urgencyTotal > 0 ? (analytics.urgency_distribution.high / urgencyTotal > 0.5 ? -10 : 10) : 0
      },
      grade: this.getGrade(score),
      suggestions: this.getProductivitySuggestions(score, analytics)
    };
  }

  /**
   * Get grade based on score
   */
  getGrade(score) {
    if (score >= 90) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    if (score >= 50) return 'D';
    return 'F';
  }

  /**
   * Get productivity improvement suggestions
   */
  getProductivitySuggestions(score, analytics) {
    const suggestions = [];
    
    if (score < 70) {
      suggestions.push('Increase your interaction with workflow tools to identify more patterns');
    }
    
    if (analytics.urgency_distribution.high > analytics.urgency_distribution.low) {
      suggestions.push('Try to plan ahead more to reduce high-urgency requests');
    }
    
    if (analytics.top_intents.length < 3) {
      suggestions.push('Diversify your workflow activities to unlock more optimization opportunities');
    }
    
    return suggestions;
  }

  /**
   * Start the API server
   */
  async start() {
    try {
      this.server = this.app.listen(this.options.port, () => {
        this.logger.info(`🚀 Workflow Analytics API server started on port ${this.options.port}`);
        this.logger.info(`📊 Health check: http://localhost:${this.options.port}/api/health`);
      });
      
      // Graceful shutdown
      process.on('SIGTERM', () => this.stop());
      process.on('SIGINT', () => this.stop());
      
    } catch (error) {
      this.logger.error('Failed to start API server', { error: error.message });
      throw error;
    }
  }

  /**
   * Stop the API server
   */
  async stop() {
    if (this.server) {
      this.logger.info('Stopping Workflow Analytics API server...');
      this.server.close(() => {
        this.logger.info('✅ API server stopped');
        process.exit(0);
      });
    }
  }
}

module.exports = WorkflowAnalyticsAPI;

// If run directly, start the server
if (require.main === module) {
  const api = new WorkflowAnalyticsAPI();
  api.start().catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}
