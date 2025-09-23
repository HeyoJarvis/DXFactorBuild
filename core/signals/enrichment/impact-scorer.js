/**
 * Impact Scorer - Uses Anthropic Claude to assess business impact of signals
 * 
 * Features:
 * 1. Competitive threat assessment
 * 2. Market opportunity identification
 * 3. Strategic importance scoring
 * 4. Urgency evaluation
 * 5. Business relevance analysis
 */

const AIAnalyzer = require('./ai-analyzer');
const winston = require('winston');

class ImpactScorer {
  constructor(options = {}) {
    this.options = {
      logLevel: 'info',
      ...options
    };
    
    this.logger = winston.createLogger({
      level: this.options.logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      defaultMeta: { service: 'impact-scorer' }
    });
    
    this.aiAnalyzer = new AIAnalyzer(options);
  }
  
  /**
   * Score the business impact of a signal
   */
  async scoreImpact(signal, userContext = {}) {
    try {
      this.logger.debug('Scoring signal impact', {
        signal_id: signal.id,
        category: signal.category
      });
      
      // Get AI analysis
      const aiAnalysis = await this.aiAnalyzer.assessCompetitiveImpact(signal, userContext);
      
      // Combine with rule-based scoring
      const ruleBasedScore = this.calculateRuleBasedScore(signal, userContext);
      
      // Create final impact assessment
      const impactAssessment = this.combineScores(aiAnalysis, ruleBasedScore, signal, userContext);
      
      this.logger.info('Impact scoring completed', {
        signal_id: signal.id,
        competitive_threat: impactAssessment.competitive_threat,
        strategic_importance: impactAssessment.strategic_importance
      });
      
      return impactAssessment;
      
    } catch (error) {
      this.logger.error('Impact scoring failed', {
        signal_id: signal.id,
        error: error.message
      });
      
      // Return default scores
      return this.getDefaultImpactAssessment(signal, userContext);
    }
  }
  
  /**
   * Calculate rule-based impact scores
   */
  calculateRuleBasedScore(signal, userContext) {
    const scores = {
      competitive_threat: 0.5,
      market_opportunity: 0.5,
      strategic_importance: 0.5,
      urgency: 0.5
    };
    
    // Category-based scoring
    const categoryScores = this.getCategoryScores(signal.category);
    Object.assign(scores, categoryScores);
    
    // Competitor mention boost
    if (this.mentionsCompetitors(signal, userContext)) {
      scores.competitive_threat += 0.2;
      scores.strategic_importance += 0.15;
      scores.urgency += 0.1;
    }
    
    // Our product mention boost
    if (this.mentionsOurProducts(signal, userContext)) {
      scores.competitive_threat += 0.25;
      scores.strategic_importance += 0.2;
      scores.urgency += 0.15;
    }
    
    // Trust level adjustment
    const trustMultiplier = this.getTrustMultiplier(signal.trust_level);
    Object.keys(scores).forEach(key => {
      scores[key] *= trustMultiplier;
    });
    
    // Recency adjustment
    const recencyMultiplier = this.getRecencyMultiplier(signal.published_at);
    scores.urgency *= recencyMultiplier;
    
    // Priority adjustment
    const priorityBoost = this.getPriorityBoost(signal.priority);
    Object.keys(scores).forEach(key => {
      scores[key] += priorityBoost;
    });
    
    // Clamp all scores to [0, 1]
    Object.keys(scores).forEach(key => {
      scores[key] = Math.max(0, Math.min(1, scores[key]));
    });
    
    return scores;
  }
  
  /**
   * Get base scores by signal category
   */
  getCategoryScores(category) {
    const categoryScoring = {
      product_launch: {
        competitive_threat: 0.8,
        market_opportunity: 0.6,
        strategic_importance: 0.7,
        urgency: 0.8
      },
      funding: {
        competitive_threat: 0.6,
        market_opportunity: 0.7,
        strategic_importance: 0.6,
        urgency: 0.4
      },
      acquisition: {
        competitive_threat: 0.9,
        market_opportunity: 0.5,
        strategic_importance: 0.9,
        urgency: 0.7
      },
      partnership: {
        competitive_threat: 0.5,
        market_opportunity: 0.8,
        strategic_importance: 0.6,
        urgency: 0.5
      },
      leadership_change: {
        competitive_threat: 0.4,
        market_opportunity: 0.3,
        strategic_importance: 0.5,
        urgency: 0.3
      },
      market_expansion: {
        competitive_threat: 0.7,
        market_opportunity: 0.8,
        strategic_importance: 0.7,
        urgency: 0.6
      },
      technology_update: {
        competitive_threat: 0.6,
        market_opportunity: 0.6,
        strategic_importance: 0.8,
        urgency: 0.5
      },
      pricing_change: {
        competitive_threat: 0.8,
        market_opportunity: 0.4,
        strategic_importance: 0.6,
        urgency: 0.9
      },
      security_incident: {
        competitive_threat: 0.3,
        market_opportunity: 0.7,
        strategic_importance: 0.4,
        urgency: 0.8
      },
      regulatory_change: {
        competitive_threat: 0.5,
        market_opportunity: 0.6,
        strategic_importance: 0.8,
        urgency: 0.7
      }
    };
    
    return categoryScoring[category] || {
      competitive_threat: 0.5,
      market_opportunity: 0.5,
      strategic_importance: 0.5,
      urgency: 0.5
    };
  }
  
  /**
   * Check if signal mentions competitors
   */
  mentionsCompetitors(signal, userContext) {
    if (!userContext.competitors) return false;
    
    const text = `${signal.title} ${signal.summary}`.toLowerCase();
    return userContext.competitors.some(competitor => 
      text.includes(competitor.toLowerCase())
    );
  }
  
  /**
   * Check if signal mentions our products
   */
  mentionsOurProducts(signal, userContext) {
    if (!userContext.our_products) return false;
    
    const text = `${signal.title} ${signal.summary}`.toLowerCase();
    return userContext.our_products.some(product => 
      text.includes(product.name.toLowerCase())
    );
  }
  
  /**
   * Get trust level multiplier
   */
  getTrustMultiplier(trustLevel) {
    const multipliers = {
      verified: 1.0,
      official: 0.95,
      reliable: 0.85,
      unverified: 0.7
    };
    
    return multipliers[trustLevel] || 0.8;
  }
  
  /**
   * Get recency multiplier for urgency
   */
  getRecencyMultiplier(publishedAt) {
    const ageHours = (Date.now() - new Date(publishedAt)) / (1000 * 60 * 60);
    
    // More recent signals are more urgent
    if (ageHours < 1) return 1.2;
    if (ageHours < 6) return 1.1;
    if (ageHours < 24) return 1.0;
    if (ageHours < 72) return 0.9;
    return 0.8;
  }
  
  /**
   * Get priority boost
   */
  getPriorityBoost(priority) {
    const boosts = {
      critical: 0.2,
      high: 0.1,
      medium: 0.0,
      low: -0.1,
      fyi: -0.2
    };
    
    return boosts[priority] || 0.0;
  }
  
  /**
   * Combine AI and rule-based scores
   */
  combineScores(aiScores, ruleScores, signal, userContext) {
    // Weight: 60% AI, 40% rules (if AI is available)
    const aiWeight = this.aiAnalyzer.isConfigured() ? 0.6 : 0.0;
    const ruleWeight = 1.0 - aiWeight;
    
    const combined = {
      competitive_threat: (aiScores.competitive_threat * aiWeight) + (ruleScores.competitive_threat * ruleWeight),
      market_opportunity: (aiScores.market_opportunity * aiWeight) + (ruleScores.market_opportunity * ruleWeight),
      strategic_importance: (aiScores.strategic_importance * aiWeight) + (ruleScores.strategic_importance * ruleWeight),
      urgency: (aiScores.urgency * aiWeight) + (ruleScores.urgency * ruleWeight),
      confidence: aiScores.confidence || 0.7,
      reasoning: aiScores.reasoning || this.generateRuleBasedReasoning(signal, ruleScores, userContext)
    };
    
    // Ensure all scores are in valid range
    Object.keys(combined).forEach(key => {
      if (typeof combined[key] === 'number') {
        combined[key] = Math.max(0, Math.min(1, combined[key]));
      }
    });
    
    return combined;
  }
  
  /**
   * Generate reasoning for rule-based scoring
   */
  generateRuleBasedReasoning(signal, scores, userContext) {
    const reasons = [];
    
    if (scores.competitive_threat > 0.7) {
      reasons.push('High competitive threat detected');
    }
    
    if (this.mentionsCompetitors(signal, userContext)) {
      reasons.push('Mentions known competitors');
    }
    
    if (this.mentionsOurProducts(signal, userContext)) {
      reasons.push('References our products');
    }
    
    if (signal.category === 'product_launch') {
      reasons.push('Product launch signals require immediate attention');
    }
    
    if (signal.priority === 'critical') {
      reasons.push('Marked as critical priority');
    }
    
    return reasons.length > 0 ? reasons.join(', ') : 'Standard impact assessment';
  }
  
  /**
   * Get default impact assessment
   */
  getDefaultImpactAssessment(signal, userContext) {
    const ruleScores = this.calculateRuleBasedScore(signal, userContext);
    
    return {
      competitive_threat: ruleScores.competitive_threat,
      market_opportunity: ruleScores.market_opportunity,
      strategic_importance: ruleScores.strategic_importance,
      urgency: ruleScores.urgency,
      confidence: 0.6,
      reasoning: this.generateRuleBasedReasoning(signal, ruleScores, userContext)
    };
  }
  
  /**
   * Batch score multiple signals
   */
  async batchScore(signals, userContext = {}) {
    const results = [];
    
    for (const signal of signals) {
      try {
        const impact = await this.scoreImpact(signal, userContext);
        results.push({
          signal_id: signal.id,
          impact_assessment: impact,
          success: true
        });
      } catch (error) {
        results.push({
          signal_id: signal.id,
          impact_assessment: this.getDefaultImpactAssessment(signal, userContext),
          success: false,
          error: error.message
        });
      }
    }
    
    return results;
  }
  
  /**
   * Get scoring statistics
   */
  getStats() {
    return {
      ai_analyzer_configured: this.aiAnalyzer.isConfigured(),
      ai_analyzer_stats: this.aiAnalyzer.getStats(),
      scoring_categories: Object.keys(this.getCategoryScores('product_launch'))
    };
  }
}

module.exports = ImpactScorer;
