/**
 * Enhanced Validation Pipeline - Multi-stage validation with Claude integration
 * 
 * Features:
 * 1. Content quality validation
 * 2. Source credibility checking
 * 3. Claude-powered relevance analysis
 * 4. Advanced duplicate detection
 * 5. Freshness validation
 * 6. Compliance checking
 */

const winston = require('winston');
const AIAnalyzer = require('../enrichment/ai-analyzer');
const natural = require('natural');
const compromise = require('compromise');

class ValidationPipeline {
  constructor(options = {}) {
    this.options = {
      confidenceThreshold: 0.7,
      criticalFailFast: true,
      logLevel: 'info',
      ...options
    };
    
    this.logger = winston.createLogger({
      level: this.options.logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      defaultMeta: { service: 'validation-pipeline' }
    });
    
    this.aiAnalyzer = new AIAnalyzer(options);
    
    // Initialize validators in order of execution
    this.validators = [
      new ContentQualityValidator(this.logger),
      new SourceCredibilityValidator(this.logger), 
      new RelevanceValidator(this.logger, this.aiAnalyzer),
      new DuplicateValidator(this.logger),
      new FreshnessValidator(this.logger),
      new ComplianceValidator(this.logger)
    ];
  }

  /**
   * Main validation method - runs all validators
   */
  async validateSignal(signal, context = {}) {
    const startTime = Date.now();
    const validationResults = [];
    
    this.logger.debug('Starting validation pipeline', {
      signal_id: signal.id,
      signal_title: signal.title,
      validators_count: this.validators.length
    });

    try {
      for (const validator of this.validators) {
        const result = await validator.validate(signal, context);
        validationResults.push(result);
        
        this.logger.debug('Validator completed', {
          validator: result.validator,
          passed: result.passed,
          score: result.score,
          critical: result.critical
        });
        
        // Fail fast for critical validations
        if (this.options.criticalFailFast && result.critical && !result.passed) {
          this.logger.warn('Critical validation failed, stopping pipeline', {
            signal_id: signal.id,
            validator: result.validator,
            reason: result.reason
          });
          
          return {
            valid: false,
            reason: result.reason,
            critical: true,
            validator: result.validator,
            processingTime: Date.now() - startTime,
            validationResults
          };
        }
      }
      
      // Calculate overall confidence score
      const confidenceScore = this.calculateConfidence(validationResults);
      const isValid = confidenceScore >= this.options.confidenceThreshold;
      
      this.logger.info('Validation pipeline completed', {
        signal_id: signal.id,
        valid: isValid,
        confidence: confidenceScore,
        processing_time_ms: Date.now() - startTime
      });
      
      return {
        valid: isValid,
        confidence: confidenceScore,
        processingTime: Date.now() - startTime,
        validationResults,
        recommendations: this.generateRecommendations(validationResults),
        enhancedSignal: this.enhanceSignalWithValidationData(signal, validationResults)
      };
      
    } catch (error) {
      this.logger.error('Validation pipeline failed', {
        signal_id: signal.id,
        error: error.message,
        processing_time_ms: Date.now() - startTime
      });
      
      throw error;
    }
  }

  /**
   * Calculate overall confidence from individual validator results
   */
  calculateConfidence(validationResults) {
    if (validationResults.length === 0) return 0;
    
    const weights = {
      content_quality: 0.25,
      source_credibility: 0.20,
      relevance: 0.30,
      duplicate: 0.15,
      freshness: 0.05,
      compliance: 0.05
    };
    
    let weightedSum = 0;
    let totalWeight = 0;
    
    for (const result of validationResults) {
      const weight = weights[result.validator] || 0.1;
      weightedSum += result.score * weight;
      totalWeight += weight;
    }
    
    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  /**
   * Generate actionable recommendations based on validation results
   */
  generateRecommendations(validationResults) {
    const recommendations = [];
    
    for (const result of validationResults) {
      if (!result.passed && result.recommendations) {
        recommendations.push(...result.recommendations);
      }
    }
    
    return recommendations;
  }

  /**
   * Enhance signal with validation metadata
   */
  enhanceSignalWithValidationData(signal, validationResults) {
    const validationMetadata = {
      validated_at: new Date(),
      validation_version: '2.0',
      confidence_scores: {},
      quality_metrics: {}
    };
    
    for (const result of validationResults) {
      validationMetadata.confidence_scores[result.validator] = result.score;
      if (result.metadata) {
        validationMetadata.quality_metrics[result.validator] = result.metadata;
      }
    }
    
    return {
      ...signal,
      validation_metadata: validationMetadata
    };
  }
}

/**
 * Content Quality Validator - Validates basic content requirements
 */
class ContentQualityValidator {
  constructor(logger) {
    this.logger = logger;
    this.minTitleLength = 10;
    this.minSummaryLength = 50;
    this.maxTitleLength = 500;
    this.maxSummaryLength = 2000;
  }

  async validate(signal, context) {
    const checks = {
      hasTitle: signal.title && signal.title.length >= this.minTitleLength,
      titleLength: signal.title && signal.title.length <= this.maxTitleLength,
      hasContent: signal.summary && signal.summary.length >= this.minSummaryLength,
      contentLength: signal.summary && signal.summary.length <= this.maxSummaryLength,
      hasValidUrl: this.isValidUrl(signal.url),
      hasRecentDate: this.isRecent(signal.published_at, 168), // 7 days max
      languageCheck: await this.detectLanguage(signal.title + ' ' + (signal.summary || '')),
      textQuality: this.assessTextQuality(signal.title + ' ' + (signal.summary || ''))
    };
    
    const passedChecks = Object.values(checks).filter(Boolean).length;
    const totalChecks = Object.keys(checks).length;
    const score = passedChecks / totalChecks;
    
    const recommendations = [];
    if (!checks.hasTitle) recommendations.push('Add a descriptive title');
    if (!checks.hasContent) recommendations.push('Add content summary');
    if (!checks.hasValidUrl) recommendations.push('Fix invalid URL');
    if (!checks.hasRecentDate) recommendations.push('Signal is too old');
    
    return {
      validator: 'content_quality',
      passed: score >= 0.8,
      score,
      details: checks,
      critical: score < 0.5,
      reason: score < 0.8 ? 'Content quality below threshold' : null,
      recommendations,
      metadata: {
        title_length: signal.title?.length || 0,
        summary_length: signal.summary?.length || 0,
        text_quality_score: checks.textQuality
      }
    };
  }

  isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  isRecent(dateString, maxHours) {
    if (!dateString) return false;
    const date = new Date(dateString);
    const ageHours = (Date.now() - date.getTime()) / (1000 * 60 * 60);
    return ageHours <= maxHours;
  }

  async detectLanguage(text) {
    // Simple language detection - can be enhanced with external service
    const englishWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
    const words = text.toLowerCase().split(/\s+/);
    const englishWordCount = words.filter(word => englishWords.includes(word)).length;
    const englishRatio = englishWordCount / Math.max(words.length, 1);
    
    return englishRatio > 0.1; // Assume English if >10% common English words
  }

  assessTextQuality(text) {
    if (!text) return 0;
    
    const doc = compromise(text);
    const sentences = doc.sentences().out('array');
    const words = doc.terms().out('array');
    
    // Quality indicators
    const avgWordsPerSentence = words.length / Math.max(sentences.length, 1);
    const hasProperCapitalization = /^[A-Z]/.test(text);
    const hasProperPunctuation = /[.!?]$/.test(text.trim());
    const spellingQuality = this.checkSpelling(words);
    
    let qualityScore = 0;
    if (avgWordsPerSentence >= 5 && avgWordsPerSentence <= 25) qualityScore += 0.3;
    if (hasProperCapitalization) qualityScore += 0.2;
    if (hasProperPunctuation) qualityScore += 0.2;
    qualityScore += spellingQuality * 0.3;
    
    return Math.min(1, qualityScore);
  }

  checkSpelling(words) {
    // Simple spelling check - can be enhanced with proper spell checker
    const commonWords = new Set([
      'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'company', 'product', 'service', 'technology', 'business', 'market', 'customer',
      'launch', 'release', 'update', 'feature', 'partnership', 'acquisition', 'funding'
    ]);
    
    const recognizedWords = words.filter(word => 
      commonWords.has(word.toLowerCase()) || 
      word.length <= 3 || 
      /^[A-Z][a-z]+$/.test(word) // Proper nouns
    );
    
    return recognizedWords.length / Math.max(words.length, 1);
  }
}

/**
 * Source Credibility Validator - Validates source reliability
 */
class SourceCredibilityValidator {
  constructor(logger) {
    this.logger = logger;
    this.trustedDomains = new Set([
      'techcrunch.com', 'reuters.com', 'bloomberg.com', 'wsj.com',
      'forbes.com', 'businessinsider.com', 'theverge.com', 'arstechnica.com'
    ]);
    this.spamIndicators = [
      'click here', 'limited time', 'act now', 'free money', 'guaranteed'
    ];
  }

  async validate(signal, context) {
    try {
      const url = new URL(signal.url);
      const domain = url.hostname.toLowerCase();
      
      const credibilityFactors = {
        trustedDomain: this.trustedDomains.has(domain),
        domainAge: await this.estimateDomainAge(domain),
        httpsSecure: url.protocol === 'https:',
        spamContent: this.detectSpamContent(signal.title + ' ' + (signal.summary || '')),
        sourceHistory: await this.getSourceHistory(signal.source_id),
        urlStructure: this.assessUrlStructure(signal.url)
      };
      
      const credibilityScore = this.calculateCredibilityScore(credibilityFactors);
      
      const recommendations = [];
      if (!credibilityFactors.httpsSecure) recommendations.push('Source uses insecure HTTP');
      if (credibilityFactors.spamContent) recommendations.push('Content contains spam indicators');
      if (credibilityScore < 0.5) recommendations.push('Consider blocking this source');
      
      return {
        validator: 'source_credibility',
        passed: credibilityScore >= 0.6,
        score: credibilityScore,
        details: credibilityFactors,
        critical: credibilityScore < 0.3,
        reason: credibilityScore < 0.6 ? 'Source credibility below threshold' : null,
        recommendations,
        metadata: {
          domain,
          estimated_credibility: credibilityScore,
          trust_indicators: Object.entries(credibilityFactors).filter(([, value]) => value === true)
        }
      };
      
    } catch (error) {
      this.logger.warn('Source credibility validation failed', { error: error.message });
      
      return {
        validator: 'source_credibility',
        passed: false,
        score: 0,
        critical: true,
        reason: 'Invalid source URL',
        recommendations: ['Fix source URL format']
      };
    }
  }

  async estimateDomainAge(domain) {
    // Simple heuristic - trusted domains are considered old
    if (this.trustedDomains.has(domain)) return true;
    
    // Check for common new domain patterns
    const newDomainPatterns = [
      /\d{4}/, // Contains year
      /blog\d+/, // Blog with numbers
      /news\d+/, // News with numbers
      /-\d+\./ // Hyphen with numbers
    ];
    
    return !newDomainPatterns.some(pattern => pattern.test(domain));
  }

  detectSpamContent(text) {
    const lowerText = text.toLowerCase();
    return this.spamIndicators.some(indicator => lowerText.includes(indicator));
  }

  async getSourceHistory(sourceId) {
    // Placeholder for source history lookup
    // In production, this would query the database for source reliability metrics
    return {
      total_signals: 100,
      positive_feedback: 75,
      negative_feedback: 10,
      reliability_score: 0.75
    };
  }

  assessUrlStructure(url) {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      
      // Good URL structure indicators
      const hasDate = /\d{4}\/\d{2}\/\d{2}/.test(pathname);
      const hasSlug = pathname.length > 10 && !pathname.includes('?id=');
      const noSuspiciousParams = !urlObj.searchParams.has('ref') && !urlObj.searchParams.has('utm_source');
      
      return hasDate && hasSlug && noSuspiciousParams;
    } catch {
      return false;
    }
  }

  calculateCredibilityScore(factors) {
    let score = 0.5; // Base score
    
    if (factors.trustedDomain) score += 0.3;
    if (factors.domainAge) score += 0.1;
    if (factors.httpsSecure) score += 0.1;
    if (!factors.spamContent) score += 0.2;
    if (factors.urlStructure) score += 0.1;
    
    // Adjust based on source history
    if (factors.sourceHistory && factors.sourceHistory.reliability_score) {
      score = (score + factors.sourceHistory.reliability_score) / 2;
    }
    
    return Math.max(0, Math.min(1, score));
  }
}

/**
 * Relevance Validator - Uses Claude to assess competitive intelligence relevance
 */
class RelevanceValidator {
  constructor(logger, aiAnalyzer) {
    this.logger = logger;
    this.aiAnalyzer = aiAnalyzer;
  }

  async validate(signal, context) {
    try {
      // Use Claude to analyze relevance for competitive intelligence
      const relevanceAnalysis = await this.aiAnalyzer.analyzeText(
        `${signal.title}\n\n${signal.summary || ''}`,
        {
          analysisType: 'competitive_relevance',
          userContext: context.user || {},
          competitorContext: context.competitors || []
        }
      );
      
      const relevanceScore = this.extractRelevanceScore(relevanceAnalysis);
      const competitiveFactors = this.extractCompetitiveFactors(relevanceAnalysis);
      
      const recommendations = [];
      if (relevanceScore < 0.5) recommendations.push('Signal may not be relevant for competitive intelligence');
      if (competitiveFactors.competitor_mentions === 0) recommendations.push('No competitor mentions detected');
      
      return {
        validator: 'relevance',
        passed: relevanceScore >= 0.4,
        score: relevanceScore,
        details: {
          ai_analysis: relevanceAnalysis,
          competitive_factors: competitiveFactors
        },
        critical: false,
        reason: relevanceScore < 0.4 ? 'Low competitive intelligence relevance' : null,
        recommendations,
        metadata: {
          ai_relevance_score: relevanceScore,
          competitive_mentions: competitiveFactors.competitor_mentions,
          business_impact: competitiveFactors.business_impact
        }
      };
      
    } catch (error) {
      this.logger.warn('Relevance validation failed, using fallback', { error: error.message });
      
      // Fallback to rule-based relevance
      const fallbackScore = this.calculateFallbackRelevance(signal, context);
      
      return {
        validator: 'relevance',
        passed: fallbackScore >= 0.4,
        score: fallbackScore,
        details: { fallback_used: true },
        critical: false,
        metadata: { fallback_relevance_score: fallbackScore }
      };
    }
  }

  extractRelevanceScore(analysis) {
    // Extract relevance score from Claude's analysis
    if (analysis.relevance_score) return analysis.relevance_score;
    
    // Parse from text if structured response not available
    const text = analysis.analysis || analysis.toString();
    const scoreMatch = text.match(/relevance[:\s]*([0-9.]+)/i);
    
    if (scoreMatch) {
      const score = parseFloat(scoreMatch[1]);
      return score > 10 ? score / 100 : score; // Handle percentage format
    }
    
    return 0.5; // Default if no score found
  }

  extractCompetitiveFactors(analysis) {
    const text = analysis.analysis || analysis.toString();
    
    return {
      competitor_mentions: (text.match(/competitor/gi) || []).length,
      business_impact: text.includes('impact') || text.includes('significant'),
      urgency_indicators: text.includes('urgent') || text.includes('immediate'),
      market_relevance: text.includes('market') || text.includes('industry')
    };
  }

  calculateFallbackRelevance(signal, context) {
    const text = (signal.title + ' ' + (signal.summary || '')).toLowerCase();
    
    let score = 0.3; // Base score
    
    // Competitive keywords
    const competitiveKeywords = [
      'competitor', 'competition', 'rival', 'alternative',
      'launch', 'release', 'product', 'feature', 'update',
      'funding', 'investment', 'acquisition', 'merger',
      'partnership', 'collaboration', 'deal'
    ];
    
    const keywordMatches = competitiveKeywords.filter(keyword => text.includes(keyword)).length;
    score += (keywordMatches / competitiveKeywords.length) * 0.4;
    
    // Check for competitor mentions
    if (context.competitors) {
      const competitorMentions = context.competitors.filter(comp => 
        text.includes(comp.toLowerCase())
      ).length;
      if (competitorMentions > 0) score += 0.3;
    }
    
    return Math.min(1, score);
  }
}

/**
 * Duplicate Validator - Detects duplicate signals
 */
class DuplicateValidator {
  constructor(logger) {
    this.logger = logger;
    this.similarityThreshold = 0.8;
  }

  async validate(signal, context) {
    try {
      const existingSignals = context.recentSignals || [];
      const duplicateCheck = await this.checkForDuplicates(signal, existingSignals);
      
      const recommendations = [];
      if (duplicateCheck.isDuplicate) {
        recommendations.push(`Duplicate of signal: ${duplicateCheck.duplicateOf}`);
        recommendations.push('Consider consolidating or skipping');
      }
      
      return {
        validator: 'duplicate',
        passed: !duplicateCheck.isDuplicate,
        score: duplicateCheck.isDuplicate ? 0 : 1,
        details: duplicateCheck,
        critical: false,
        reason: duplicateCheck.isDuplicate ? 'Duplicate signal detected' : null,
        recommendations,
        metadata: {
          similarity_score: duplicateCheck.maxSimilarity,
          duplicate_count: duplicateCheck.duplicates?.length || 0
        }
      };
      
    } catch (error) {
      this.logger.warn('Duplicate validation failed', { error: error.message });
      
      return {
        validator: 'duplicate',
        passed: true, // Assume not duplicate if check fails
        score: 0.8,
        details: { check_failed: true }
      };
    }
  }

  async checkForDuplicates(signal, existingSignals) {
    const duplicates = [];
    let maxSimilarity = 0;
    
    for (const existing of existingSignals) {
      const similarity = this.calculateSimilarity(signal, existing);
      
      if (similarity > this.similarityThreshold) {
        duplicates.push({
          signalId: existing.id,
          similarity,
          type: 'content'
        });
      }
      
      maxSimilarity = Math.max(maxSimilarity, similarity);
    }
    
    // URL-based duplicate check
    const urlDuplicates = existingSignals.filter(existing => existing.url === signal.url);
    if (urlDuplicates.length > 0) {
      duplicates.push(...urlDuplicates.map(dup => ({
        signalId: dup.id,
        similarity: 1.0,
        type: 'url'
      })));
    }
    
    return {
      isDuplicate: duplicates.length > 0,
      duplicates,
      maxSimilarity,
      duplicateOf: duplicates.length > 0 ? duplicates[0].signalId : null
    };
  }

  calculateSimilarity(signal1, signal2) {
    // Simple text similarity using Jaccard index
    const text1 = (signal1.title + ' ' + (signal1.summary || '')).toLowerCase();
    const text2 = (signal2.title + ' ' + (signal2.summary || '')).toLowerCase();
    
    const words1 = new Set(text1.split(/\s+/));
    const words2 = new Set(text2.split(/\s+/));
    
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }
}

/**
 * Freshness Validator - Ensures signals are fresh and timely
 */
class FreshnessValidator {
  constructor(logger) {
    this.logger = logger;
    this.maxAgeHours = {
      critical: 1,
      high: 6,
      medium: 24,
      low: 168 // 1 week
    };
  }

  async validate(signal, context) {
    const publishedAt = new Date(signal.published_at);
    const ageHours = (Date.now() - publishedAt.getTime()) / (1000 * 60 * 60);
    
    const priority = signal.priority || 'medium';
    const maxAge = this.maxAgeHours[priority] || this.maxAgeHours.medium;
    
    const isFresh = ageHours <= maxAge;
    const freshnessScore = Math.max(0, 1 - (ageHours / maxAge));
    
    const recommendations = [];
    if (!isFresh) {
      recommendations.push(`Signal is ${Math.round(ageHours)} hours old, max age for ${priority} priority is ${maxAge} hours`);
    }
    
    return {
      validator: 'freshness',
      passed: isFresh,
      score: freshnessScore,
      details: {
        age_hours: ageHours,
        max_age_hours: maxAge,
        priority
      },
      critical: false,
      reason: !isFresh ? 'Signal is too old' : null,
      recommendations,
      metadata: {
        signal_age_hours: ageHours,
        freshness_score: freshnessScore
      }
    };
  }
}

/**
 * Compliance Validator - Ensures signals meet compliance requirements
 */
class ComplianceValidator {
  constructor(logger) {
    this.logger = logger;
    this.blockedDomains = new Set([
      'spam-site.com',
      'fake-news.net'
    ]);
    this.sensitiveKeywords = [
      'insider trading',
      'confidential',
      'leaked',
      'rumor'
    ];
  }

  async validate(signal, context) {
    try {
      const url = new URL(signal.url);
      const domain = url.hostname.toLowerCase();
      
      const complianceChecks = {
        blockedDomain: !this.blockedDomains.has(domain),
        sensitiveContent: !this.containsSensitiveContent(signal),
        properAttribution: this.hasProperAttribution(signal),
        legalCompliance: true // Placeholder for more complex legal checks
      };
      
      const passedChecks = Object.values(complianceChecks).filter(Boolean).length;
      const totalChecks = Object.keys(complianceChecks).length;
      const complianceScore = passedChecks / totalChecks;
      
      const recommendations = [];
      if (complianceChecks.blockedDomain === false) recommendations.push('Source domain is blocked');
      if (complianceChecks.sensitiveContent === false) recommendations.push('Contains sensitive content');
      if (complianceChecks.properAttribution === false) recommendations.push('Missing proper attribution');
      
      return {
        validator: 'compliance',
        passed: complianceScore >= 0.8,
        score: complianceScore,
        details: complianceChecks,
        critical: complianceScore < 0.5,
        reason: complianceScore < 0.8 ? 'Compliance issues detected' : null,
        recommendations,
        metadata: {
          compliance_score: complianceScore,
          blocked_domain: !complianceChecks.blockedDomain
        }
      };
      
    } catch (error) {
      this.logger.warn('Compliance validation failed', { error: error.message });
      
      return {
        validator: 'compliance',
        passed: false,
        score: 0,
        critical: true,
        reason: 'Compliance check failed'
      };
    }
  }

  containsSensitiveContent(signal) {
    const text = (signal.title + ' ' + (signal.summary || '')).toLowerCase();
    return this.sensitiveKeywords.some(keyword => text.includes(keyword));
  }

  hasProperAttribution(signal) {
    // Check if signal has author or source attribution
    return !!(signal.author || signal.source_name || signal.source_id);
  }
}

module.exports = ValidationPipeline;
