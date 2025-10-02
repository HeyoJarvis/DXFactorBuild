/**
 * Supabase Adapter for CRM Integration
 * 
 * Connects CRM integration to Supabase for:
 * 1. Analysis history persistence
 * 2. Alert tracking
 * 3. Company intelligence storage
 * 4. Recommendation history
 */

const SupabaseClient = require('../data/storage/supabase-client');

class CRMSupabaseAdapter {
  constructor(options = {}) {
    // Use service role key for admin operations in background services
    const supabaseOptions = {
      useServiceRole: true, // Bypass RLS for background operations
      ...options
    };
    this.supabase = new SupabaseClient(supabaseOptions);
    this.logger = options.logger || console;
  }

  /**
   * Store CRM analysis results
   */
  async storeAnalysis(organizationId, analysisData) {
    try {
      // Create a signal for the analysis
      const signal = await this.supabase.createSignal({
        title: `CRM Analysis: ${analysisData.organizationName || organizationId}`,
        summary: this._generateAnalysisSummary(analysisData),
        content: JSON.stringify(analysisData.recommendations),
        url: `https://app.hubspot.com/contacts/${organizationId}`,
        category: 'competitive_analysis',
        priority: this._mapUrgencyToPriority(analysisData.urgency),
        published_at: new Date(),
        entities: analysisData.intelligenceData?.entities || [],
        keywords: analysisData.intelligenceData?.keywords || [],
        relevance_score: analysisData.intelligenceData?.confidenceScore || 0.5,
        impact_assessment: {
          organization_id: organizationId,
          deals: analysisData.dealAnalysis,
          recommendations: analysisData.recommendations,
          context: analysisData.intelligenceData
        }
      });

      this.logger.info('Stored CRM analysis', { 
        signal_id: signal.id,
        organization_id: organizationId
      });

      return signal;

    } catch (error) {
      this.logger.error('Failed to store analysis', { 
        organization_id: organizationId,
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Get analysis history for an organization
   */
  async getAnalysisHistory(organizationId, limit = 10) {
    try {
      const { data, error } = await this.supabase.getClient()
        .from('signals')
        .select('*')
        .eq('category', 'competitive_analysis')
        .contains('impact_assessment', { organization_id: organizationId })
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return data || [];

    } catch (error) {
      this.logger.error('Failed to get analysis history', { 
        organization_id: organizationId,
        error: error.message 
      });
      return [];
    }
  }

  /**
   * Get analyses (alias for getAnalysisHistory for API consistency)
   */
  async getAnalyses(organizationId, options = {}) {
    const limit = options.limit || 10;
    return this.getAnalysisHistory(organizationId, limit);
  }

  /**
   * Store alert
   */
  async storeAlert(organizationId, alertData) {
    try {
      // Create a high-priority signal for the alert
      const signal = await this.supabase.createSignal({
        title: `🚨 ${alertData.title}`,
        summary: alertData.message,
        content: JSON.stringify(alertData.context),
        url: `https://app.hubspot.com/contacts/${organizationId}`,
        category: this._mapAlertTypeToCategory(alertData.type),
        priority: 'critical',
        published_at: new Date(),
        relevance_score: 0.9,
        impact_assessment: {
          alert_type: alertData.type,
          organization_id: organizationId,
          severity: alertData.severity || 'high',
          context: alertData.context
        }
      });

      this.logger.info('Stored alert', { 
        signal_id: signal.id,
        organization_id: organizationId,
        alert_type: alertData.type
      });

      return signal;

    } catch (error) {
      this.logger.error('Failed to store alert', { 
        organization_id: organizationId,
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Get recent alerts
   */
  async getRecentAlerts(organizationId = null, hours = 24) {
    try {
      const since = new Date();
      since.setHours(since.getHours() - hours);

      let query = this.supabase.getClient()
        .from('signals')
        .select('*')
        .eq('priority', 'critical')
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: false });

      if (organizationId) {
        query = query.contains('impact_assessment', { organization_id: organizationId });
      }

      const { data, error } = await query;

      if (error) throw error;

      return data || [];

    } catch (error) {
      this.logger.error('Failed to get recent alerts', { 
        organization_id: organizationId,
        error: error.message 
      });
      return [];
    }
  }

  /**
   * Store company intelligence data
   */
  async storeCompanyIntelligence(companyData) {
    try {
      // Store as a source for future reference
      const source = await this.supabase.createSource({
        name: companyData.name,
        description: companyData.description,
        type: 'scraper',
        category: 'company_profile',
        url: companyData.website,
        homepage: companyData.website,
        extraction_config: {
          company_intelligence: companyData
        },
        quality_metrics: {
          confidence_score: companyData.confidenceScore,
          last_updated: new Date()
        },
        is_public: false
      });

      this.logger.info('Stored company intelligence', { 
        source_id: source.id,
        company: companyData.name
      });

      return source;

    } catch (error) {
      this.logger.error('Failed to store company intelligence', { 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Get stored company intelligence
   */
  async getCompanyIntelligence(companyName) {
    try {
      const { data, error } = await this.supabase.getClient()
        .from('sources')
        .select('*')
        .eq('category', 'company_profile')
        .ilike('name', `%${companyName}%`)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      return data?.extraction_config?.company_intelligence || null;

    } catch (error) {
      this.logger.error('Failed to get company intelligence', { 
        company: companyName,
        error: error.message 
      });
      return null;
    }
  }

  /**
   * Track recommendation delivery
   */
  async trackRecommendation(organizationId, recommendation) {
    try {
      // Store as feedback for learning
      const feedback = await this.supabase.createFeedback({
        user_id: recommendation.user_id || null,
        signal_id: recommendation.signal_id || null,
        type: 'create_task',
        value: {
          recommendation_type: recommendation.type,
          priority: recommendation.priority,
          delivered: true
        },
        comment: recommendation.description,
        context: {
          organization_id: organizationId,
          source: 'crm_integration',
          automated: true
        }
      });

      this.logger.info('Tracked recommendation', { 
        feedback_id: feedback.id,
        organization_id: organizationId
      });

      return feedback;

    } catch (error) {
      this.logger.error('Failed to track recommendation', { 
        organization_id: organizationId,
        error: error.message 
      });
      // Don't throw - tracking failure shouldn't break recommendations
      return null;
    }
  }

  /**
   * Get recommendation effectiveness
   */
  async getRecommendationEffectiveness(organizationId = null) {
    try {
      let query = this.supabase.getClient()
        .from('feedback')
        .select('*')
        .eq('type', 'create_task')
        .eq('context->>source', 'crm_integration');

      if (organizationId) {
        query = query.eq('context->>organization_id', organizationId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Calculate effectiveness metrics
      const total = data.length;
      const successful = data.filter(f => f.processed && f.used_for_training).length;
      
      return {
        total_recommendations: total,
        successful: successful,
        success_rate: total > 0 ? (successful / total) * 100 : 0,
        by_type: this._groupByType(data)
      };

    } catch (error) {
      this.logger.error('Failed to get recommendation effectiveness', { 
        error: error.message 
      });
      return { total_recommendations: 0, successful: 0, success_rate: 0 };
    }
  }

  // Helper methods

  _generateAnalysisSummary(analysisData) {
    const parts = [];
    
    if (analysisData.dealAnalysis?.totalValue) {
      parts.push(`Total pipeline value: $${analysisData.dealAnalysis.totalValue.toLocaleString()}`);
    }
    
    if (analysisData.recommendations?.length) {
      parts.push(`${analysisData.recommendations.length} recommendations generated`);
    }

    if (analysisData.intelligenceData?.confidenceScore) {
      parts.push(`Confidence: ${(analysisData.intelligenceData.confidenceScore * 100).toFixed(0)}%`);
    }

    return parts.join(' • ');
  }

  _mapUrgencyToPriority(urgency) {
    const mapping = {
      'critical': 'critical',
      'high': 'high',
      'medium': 'medium',
      'low': 'low'
    };
    return mapping[urgency] || 'medium';
  }

  _mapAlertTypeToCategory(alertType) {
    const mapping = {
      'at_risk': 'security_incident',
      'opportunity': 'market_expansion',
      'milestone': 'product_launch',
      'engagement': 'competitive_analysis'
    };
    return mapping[alertType] || 'industry_trend';
  }

  _groupByType(data) {
    return data.reduce((acc, item) => {
      const type = item.value?.recommendation_type || 'unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});
  }
}

module.exports = CRMSupabaseAdapter;

