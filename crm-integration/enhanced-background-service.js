/**
 * Enhanced Intelligent CRM Background Service with Company Intelligence
 * 
 * A comprehensive background service that:
 * 1. Gathers company intelligence on first startup
 * 2. Uses company context for personalized CRM recommendations
 * 3. Monitors CRM changes with company-aware insights
 * 4. Provides contextual Slack alerts and suggestions
 */

require('dotenv').config({ path: '../.env' });
const express = require('express');
const winston = require('winston');
const cron = require('node-cron');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const path = require('path');
const { EventEmitter } = require('events');

// Import existing components
const IntelligentCRMAnalyzer = require('./intelligent-crm-analyzer');

// Import new intelligence components
const CompanyIntelligenceBridge = require('./intelligence/company-intelligence-bridge');
const CompanyContextManager = require('./intelligence/company-context-manager');
const { IntelligenceUtils, CompanySize, TechSophistication } = require('./intelligence/intelligence-types');

class EnhancedIntelligentBackgroundService extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      port: 3001,
      logLevel: 'info',
      changeThreshold: 0.1,
      stagnationDays: 7,
      batchDelay: 30000,
      maxAlertsPerDay: 3,
      intelligenceRefreshDays: 7,
      ...options
    };
    
    // Setup logging with file output
    this.setupLogging();
    
    // Initialize components
    this.analyzer = new IntelligentCRMAnalyzer({ logLevel: 'error' });
    this.intelligenceBridge = new CompanyIntelligenceBridge();
    this.contextManager = new CompanyContextManager();
    
    // Company intelligence state
    this.companyContext = null;
    this.isIntelligenceReady = false;
    this.intelligenceInitialized = false;
    
    // Existing state management
    this.eventQueue = [];
    this.snapshots = new Map();
    this.changeHistory = new Map();
    this.alertHistory = new Map();
    this.learningData = new Map();
    
    // Processing state
    this.isProcessing = false;
    this.processingTimer = null;
    this.lastProcessingTime = null;
    
    this.logger.info('🚀 Enhanced CRM Background Service initialized with Company Intelligence');
  }

  async start() {
    try {
      this.logger.info('🔄 Starting Enhanced CRM Background Service...');
      
      // Step 1: Initialize company intelligence
      await this.initializeCompanyIntelligence();
      
      // Step 2: Setup express server
      this.setupExpressServer();
      
      // Step 3: Setup scheduled tasks
      this.setupScheduledTasks();
      
      // Step 4: Load existing learning data
      await this.loadLearningState();
      
      // Step 5: Start the server
      this.server = this.app.listen(this.options.port, () => {
        this.logger.info(`🌟 Enhanced CRM Service running on port ${this.options.port}`);
        this.logger.info(`📊 Company Intelligence: ${this.isIntelligenceReady ? 'Ready' : 'Not Available'}`);
        if (this.companyContext) {
          this.logger.info(`🏢 Company Context: ${this.companyContext.companyName} (${this.companyContext.industry})`);
        }
      });
      
    } catch (error) {
      this.logger.error('❌ Failed to start Enhanced CRM Service:', error);
      throw error;
    }
  }

  async initializeCompanyIntelligence() {
    try {
      this.logger.info('🔍 Initializing Company Intelligence...');
      
      // Check if company context already exists
      const hasContext = await this.contextManager.hasCompanyContext();
      
      if (hasContext) {
        // Load existing context
        this.companyContext = await this.contextManager.getCurrentCompanyContext();
        if (this.companyContext) {
          this.isIntelligenceReady = true;
          this.logger.info(`✅ Loaded existing company context: ${this.companyContext.company_name}`);
          
          // Check if refresh is needed
          const needsRefresh = await this.contextManager.needsRefresh(
            this.companyContext.organization_context.organization_id
          );
          
          if (needsRefresh) {
            this.logger.info('🔄 Company intelligence needs refresh - scheduling background update');
            this.scheduleIntelligenceRefresh();
          }
        }
      } else {
        // No context exists - prompt user for company website
        this.logger.info('❓ No company context found');
        this.logger.info('🚀 Welcome to the Enhanced CRM Intelligence System!');
        this.logger.info('');
        this.logger.info('To get started, please provide your company website URL.');
        this.logger.info('This will be used to gather intelligence about your company');
        this.logger.info('and provide personalized CRM recommendations.');
        this.logger.info('');
        
        // Prompt user for website URL
        await this.promptForCompanyWebsite();
      }
      
      // Health check the intelligence bridge
      const isHealthy = await this.intelligenceBridge.healthCheck();
      if (!isHealthy) {
        this.logger.warn('⚠️ Company Intelligence Bridge health check failed');
        this.logger.warn('   Some features may be limited without intelligence');
      }
      
      this.intelligenceInitialized = true;
      
    } catch (error) {
      this.logger.error('❌ Failed to initialize company intelligence:', error);
      // Continue without intelligence - service should still work
      this.intelligenceInitialized = true;
    }
  }

  async promptForCompanyWebsite() {
    const readline = require('readline');
    
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    return new Promise((resolve) => {
      rl.question('🌐 Please enter your company website URL (e.g., https://yourcompany.com): ', async (websiteUrl) => {
        rl.close();
        
        if (!websiteUrl || !websiteUrl.trim()) {
          this.logger.warn('⚠️ No website URL provided. Starting without company intelligence.');
          this.logger.info('💡 You can add company intelligence later using: POST /initialize-company');
          resolve();
          return;
        }
        
        // Clean up the URL
        let cleanUrl = websiteUrl.trim();
        if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
          cleanUrl = 'https://' + cleanUrl;
        }
        
        try {
          this.logger.info(`🔍 Gathering intelligence for: ${cleanUrl}`);
          await this.gatherCompanyIntelligence(cleanUrl);
          this.logger.info('✅ Company intelligence setup complete!');
        } catch (error) {
          this.logger.error('❌ Failed to gather company intelligence:', error.message);
          this.logger.info('💡 Starting without company intelligence. You can try again later.');
        }
        
        resolve();
      });
    });
  }

  async gatherCompanyIntelligence(websiteUrl, companyName = null) {
    try {
      this.logger.info(`🔍 Gathering company intelligence for: ${websiteUrl}`);
      
      // Show progress to user
      this.emit('intelligenceProgress', { 
        status: 'started', 
        message: 'Starting company analysis...' 
      });
      
      // Set up progress tracking
      this.intelligenceBridge.on('analysisProgress', (data) => {
        this.emit('intelligenceProgress', { 
          status: 'progress', 
          message: data.data 
        });
      });
      
      // Run the analysis
      const intelligence = await this.intelligenceBridge.analyzeCompany(websiteUrl, companyName);
      
      // Save as context
      const orgId = await this.contextManager.saveCompanyContext(intelligence);
      
      // Set as current context
      this.companyContext = await this.contextManager.getContextSummary();
      this.isIntelligenceReady = true;
      
      this.logger.info(`✅ Company intelligence gathered successfully`);
      this.logger.info(`🏢 Company: ${intelligence.company_name}`);
      this.logger.info(`🏭 Industry: ${intelligence.organization_context.industry}`);
      this.logger.info(`📏 Size: ${intelligence.organization_context.company_size}`);
      this.logger.info(`💼 Business Model: ${intelligence.organization_context.business_model}`);
      
      this.emit('intelligenceProgress', { 
        status: 'completed', 
        message: `Company intelligence ready for ${intelligence.company_name}!`,
        intelligence: this.companyContext
      });
      
      return intelligence;
      
    } catch (error) {
      this.logger.error('❌ Failed to gather company intelligence:', error);
      this.emit('intelligenceProgress', { 
        status: 'error', 
        message: `Failed to analyze company: ${error.message}` 
      });
      throw error;
    }
  }

  async scheduleIntelligenceRefresh() {
    try {
      if (!this.companyContext) return;
      
      this.logger.info('🔄 Refreshing company intelligence...');
      
      const websiteUrl = this.companyContext.websiteUrl;
      const companyName = this.companyContext.companyName;
      
      // Refresh intelligence in background
      const freshIntelligence = await this.intelligenceBridge.analyzeCompany(websiteUrl, companyName);
      
      // Update context
      await this.contextManager.saveCompanyContext(freshIntelligence);
      this.companyContext = await this.contextManager.getContextSummary();
      
      // Update metadata
      await this.contextManager.updateContextMetadata(
        this.companyContext.organizationId,
        { 
          lastRefresh: new Date().toISOString(),
          refreshCount: (this.companyContext.refreshCount || 0) + 1
        }
      );
      
      this.logger.info('✅ Company intelligence refreshed successfully');
      
    } catch (error) {
      this.logger.error('❌ Failed to refresh company intelligence:', error);
    }
  }

  setupExpressServer() {
    this.app = express();
    this.app.use(express.json());
    
    // Existing webhook endpoint
    this.app.post('/webhook/crm-change', async (req, res) => {
      try {
        await this.handleCRMWebhook(req.body);
        res.json({ success: true, message: 'Webhook processed' });
      } catch (error) {
        this.logger.error('Webhook processing error:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
      }
    });
    
    // New: Company intelligence initialization endpoint
    this.app.post('/initialize-company', async (req, res) => {
      try {
        const { websiteUrl, companyName } = req.body;
        
        if (!websiteUrl) {
          return res.status(400).json({ error: 'Website URL is required' });
        }
        
        const intelligence = await this.gatherCompanyIntelligence(websiteUrl, companyName);
        
        res.json({ 
          success: true, 
          message: `Company intelligence gathered for ${intelligence.company_name}`,
          organizationId: intelligence.organization_context.organization_id,
          context: this.companyContext
        });
        
      } catch (error) {
        this.logger.error('Company initialization error:', error);
        res.status(500).json({ error: error.message });
      }
    });
    
    // New: Reset/change company
    this.app.post('/reset-company', async (req, res) => {
      try {
        this.logger.info('🔄 API request to reset company intelligence');
        
        // Clear current context
        await this.contextManager.clearAllContexts();
        this.companyContext = null;
        this.isIntelligenceReady = false;
        this.currentOrganizationId = null;
        
        this.logger.info('✅ Company intelligence reset. Ready for new company setup.');
        
        res.json({ 
          success: true, 
          message: 'Company intelligence reset successfully. Use /initialize-company to set up a new company.' 
        });
        
      } catch (error) {
        this.logger.error('❌ Failed to reset company intelligence:', error);
        res.status(500).json({ 
          success: false, 
          error: error.message 
        });
      }
    });
    
    // New: Get current company context
    this.app.get('/company-context', async (req, res) => {
      try {
        if (!this.isIntelligenceReady || !this.companyContext) {
          return res.json({ 
            hasContext: false, 
            message: 'No company context available. Use /initialize-company to set up.' 
          });
        }
        
        res.json({
          hasContext: true,
          context: this.companyContext,
          recommendations: this.generateContextualRecommendations()
        });
        
      } catch (error) {
        this.logger.error('Context retrieval error:', error);
        res.status(500).json({ error: error.message });
      }
    });
    
    // New: Get contextual tool recommendations
    this.app.get('/recommendations/tools', async (req, res) => {
      try {
        if (!this.isIntelligenceReady) {
          return res.json({ 
            recommendations: [],
            message: 'Company intelligence not available for personalized recommendations'
          });
        }
        
        const recommendations = this.generateContextualToolRecommendations();
        res.json({ recommendations });
        
      } catch (error) {
        this.logger.error('Tool recommendations error:', error);
        res.status(500).json({ error: error.message });
      }
    });
    
    // New: Refresh company intelligence
    this.app.post('/refresh-intelligence', async (req, res) => {
      try {
        if (!this.companyContext) {
          return res.status(400).json({ error: 'No company context to refresh' });
        }
        
        await this.scheduleIntelligenceRefresh();
        res.json({ success: true, message: 'Company intelligence refreshed' });
        
      } catch (error) {
        this.logger.error('Intelligence refresh error:', error);
        res.status(500).json({ error: error.message });
      }
    });
    
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        intelligenceReady: this.isIntelligenceReady,
        companyContext: this.companyContext ? {
          name: this.companyContext.companyName,
          industry: this.companyContext.industry,
          size: this.companyContext.companySize
        } : null,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      });
    });
  }

  generateContextualRecommendations() {
    if (!this.companyContext) return [];
    
    const recommendations = [];
    
    // Get recommended tool categories
    const categories = IntelligenceUtils.getRecommendedToolCategories(this.companyContext);
    
    categories.forEach(category => {
      const reasoning = IntelligenceUtils.generateToolReasoning(
        `${category} tools`, 
        this.companyContext
      );
      
      recommendations.push({
        category,
        priority: this.calculateCategoryPriority(category),
        reasoning,
        readinessScore: this.calculateReadinessScore(category)
      });
    });
    
    return recommendations.sort((a, b) => b.priority - a.priority);
  }

  generateContextualToolRecommendations() {
    if (!this.companyContext) return [];
    
    const tools = [];
    
    // CRM recommendations
    const crmReadiness = IntelligenceUtils.getCRMReadiness(this.companyContext);
    if (crmReadiness > 60) {
      if (this.companyContext.companySize === CompanySize.ENTERPRISE) {
        tools.push({
          name: 'Salesforce',
          category: 'CRM',
          score: 85 + (crmReadiness * 0.15),
          reasoning: `Enterprise-grade CRM perfect for ${this.companyContext.companyName}'s ${this.companyContext.companySize} size and ${this.companyContext.salesComplexity} sales process`,
          integration: this.companyContext.technologyStack?.crmSystem ? 'migration' : 'greenfield'
        });
      } else {
        tools.push({
          name: 'HubSpot',
          category: 'CRM',
          score: 80 + (crmReadiness * 0.2),
          reasoning: `All-in-one CRM ideal for ${this.companyContext.companyName}'s ${this.companyContext.companySize} company with ${this.companyContext.businessModel} model`,
          integration: this.companyContext.technologyStack?.crmSystem ? 'migration' : 'greenfield'
        });
      }
    }
    
    // Automation recommendations
    const automationReadiness = IntelligenceUtils.getAutomationReadiness(this.companyContext);
    if (automationReadiness > 50 && this.companyContext.automationGaps?.length > 0) {
      tools.push({
        name: 'Zapier',
        category: 'Automation',
        score: 70 + (automationReadiness * 0.3),
        reasoning: `Automation platform to address gaps in: ${this.companyContext.automationGaps.slice(0, 2).join(', ')}`,
        integration: 'enhancement'
      });
    }
    
    // Communication tools for remote work
    if (this.companyContext.processMaturity?.changeManagementCapability === 'high') {
      tools.push({
        name: 'Slack',
        category: 'Communication',
        score: 75,
        reasoning: `Team communication platform suitable for ${this.companyContext.companyName}'s advanced process maturity`,
        integration: 'addition'
      });
    }
    
    return tools.sort((a, b) => b.score - a.score);
  }

  calculateCategoryPriority(category) {
    if (!this.companyContext) return 50;
    
    let priority = 50;
    
    switch (category) {
      case 'crm':
        priority = IntelligenceUtils.getCRMReadiness(this.companyContext);
        break;
      case 'automation':
        priority = IntelligenceUtils.getAutomationReadiness(this.companyContext);
        break;
      case 'communication':
        priority = this.companyContext.companySize === CompanySize.ENTERPRISE ? 80 : 60;
        break;
      case 'analytics':
        priority = this.companyContext.techSophistication === TechSophistication.HIGH ? 85 : 50;
        break;
      default:
        priority = 60;
    }
    
    return Math.min(100, priority);
  }

  calculateReadinessScore(category) {
    if (!this.companyContext) return 50;
    
    switch (category) {
      case 'crm':
        return IntelligenceUtils.getCRMReadiness(this.companyContext);
      case 'automation':
        return IntelligenceUtils.getAutomationReadiness(this.companyContext);
      default:
        return 70;
    }
  }

  async handleCRMWebhook(data) {
    // Enhanced webhook handling with company context
    this.logger.info('📨 Processing CRM webhook with company intelligence...');
    
    // Add to event queue with company context
    const event = {
      id: uuidv4(),
      timestamp: Date.now(),
      data: data,
      companyContext: this.companyContext ? {
        organizationId: this.companyContext.organizationId,
        companyName: this.companyContext.companyName,
        industry: this.companyContext.industry,
        companySize: this.companyContext.companySize
      } : null
    };
    
    this.eventQueue.push(event);
    
    // Schedule processing if not already running
    if (!this.processingTimer) {
      this.processingTimer = setTimeout(() => {
        this.processEventQueue();
      }, this.options.batchDelay);
    }
  }

  setupScheduledTasks() {
    // Daily intelligence health check
    cron.schedule('0 9 * * *', async () => {
      this.logger.info('🔍 Daily company intelligence health check');
      
      if (this.companyContext) {
        const needsRefresh = await this.contextManager.needsRefresh(
          this.companyContext.organizationId
        );
        
        if (needsRefresh) {
          this.logger.info('🔄 Scheduling intelligence refresh');
          await this.scheduleIntelligenceRefresh();
        }
      }
    });
    
    // Weekly learning data backup
    cron.schedule('0 2 * * 0', async () => {
      await this.saveLearningState();
      this.logger.info('💾 Weekly learning state backup completed');
    });
  }

  setupLogging() {
    this.logger = winston.createLogger({
      level: this.options.logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
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
          filename: path.join(__dirname, 'logs', 'enhanced-background-service.log'),
          maxsize: 5242880, // 5MB
          maxFiles: 5
        })
      ]
    });
  }

  async loadLearningState() {
    try {
      const learningFile = path.join(__dirname, 'enhanced-learning-state.json');
      const data = await fs.readFile(learningFile, 'utf8');
      const learningState = JSON.parse(data);
      
      // Restore learning data
      this.learningData = new Map(learningState.learningData || []);
      this.alertHistory = new Map(learningState.alertHistory || []);
      
      this.logger.info(`📚 Loaded learning state: ${this.learningData.size} patterns`);
    } catch (error) {
      this.logger.info('📚 No existing learning state found, starting fresh');
    }
  }

  async saveLearningState() {
    try {
      const learningState = {
        learningData: Array.from(this.learningData.entries()),
        alertHistory: Array.from(this.alertHistory.entries()),
        lastSaved: new Date().toISOString(),
        companyContext: this.companyContext ? {
          organizationId: this.companyContext.organizationId,
          companyName: this.companyContext.companyName
        } : null
      };
      
      const learningFile = path.join(__dirname, 'enhanced-learning-state.json');
      await fs.writeFile(learningFile, JSON.stringify(learningState, null, 2));
      
      this.logger.info('💾 Learning state saved successfully');
    } catch (error) {
      this.logger.error('❌ Failed to save learning state:', error);
    }
  }

  async processEventQueue() {
    if (this.isProcessing || this.eventQueue.length === 0) {
      return;
    }
    
    this.isProcessing = true;
    this.processingTimer = null;
    
    try {
      this.logger.info(`🔄 Processing ${this.eventQueue.length} CRM events with company intelligence...`);
      
      const events = [...this.eventQueue];
      this.eventQueue = [];
      
      // Process events with company context
      for (const event of events) {
        await this.processEventWithContext(event);
      }
      
      this.lastProcessingTime = Date.now();
      this.logger.info('✅ Event processing completed');
      
    } catch (error) {
      this.logger.error('❌ Event processing failed:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  async processEventWithContext(event) {
    // Enhanced event processing that considers company context
    try {
      if (event.companyContext) {
        this.logger.info(`📊 Processing event for ${event.companyContext.companyName} (${event.companyContext.industry})`);
        
        // Use company context to enhance analysis
        // This is where you'd integrate with existing CRM analysis
        // but now with company intelligence context
      }
      
      // Continue with existing event processing logic...
      
    } catch (error) {
      this.logger.error('❌ Failed to process event with context:', error);
    }
  }

  async stop() {
    this.logger.info('🛑 Stopping Enhanced CRM Background Service...');
    
    if (this.server) {
      this.server.close();
    }
    
    if (this.processingTimer) {
      clearTimeout(this.processingTimer);
    }
    
    // Save final learning state
    await this.saveLearningState();
    
    this.logger.info('✅ Enhanced CRM Background Service stopped');
  }
}

// Export for use in other modules
module.exports = EnhancedIntelligentBackgroundService;

// Run if called directly
if (require.main === module) {
  const service = new EnhancedIntelligentBackgroundService();
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    await service.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    await service.stop();
    process.exit(0);
  });
  
  // Start the service
  service.start().catch(error => {
    console.error('💥 Failed to start Enhanced CRM Service:', error);
    process.exit(1);
  });
}
