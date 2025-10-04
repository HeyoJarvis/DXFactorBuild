/**
 * CRM Service
 * Handles CRM data integration and analysis - Connected to real CRM service
 */

const fetch = require('node-fetch');

class CRMService {
  constructor({ logger }) {
    this.logger = logger;
    this.isInitialized = false;
    this.data = {};
    this.serviceUrl = 'http://localhost:3002'; // CRM intelligent service
  }

  /**
   * Initialize the CRM service
   */
  async initialize() {
    try {
      // Test connection to CRM service
      const response = await fetch(`${this.serviceUrl}/health`);
      if (response.ok) {
        this.isInitialized = true;
        this.logger.info('CRM Service initialized and connected to intelligent service');
      } else {
        this.logger.warn('CRM Service initialized but intelligent service unavailable');
        this.isInitialized = false;
      }
    } catch (error) {
      this.logger.error('CRM initialization failed:', error);
      this.isInitialized = false;
    }
  }

  /**
   * Get CRM data from intelligent service
   */
  async getData() {
    try {
      const response = await fetch(`${this.serviceUrl}/analysis/latest/heyjarvis_org`);
      
      if (!response.ok) {
        throw new Error(`CRM Service responded with ${response.status}: ${response.statusText}`);
      }
      
      const crmData = await response.json();
      
      this.logger.info('CRM data retrieved', {
        patterns: crmData.patterns?.length || 0,
        recommendations: crmData.recommendations?.length || 0,
        workflows: crmData.workflows?.length || 0
      });
      
      // Format data for frontend
      return {
        success: true,
        insights: (crmData.patterns || []).map(pattern => ({
          type: pattern.priority === 'high' ? 'critical' : pattern.priority === 'medium' ? 'warning' : 'positive',
          title: pattern.pattern_name || pattern.title || 'CRM Pattern',
          message: pattern.description || pattern.insight || 'CRM workflow pattern detected'
        })),
        recommendations: (crmData.recommendations || []).map(rec => ({
          title: rec.title || rec.recommendation_title || 'CRM Recommendation',
          description: rec.description || rec.details || 'Workflow optimization suggestion',
          priority: rec.priority || 'medium',
          impact: rec.impact || 'Workflow efficiency'
        })),
        workflows: crmData.workflows || [],
        summary: crmData.summary || 'CRM analysis completed',
        last_updated: crmData.timestamp || new Date().toISOString()
      };
      
    } catch (error) {
      this.logger.error('Failed to get CRM data:', error.message);
      
      // Return fallback data
      return {
        success: false,
        error: error.message,
        insights: [
          {
            type: 'warning',
            title: 'CRM Service Connection',
            message: `Unable to connect to CRM service at ${this.serviceUrl}. Make sure the intelligent background service is running.`
          }
        ],
        recommendations: [
          {
            title: 'Start CRM Service',
            description: 'Run the CRM intelligent background service to get real-time insights.',
            priority: 'high'
          }
        ]
      };
    }
  }

  /**
   * Trigger CRM analysis refresh
   */
  async refresh() {
    try {
      this.logger.info('Triggering CRM analysis refresh...');
      
      const response = await fetch(`${this.serviceUrl}/analysis/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          website: process.env.COMPANY_WEBSITE || 'https://example.com',
          organization_id: 'heyjarvis_org'
        })
      });
      
      if (!response.ok) {
        throw new Error(`CRM Service responded with ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      this.logger.info('CRM analysis triggered', {
        analysis_id: result.analysis_id,
        status: result.status
      });
      
      return {
        success: true,
        message: 'CRM analysis refresh triggered successfully',
        analysis_id: result.analysis_id
      };
      
    } catch (error) {
      this.logger.error('Failed to refresh CRM:', error.message);
      return {
        success: false,
        error: error.message,
        message: 'Failed to trigger CRM refresh. Make sure the CRM service is running.'
      };
    }
  }

  /**
   * Get CRM recommendations
   */
  async getRecommendations(orgId = 'heyjarvis_org') {
    try {
      const response = await fetch(`${this.serviceUrl}/recommendations/${orgId}`);
      
      if (!response.ok) {
        throw new Error(`Recommendations service responded with ${response.status}`);
      }
      
      const recommendations = await response.json();
      
      return {
        success: true,
        recommendations: recommendations.map(rec => ({
          title: rec.title || rec.recommendation_title,
          description: rec.description || rec.details,
          priority: rec.priority || 'medium',
          category: rec.category || 'workflow',
          impact: rec.impact || 'efficiency'
        }))
      };
      
    } catch (error) {
      this.logger.error('Failed to get recommendations:', error.message);
      return {
        success: false,
        error: error.message,
        recommendations: []
      };
    }
  }

  /**
   * Get service status
   */
  async getStatus() {
    try {
      const response = await fetch(`${this.serviceUrl}/health`);
      
      if (!response.ok) {
        throw new Error(`Health check failed with ${response.status}`);
      }
      
      const health = await response.json();
      
      return {
        success: true,
        connected: true,
        status: 'healthy',
        message: 'CRM service is operational',
        service_url: this.serviceUrl,
        version: health.version,
        uptime: health.uptime
      };
      
    } catch (error) {
      this.logger.error('CRM health check failed:', error.message);
      return {
        success: false,
        connected: false,
        status: 'unhealthy',
        message: `CRM service unavailable: ${error.message}`,
        service_url: this.serviceUrl
      };
    }
  }

  /**
   * Cleanup
   */
  cleanup() {
    this.data = {};
    this.isInitialized = false;
    this.logger.info('CRM Service cleaned up');
  }
}

module.exports = CRMService;

