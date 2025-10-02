/**
 * Intelligent Background Service - Pure AI-Powered CRM Analysis
 * 
 * A modern background service that:
 * 1. Uses company intelligence for contextual analysis
 * 2. Provides AI-powered workflow insights and recommendations
 * 3. Connects to existing frontend with enhanced data
 * 4. Runs intelligent monitoring and alerting
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const express = require('express');
const winston = require('winston');
const cron = require('node-cron');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const { EventEmitter } = require('events');

// Import intelligent components
const IntelligentCRMAnalyzer = require('./intelligent-crm-analyzer');
const CRMSupabaseAdapter = require('./supabase-adapter');

class IntelligentBackgroundService extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      port: 3002, // Different port from legacy service
      logLevel: 'debug',
      analysisInterval: '*/30 * * * *', // Every 30 minutes
      maxAlertsPerDay: 5,
      companyWebsite: options.companyWebsite || null,
      ...options
    };
    
    // Setup logging
    this.setupLogging();
    
    // Initialize intelligent analyzer
    this.analyzer = new IntelligentCRMAnalyzer({
      logLevel: this.options.logLevel
    });
    
    // Initialize Supabase database adapter
    this.dbAdapter = new CRMSupabaseAdapter({
      logger: this.logger
    });
    this.logger.info('✅ Supabase adapter initialized for CRM integration');
    
    // State management - all data stored in Supabase
    this.companyIntelligence = null;
    this.lastAnalysisTime = null;
    
    // Express app for webhooks and API
    this.app = express();
    this.setupRoutes();
    
    // Graceful shutdown
    this.setupGracefulShutdown();
  }
  
  setupLogging() {
    this.logger = winston.createLogger({
      level: this.options.logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      defaultMeta: { service: 'intelligent-background-service' },
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        }),
        new winston.transports.File({ 
          filename: 'logs/intelligent-service.log',
          maxsize: 5242880, // 5MB
          maxFiles: 5
        })
      ]
    });
  }
  
  setupRoutes() {
    this.app.use(express.json());
    
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        service: 'intelligent-background-service',
        version: '2.0.0',
        uptime: process.uptime(),
        last_analysis: this.lastAnalysisTime,
        company_intelligence: !!this.companyIntelligence
      });
    });
    
    // HubSpot webhook endpoint
    this.app.post('/webhooks/hubspot', async (req, res) => {
      try {
        await this.handleHubSpotWebhook(req.body);
        res.status(200).json({ status: 'processed' });
      } catch (error) {
        this.logger.error('Webhook processing failed', { error: error.message });
        res.status(500).json({ error: 'Processing failed' });
      }
    });
    
    // Manual analysis trigger
    this.app.post('/analysis/trigger', async (req, res) => {
      try {
        const { website, organization_id } = req.body;
        const result = await this.runIntelligentAnalysis(website, organization_id);
        res.json({
          status: 'completed',
          analysis_id: result.analysis_id,
          recommendations: result.recommendations?.length || 0,
          patterns: result.patterns?.length || 0
        });
      } catch (error) {
        this.logger.error('Manual analysis failed', { error: error.message });
        res.status(500).json({ error: error.message });
      }
    });
    
    // Get latest analysis results from Supabase
    this.app.get('/analysis/latest/:organizationId', async (req, res) => {
      try {
        const { organizationId } = req.params;
        
        // Fetch from Supabase
        const analyses = await this.dbAdapter.getAnalyses(organizationId, { limit: 1 });
        
        if (!analyses || analyses.length === 0) {
          return res.status(404).json({ error: 'No analysis found' });
        }
        
        const latest = analyses[0];
        res.json(latest);
        
      } catch (error) {
        this.logger.error('Failed to get analysis results', { error: error.message });
        res.status(500).json({ error: error.message });
      }
    });
    
    // Get recommendations from Supabase
    this.app.get('/recommendations/:organizationId', async (req, res) => {
      try {
        const { organizationId } = req.params;
        
        // Fetch latest analysis from Supabase
        const analyses = await this.dbAdapter.getAnalyses(organizationId, { limit: 1 });
        
        if (!analyses || analyses.length === 0) {
          return res.status(404).json({ error: 'No recommendations found' });
        }
        
        const latest = analyses[0];
        
        res.json({
          recommendations: latest.recommendations || [],
          generated_at: latest.timestamp,
          company: latest.company_name || organizationId
        });
        
      } catch (error) {
        this.logger.error('Failed to get recommendations', { error: error.message });
        res.status(500).json({ error: error.message });
      }
    });
    
    // Company intelligence endpoint - fetch from Supabase
    this.app.get('/intelligence/:organizationId', async (req, res) => {
      try {
        const { organizationId } = req.params;
        
        // Fetch latest analysis from Supabase
        const analyses = await this.dbAdapter.getAnalyses(organizationId, { limit: 1 });
        
        if (!analyses || analyses.length === 0) {
          return res.status(404).json({ error: 'No company intelligence found' });
        }
        
        const latest = analyses[0];
        
        res.json(latest.company_intelligence || {});
        
      } catch (error) {
        this.logger.error('Failed to get company intelligence', { error: error.message });
        res.status(500).json({ error: error.message });
      }
    });
    
    // NEW: Task analysis endpoint
    this.app.post('/tasks/analyze', async (req, res) => {
      try {
        const { task_message, message_context, organization_id } = req.body;
        
        if (!task_message) {
          return res.status(400).json({ error: 'task_message is required' });
        }
        
        this.logger.info('Processing task analysis request', {
          organization_id: organization_id || 'default_org',
          message_length: task_message.length
        });
        
        // Import and use TaskContextOrchestrator
        const TaskContextOrchestrator = require('../core/orchestration/task-context-orchestrator');
        const orchestrator = new TaskContextOrchestrator({
          crmServiceUrl: `http://localhost:${this.options.port}`
        });
        
        // Enrich task with context
        const enrichedContext = await orchestrator.enrichTaskWithContext(
          task_message,
          message_context || {},
          organization_id || 'default_org'
        );
        
        res.json({
          success: true,
          task_id: enrichedContext.task_id,
          enriched_context: enrichedContext,
          processed_at: new Date()
        });
        
      } catch (error) {
        this.logger.error('Task analysis failed', { error: error.message });
        res.status(500).json({ error: error.message });
      }
    });
    
    // NEW: Task recommendations endpoint
    this.app.post('/tasks/recommendations', async (req, res) => {
      try {
        const { enriched_task_context } = req.body;
        
        if (!enriched_task_context) {
          return res.status(400).json({ error: 'enriched_task_context is required' });
        }
        
        this.logger.info('Generating task recommendations', {
          task_id: enriched_task_context.task_id,
          task_type: enriched_task_context.task_type
        });
        
        // Import and use AITaskRecommendationGenerator
        const AITaskRecommendationGenerator = require('../core/recommendations/ai-task-recommendation-generator');
        const generator = new AITaskRecommendationGenerator();
        
        // Generate recommendations
        const recommendations = await generator.generateTaskRecommendations(enriched_task_context);
        
        res.json({
          success: true,
          recommendations: recommendations,
          generated_at: new Date()
        });
        
      } catch (error) {
        this.logger.error('Task recommendations generation failed', { error: error.message });
        res.status(500).json({ error: error.message });
      }
    });
    
    // NEW: Complete task processing endpoint (analyze + recommend)
    this.app.post('/tasks/process', async (req, res) => {
      try {
        const { task_message, message_context, organization_id } = req.body;
        
        if (!task_message) {
          return res.status(400).json({ error: 'task_message is required' });
        }
        
        this.logger.info('Processing complete task workflow', {
          organization_id: organization_id || 'default_org',
          message_length: task_message.length
        });
        
        // Step 1: Analyze task context
        const TaskContextOrchestrator = require('../core/orchestration/task-context-orchestrator');
        const orchestrator = new TaskContextOrchestrator({
          crmServiceUrl: `http://localhost:${this.options.port}`
        });
        
        const enrichedContext = await orchestrator.enrichTaskWithContext(
          task_message,
          message_context || {},
          organization_id || 'default_org'
        );
        
        // Step 2: Generate recommendations (only if it's actually a task)
        let recommendations = null;
           if (enrichedContext.is_task && enrichedContext.confidence_score >= 0.3) {
          const AITaskRecommendationGenerator = require('../core/recommendations/ai-task-recommendation-generator');
          const generator = new AITaskRecommendationGenerator();
          
          recommendations = await generator.generateTaskRecommendations(enrichedContext);
        }
        
        const result = {
          success: true,
          task_id: enrichedContext.task_id,
          is_task: enrichedContext.is_task,
          confidence_score: enrichedContext.confidence_score,
          enriched_context: enrichedContext,
          recommendations: recommendations,
          processed_at: new Date()
        };
        
        // Log successful processing
        this.logger.info('Task processing completed', {
          task_id: enrichedContext.task_id,
          is_task: enrichedContext.is_task,
          has_recommendations: !!recommendations,
          confidence: enrichedContext.confidence_score
        });
        
        res.json(result);
        
      } catch (error) {
        this.logger.error('Complete task processing failed', { error: error.message });
        res.status(500).json({ error: error.message });
      }
    });
  }
  
  async handleHubSpotWebhook(payload) {
    this.logger.info('Received HubSpot webhook', {
      subscription_type: payload.subscriptionType,
      events_count: payload.length || 0
    });
    
    // Trigger analysis if significant changes detected
    if (this.shouldTriggerAnalysis(payload)) {
      const organizationId = this.extractOrganizationId(payload);
      await this.scheduleAnalysis(organizationId, 'webhook_trigger');
    }
  }
  
  shouldTriggerAnalysis(payload) {
    // Trigger on deal updates, new deals, or contact changes
    const triggerEvents = ['deal.propertyChange', 'deal.creation', 'contact.propertyChange'];
    
    if (Array.isArray(payload)) {
      return payload.some(event => triggerEvents.includes(event.subscriptionType));
    }
    
    return triggerEvents.includes(payload.subscriptionType);
  }
  
  extractOrganizationId(payload) {
    // Extract organization ID from webhook payload or use default
    return 'default_org'; // Could be enhanced to extract from payload
  }
  
  async scheduleAnalysis(organizationId, reason) {
    this.logger.info('Scheduling intelligent analysis', {
      organization_id: organizationId,
      reason: reason
    });
    
    // Debounce analysis requests
    setTimeout(async () => {
      try {
        await this.runIntelligentAnalysis(this.options.companyWebsite, organizationId);
      } catch (error) {
        this.logger.error('Scheduled analysis failed', {
          organization_id: organizationId,
          error: error.message
        });
      }
    }, 5000); // 5 second delay to batch multiple events
  }
  
  async runIntelligentAnalysis(websiteUrl, organizationId) {
    const analysisId = `analysis_${Date.now()}`;
    
    try {
      this.logger.info('🧠 Starting intelligent analysis', {
        analysis_id: analysisId,
        organization_id: organizationId,
        website: websiteUrl
      });
      
      // Prepare CRM config
      const crmConfig = {
        type: 'hubspot',
        organization_id: organizationId,
        access_token: process.env.HUBSPOT_API_KEY || process.env.HUBSPOT_ACCESS_TOKEN
      };
      
      let analysisResult;
      
      if (websiteUrl) {
        // Full intelligent analysis with company intelligence
        this.logger.info('🧠 Running intelligent analysis with company intelligence', {
          website: websiteUrl,
          analysis_id: analysisId
        });
        
        const rawAnalysisResult = await this.analyzer.analyzeCompanyWorkflows(
          websiteUrl,
          crmConfig,
          { limit: 30 }
        );
        
        this.logger.debug('🔍 Raw analysis result structure', {
          analysis_id: analysisId,
          has_raw_data: !!rawAnalysisResult.raw_data,
          has_patterns: !!rawAnalysisResult.raw_data?.patterns,
          has_recommendations: !!rawAnalysisResult.raw_data?.recommendations,
          patterns_count: rawAnalysisResult.raw_data?.patterns?.length || 0,
          recommendations_count: rawAnalysisResult.raw_data?.recommendations?.length || 0,
          top_level_keys: Object.keys(rawAnalysisResult || {})
        });
        
        // Extract data from the intelligent analysis format
        analysisResult = {
          analysis_id: analysisId,
          timestamp: new Date().toISOString(),
          company_name: rawAnalysisResult.analysis_metadata?.company_name || organizationId,
          workflows: rawAnalysisResult.raw_data?.workflows || [],
          patterns: rawAnalysisResult.raw_data?.patterns || [],
          recommendations: rawAnalysisResult.raw_data?.recommendations || [],
          summary: rawAnalysisResult.workflow_analysis || {},
          company_intelligence: rawAnalysisResult.company_intelligence_summary || {},
          contextual_recommendations: rawAnalysisResult.contextual_recommendations || {},
          // Include the full analysis report for frontend
          full_analysis: rawAnalysisResult
        };
        
        this.logger.info('✅ Intelligent analysis data extracted', {
          analysis_id: analysisId,
          patterns_count: analysisResult.patterns.length,
          recommendations_count: analysisResult.recommendations.length,
          workflows_count: analysisResult.workflows.length
        });
        
      } else {
        // CRM-only analysis using legacy compatibility method
        this.logger.info('📊 Running CRM-only analysis (legacy mode)', {
          analysis_id: analysisId
        });
        
        analysisResult = await this.analyzer.analyzeWorkflows(organizationId);
        
        // Convert to new format - extract from raw_data
        analysisResult = {
          analysis_id: analysisId,
          timestamp: new Date().toISOString(),
          company_name: analysisResult.analysis_metadata?.company_name || organizationId,
          workflows: analysisResult.raw_data?.workflows || [],
          patterns: analysisResult.raw_data?.patterns || [],
          recommendations: analysisResult.raw_data?.recommendations || [],
          summary: analysisResult.workflow_analysis || {},
          company_intelligence: analysisResult.company_intelligence_summary || {},
          contextual_recommendations: analysisResult.contextual_recommendations || {}
        };
      }
      
      // Store analysis result
      this.storeAnalysisResult(organizationId, analysisResult);
      
      // Generate intelligent alerts
      await this.generateIntelligentAlerts(organizationId, analysisResult);
      
      this.lastAnalysisTime = new Date().toISOString();
      
      this.logger.info('✅ Intelligent analysis completed', {
        analysis_id: analysisId,
        organization_id: organizationId,
        patterns_found: analysisResult.patterns?.length || 0,
        recommendations: analysisResult.recommendations?.length || 0
      });
      
      // Emit event for frontend updates
      this.emit('analysis_completed', {
        organizationId,
        analysisResult,
        analysisId
      });
      
      return analysisResult;
      
    } catch (error) {
      this.logger.error('Intelligent analysis failed', {
        analysis_id: analysisId,
        organization_id: organizationId,
        error: error.message
      });
      throw error;
    }
  }
  
  async storeAnalysisResult(organizationId, result) {
    try {
      // Store in Supabase database
      const signal = await this.dbAdapter.storeAnalysis(organizationId, result);
      
      this.logger.info('Analysis result stored in Supabase', {
        organizationId,
        signal_id: signal.id,
        urgency: result.urgency || 'medium'
      });
      
      // Emit event for real-time updates
      this.emit('analysis_stored', {
        organizationId,
        signal_id: signal.id,
        result
      });
      
      return signal;
      
    } catch (error) {
      this.logger.error('Failed to store analysis result', {
        organizationId,
        error: error.message
      });
      // Don't throw - logging failure shouldn't break analysis
    }
  }
  
  async generateIntelligentAlerts(organizationId, analysisResult) {
    const alerts = [];
    
    try {
      // Check if we should send alerts (rate limiting)
      if (!this.shouldSendAlert(organizationId)) {
        return;
      }
      
      // Critical workflow health alert
      if (analysisResult.summary?.workflow_health_score < 30) {
        alerts.push({
          type: 'critical_health',
          title: '🚨 Critical Workflow Health Alert',
          message: `Workflow health score is critically low (${analysisResult.summary.workflow_health_score}%). Immediate attention required.`,
          urgency: 'critical',
          recommendations: analysisResult.recommendations?.slice(0, 3) || []
        });
      }
      
      // High-value recommendations alert
      const highValueRecs = analysisResult.recommendations?.filter(r => 
        r.priority === 'high' && r.projected_savings > 10000
      ) || [];
      
      if (highValueRecs.length > 0) {
        alerts.push({
          type: 'high_value_opportunity',
          title: '💰 High-Value Optimization Opportunity',
          message: `Found ${highValueRecs.length} high-impact recommendations with potential savings of $${highValueRecs.reduce((sum, r) => sum + (r.projected_savings || 0), 0).toLocaleString()}`,
          urgency: 'medium',
          recommendations: highValueRecs
        });
      }
      
      // Pattern discovery alert
      if (analysisResult.patterns?.length > 0) {
        const criticalPatterns = analysisResult.patterns.filter(p => p.confidence > 0.8);
        if (criticalPatterns.length > 0) {
          alerts.push({
            type: 'pattern_discovery',
            title: '🔍 Critical Workflow Patterns Detected',
            message: `AI discovered ${criticalPatterns.length} high-confidence workflow patterns that need attention`,
            urgency: 'medium',
            patterns: criticalPatterns.map(p => ({
              name: p.name,
              confidence: p.confidence,
              affected_workflows: p.workflow_count
            }))
          });
        }
      }
      
      // Send alerts
      for (const alert of alerts) {
        await this.sendAlert(organizationId, alert);
      }
      
      // Track alert history
      this.trackAlertHistory(organizationId, alerts);
      
    } catch (error) {
      this.logger.error('Failed to generate intelligent alerts', {
        organization_id: organizationId,
        error: error.message
      });
    }
  }
  
  shouldSendAlert(organizationId) {
    const today = new Date().toDateString();
    const alertsToday = this.getAlertsToday(organizationId);
    return alertsToday < this.options.maxAlertsPerDay;
  }
  
  getAlertsToday(organizationId) {
    const history = this.alertHistory.get(organizationId) || [];
    const today = new Date().toDateString();
    return history.filter(alert => 
      new Date(alert.sent_at).toDateString() === today
    ).length;
  }
  
  async sendAlert(organizationId, alert) {
    this.logger.info('📢 Sending intelligent alert', {
      organization_id: organizationId,
      alert_type: alert.type,
      urgency: alert.urgency
    });
    
    try {
      // Store alert in database
      const signal = await this.dbAdapter.storeAlert(organizationId, alert);
      
      this.logger.info('Alert stored in database', {
        organizationId,
        signal_id: signal.id,
        alert_type: alert.type
      });
      
      // Emit event for Slack integration or other alert handlers
      this.emit('alert_generated', {
        organizationId,
        alert,
        signal_id: signal.id,
        timestamp: new Date().toISOString()
      });
      
      // Console log for visibility
      console.log(`\n🔔 INTELLIGENT ALERT for ${organizationId}:`);
      console.log(`📋 ${alert.title}`);
      console.log(`💬 ${alert.message}`);
      console.log(`🔗 Signal ID: ${signal.id}`);
      if (alert.recommendations) {
        console.log(`💡 Top Recommendations:`);
        alert.recommendations.slice(0, 2).forEach((rec, i) => {
          console.log(`   ${i + 1}. ${rec.tool_name || 'Recommendation'}: ${rec.recommendation || rec.description || ''}`);
        });
      }
      console.log('');
      
      return signal;
      
    } catch (error) {
      this.logger.error('Failed to store alert', {
        organizationId,
        error: error.message
      });
      // Still emit event even if storage fails
      this.emit('alert_generated', {
        organizationId,
        alert,
        timestamp: new Date().toISOString(),
        storage_error: error.message
      });
    }
  }
  
  trackAlertHistory(organizationId, alerts) {
    if (!this.alertHistory.has(organizationId)) {
      this.alertHistory.set(organizationId, []);
    }
    
    const history = this.alertHistory.get(organizationId);
    alerts.forEach(alert => {
      history.push({
        ...alert,
        sent_at: new Date().toISOString()
      });
    });
    
    // Keep only last 50 alerts
    if (history.length > 50) {
      history.splice(0, history.length - 50);
    }
  }
  
  schedulePeriodicTasks() {
    // Periodic intelligent analysis - DISABLED FOR TESTING
    // cron.schedule(this.options.analysisInterval, async () => {
    //   this.logger.info('🔄 Running scheduled intelligent analysis');
    //   
    //   try {
    //     await this.runIntelligentAnalysis(
    //       this.options.companyWebsite,
    //       'default_org'
    //     );
    //   } catch (error) {
    //     this.logger.error('Scheduled analysis failed', { error: error.message });
    //   }
    // });
    
    this.logger.info('⏰ Periodic intelligent analysis scheduled', {
      interval: this.options.analysisInterval
    });
  }
  
  setupGracefulShutdown() {
    const shutdown = async (signal) => {
      this.logger.info(`${signal} received, shutting down gracefully...`);
      
      if (this.server) {
        this.server.close(() => {
          this.logger.info('🌐 Server closed');
        });
      }
      
      this.logger.info('✅ Graceful shutdown completed');
      process.exit(0);
    };
    
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  }
  
  async start() {
    try {
      this.logger.info('🚀 Starting Intelligent Background Service...');
      
      // Start webhook server
      this.server = this.app.listen(this.options.port, () => {
        this.logger.info(`🌐 Intelligent service listening on port ${this.options.port}`);
      });
      
      // Schedule periodic tasks
      this.schedulePeriodicTasks();
      
      // Run initial analysis if company website provided
      if (this.options.companyWebsite) {
        this.logger.info('🔍 Running initial company intelligence analysis...');
        setTimeout(async () => {
          try {
            await this.runIntelligentAnalysis(this.options.companyWebsite, 'default_org');
          } catch (error) {
            this.logger.warn('Initial analysis failed', { error: error.message });
          }
        }, 5000);
      }
      
      this.logger.info('✅ Intelligent Background Service started successfully');
      this.logger.info(`📡 Webhook endpoint: http://localhost:${this.options.port}/webhooks/hubspot`);
      this.logger.info(`🏥 Health check: http://localhost:${this.options.port}/health`);
      this.logger.info(`🧠 Analysis API: http://localhost:${this.options.port}/analysis/trigger`);
      
    } catch (error) {
      this.logger.error('Failed to start service', { error: error.message });
      process.exit(1);
    }
  }
}

// Start the service if run directly
if (require.main === module) {
  const service = new IntelligentBackgroundService({
    companyWebsite: process.env.COMPANY_WEBSITE || 'https://dxfactor.com',
    logLevel: process.env.LOG_LEVEL || 'info'
  });
  
  service.start().catch(error => {
    console.error('Failed to start Intelligent Background Service:', error);
    process.exit(1);
  });
}

module.exports = IntelligentBackgroundService;
