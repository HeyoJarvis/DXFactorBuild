/**
 * User Model - Personalized relevance scoring based on user context and behavior
 * 
 * Features:
 * 1. Dynamic user profiling from feedback
 * 2. Context-aware relevance scoring
 * 3. Behavioral pattern learning
 * 4. Multi-dimensional preference modeling
 * 5. Real-time adaptation
 */

const winston = require('winston');
const { UserHelpers, FeedbackHelpers } = require('@heyjarvis/data');

class UserModel {
  constructor(options = {}) {
    this.options = {
      learningRate: 0.1,
      decayFactor: 0.95,
      minFeedbackForLearning: 5,
      maxHistoryDays: 90,
      logLevel: 'info',
      ...options
    };
    
    this.logger = winston.createLogger({
      level: this.options.logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      defaultMeta: { service: 'user-model' }
    });
    
    // User profiles cache
    this.userProfiles = new Map();
    
    // Feature weights for different aspects of relevance
    this.featureWeights = {
      category_match: 0.25,
      competitor_relevance: 0.30,
      keyword_overlap: 0.20,
      source_trust: 0.15,
      temporal_relevance: 0.10
    };
  }
  
  /**
   * Calculate relevance score for a signal and user
   */
  async calculateRelevance(signal, user, context = {}) {
    try {
      const profile = await this.getUserProfile(user.id);
      
      this.logger.debug('Calculating relevance', {
        signal_id: signal.id,
        user_id: user.id,
        signal_category: signal.category
      });
      
      // Extract features from signal and user context
      const features = this.extractFeatures(signal, user, context);
      
      // Calculate component scores
      const scores = {
        category_match: this.scoreCategoryMatch(features, profile),
        competitor_relevance: this.scoreCompetitorRelevance(features, profile),
        keyword_overlap: this.scoreKeywordOverlap(features, profile),
        source_trust: this.scoreSourceTrust(features, profile),
        temporal_relevance: this.scoreTemporalRelevance(features, profile),
        personalization: this.scorePersonalization(features, profile)
      };
      
      // Calculate weighted final score
      let relevanceScore = 0;
      for (const [component, weight] of Object.entries(this.featureWeights)) {
        relevanceScore += scores[component] * weight;
      }
      
      // Apply personalization boost
      relevanceScore = Math.min(1.0, relevanceScore + scores.personalization * 0.1);
      
      // Apply user-specific adjustments
      relevanceScore = this.applyUserAdjustments(relevanceScore, signal, profile);
      
      this.logger.debug('Relevance calculated', {
        signal_id: signal.id,
        user_id: user.id,
        final_score: relevanceScore,
        component_scores: scores
      });
      
      return {
        score: Math.max(0, Math.min(1, relevanceScore)),
        components: scores,
        explanation: this.generateExplanation(scores, features, profile)
      };
      
    } catch (error) {
      this.logger.error('Relevance calculation failed', {
        signal_id: signal.id,
        user_id: user.id,
        error: error.message
      });
      
      // Return default score on error
      return {
        score: 0.5,
        components: {},
        explanation: 'Error calculating relevance'
      };
    }
  }
  
  /**
   * Get or create user profile
   */
  async getUserProfile(userId) {
    if (this.userProfiles.has(userId)) {
      const profile = this.userProfiles.get(userId);
      
      // Check if profile needs refresh
      const ageHours = (Date.now() - profile.last_updated) / (1000 * 60 * 60);
      if (ageHours < 1) { // Cache for 1 hour
        return profile;
      }
    }
    
    // Create or refresh profile
    const profile = await this.buildUserProfile(userId);
    this.userProfiles.set(userId, profile);
    
    return profile;
  }
  
  /**
   * Build comprehensive user profile
   */
  async buildUserProfile(userId) {
    // In production, this would fetch from database
    // For now, using mock data structure
    
    const profile = {
      user_id: userId,
      
      // Category preferences (learned from feedback)
      category_preferences: {
        product_launch: 0.8,
        funding: 0.6,
        acquisition: 0.9,
        partnership: 0.5,
        leadership_change: 0.7,
        pricing_change: 0.4
      },
      
      // Competitor interest levels
      competitor_interests: {
        // Will be populated from user context and feedback
      },
      
      // Keyword importance weights
      keyword_weights: {
        // Learned from user interactions
      },
      
      // Source trust adjustments
      source_adjustments: {
        // User-specific source reliability scores
      },
      
      // Temporal preferences
      temporal_preferences: {
        recency_importance: 0.7, // How much user cares about recent vs older signals
        time_of_day_activity: {}, // When user is most active
        preferred_frequency: 'medium' // high, medium, low
      },
      
      // Behavioral patterns
      behavior_patterns: {
        avg_time_per_signal: 30, // seconds
        action_rate: 0.15, // % of signals that lead to actions
        feedback_rate: 0.25, // % of signals that get feedback
        preferred_channels: ['slack', 'desktop']
      },
      
      // Learning metadata
      total_feedback_count: 0,
      model_accuracy: 0.5,
      last_updated: Date.now(),
      model_version: '1.0'
    };
    
    return profile;
  }
  
  /**
   * Extract features from signal, user, and context
   */
  extractFeatures(signal, user, context) {
    return {
      // Signal features
      signal_category: signal.category,
      signal_priority: signal.priority,
      signal_keywords: signal.keywords || [],
      signal_entities: signal.entities || [],
      signal_source_id: signal.source_id,
      signal_age_hours: this.calculateSignalAge(signal),
      signal_trust_level: signal.trust_level,
      
      // User features
      user_role: user.context?.role,
      user_seniority: user.context?.seniority,
      user_department: user.context?.department,
      user_focus_areas: user.context?.focus_areas || [],
      user_competitors: [
        ...(user.context?.primary_competitors || []),
        ...(user.context?.secondary_competitors || [])
      ],
      user_products: user.context?.products_owned || [],
      user_technologies: user.context?.technologies_used || [],
      
      // Context features
      time_of_day: new Date().getHours(),
      day_of_week: new Date().getDay(),
      is_work_hours: UserHelpers.isInWorkHours(user),
      
      // Derived features
      has_competitor_mention: this.hasCompetitorMention(signal, user),
      has_product_mention: this.hasProductMention(signal, user),
      keyword_overlap_count: this.calculateKeywordOverlap(signal, user)
    };
  }
  
  /**
   * Score category match
   */
  scoreCategoryMatch(features, profile) {
    const categoryPref = profile.category_preferences[features.signal_category] || 0.5;
    
    // Boost for user's role-specific interests
    let roleBoost = 0;
    switch (features.user_role) {
      case 'product_manager':
        if (['product_launch', 'partnership'].includes(features.signal_category)) {
          roleBoost = 0.2;
        }
        break;
      case 'executive':
        if (['acquisition', 'funding', 'leadership_change'].includes(features.signal_category)) {
          roleBoost = 0.2;
        }
        break;
      case 'marketing_manager':
        if (['product_launch', 'partnership', 'pricing_change'].includes(features.signal_category)) {
          roleBoost = 0.2;
        }
        break;
    }
    
    return Math.min(1.0, categoryPref + roleBoost);
  }
  
  /**
   * Score competitor relevance
   */
  scoreCompetitorRelevance(features, profile) {
    if (!features.has_competitor_mention) {
      return 0.3; // Base score for non-competitor signals
    }
    
    // High score for competitor mentions
    let score = 0.8;
    
    // Check if it's a primary vs secondary competitor
    const signal_entities = features.signal_entities.filter(e => e.type === 'company');
    
    for (const entity of signal_entities) {
      if (features.user_competitors.includes(entity.name)) {
        // Check if it's primary competitor (higher weight)
        if (features.user_competitors.slice(0, 3).includes(entity.name)) {
          score = Math.max(score, 0.95);
        } else {
          score = Math.max(score, 0.8);
        }
        
        // Apply user-specific competitor interest
        const interest = profile.competitor_interests[entity.name] || 1.0;
        score *= interest;
      }
    }
    
    return Math.min(1.0, score);
  }
  
  /**
   * Score keyword overlap
   */
  scoreKeywordOverlap(features, profile) {
    if (features.keyword_overlap_count === 0) {
      return 0.2;
    }
    
    const maxOverlap = Math.max(features.signal_keywords.length, features.user_focus_areas.length);
    const overlapRatio = maxOverlap > 0 ? features.keyword_overlap_count / maxOverlap : 0;
    
    // Apply user-specific keyword weights
    let weightedScore = 0;
    let totalWeight = 0;
    
    for (const keyword of features.signal_keywords) {
      const weight = profile.keyword_weights[keyword] || 1.0;
      weightedScore += weight;
      totalWeight += 1;
    }
    
    const avgWeight = totalWeight > 0 ? weightedScore / totalWeight : 1.0;
    
    return Math.min(1.0, overlapRatio * avgWeight);
  }
  
  /**
   * Score source trust
   */
  scoreSourceTrust(features, profile) {
    // Base trust from signal
    const baseTrust = this.mapTrustLevel(features.signal_trust_level);
    
    // Apply user-specific source adjustments
    const sourceAdjustment = profile.source_adjustments[features.signal_source_id] || 0;
    
    return Math.max(0, Math.min(1, baseTrust + sourceAdjustment));
  }
  
  /**
   * Score temporal relevance
   */
  scoreTemporalRelevance(features, profile) {
    const ageHours = features.signal_age_hours;
    const recencyImportance = profile.temporal_preferences.recency_importance;
    
    // Decay function: newer signals score higher
    const recencyScore = Math.exp(-ageHours / 24) * recencyImportance;
    
    // Time of day relevance
    const timeScore = features.is_work_hours ? 1.0 : 0.7;
    
    return (recencyScore + timeScore) / 2;
  }
  
  /**
   * Score personalization based on learned preferences
   */
  scorePersonalization(features, profile) {
    let score = 0;
    
    // Boost based on user's historical engagement with similar signals
    if (profile.total_feedback_count >= this.options.minFeedbackForLearning) {
      score += profile.model_accuracy - 0.5; // Center around 0
    }
    
    // Boost for signals matching user's behavioral patterns
    if (features.user_role === 'executive' && features.signal_priority === 'high') {
      score += 0.2;
    }
    
    return Math.max(-0.3, Math.min(0.3, score)); // Limit personalization impact
  }
  
  /**
   * Apply user-specific adjustments
   */
  applyUserAdjustments(score, signal, profile) {
    // Apply global user preferences
    if (profile.behavior_patterns.preferred_frequency === 'low' && score < 0.8) {
      score *= 0.8; // Reduce scores for low-frequency users
    } else if (profile.behavior_patterns.preferred_frequency === 'high') {
      score *= 1.1; // Boost scores for high-frequency users
    }
    
    // Apply time-based adjustments
    const currentHour = new Date().getHours();
    const activityLevel = profile.temporal_preferences.time_of_day_activity[currentHour] || 1.0;
    score *= activityLevel;
    
    return score;
  }
  
  /**
   * Update user profile with feedback
   */
  async updateWithFeedback(userId, signal, feedback) {
    const profile = await this.getUserProfile(userId);
    
    this.logger.debug('Updating user profile with feedback', {
      user_id: userId,
      signal_id: signal.id,
      feedback_type: feedback.type,
      feedback_value: feedback.value
    });
    
    const isPositive = FeedbackHelpers.isPositiveFeedback(feedback);
    const learningRate = this.options.learningRate;
    
    // Update category preferences
    if (isPositive !== null) {
      const currentPref = profile.category_preferences[signal.category] || 0.5;
      const adjustment = isPositive ? learningRate : -learningRate;
      profile.category_preferences[signal.category] = Math.max(0, Math.min(1, currentPref + adjustment));
    }
    
    // Update competitor interests
    for (const entity of signal.entities || []) {
      if (entity.type === 'company' && entity.is_competitor) {
        const currentInterest = profile.competitor_interests[entity.name] || 1.0;
        const adjustment = isPositive ? learningRate * 0.5 : -learningRate * 0.5;
        profile.competitor_interests[entity.name] = Math.max(0.2, Math.min(1.5, currentInterest + adjustment));
      }
    }
    
    // Update keyword weights
    for (const keyword of signal.keywords || []) {
      const currentWeight = profile.keyword_weights[keyword] || 1.0;
      const adjustment = isPositive ? learningRate * 0.3 : -learningRate * 0.3;
      profile.keyword_weights[keyword] = Math.max(0.3, Math.min(2.0, currentWeight + adjustment));
    }
    
    // Update source adjustments
    const currentSourceAdj = profile.source_adjustments[signal.source_id] || 0;
    const sourceAdjustment = isPositive ? learningRate * 0.1 : -learningRate * 0.1;
    profile.source_adjustments[signal.source_id] = Math.max(-0.3, Math.min(0.3, currentSourceAdj + sourceAdjustment));
    
    // Update behavioral patterns
    profile.behavior_patterns.feedback_rate = this.updateMovingAverage(
      profile.behavior_patterns.feedback_rate,
      1.0, // This signal got feedback
      profile.total_feedback_count
    );
    
    if (['action', 'flag', 'create_task', 'share'].includes(feedback.type)) {
      profile.behavior_patterns.action_rate = this.updateMovingAverage(
        profile.behavior_patterns.action_rate,
        1.0, // This signal led to action
        profile.total_feedback_count
      );
    }
    
    // Update metadata
    profile.total_feedback_count++;
    profile.last_updated = Date.now();
    
    // Recalculate model accuracy (simplified)
    if (profile.total_feedback_count >= this.options.minFeedbackForLearning) {
      // This would be more sophisticated in production
      profile.model_accuracy = isPositive ? 
        Math.min(1.0, profile.model_accuracy + 0.01) :
        Math.max(0.0, profile.model_accuracy - 0.01);
    }
    
    // Update cache
    this.userProfiles.set(userId, profile);
    
    this.logger.info('User profile updated', {
      user_id: userId,
      total_feedback: profile.total_feedback_count,
      model_accuracy: profile.model_accuracy
    });
  }
  
  /**
   * Generate explanation for relevance score
   */
  generateExplanation(scores, features, profile) {
    const explanations = [];
    
    if (scores.competitor_relevance > 0.7) {
      explanations.push('Mentions your competitors');
    }
    
    if (scores.category_match > 0.7) {
      explanations.push(`Matches your interest in ${features.signal_category.replace('_', ' ')}`);
    }
    
    if (scores.keyword_overlap > 0.6) {
      explanations.push('Contains relevant keywords');
    }
    
    if (scores.source_trust > 0.8) {
      explanations.push('From a trusted source');
    }
    
    if (scores.temporal_relevance > 0.8) {
      explanations.push('Recent and timely');
    }
    
    return explanations.length > 0 ? explanations.join(', ') : 'General relevance match';
  }
  
  // Helper methods
  
  calculateSignalAge(signal) {
    const now = new Date();
    const published = new Date(signal.published_at);
    return (now - published) / (1000 * 60 * 60); // hours
  }
  
  hasCompetitorMention(signal, user) {
    const competitors = [
      ...(user.context?.primary_competitors || []),
      ...(user.context?.secondary_competitors || [])
    ];
    
    const signalText = `${signal.title} ${signal.summary}`.toLowerCase();
    return competitors.some(comp => signalText.includes(comp.toLowerCase()));
  }
  
  hasProductMention(signal, user) {
    const products = user.context?.products_owned || [];
    const signalText = `${signal.title} ${signal.summary}`.toLowerCase();
    return products.some(prod => signalText.includes(prod.toLowerCase()));
  }
  
  calculateKeywordOverlap(signal, user) {
    const signalKeywords = (signal.keywords || []).map(k => k.toLowerCase());
    const userKeywords = (user.context?.focus_areas || []).map(k => k.toLowerCase());
    
    return signalKeywords.filter(k => userKeywords.includes(k)).length;
  }
  
  mapTrustLevel(trustLevel) {
    const mapping = {
      'verified': 0.95,
      'official': 0.9,
      'reliable': 0.7,
      'unverified': 0.4
    };
    
    return mapping[trustLevel] || 0.5;
  }
  
  updateMovingAverage(currentAvg, newValue, count) {
    if (count === 0) return newValue;
    return (currentAvg * count + newValue) / (count + 1);
  }
  
  /**
   * Get user profile summary
   */
  async getProfileSummary(userId) {
    const profile = await this.getUserProfile(userId);
    
    return {
      user_id: userId,
      total_feedback: profile.total_feedback_count,
      model_accuracy: profile.model_accuracy,
      top_categories: Object.entries(profile.category_preferences)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3)
        .map(([cat, score]) => ({ category: cat, preference: score })),
      top_competitors: Object.entries(profile.competitor_interests)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([comp, interest]) => ({ competitor: comp, interest })),
      behavior_summary: {
        action_rate: profile.behavior_patterns.action_rate,
        feedback_rate: profile.behavior_patterns.feedback_rate,
        preferred_frequency: profile.temporal_preferences.preferred_frequency
      },
      last_updated: new Date(profile.last_updated)
    };
  }
}

module.exports = UserModel;
