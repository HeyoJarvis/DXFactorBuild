/**
 * Intelligent CRM Background Service
 * 
 * A comprehensive background service that:
 * 1. Monitors CRM changes via webhooks
 * 2. Learns from patterns continuously  
 * 3. Sends intelligent alerts only when needed
 * 4. Runs efficiently in the background
 */

require('dotenv').config({ path: '../.env' });
const express = require('express');
const winston = require('winston');
const cron = require('node-cron');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const path = require('path');

// Import existing components
const CRMWorkflowAnalyzer = require('./index');

class IntelligentBackgroundService {
  constructor(options = {}) {
    this.options = {
      port: 3001,
      logLevel: 'info',
      changeThreshold: 0.1,
      stagnationDays: 7,
      batchDelay: 30000,
      maxAlertsPerDay: 3,
      ...options
    };
    
    // Setup logging with file output
    this.setupLogging();
    
    // Initialize components
    this.analyzer = new CRMWorkflowAnalyzer({ logLevel: 'error' });
    
    // State management
    this.eventQueue = [];
    this.snapshots = new Map(); // organizationId -> last snapshot
    this.changeHistory = new Map(); // organizationId -> change history
    this.alertHistory = new Map(); // organizationId -> alert history
    this.learningData = new Map(); // pattern -> learning data
    
    // Processing state
    this.isProcessing = false;
    this.processingTimer = null;
    this.lastProcessingTime = null;
    
    // Setup Express app for webhooks
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }
  
  setupLogging() {
    // Ensure logs directory exists
    const logsDir = path.join(__dirname, 'logs');
    fs.mkdir(logsDir, { recursive: true }).catch(() => {});
    
    this.logger = winston.createLogger({
      level: this.options.logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        }),
        new winston.transports.File({ 
          filename: path.join(logsDir, 'background-service.log'),
          maxsize: 10485760, // 10MB
          maxFiles: 5
        })
      ],
      defaultMeta: { service: 'intelligent-background-service' }
    });
  }
  
  setupMiddleware() {
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));
    
    // Enhanced CORS for Electron
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
      res.header('Access-Control-Allow-Credentials', 'true');
      
      // Handle preflight requests
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
        return;
      }
      next();
    });
    
    // Request logging
    this.app.use((req, res, next) => {
      this.logger.debug('Incoming request', {
        method: req.method,
        url: req.url,
        ip: req.ip
      });
      next();
    });
  }
  
  setupRoutes() {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      const memUsage = process.memoryUsage();
      res.json({
        status: 'healthy',
        uptime_seconds: Math.floor(process.uptime()),
        memory_usage_mb: Math.floor(memUsage.heapUsed / 1024 / 1024),
        queue_size: this.eventQueue.length,
        organizations_monitored: this.snapshots.size,
        learning_patterns: this.learningData.size,
        last_processing: this.lastProcessingTime,
        version: '1.0.0'
      });
    });
    
    // HubSpot webhook endpoint
    this.app.post('/webhooks/hubspot', async (req, res) => {
      try {
        await this.handleHubSpotWebhook(req.body);
        res.status(200).json({ message: 'Webhook processed', timestamp: new Date() });
      } catch (error) {
        this.logger.error('HubSpot webhook error', { error: error.message });
        res.status(500).json({ error: 'Webhook processing failed' });
      }
    });
    
    // Manual analysis trigger
    this.app.post('/trigger/:organizationId', async (req, res) => {
      try {
        const { organizationId } = req.params;
        const reason = req.body.reason || 'manual_trigger';
        
        await this.triggerAnalysis(organizationId, reason);
        
        res.json({ 
          message: 'Analysis triggered successfully',
          organization_id: organizationId,
          reason: reason,
          timestamp: new Date()
        });
        
      } catch (error) {
        this.logger.error('Manual trigger failed', { error: error.message });
        res.status(500).json({ error: error.message });
      }
    });
    
    // Get organization insights
    // Status endpoint for learning insights (renamed to avoid conflict)
    this.app.get('/status/:organizationId', (req, res) => {
      const { organizationId } = req.params;
      const history = this.changeHistory.get(organizationId) || [];
      const alerts = this.alertHistory.get(organizationId) || [];
      const snapshot = this.snapshots.get(organizationId);
      
      res.json({
        organization_id: organizationId,
        last_snapshot: snapshot?.snapshot_time,
        recent_changes: history.slice(-10),
        recent_alerts: alerts.slice(-5),
        learning_patterns: Array.from(this.learningData.keys()).slice(-10),
        health_summary: {
          total_changes_tracked: history.length,
          alerts_sent_today: this.getAlertsToday(organizationId),
          learning_confidence: this.calculateLearningConfidence(organizationId)
        }
      });
    });
    
    // Get CRM dashboard data
        this.app.get('/dashboard/:organizationId', async (req, res) => {
          try {
            const { organizationId } = req.params;
            const currentData = await this.getCurrentCRMState(organizationId);
            
            res.json({
              organization_id: organizationId,
              dashboard_data: {
                total_deals: currentData.summary.total_deals || 0,
                total_value: currentData.summary.total_value || 0,
                avg_deal_size: currentData.summary.avg_deal_size || 0,
                cycle_time: currentData.summary.avg_age_days || 0,
                health_score: currentData.summary.workflow_health_score || 0,
                stagnant_deals: currentData.summary.stagnant_deals_count || 0,
                deals: currentData.deals.slice(0, 5).map(deal => ({
                  name: deal.name,
                  amount: deal.amount,
                  stage: deal.stage,
                  age_days: Math.floor((new Date() - new Date(deal.created_at)) / (1000 * 60 * 60 * 24))
                }))
              },
              timestamp: new Date()
            });
          } catch (error) {
            this.logger.error('Dashboard data request failed', { error: error.message });
            res.status(500).json({ error: error.message });
          }
        });

        // AI Insights endpoint for the copilot
        this.app.get('/insights/:organizationId', async (req, res) => {
          try {
            const { organizationId } = req.params;
            const currentData = await this.getCurrentCRMState(organizationId);
            
            // Generate AI-powered insights
            const insights = await this.generateAIInsights(currentData);
            
            res.json({
              organization_id: organizationId,
              insights: insights.criticalInsights,
              recommendations: insights.recommendations,
              nextSteps: insights.nextSteps,
              timestamp: new Date()
            });
          } catch (error) {
            this.logger.error('AI insights request failed', { error: error.message });
            res.status(500).json({ error: error.message });
          }
        });

    // Force learning update
    this.app.post('/admin/update-learning', async (req, res) => {
      try {
        await this.updateLearningModels();
        res.json({ message: 'Learning models updated', timestamp: new Date() });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  }
  
  async start() {
    try {
      this.logger.info('🚀 Starting Intelligent CRM Background Service...');
      
      // Initialize CRM connections
      const crmConfigs = [{
        type: 'hubspot',
        organization_id: 'default_org',
        access_token: process.env.HUBSPOT_API_KEY || process.env.HUBSPOT_ACCESS_TOKEN
      }];
      
      if (!crmConfigs[0].access_token) {
        this.logger.warn('No HubSpot API key found - CRM integration will be limited');
      } else {
        try {
          await this.analyzer.initialize(crmConfigs);
          this.logger.info('✅ CRM analyzer initialized');
        } catch (error) {
          this.logger.warn('⚠️ CRM analyzer failed to initialize - continuing without full CRM integration', {
            error: error.message
          });
        }
      }
      
      // Start webhook server
      this.server = this.app.listen(this.options.port, () => {
        this.logger.info(`🌐 Webhook server listening on port ${this.options.port}`);
      });
      
      // Schedule periodic tasks
      this.schedulePeriodicTasks();
      
      // Setup graceful shutdown
      this.setupGracefulShutdown();
      
      this.logger.info('✅ Background service started successfully');
      this.logger.info(`📡 Webhook endpoint: http://localhost:${this.options.port}/webhooks/hubspot`);
      this.logger.info(`🏥 Health check: http://localhost:${this.options.port}/health`);
      
      // Perform initial analysis
      setTimeout(() => {
        this.performInitialAnalysis();
      }, 5000); // Wait 5 seconds for everything to initialize
      
    } catch (error) {
      this.logger.error('❌ Failed to start background service', { error: error.message });
      throw error;
    }
  }
  
  async handleHubSpotWebhook(events) {
    if (!Array.isArray(events)) {
      events = [events];
    }
    
    this.logger.debug(`📥 Received ${events.length} webhook events`);
    
    for (const event of events) {
      if (this.isRelevantEvent(event)) {
        this.eventQueue.push({
          id: uuidv4(),
          type: 'hubspot_webhook',
          event: event,
          timestamp: new Date(),
          organization_id: this.extractOrganizationId(event)
        });
        
        this.logger.debug('Webhook event queued', {
          event_type: event.subscriptionType,
          object_id: event.objectId
        });
      }
    }
    
    // Trigger batch processing
    this.scheduleBatchProcessing();
  }
  
  isRelevantEvent(event) {
    const relevantTypes = [
      'deal.creation',
      'deal.propertyChange',
      'deal.deletion',
      'contact.creation',
      'company.propertyChange'
    ];
    
    const relevantProperties = [
      'dealstage',
      'amount',
      'closedate',
      'hs_deal_stage_probability',
      'dealname'
    ];
    
    return relevantTypes.includes(event.subscriptionType) &&
           (!event.propertyName || relevantProperties.includes(event.propertyName));
  }
  
  extractOrganizationId(event) {
    // For now, use default org - in production, extract from event or portal ID
    return 'default_org';
  }
  
  scheduleBatchProcessing() {
    if (this.processingTimer) {
      clearTimeout(this.processingTimer);
    }
    
    this.processingTimer = setTimeout(() => {
      this.processBatchedEvents();
    }, this.options.batchDelay);
  }
  
  async processBatchedEvents() {
    if (this.isProcessing || this.eventQueue.length === 0) {
      return;
    }
    
    this.isProcessing = true;
    this.lastProcessingTime = new Date();
    
    try {
      const events = this.eventQueue.splice(0); // Take all events
      this.logger.info(`🔄 Processing ${events.length} batched events`);
      
      // Group events by organization
      const eventsByOrg = this.groupEventsByOrganization(events);
      
      for (const [orgId, orgEvents] of eventsByOrg) {
        await this.processOrganizationEvents(orgId, orgEvents);
      }
      
      this.logger.info('✅ Batch processing completed');
      
    } catch (error) {
      this.logger.error('❌ Batch processing failed', { error: error.message });
    } finally {
      this.isProcessing = false;
    }
  }
  
  groupEventsByOrganization(events) {
    const grouped = new Map();
    
    for (const event of events) {
      const orgId = event.organization_id;
      if (!grouped.has(orgId)) {
        grouped.set(orgId, []);
      }
      grouped.get(orgId).push(event);
    }
    
    return grouped;
  }
  
  async processOrganizationEvents(organizationId, events) {
    try {
      this.logger.debug(`Processing ${events.length} events for ${organizationId}`);
      
      // Get current CRM state
      const currentData = await this.getCurrentCRMState(organizationId);
      
      // Handle case where events might not be properly structured
      const validEvents = events.filter(event => {
        if (!event || typeof event !== 'object') return false;
        // For manual triggers, create a simple event structure
        if (event.type && !event.event) {
          return true;
        }
        // For webhook events, check for proper structure
        return event.event && typeof event.event === 'object';
      });
      
      // Detect significant changes
      const significantChanges = await this.detectSignificantChanges(
        organizationId, 
        currentData, 
        validEvents
      );
      
      if (significantChanges.length > 0) {
        this.logger.info(`📊 ${significantChanges.length} significant changes detected`, {
          organization_id: organizationId,
          change_types: significantChanges.map(c => c.type)
        });
        
        // Learn from changes
        await this.learnFromChanges(organizationId, significantChanges);
        
        // Trigger intelligent analysis if needed
        const needsAnalysis = significantChanges.some(c => c.significance >= 0.8);
        if (needsAnalysis) {
          await this.triggerIntelligentAnalysis(organizationId, significantChanges);
        }
        
        // Store change history
        this.storeChangeHistory(organizationId, significantChanges);
      }
      
      // Update snapshot
      this.updateSnapshot(organizationId, currentData);
      
    } catch (error) {
      this.logger.error(`Failed to process events for ${organizationId}`, {
        error: error.message,
        stack: error.stack
      });
    }
  }
  
  async getCurrentCRMState(organizationId) {
    try {
      // Use the working test script approach to get real HubSpot data
      const { Client } = require('@hubspot/api-client');
      const hubspotClient = new Client({ accessToken: process.env.HUBSPOT_API_KEY });
      
      // Get real deals from HubSpot with available permissions
      const dealsResponse = await hubspotClient.crm.deals.basicApi.getPage(50, undefined, [
        'dealname', 'amount', 'dealstage', 'closedate', 'createdate', 'hs_deal_stage_probability'
      ]);
      
      const deals = dealsResponse.results.map(deal => ({
        id: deal.id,
        name: deal.properties.dealname,
        amount: parseFloat(deal.properties.amount) || 0,
        stage: deal.properties.dealstage,
        created_at: deal.properties.createdate,
        updated_at: deal.properties.hs_lastmodifieddate || deal.properties.createdate,
        probability: parseFloat(deal.properties.hs_deal_stage_probability) || 0
      }));
      
      // Calculate real metrics
      const totalValue = deals.reduce((sum, deal) => sum + deal.amount, 0);
      const avgDealSize = deals.length > 0 ? totalValue / deals.length : 0;
      const now = new Date();
      const avgAge = deals.reduce((sum, deal) => {
        const age = Math.floor((now - new Date(deal.created_at)) / (1000 * 60 * 60 * 24));
        return sum + age;
      }, 0) / deals.length;
      
      const stagnantDeals = deals.filter(deal => {
        const age = Math.floor((now - new Date(deal.updated_at || deal.created_at)) / (1000 * 60 * 60 * 24));
        return age > 60;
      });
      
      return {
        deals: deals,
        summary: {
          total_deals: deals.length,
          total_value: totalValue,
          avg_deal_size: avgDealSize,
          avg_age_days: avgAge,
          stagnant_deals_count: stagnantDeals.length,
          workflow_health_score: Math.max(0, 100 - (stagnantDeals.length / deals.length * 100))
        },
        timestamp: new Date()
      };
      
    } catch (error) {
      this.logger.error('Failed to get current CRM state', {
        organization_id: organizationId,
        error: error.message
      });
      return { deals: [], summary: {}, timestamp: new Date() };
    }
  }
  
  async detectSignificantChanges(organizationId, currentData, events) {
    const previousSnapshot = this.snapshots.get(organizationId);
    const significantChanges = [];
    
    // If no previous snapshot, treat as initial analysis
    if (!previousSnapshot) {
      significantChanges.push({
        type: 'initial_analysis',
        organization_id: organizationId,
        data_summary: {
          deals_count: currentData.deals.length
        },
        timestamp: new Date(),
        significance: 1.0,
        reason: 'First time analysis for organization'
      });
      return significantChanges;
    }
    
    // Analyze webhook events for significance
    for (const event of events) {
      const change = await this.analyzeEventSignificance(event, currentData, previousSnapshot);
      if (change && change.significance >= 0.5) {
        significantChanges.push(change);
      }
    }
    
    // Check for stagnation changes
    const stagnationChanges = this.detectStagnation(currentData.deals, previousSnapshot.deals);
    significantChanges.push(...stagnationChanges);
    
    // Check for pipeline health changes
    const healthChanges = this.detectHealthChanges(currentData, previousSnapshot);
    significantChanges.push(...healthChanges);
    
    return significantChanges;
  }
  
  async analyzeEventSignificance(event, currentData, previousSnapshot) {
    // Handle manual triggers (no hubspot event)
    if (!event.event) {
      return {
        type: event.type || 'manual_trigger',
        timestamp: new Date(),
        significance: 0.5,
        reason: 'Manual analysis trigger'
      };
    }
    
    const hubspotEvent = event.event;
    
    // Handle hubspot webhook events
    if (hubspotEvent && hubspotEvent.subscriptionType) {
      switch (hubspotEvent.subscriptionType) {
        case 'deal.creation':
          return {
            type: 'deal_created',
            deal_id: hubspotEvent.objectId,
            timestamp: new Date(hubspotEvent.occurredAt),
            significance: 1.0,
            reason: 'New deal created',
            event_data: hubspotEvent
          };
          
        case 'deal.propertyChange':
          if (['dealstage', 'amount', 'hs_deal_stage_probability'].includes(hubspotEvent.propertyName)) {
            return {
              type: 'deal_updated',
              deal_id: hubspotEvent.objectId,
              property: hubspotEvent.propertyName,
              timestamp: new Date(hubspotEvent.occurredAt),
              significance: this.calculatePropertyChangeSignificance(hubspotEvent.propertyName),
              reason: `${hubspotEvent.propertyName} changed`,
              event_data: hubspotEvent
            };
          }
          break;
      }
    }
    
    return null;
  }
  
  calculatePropertyChangeSignificance(propertyName) {
    const significanceMap = {
      'dealstage': 0.9,           // Stage changes are very significant
      'amount': 0.7,              // Value changes are significant
      'hs_deal_stage_probability': 0.6, // Probability changes are moderately significant
      'closedate': 0.5,           // Date changes are somewhat significant
      'dealname': 0.3             // Name changes are less significant
    };
    
    return significanceMap[propertyName] || 0.3;
  }
  
  detectStagnation(currentDeals, previousDeals) {
    const stagnantChanges = [];
    const now = new Date();
    
    for (const deal of currentDeals) {
      const lastModified = new Date(deal.updated_at || deal.created_at);
      const daysSinceActivity = Math.floor((now - lastModified) / (1000 * 60 * 60 * 24));
      
      if (daysSinceActivity >= this.options.stagnationDays) {
        // Check if this is a new stagnation (wasn't stagnant before)
        const wasStagnant = previousDeals?.some(pd => 
          pd.id === deal.id && 
          Math.floor((now - new Date(pd.updated_at || pd.created_at)) / (1000 * 60 * 60 * 24)) >= this.options.stagnationDays
        );
        
        if (!wasStagnant) {
          stagnantChanges.push({
            type: 'deal_became_stagnant',
            deal_id: deal.id,
            days_stagnant: daysSinceActivity,
            last_activity: lastModified,
            timestamp: now,
            significance: Math.min(1.0, daysSinceActivity / 30),
            reason: `Deal became stagnant (${daysSinceActivity} days)`
          });
        }
      }
    }
    
    return stagnantChanges;
  }
  
  detectHealthChanges(currentData, previousSnapshot) {
    const changes = [];
    
    // Compare key health metrics
    const currentHealth = this.calculateQuickHealthScore(currentData);
    const previousHealth = this.calculateQuickHealthScore(previousSnapshot);
    
    const healthDelta = Math.abs(currentHealth - previousHealth);
    
    if (healthDelta > 10) { // 10 point change in health score
      changes.push({
        type: 'health_score_change',
        from_score: previousHealth,
        to_score: currentHealth,
        delta: currentHealth - previousHealth,
        timestamp: new Date(),
        significance: Math.min(1.0, healthDelta / 50),
        reason: `Health score changed by ${Math.round(healthDelta)} points`
      });
    }
    
    return changes;
  }
  
  calculateQuickHealthScore(data) {
    if (!data.deals || data.deals.length === 0) return 50;
    
    const now = new Date();
    const stagnantCount = data.deals.filter(deal => {
      const age = Math.floor((now - new Date(deal.created_at)) / (1000 * 60 * 60 * 24));
      return age > 60;
    }).length;
    
    const stagnantRate = stagnantCount / data.deals.length;
    return Math.max(0, 100 - (stagnantRate * 100));
  }
  
  async learnFromChanges(organizationId, changes) {
    for (const change of changes) {
      const patternKey = `${change.type}_${organizationId}`;
      const existingPattern = this.learningData.get(patternKey) || {
        occurrences: 0,
        outcomes: [],
        confidence: 0,
        first_seen: new Date(),
        last_seen: null
      };
      
      existingPattern.occurrences++;
      existingPattern.last_seen = new Date();
      existingPattern.confidence = Math.min(1.0, existingPattern.occurrences / 10);
      
      // Store change outcome for learning
      existingPattern.outcomes.push({
        change: change,
        timestamp: new Date()
      });
      
      // Keep only recent outcomes (last 50)
      if (existingPattern.outcomes.length > 50) {
        existingPattern.outcomes.splice(0, existingPattern.outcomes.length - 50);
      }
      
      this.learningData.set(patternKey, existingPattern);
    }
    
    this.logger.debug(`Learning updated for ${organizationId}`, {
      patterns_learned: changes.length,
      total_patterns: this.learningData.size
    });
  }
  
  async triggerIntelligentAnalysis(organizationId, changes) {
    try {
      this.logger.info('🧠 Triggering intelligent analysis', {
        organization_id: organizationId,
        change_count: changes.length
      });
      
      // Run full analysis
      const results = await this.analyzer.analyzeWorkflows(organizationId);
      
      // Generate smart alerts based on analysis and changes
      await this.generateSmartAlerts(organizationId, results, changes);
      
      // Save analysis results
      await this.saveAnalysisResults(organizationId, results, changes);
      
    } catch (error) {
      this.logger.error('Intelligent analysis failed', {
        organization_id: organizationId,
        error: error.message
      });
    }
  }
  
  async generateSmartAlerts(organizationId, analysisResults, changes) {
    const alerts = [];
    
    // Critical health alert
    if (analysisResults.summary.workflow_health_score < 30) {
      alerts.push({
        type: 'critical_health',
        title: '🚨 Critical Pipeline Health Alert',
        urgency: 'critical',
        data: {
          health_score: analysisResults.summary.workflow_health_score,
          organization_id: organizationId,
          critical_issues: analysisResults.summary.critical_bottlenecks,
          total_deals: analysisResults.workflow_count,
          revenue_at_risk: analysisResults.summary.total_potential_roi
        }
      });
    }
    
    // Mass stagnation alert
    const stagnantChanges = changes.filter(c => c.type.includes('stagnant'));
    if (stagnantChanges.length > 5) {
      alerts.push({
        type: 'mass_stagnation',
        title: '⚠️ Multiple Deals Became Stagnant',
        urgency: 'high',
        data: {
          stagnant_count: stagnantChanges.length,
          organization_id: organizationId,
          deals: stagnantChanges.map(c => c.deal_id)
        }
      });
    }
    
    // High ROI opportunity alert
    const highROIRecs = analysisResults.recommendations?.filter(r => r.roi_percentage > 300) || [];
    if (highROIRecs.length > 0) {
      alerts.push({
        type: 'high_roi_opportunity',
        title: '🚀 High ROI Opportunity Detected',
        urgency: 'medium',
        data: {
          recommendation: highROIRecs[0],
          organization_id: organizationId
        }
      });
    }
    
    // Send alerts with rate limiting
    for (const alert of alerts) {
      if (this.shouldSendAlert(organizationId, alert.type)) {
        await this.sendIntelligentAlert(organizationId, alert);
        this.recordAlert(organizationId, alert);
      }
    }
  }
  
  shouldSendAlert(organizationId, alertType) {
    const orgAlerts = this.alertHistory.get(organizationId) || [];
    const today = new Date().toDateString();
    
    const todayAlerts = orgAlerts.filter(a => 
      a.type === alertType && 
      new Date(a.timestamp).toDateString() === today
    );
    
    return todayAlerts.length < this.options.maxAlertsPerDay;
  }
  
  async sendIntelligentAlert(organizationId, alert) {
    try {
      this.logger.info('📢 Sending intelligent alert', {
        organization_id: organizationId,
        alert_type: alert.type,
        urgency: alert.urgency
      });
      
      // Console output for now - in production, send to Slack
      console.log(`\n${alert.urgency === 'critical' ? '🚨' : '📊'} INTELLIGENT ALERT`);
      console.log(`Title: ${alert.title}`);
      console.log(`Organization: ${organizationId}`);
      console.log(`Urgency: ${alert.urgency.toUpperCase()}`);
      console.log(`Data: ${JSON.stringify(alert.data, null, 2)}`);
      console.log(`Timestamp: ${new Date().toISOString()}`);
      console.log('---');
      
      // In production, integrate with Slack:
      // await this.alertSystem.sendWorkflowAlert(alert.type, alert.data);
      
    } catch (error) {
      this.logger.error('Failed to send alert', {
        organization_id: organizationId,
        alert_type: alert.type,
        error: error.message
      });
    }
  }
  
  recordAlert(organizationId, alert) {
    const orgAlerts = this.alertHistory.get(organizationId) || [];
    orgAlerts.push({
      ...alert,
      timestamp: new Date()
    });
    
    // Keep only recent alerts (last 100)
    if (orgAlerts.length > 100) {
      orgAlerts.splice(0, orgAlerts.length - 100);
    }
    
    this.alertHistory.set(organizationId, orgAlerts);
  }
  
  storeChangeHistory(organizationId, changes) {
    const orgHistory = this.changeHistory.get(organizationId) || [];
    orgHistory.push(...changes);
    
    // Keep only recent history (last 500 changes)
    if (orgHistory.length > 500) {
      orgHistory.splice(0, orgHistory.length - 500);
    }
    
    this.changeHistory.set(organizationId, orgHistory);
  }
  
  updateSnapshot(organizationId, data) {
    this.snapshots.set(organizationId, {
      ...data,
      snapshot_time: new Date()
    });
    
    this.logger.debug('Snapshot updated', {
      organization_id: organizationId,
      deals_count: data.deals.length
    });
  }
  
  async saveAnalysisResults(organizationId, results, changes) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `background-analysis-${organizationId}-${timestamp}.json`;
      const filepath = path.join(__dirname, 'analysis-results', filename);
      
      const analysisData = {
        organization_id: organizationId,
        analysis_timestamp: new Date(),
        trigger_changes: changes,
        results: results,
        learning_state: {
          patterns_learned: this.learningData.size,
          confidence_scores: Array.from(this.learningData.values()).map(p => p.confidence)
        }
      };
      
      await fs.writeFile(filepath, JSON.stringify(analysisData, null, 2));
      
      this.logger.info('Analysis results saved', {
        organization_id: organizationId,
        filename: filename
      });
      
    } catch (error) {
      this.logger.error('Failed to save analysis results', {
        organization_id: organizationId,
        error: error.message
      });
    }
  }
  
  async performInitialAnalysis() {
    this.logger.info('🔍 Performing initial analysis...');
    
    try {
      await this.triggerAnalysis('default_org', 'startup_analysis');
    } catch (error) {
      this.logger.error('Initial analysis failed', { error: error.message });
    }
  }
  
  async triggerAnalysis(organizationId, reason) {
    this.logger.info(`🎯 Triggering analysis for ${organizationId}`, { reason });
    
    const mockChange = [{
      type: reason,
      organization_id: organizationId,
      timestamp: new Date(),
      significance: 1.0,
      reason: reason
    }];
    
    await this.processOrganizationEvents(organizationId, mockChange);
  }
  
  schedulePeriodicTasks() {
    // Daily learning update at 2 AM
    cron.schedule('0 2 * * *', async () => {
      this.logger.info('🧠 Running daily learning update...');
      await this.updateLearningModels();
    });
    
    // Weekly comprehensive analysis on Mondays at 6 AM
    cron.schedule('0 6 * * 1', async () => {
      this.logger.info('📊 Running weekly comprehensive analysis...');
      for (const organizationId of this.snapshots.keys()) {
        await this.triggerAnalysis(organizationId, 'weekly_comprehensive');
      }
    });
    
    // Hourly health check
    cron.schedule('0 * * * *', () => {
      this.performHealthCheck();
    });
    
    this.logger.info('⏰ Periodic tasks scheduled');
  }
  
  async updateLearningModels() {
    try {
      let totalPatterns = 0;
      let highConfidencePatterns = 0;
      
      for (const [pattern, data] of this.learningData) {
        totalPatterns++;
        if (data.confidence > 0.8) {
          highConfidencePatterns++;
        }
      }
      
      this.logger.info('🎓 Learning model updated', {
        total_patterns: totalPatterns,
        high_confidence_patterns: highConfidencePatterns,
        learning_accuracy: totalPatterns > 0 ? highConfidencePatterns / totalPatterns : 0
      });
      
    } catch (error) {
      this.logger.error('Learning model update failed', { error: error.message });
    }
  }

  async generateAIInsights(crmData) {
    try {
      // Analyze current CRM state for critical insights
      const criticalInsights = [];
      const recommendations = [];
      const nextSteps = [];

      // Critical Insights Analysis
      if (crmData.summary.workflow_health_score < 30) {
        criticalInsights.push({
          id: 'critical_health',
          type: 'critical',
          title: 'Critical Pipeline Health',
          description: `Your pipeline health score is ${crmData.summary.workflow_health_score}%. Immediate action required to prevent revenue loss.`
        });
      }

      if (crmData.summary.stagnant_deals_count > 10) {
        criticalInsights.push({
          id: 'stagnant_deals',
          type: 'warning',
          title: 'High Number of Stagnant Deals',
          description: `${crmData.summary.stagnant_deals_count} deals haven't moved in 30+ days. This represents potential revenue at risk.`
        });
      }

      if (crmData.summary.avg_age_days > 90) {
        criticalInsights.push({
          id: 'long_cycle',
          type: 'warning',
          title: 'Extended Sales Cycle',
          description: `Average deal age is ${Math.round(crmData.summary.avg_age_days)} days. Industry benchmark is typically 30-60 days.`
        });
      }

      // AI-Powered Recommendations
      if (crmData.summary.stagnant_deals_count > 5) {
        recommendations.push({
          id: 'automation_tool',
          title: 'Implement Deal Progression Automation',
          description: 'Use HubSpot Workflows to automatically nudge stagnant deals and set follow-up reminders.',
          roi: '25% faster close rate',
          priority: 'high'
        });
      }

      if (crmData.summary.avg_age_days > 60) {
        recommendations.push({
          id: 'sales_enablement',
          title: 'Deploy Sales Enablement Platform',
          description: 'Sales enablement platforms can help reduce cycle time through better prospect engagement.',
          roi: 'ROI calculation requires specific tool and organizational context',
          priority: 'medium'
        });
      }

      recommendations.push({
        id: 'ai_scoring',
        title: 'AI Lead Scoring Implementation',
        description: 'Implement predictive lead scoring to focus on high-probability deals first.',
        roi: '40% improvement in conversion',
        priority: 'medium'
      });

      // Next Steps (Actionable Items)
      if (crmData.summary.stagnant_deals_count > 0) {
        nextSteps.push({
          id: 'review_stagnant',
          title: 'Review Stagnant Deals',
          description: `Immediately review and action the ${crmData.summary.stagnant_deals_count} stagnant deals in your pipeline.`,
          urgency: 'high'
        });
      }

      nextSteps.push({
        id: 'setup_automation',
        title: 'Configure Deal Stage Automation',
        description: 'Set up automated workflows to move deals through stages based on activity triggers.',
        urgency: 'medium'
      });

      nextSteps.push({
        id: 'weekly_review',
        title: 'Schedule Weekly Pipeline Review',
        description: 'Establish a recurring meeting to review pipeline health and deal progression.',
        urgency: 'low'
      });

      return {
        criticalInsights,
        recommendations,
        nextSteps
      };

    } catch (error) {
      this.logger.error('AI insights generation failed', { error: error.message });
      return {
        criticalInsights: [{
          id: 'error',
          type: 'warning',
          title: 'Analysis Temporarily Unavailable',
          description: 'AI insights are temporarily unavailable. Please try again later.'
        }],
        recommendations: [],
        nextSteps: []
      };
    }
  }
  
  performHealthCheck() {
    const memUsage = process.memoryUsage();
    const uptime = process.uptime();
    
    this.logger.info('💓 Health check', {
      uptime_hours: Math.floor(uptime / 3600),
      memory_mb: Math.floor(memUsage.heapUsed / 1024 / 1024),
      queue_size: this.eventQueue.length,
      organizations: this.snapshots.size,
      learning_patterns: this.learningData.size,
      processing_status: this.isProcessing ? 'active' : 'idle'
    });
    
    // Alert on high memory usage
    if (memUsage.heapUsed > 500 * 1024 * 1024) { // 500MB
      this.logger.warn('⚠️ High memory usage detected', {
        memory_mb: Math.floor(memUsage.heapUsed / 1024 / 1024)
      });
    }
  }
  
  getAlertsToday(organizationId) {
    const orgAlerts = this.alertHistory.get(organizationId) || [];
    const today = new Date().toDateString();
    
    return orgAlerts.filter(a => 
      new Date(a.timestamp).toDateString() === today
    ).length;
  }
  
  calculateLearningConfidence(organizationId) {
    const patterns = Array.from(this.learningData.entries())
      .filter(([key, data]) => key.includes(organizationId));
    
    if (patterns.length === 0) return 0;
    
    const avgConfidence = patterns.reduce((sum, [key, data]) => sum + data.confidence, 0) / patterns.length;
    return Math.round(avgConfidence * 100) / 100;
  }
  
  setupGracefulShutdown() {
    const shutdown = async (signal) => {
      this.logger.info(`${signal} received, shutting down gracefully...`);
      
      // Stop accepting new requests
      if (this.server) {
        this.server.close(() => {
          this.logger.info('🌐 Webhook server closed');
        });
      }
      
      // Process remaining events
      if (this.eventQueue.length > 0) {
        this.logger.info(`Processing ${this.eventQueue.length} remaining events...`);
        await this.processBatchedEvents();
      }
      
      // Save learning state
      this.logger.info('💾 Saving learning state...');
      await this.saveLearningState();
      
      this.logger.info('✅ Graceful shutdown completed');
      process.exit(0);
    };
    
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }
  
  async saveLearningState() {
    try {
      const learningState = {
        patterns: Array.from(this.learningData.entries()),
        snapshots: Array.from(this.snapshots.entries()),
        saved_at: new Date()
      };
      
      const filepath = path.join(__dirname, 'learning-state.json');
      await fs.writeFile(filepath, JSON.stringify(learningState, null, 2));
      
      this.logger.info('Learning state saved', {
        patterns_count: this.learningData.size,
        snapshots_count: this.snapshots.size
      });
      
    } catch (error) {
      this.logger.error('Failed to save learning state', { error: error.message });
    }
  }
  
  async loadLearningState() {
    try {
      const filepath = path.join(__dirname, 'learning-state.json');
      const data = await fs.readFile(filepath, 'utf8');
      const learningState = JSON.parse(data);
      
      this.learningData = new Map(learningState.patterns);
      this.snapshots = new Map(learningState.snapshots);
      
      this.logger.info('Learning state loaded', {
        patterns_count: this.learningData.size,
        snapshots_count: this.snapshots.size
      });
      
    } catch (error) {
      this.logger.info('No previous learning state found - starting fresh');
    }
  }
}

// Export for use as module or run directly
module.exports = IntelligentBackgroundService;

// Run if called directly
if (require.main === module) {
  const service = new IntelligentBackgroundService();
  
  // Load previous learning state
  service.loadLearningState().then(() => {
    return service.start();
  }).catch(error => {
    console.error('❌ Failed to start background service:', error.message);
    process.exit(1);
  });
}
