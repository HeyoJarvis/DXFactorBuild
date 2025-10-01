/**
 * CRM Startup Service - Initializes CRM data loading on desktop app startup
 * 
 * Features:
 * 1. Automatic CRM service connection on app launch
 * 2. Progress tracking and status reporting
 * 3. Fallback handling for service unavailability
 * 4. Background data loading with user feedback
 */

const winston = require('winston');
const { EventEmitter } = require('events');
const path = require('path');

// Import CRM services
const IntelligentBackgroundService = require('../../crm-integration/intelligent-background-service');

class CRMStartupService extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      port: 3002,
      logLevel: 'info',
      companyWebsite: process.env.COMPANY_WEBSITE || 'https://dxfactor.com',
      organizationId: 'heyjarvis_org',
      timeout: 30000, // 30 seconds timeout for initial load
      ...options
    };
    
    // Setup logging
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
          filename: path.join(process.cwd(), 'logs', 'crm-startup.log'),
          maxsize: 5242880, // 5MB
          maxFiles: 3
        })
      ],
      defaultMeta: { service: 'crm-startup-service' }
    });
    
    // State management
    this.isInitialized = false;
    this.isLoading = false;
    this.loadingProgress = 0;
    this.crmService = null;
    this.lastError = null;
    this.startTime = null;
    
    // CRM data cache
    this.crmData = {
      connected: false,
      insights: [],
      recommendations: [],
      workflows: [],
      last_updated: null
    };
  }
  
  /**
   * Initialize CRM service and start data loading
   */
  async initialize() {
    if (this.isInitialized) {
      this.logger.info('CRM startup service already initialized');
      return this.crmData;
    }
    
    this.startTime = Date.now();
    this.isLoading = true;
    this.loadingProgress = 0;
    
    try {
      this.logger.info('🚀 Initializing CRM startup service...');
      this.emit('loading:started', { message: 'Initializing CRM connection...' });
      
      // Step 1: Initialize CRM background service
      await this.initializeCRMService();
      this.loadingProgress = 25;
      this.emit('loading:progress', { progress: 25, message: 'CRM service started...' });
      
      // Step 2: Wait for service to be ready
      await this.waitForServiceReady();
      this.loadingProgress = 50;
      this.emit('loading:progress', { progress: 50, message: 'Connecting to CRM APIs...' });
      
      // Step 3: Load initial CRM data
      await this.loadInitialCRMData();
      this.loadingProgress = 75;
      this.emit('loading:progress', { progress: 75, message: 'Loading CRM workflows...' });
      
      // Step 4: Trigger initial analysis
      await this.triggerInitialAnalysis();
      this.loadingProgress = 100;
      this.emit('loading:progress', { progress: 100, message: 'CRM data loaded successfully!' });
      
      this.isInitialized = true;
      this.isLoading = false;
      
      const loadTime = Date.now() - this.startTime;
      this.logger.info('✅ CRM startup service initialized successfully', {
        load_time_ms: loadTime,
        insights_count: this.crmData.insights.length,
        recommendations_count: this.crmData.recommendations.length
      });
      
      this.emit('loading:completed', { 
        data: this.crmData,
        loadTime,
        message: 'CRM system ready for queries!'
      });
      
      return this.crmData;
      
    } catch (error) {
      this.isLoading = false;
      this.lastError = error;
      
      this.logger.error('❌ Failed to initialize CRM startup service', {
        error: error.message,
        load_time_ms: Date.now() - this.startTime
      });
      
      // Emit error but continue with fallback data
      this.emit('loading:error', { 
        error: error.message,
        fallback: true,
        message: 'CRM connection failed - using offline mode'
      });
      
      // Return fallback data structure
      return this.getFallbackData();
    }
  }
  
  /**
   * Initialize the CRM background service
   */
  async initializeCRMService() {
    try {
      this.logger.info('🔧 Starting CRM background service...');
      
      // Create CRM service instance
      this.crmService = new IntelligentBackgroundService({
        port: this.options.port,
        logLevel: this.options.logLevel,
        companyWebsite: this.options.companyWebsite
      });
      
      // Setup event listeners
      this.crmService.on('analysis_completed', (data) => {
        this.handleAnalysisUpdate(data);
      });
      
      this.crmService.on('error', (error) => {
        this.logger.warn('CRM service error', { error: error.message });
      });
      
      // Start the service
      await this.crmService.start();
      
      this.logger.info('✅ CRM background service started');
      
    } catch (error) {
      this.logger.error('Failed to start CRM service', { error: error.message });
      throw new Error(`CRM service initialization failed: ${error.message}`);
    }
  }
  
  /**
   * Wait for CRM service to be ready
   */
  async waitForServiceReady(maxWaitTime = 15000) {
    const startTime = Date.now();
    const checkInterval = 1000; // Check every second
    
    while (Date.now() - startTime < maxWaitTime) {
      try {
        // Try to fetch health status
        const fetch = require('node-fetch');
        const response = await fetch(`http://localhost:${this.options.port}/health`);
        
        if (response.ok) {
          const health = await response.json();
          if (health.status === 'healthy') {
            this.logger.info('✅ CRM service is ready', { uptime: health.uptime });
            return true;
          }
        }
      } catch (error) {
        // Service not ready yet, continue waiting
      }
      
      // Wait before next check
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
    
    throw new Error('CRM service did not become ready within timeout period');
  }
  
  /**
   * Load initial CRM data
   */
  async loadInitialCRMData() {
    try {
      this.logger.info('📊 Loading initial CRM data...');
      
      const fetch = require('node-fetch');
      
      // Try to get existing analysis data
      const response = await fetch(`http://localhost:${this.options.port}/analysis/latest/${this.options.organizationId}`);
      
      if (response.ok) {
        const analysisData = await response.json();
        
        this.crmData = {
          connected: true,
          insights: (analysisData.patterns || []).slice(0, 5),
          recommendations: (analysisData.recommendations || []).slice(0, 5),
          workflows: analysisData.workflows || [],
          last_updated: analysisData.timestamp || new Date().toISOString(),
          analysis_id: analysisData.analysis_id
        };
        
        this.logger.info('✅ Initial CRM data loaded', {
          insights_count: this.crmData.insights.length,
          recommendations_count: this.crmData.recommendations.length,
          workflows_count: this.crmData.workflows.length
        });
        
      } else {
        this.logger.info('No existing analysis found - will trigger new analysis');
        this.crmData.connected = true;
      }
      
    } catch (error) {
      this.logger.warn('Failed to load initial CRM data', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Trigger initial CRM analysis
   */
  async triggerInitialAnalysis() {
    try {
      this.logger.info('🧠 Triggering initial CRM analysis...');
      
      const fetch = require('node-fetch');
      const response = await fetch(`http://localhost:${this.options.port}/analysis/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          website: this.options.companyWebsite,
          organization_id: this.options.organizationId,
          include_company_intelligence: true
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        this.logger.info('✅ Initial analysis triggered', {
          analysis_id: result.analysis_id,
          estimated_completion: result.estimated_completion
        });
        
        // Don't wait for completion - it will update via events
        return result;
      } else {
        throw new Error(`Analysis trigger failed: ${response.status}`);
      }
      
    } catch (error) {
      this.logger.warn('Failed to trigger initial analysis', { error: error.message });
      // Don't throw - this is not critical for startup
    }
  }
  
  /**
   * Handle analysis updates from CRM service
   */
  handleAnalysisUpdate(data) {
    try {
      this.logger.info('📈 Received CRM analysis update', {
        analysis_id: data.analysis_id,
        patterns_count: data.patterns?.length || 0,
        recommendations_count: data.recommendations?.length || 0
      });
      
      // Update cached data
      this.crmData = {
        connected: true,
        insights: (data.patterns || []).slice(0, 5),
        recommendations: (data.recommendations || []).slice(0, 5),
        workflows: data.workflows || this.crmData.workflows,
        last_updated: data.timestamp || new Date().toISOString(),
        analysis_id: data.analysis_id
      };
      
      // Emit update event for UI
      this.emit('data:updated', this.crmData);
      
    } catch (error) {
      this.logger.error('Failed to handle analysis update', { error: error.message });
    }
  }
  
  /**
   * Get current CRM data
   */
  getCRMData() {
    return {
      ...this.crmData,
      isLoading: this.isLoading,
      loadingProgress: this.loadingProgress,
      lastError: this.lastError?.message || null,
      isInitialized: this.isInitialized
    };
  }
  
  /**
   * Get fallback data when CRM service is unavailable
   */
  getFallbackData() {
    return {
      connected: false,
      insights: [
        {
          type: 'warning',
          title: 'CRM Service Offline',
          message: 'CRM analysis service is currently unavailable. Connect to get real-time insights.'
        }
      ],
      recommendations: [
        {
          title: 'Connect CRM Service',
          description: 'Start the CRM background service to get workflow insights and recommendations.',
          priority: 'high',
          category: 'system'
        }
      ],
      workflows: [],
      last_updated: new Date().toISOString(),
      isLoading: false,
      loadingProgress: 0,
      lastError: this.lastError?.message || 'Service unavailable',
      isInitialized: false
    };
  }
  
  /**
   * Refresh CRM data
   */
  async refresh() {
    if (!this.isInitialized) {
      return await this.initialize();
    }
    
    try {
      this.logger.info('🔄 Refreshing CRM data...');
      this.emit('loading:started', { message: 'Refreshing CRM data...' });
      
      await this.loadInitialCRMData();
      await this.triggerInitialAnalysis();
      
      this.emit('loading:completed', { 
        data: this.crmData,
        message: 'CRM data refreshed successfully!'
      });
      
      return this.crmData;
      
    } catch (error) {
      this.logger.error('Failed to refresh CRM data', { error: error.message });
      this.emit('loading:error', { 
        error: error.message,
        message: 'Failed to refresh CRM data'
      });
      throw error;
    }
  }
  
  /**
   * Stop the CRM service
   */
  async stop() {
    try {
      if (this.crmService && this.crmService.server) {
        await new Promise((resolve) => {
          this.crmService.server.close(resolve);
        });
        this.logger.info('✅ CRM service stopped');
      }
    } catch (error) {
      this.logger.error('Failed to stop CRM service', { error: error.message });
    }
  }
}

module.exports = CRMStartupService;
