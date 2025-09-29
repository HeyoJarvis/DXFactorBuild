/**
 * CRM Integration Main Entry Point
 * 
 * Features:
 * 1. Orchestrates CRM workflow analysis
 * 2. Coordinates AI-powered insights
 * 3. Manages tool recommendations
 * 4. Handles Slack notifications
 * 5. Provides unified API interface
 */

const winston = require('winston');
const EventEmitter = require('events');

// Core components
const HubSpotAdapter = require('./adapters/hubspot-adapter');
const WorkflowPatternDetector = require('./intelligence/workflow-pattern-detector');
const { ToolRecommendationEngine } = require('./recommendations/tool-recommendation-engine');
const WorkflowAlertSystem = require('./slack/workflow-alert-system');

// Models
const { WorkflowHelpers } = require('./models/workflow.schema');
const { ToolRecommendationHelpers } = require('./models/tool-recommendation.schema');

class CRMWorkflowAnalyzer extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      logLevel: 'info',
      analysisInterval: 3600000, // 1 hour
      enableSlackAlerts: true,
      enableRealTimeMonitoring: true,
      ...options
    };
    
    this.logger = winston.createLogger({
      level: this.options.logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      defaultMeta: { service: 'crm-workflow-analyzer' },
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        })
      ]
    });
    
    // Initialize components
    this.crmAdapters = new Map();
    this.patternDetector = new WorkflowPatternDetector(options);
    this.recommendationEngine = new ToolRecommendationEngine(options);
    this.alertSystem = null; // Initialized when Slack app is provided
    
    // Analysis state
    this.isAnalyzing = false;
    this.lastAnalysisTime = null;
    this.analysisResults = new Map(); // organizationId -> results
    
    // Setup event handlers
    this.setupEventHandlers();
  }
  
  /**
   * Initialize the analyzer with CRM configurations
   */
  async initialize(crmConfigs, slackApp = null) {
    try {
      this.logger.info('Initializing CRM Workflow Analyzer', {
        crm_count: crmConfigs.length,
        slack_enabled: !!slackApp
      });
      
      // Initialize CRM adapters
      for (const config of crmConfigs) {
        await this.addCRMAdapter(config);
      }
      
      // Initialize Slack integration if provided
      if (slackApp && this.options.enableSlackAlerts) {
        this.alertSystem = new WorkflowAlertSystem(slackApp, this.options);
        this.logger.info('Slack alert system initialized');
      }
      
      // Start real-time monitoring if enabled
      if (this.options.enableRealTimeMonitoring) {
        this.startRealTimeMonitoring();
      }
      
      this.logger.info('CRM Workflow Analyzer initialized successfully');
      this.emit('initialized');
      
    } catch (error) {
      this.logger.error('Failed to initialize CRM Workflow Analyzer', {
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Add a CRM adapter
   */
  async addCRMAdapter(crmConfig) {
    try {
      let adapter;
      
      switch (crmConfig.type.toLowerCase()) {
        case 'hubspot':
          adapter = new HubSpotAdapter(crmConfig, this.options);
          break;
        // Add other CRM types here
        default:
          throw new Error(`Unsupported CRM type: ${crmConfig.type}`);
      }
      
      // Test connection
      await adapter.connect();
      
      // Store adapter
      this.crmAdapters.set(crmConfig.organization_id, adapter);
      
      this.logger.info('CRM adapter added', {
        crm_type: crmConfig.type,
        organization_id: crmConfig.organization_id
      });
      
      return adapter;
      
    } catch (error) {
      this.logger.error('Failed to add CRM adapter', {
        crm_type: crmConfig.type,
        organization_id: crmConfig.organization_id,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Analyze workflows for a specific organization
   */
  async analyzeWorkflows(organizationId, options = {}) {
    try {
      this.logger.info('Starting workflow analysis', {
        organization_id: organizationId,
        options
      });
      
      const startTime = Date.now();
      
      // Get CRM adapter
      const adapter = this.crmAdapters.get(organizationId);
      if (!adapter) {
        throw new Error(`No CRM adapter found for organization: ${organizationId}`);
      }
      
      // Extract workflows from CRM
      const workflows = await adapter.extractWorkflows(options);
      
      if (workflows.length === 0) {
        this.logger.warn('No workflows extracted', { organization_id: organizationId });
        return { workflows: [], patterns: [], recommendations: [] };
      }
      
      // Detect patterns
      const organizationContext = await this.getOrganizationContext(organizationId);
      const patternAnalysis = await this.patternDetector.detectPatterns(workflows, organizationContext);
      
      // Generate tool recommendations
      const recommendations = [];
      for (const pattern of patternAnalysis.patterns) {
        const patternRecs = await this.recommendationEngine.generateRecommendations(pattern, organizationContext);
        recommendations.push(...patternRecs);
      }
      
      // Compile analysis results
      const analysisResults = {
        organization_id: organizationId,
        analysis_timestamp: new Date(),
        processing_time_ms: Date.now() - startTime,
        
        workflows: workflows,
        workflow_count: workflows.length,
        
        patterns: patternAnalysis.patterns,
        pattern_count: patternAnalysis.patterns.length,
        cross_pattern_insights: patternAnalysis.insights,
        
        recommendations: recommendations,
        recommendation_count: recommendations.length,
        
        summary: this.generateAnalysisSummary(workflows, patternAnalysis.patterns, recommendations)
      };
      
      // Store results
      this.analysisResults.set(organizationId, analysisResults);
      this.lastAnalysisTime = Date.now();
      
      // Send alerts if configured
      if (this.alertSystem) {
        await this.processAlertsFromAnalysis(analysisResults);
      }
      
      this.logger.info('Workflow analysis completed', {
        organization_id: organizationId,
        workflow_count: workflows.length,
        pattern_count: patternAnalysis.patterns.length,
        recommendation_count: recommendations.length,
        processing_time_ms: analysisResults.processing_time_ms
      });
      
      this.emit('analysis_completed', analysisResults);
      
      return analysisResults;
      
    } catch (error) {
      this.logger.error('Workflow analysis failed', {
        organization_id: organizationId,
        error: error.message
      });
      
      this.emit('analysis_error', { organizationId, error });
      throw error;
    }
  }
  
  /**
   * Generate analysis summary
   */
  generateAnalysisSummary(workflows, patterns, recommendations) {
    // Fix success rate calculation - 'completed' workflows would be those that closed successfully
    // In HubSpot context: deals with closed-won status, or deals that reached final positive stage
    const successfulWorkflows = workflows.filter(w => 
      w.status === 'completed' || 
      w.status === 'won' || 
      (w.stages && w.stages.some(stage => stage.is_closed_won)) ||
      (w.hubspot_metadata && w.hubspot_metadata.pipeline_name && w.deal_value > 0 && w.status === 'active')
    );
    const avgCycleTime = workflows.reduce((sum, w) => sum + (w.duration_days || 0), 0) / workflows.length;
    const conversionRate = successfulWorkflows.length / workflows.length;
    
    const criticalBottlenecks = patterns.reduce((count, p) => 
      count + (p.bottlenecks?.filter(b => b.severity === 'high' || b.severity === 'critical').length || 0), 0
    );
    
    const highROIRecommendations = recommendations.filter(r => (r.roi_percentage || 0) > 200);
    
    return {
      workflow_health_score: this.calculateWorkflowHealthScore(workflows, patterns),
      avg_cycle_time: Math.round(avgCycleTime),
      conversion_rate: Math.round(conversionRate * 100) / 100,
      critical_bottlenecks: criticalBottlenecks,
      high_roi_opportunities: highROIRecommendations.length,
      total_potential_roi: recommendations.reduce((sum, r) => sum + (r.revenue_impact || 0), 0),
      key_insights: this.extractKeyInsights(patterns, recommendations)
    };
  }
  
  /**
   * Calculate overall workflow health score
   */
  calculateWorkflowHealthScore(workflows, patterns) {
    // Health score calculation requires configurable weights and industry benchmarks
    this.logger.warn('Health score calculation requires external configuration', {
      workflow_count: workflows.length,
      pattern_count: patterns.length
    });
    
    // Return neutral score without hardcoded calculations
    return 50; // Neutral score - real calculation requires external benchmarks
  }
  
  /**
   * Extract key insights from analysis
   */
  extractKeyInsights(patterns, recommendations) {
    const insights = [];
    
    // Pattern insights
    const bestPattern = patterns.reduce((best, p) => 
      (p.benchmark_metrics?.success_rate || 0) > (best?.benchmark_metrics?.success_rate || 0) ? p : best
    , null);
    
    if (bestPattern) {
      insights.push(`Best performing pattern: ${bestPattern.pattern_name} (${Math.round((bestPattern.benchmark_metrics.success_rate || 0) * 100)}% success rate)`);
    }
    
    // Bottleneck insights
    const commonBottlenecks = {};
    patterns.forEach(p => {
      p.bottlenecks?.forEach(b => {
        commonBottlenecks[b.location] = (commonBottlenecks[b.location] || 0) + 1;
      });
    });
    
    const topBottleneck = Object.entries(commonBottlenecks).reduce((top, [location, count]) => 
      count > (top[1] || 0) ? [location, count] : top
    , ['', 0]);
    
    if (topBottleneck[1] > 0) {
      insights.push(`Most common bottleneck: ${topBottleneck[0]} (affects ${topBottleneck[1]} patterns)`);
    }
    
    // ROI insights
    const topROI = recommendations.reduce((top, r) => 
      (r.roi_percentage || 0) > (top?.roi_percentage || 0) ? r : top
    , null);
    
    if (topROI) {
      insights.push(`Highest ROI opportunity: ${topROI.recommended_tool} (${Math.round(topROI.roi_percentage || 0)}% ROI)`);
    }
    
    return insights;
  }
  
  /**
   * Process alerts from analysis results
   */
  async processAlertsFromAnalysis(analysisResults) {
    try {
      const alerts = [];
      
      // Check for critical bottlenecks
      for (const pattern of analysisResults.patterns) {
        for (const bottleneck of pattern.bottlenecks || []) {
          if (bottleneck.severity === 'critical' || bottleneck.severity === 'high') {
            alerts.push({
              type: 'bottleneck_detected',
              data: {
                alert_id: `bottleneck_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                title: 'Critical Bottleneck Detected',
                bottleneck_location: bottleneck.location,
                issue_description: bottleneck.issue,
                impact_description: bottleneck.impact,
                severity: bottleneck.severity,
                affected_deals_count: pattern.workflow_count,
                revenue_at_risk: pattern.benchmark_metrics?.avg_deal_value * pattern.workflow_count || 0,
                organization_id: analysisResults.organization_id,
                analyzed_at: analysisResults.analysis_timestamp
              }
            });
          }
        }
      }
      
      // Check for high ROI opportunities
      for (const recommendation of analysisResults.recommendations) {
        if ((recommendation.roi_percentage || 0) > 300 && recommendation.priority === 'high') {
          alerts.push({
            type: 'roi_opportunity',
            data: {
              alert_id: `roi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              title: 'High ROI Opportunity Identified',
              recommended_tool: recommendation.recommended_tool,
              bottleneck_addressed: recommendation.addresses_issue,
              roi_percentage: Math.round(recommendation.roi_percentage || 0),
              payback_months: Math.round(recommendation.payback_period_months || 0),
              revenue_impact: recommendation.revenue_impact || 0,
              implementation_cost: recommendation.implementation_cost || 0,
              confidence_score: Math.round((recommendation.ai_confidence || 0) * 100),
              organization_id: analysisResults.organization_id,
              recommendation_id: recommendation.id
            }
          });
        }
      }
      
      // Send alerts
      for (const alert of alerts) {
        await this.alertSystem.sendWorkflowAlert(alert.type, alert.data);
      }
      
      this.logger.info('Alerts processed', {
        organization_id: analysisResults.organization_id,
        alert_count: alerts.length
      });
      
    } catch (error) {
      this.logger.error('Failed to process alerts', {
        organization_id: analysisResults.organization_id,
        error: error.message
      });
    }
  }
  
  /**
   * Get organization context for analysis
   */
  async getOrganizationContext(organizationId) {
    // Try to load actual company intelligence first
    try {
      const CompanyContextManager = require('./intelligence/company-context-manager');
      const contextManager = new CompanyContextManager();
      
      // Load company context for this organization
      const companyContext = await contextManager.loadCompanyContext(organizationId);
      
      if (companyContext) {
        // Convert company intelligence to organization context format
        const orgContext = companyContext.organization_context;
        return {
          organization_id: organizationId,
          industry: orgContext.industry || 'Technology',
          company_size: orgContext.company_size || 'Mid-Market',
          sales_team_size: orgContext.sales_team_size || null,
          avg_deal_size: orgContext.avg_deal_size || null,
          current_conversion_rate: orgContext.current_conversion_rate || null,
          avg_cycle_time: orgContext.avg_cycle_time || null,
          crm_system: orgContext.crm_system || 'Unknown',
          tech_sophistication: orgContext.tech_sophistication || 'medium',
          budget_range: orgContext.budget_range || null,
          business_model: orgContext.business_model || null,
          sales_complexity: orgContext.sales_complexity || 'consultative',
          // Add workflow intelligence for better recommendations
          automation_gaps: companyContext.workflow_intelligence?.automation_gaps || [],
          integration_needs: companyContext.workflow_intelligence?.integration_needs || [],
          manual_processes: companyContext.workflow_intelligence?.manual_process_mentions || []
        };
      }
    } catch (error) {
      this.logger.warn('Failed to load company intelligence, using defaults', { 
        organization_id: organizationId, 
        error: error.message 
      });
    }
    
    // No fallback context - organization context must be provided
    this.logger.error('Organization context not available and no fallback provided', {
      organization_id: organizationId
    });
    
    return {
      organization_id: organizationId,
      industry: null,
      company_size: null,
      sales_team_size: null,
      avg_deal_size: null,
      current_conversion_rate: null,
      avg_cycle_time: null,
      crm_system: null,
      tech_sophistication: null,
      budget_range: null,
      note: 'Organization context must be provided externally'
    };
  }
  
  /**
   * Start real-time monitoring
   */
  startRealTimeMonitoring() {
    this.logger.info('Starting real-time workflow monitoring');
    
    // Set up periodic analysis
    this.monitoringInterval = setInterval(async () => {
      try {
        for (const [organizationId, adapter] of this.crmAdapters) {
          // Check for recent changes that might trigger alerts
          await this.checkForRealtimeAlerts(organizationId);
        }
      } catch (error) {
        this.logger.error('Real-time monitoring error', {
          error: error.message
        });
      }
    }, this.options.analysisInterval);
    
    this.emit('monitoring_started');
  }
  
  /**
   * Check for real-time alerts
   */
  async checkForRealtimeAlerts(organizationId) {
    // Implementation would check for:
    // - Deals stagnant beyond normal duration
    // - Sudden drops in conversion rates
    // - High-value deals at risk
    // - Performance anomalies
    
    this.logger.debug('Checking for real-time alerts', {
      organization_id: organizationId
    });
  }
  
  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      this.logger.info('Real-time monitoring stopped');
      this.emit('monitoring_stopped');
    }
  }
  
  /**
   * Setup event handlers
   */
  setupEventHandlers() {
    this.on('analysis_completed', (results) => {
      this.logger.debug('Analysis completed event emitted', {
        organization_id: results.organization_id,
        workflow_count: results.workflow_count
      });
    });
    
    this.on('analysis_error', ({ organizationId, error }) => {
      this.logger.error('Analysis error event emitted', {
        organization_id: organizationId,
        error: error.message
      });
    });
  }
  
  /**
   * Get analysis results for an organization
   */
  getAnalysisResults(organizationId) {
    return this.analysisResults.get(organizationId);
  }
  
  /**
   * Get all analysis results
   */
  getAllAnalysisResults() {
    return Array.from(this.analysisResults.values());
  }
  
  /**
   * Cleanup resources
   */
  async cleanup() {
    this.logger.info('Cleaning up CRM Workflow Analyzer');
    
    this.stopMonitoring();
    
    // Close CRM connections
    for (const [organizationId, adapter] of this.crmAdapters) {
      try {
        if (adapter.disconnect) {
          await adapter.disconnect();
        }
      } catch (error) {
        this.logger.warn('Failed to disconnect CRM adapter', {
          organization_id: organizationId,
          error: error.message
        });
      }
    }
    
    this.crmAdapters.clear();
    this.analysisResults.clear();
    
    this.emit('cleanup_completed');
  }
}

module.exports = CRMWorkflowAnalyzer;
