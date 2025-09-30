/**
 * Workflow Pattern Detector - AI-powered workflow pattern recognition and analysis
 * 
 * Features:
 * 1. Pattern clustering and classification
 * 2. AI-powered workflow analysis
 * 3. Bottleneck identification
 * 4. Success factor correlation
 * 5. Anomaly detection
 */

const AIAnalyzer = require('@heyjarvis/core/signals/enrichment/ai-analyzer');
const natural = require('natural');
const winston = require('winston');
const { WorkflowHelpers } = require('../models/workflow.schema');

class WorkflowPatternDetector {
  constructor(options = {}) {
    this.options = {
      minPatternSize: 2,
      similarityThreshold: 0.68, // Sweet spot for meaningful patterns
      confidenceThreshold: 0.6, // Higher confidence required
      maxClusters: 20,
      logLevel: 'info',
      ...options
    };
    
    this.logger = winston.createLogger({
      level: this.options.logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      defaultMeta: { service: 'workflow-pattern-detector' },
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        })
      ]
    });
    
    this.aiAnalyzer = new AIAnalyzer(options);
    
    // Pattern classification models
    this.patternClassifiers = {
      stage_sequence: new natural.LogisticRegressionClassifier(),
      activity_patterns: new natural.BayesClassifier(),
      duration_patterns: null // KMeans clustering will be implemented separately
    };
    
    // Cached patterns for performance
    this.patternCache = new Map();
    this.lastCacheUpdate = null;
  }
  
  /**
   * Detect patterns in a collection of workflows
   */
  async detectPatterns(workflows, organizationContext = {}) {
    try {
      this.logger.info('Starting pattern detection', {
        workflow_count: workflows.length,
        organization_id: organizationContext.organization_id
      });
      
      // Pre-process workflows
      const processedWorkflows = this.preprocessWorkflows(workflows);
      
      // Cluster similar workflows
      const clusters = await this.clusterWorkflows(processedWorkflows);
      
      // Analyze each cluster with AI
      const patterns = [];
      for (const cluster of clusters) {
        const pattern = await this.analyzeCluster(cluster, organizationContext);
        if (pattern && pattern.confidence >= this.options.confidenceThreshold) {
          patterns.push(pattern);
        }
      }
      
      // Identify cross-pattern insights
      const insights = await this.generateCrossPatternInsights(patterns, organizationContext);
      
      this.logger.info('Pattern detection completed', {
        patterns_detected: patterns.length,
        total_workflows: workflows.length,
        avg_confidence: patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length
      });
      
      return {
        patterns,
        insights,
        metadata: {
          total_workflows: workflows.length,
          patterns_detected: patterns.length,
          analysis_timestamp: new Date(),
          organization_context: organizationContext
        }
      };
      
    } catch (error) {
      this.logger.error('Pattern detection failed', {
        error: error.message,
        workflow_count: workflows.length
      });
      throw error;
    }
  }
  
  /**
   * Pre-process workflows for pattern analysis
   */
  preprocessWorkflows(workflows) {
    return workflows.map(workflow => {
      // Create feature vectors for clustering
      const features = {
        stage_sequence: this.extractStageSequence(workflow),
        activity_pattern: this.extractActivityPattern(workflow),
        duration_profile: this.extractDurationProfile(workflow),
        participant_profile: this.extractParticipantProfile(workflow),
        value_profile: this.extractValueProfile(workflow)
      };
      
      return {
        ...workflow,
        features,
        normalized_signature: this.createNormalizedSignature(features)
      };
    });
  }
  
  /**
   * Extract stage sequence features
   */
  extractStageSequence(workflow) {
    if (!workflow.stages || workflow.stages.length === 0) {
      return [];
    }
    
    return workflow.stages
      .sort((a, b) => a.order - b.order)
      .map(stage => ({
        name: stage.name.toLowerCase().replace(/[^a-z0-9]/g, '_'),
        duration: stage.duration || 0,
        activities: stage.activities || []
      }));
  }
  
  /**
   * Extract activity pattern features
   */
  extractActivityPattern(workflow) {
    if (!workflow.activities || workflow.activities.length === 0) {
      return {
        counts: {},
        sequence: [],
        total: 0,
        unique_types: 0,
        activity_density: 0,
        pattern_type: 'low_engagement',
        issues: ['No activities recorded', 'Low CRM usage', 'Process gaps']
      };
    }
    
    const activityCounts = {};
    const activitySequence = [];
    
    workflow.activities.forEach(activity => {
      const type = activity.type || 'unknown';
      activityCounts[type] = (activityCounts[type] || 0) + 1;
      activitySequence.push(type);
    });
    
    // Detect activity pattern issues
    const issues = [];
    let pattern_type = 'normal';
    const activity_density = workflow.activities.length / (workflow.duration_days || 1);
    
    // Low engagement pattern
    if (activity_density < 0.1) {
      issues.push('Low activity frequency - less than 1 activity per 10 days');
      pattern_type = 'low_engagement';
    }
    
    // Repetitive pattern
    const maxActivityType = Object.values(activityCounts).reduce((max, count) => Math.max(max, count), 0);
    if (maxActivityType / workflow.activities.length > 0.8) {
      issues.push('Repetitive activity pattern - over-reliance on single activity type');
      pattern_type = 'repetitive_activities';
    }
    
    // Communication gaps
    if (!activitySequence.includes('email') && !activitySequence.includes('call') && !activitySequence.includes('meeting')) {
      issues.push('No direct communication activities');
      pattern_type = 'communication_gaps';
    }
    
    // High activity but long duration (inefficient)
    if (activity_density > 0.5 && workflow.duration_days > 200) {
      issues.push('High activity but long duration - possible inefficient workflow');
      pattern_type = 'inefficient_execution';
    }
    
    return {
      counts: activityCounts,
      sequence: activitySequence,
      total: workflow.activities.length,
      unique_types: Object.keys(activityCounts).length,
      activity_density,
      pattern_type,
      issues
    };
  }
  
  /**
   * Extract duration profile features
   */
  extractDurationProfile(workflow) {
    return {
      total_duration: workflow.duration_days || 0,
      stage_durations: workflow.stages?.map(s => s.duration) || [],
      avg_stage_duration: workflow.stages?.length > 0 ? 
        workflow.stages.reduce((sum, s) => sum + (s.duration || 0), 0) / workflow.stages.length : 0,
      velocity: workflow.activities?.length / (workflow.duration_days || 1) || 0
    };
  }
  
  /**
   * Extract participant profile features
   */
  extractParticipantProfile(workflow) {
    if (!workflow.participants || workflow.participants.length === 0) {
      return {};
    }
    
    const contacts = workflow.participants.filter(p => p.type === 'contact');
    const companies = workflow.participants.filter(p => p.type === 'company');
    
    return {
      total_participants: workflow.participants.length,
      contact_count: contacts.length,
      company_count: companies.length,
      engagement_levels: contacts.map(c => c.engagement_level || 'none'),
      roles: contacts.map(c => (c && c.job_title) || 'unknown')
    };
  }
  
  /**
   * Extract value profile features
   */
  extractValueProfile(workflow) {
    const dealValue = workflow.deal_value || 0;
    
    return {
      deal_value: dealValue,
      value_category: this.categorizeValue(dealValue),
      success_rate: workflow.success_rate || 0,
      efficiency_score: workflow.efficiency_score || 0
    };
  }
  
  /**
   * Categorize deal value
   */
  categorizeValue(value) {
    if (value >= 100000) return 'enterprise';
    if (value >= 25000) return 'mid_market';
    if (value >= 5000) return 'smb';
    return 'small';
  }
  
  /**
   * Create normalized signature for similarity comparison
   */
  createNormalizedSignature(features) {
    const signature = [];
    
    // Stage sequence signature
    if (features.stage_sequence.length > 0) {
      signature.push(features.stage_sequence.map(s => s.name).join('→'));
    }
    
    // Activity pattern signature
    const topActivities = Object.entries(features.activity_pattern.counts || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([type, count]) => `${type}:${count}`)
      .join(',');
    signature.push(topActivities);
    
    // Value category
    signature.push(features.value_profile.value_category);
    
    return signature.join('|');
  }
  
  /**
   * Cluster workflows based on similarity
   */
  async clusterWorkflows(workflows) {
    const clusters = [];
    const processed = new Set();
    
    for (let i = 0; i < workflows.length; i++) {
      if (processed.has(i)) continue;
      
      const cluster = [workflows[i]];
      processed.add(i);
      
      // Find similar workflows
      for (let j = i + 1; j < workflows.length; j++) {
        if (processed.has(j)) continue;
        
        const similarity = this.calculateSimilarity(workflows[i], workflows[j]);
        if (similarity >= this.options.similarityThreshold) {
          cluster.push(workflows[j]);
          processed.add(j);
        }
      }
      
      // Only keep clusters with minimum size
      if (cluster.length >= this.options.minPatternSize) {
        clusters.push(cluster);
      }
    }
    
    this.logger.info('Workflow clustering completed', {
      total_workflows: workflows.length,
      clusters_found: clusters.length,
      avg_cluster_size: clusters.reduce((sum, c) => sum + c.length, 0) / clusters.length
    });
    
    return clusters;
  }
  
  /**
   * Calculate similarity between two workflows
   */
  calculateSimilarity(workflow1, workflow2) {
    let similarity = 0;
    let weights = 0;
    
    // Workflow type similarity (40% weight) - STRICT type matching
    const typeSim = workflow1.workflow_type === workflow2.workflow_type ? 1 : 0.1; // Different types get very low score
    similarity += typeSim * 0.4;
    weights += 0.4;
    
    // Duration profile similarity (25% weight) - STRICT duration matching  
    const durationSim = this.calculateStrictDurationSimilarity(
      workflow1.features.duration_profile,
      workflow2.features.duration_profile
    );
    similarity += durationSim * 0.25;
    weights += 0.25;
    
    // Deal value similarity (20% weight) - STRICT value range matching
    const valueSim = this.calculateStrictValueSimilarity(
      workflow1.features.value_profile,
      workflow2.features.value_profile
    );
    similarity += valueSim * 0.2;
    weights += 0.2;
    
    // Activity pattern similarity (10% weight)
    const activitySim = this.calculateActivityPatternSimilarity(
      workflow1.features.activity_pattern,
      workflow2.features.activity_pattern
    );
    similarity += activitySim * 0.1;
    weights += 0.1;
    
    // Participant pattern similarity (5% weight)
    const participantSim = this.calculateParticipantSimilarity(
      workflow1.features.participant_profile,
      workflow2.features.participant_profile
    );
    similarity += participantSim * 0.05;
    weights += 0.05;
    
    return weights > 0 ? similarity / weights : 0;
  }
  
  /**
   * Calculate stage sequence similarity
   */
  calculateStageSequenceSimilarity(seq1, seq2) {
    if (!seq1.length || !seq2.length) return 0;
    
    const names1 = seq1.map(s => s.name);
    const names2 = seq2.map(s => s.name);
    
    // Use Levenshtein distance for sequence similarity
    const distance = natural.LevenshteinDistance(names1.join(''), names2.join(''));
    const maxLength = Math.max(names1.join('').length, names2.join('').length);
    
    return maxLength > 0 ? 1 - (distance / maxLength) : 0;
  }
  
  /**
   * Calculate activity pattern similarity
   */
  calculateActivityPatternSimilarity(pattern1, pattern2) {
    if (!pattern1.counts || !pattern2.counts) return 0;
    
    const allTypes = new Set([
      ...Object.keys(pattern1.counts),
      ...Object.keys(pattern2.counts)
    ]);
    
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (const type of allTypes) {
      const count1 = pattern1.counts[type] || 0;
      const count2 = pattern2.counts[type] || 0;
      
      dotProduct += count1 * count2;
      norm1 += count1 * count1;
      norm2 += count2 * count2;
    }
    
    const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);
    return magnitude > 0 ? dotProduct / magnitude : 0;
  }
  
  /**
   * Calculate duration similarity
   */
  calculateDurationSimilarity(duration1, duration2) {
    if (!duration1.total_duration || !duration2.total_duration) return 0;
    
    const ratio = Math.min(duration1.total_duration, duration2.total_duration) /
                  Math.max(duration1.total_duration, duration2.total_duration);
    
    return ratio;
  }
  
  /**
   * Calculate STRICT duration similarity - workflows must be in similar duration ranges
   */
  calculateStrictDurationSimilarity(duration1, duration2) {
    if (!duration1.total_duration || !duration2.total_duration) return 0;
    
    const d1 = duration1.total_duration;
    const d2 = duration2.total_duration;
    
    // Define strict duration ranges
    if (d1 <= 30 && d2 <= 30) return 1.0;         // Short cycles (0-30 days)
    if (d1 <= 90 && d2 <= 90 && d1 > 30 && d2 > 30) return 1.0; // Medium cycles (31-90 days)
    if (d1 <= 180 && d2 <= 180 && d1 > 90 && d2 > 90) return 1.0; // Long cycles (91-180 days)
    if (d1 > 180 && d2 > 180) {
      // Very long cycles - must be within 50% of each other
      const ratio = Math.min(d1, d2) / Math.max(d1, d2);
      return ratio > 0.5 ? ratio : 0;
    }
    
    // Different duration ranges - very low similarity
    return 0.1;
  }
  
  /**
   * Calculate STRICT value similarity - workflows must be in similar value ranges
   */
  calculateStrictValueSimilarity(value1, value2) {
    if (!value1.total_value || !value2.total_value) return 0;
    
    const v1 = value1.total_value;
    const v2 = value2.total_value;
    
    // Define strict value ranges
    if (v1 <= 1000 && v2 <= 1000) return 1.0;       // Small deals (0-1K)
    if (v1 <= 5000 && v2 <= 5000 && v1 > 1000 && v2 > 1000) return 1.0; // Medium deals (1K-5K)
    if (v1 <= 15000 && v2 <= 15000 && v1 > 5000 && v2 > 5000) return 1.0; // Large deals (5K-15K)
    if (v1 > 15000 && v2 > 15000) {
      // Enterprise deals - must be within 60% of each other
      const ratio = Math.min(v1, v2) / Math.max(v1, v2);
      return ratio > 0.6 ? ratio : 0;
    }
    
    // Different value ranges - very low similarity
    return 0.1;
  }
  
  /**
   * Calculate participant similarity
   */
  calculateParticipantSimilarity(participant1, participant2) {
    if (!participant1 || !participant2) return 0;
    
    let similarity = 0;
    let factors = 0;
    
    // Contact count similarity
    if (participant1.contact_count !== undefined && participant2.contact_count !== undefined) {
      const maxContacts = Math.max(participant1.contact_count, participant2.contact_count);
      const minContacts = Math.min(participant1.contact_count, participant2.contact_count);
      similarity += maxContacts > 0 ? minContacts / maxContacts : 1;
      factors++;
    }
    
    // Company count similarity
    if (participant1.company_count !== undefined && participant2.company_count !== undefined) {
      const maxCompanies = Math.max(participant1.company_count, participant2.company_count);
      const minCompanies = Math.min(participant1.company_count, participant2.company_count);
      similarity += maxCompanies > 0 ? minCompanies / maxCompanies : 1;
      factors++;
    }
    
    // Role similarity (basic check)
    if (participant1.roles && participant2.roles) {
      const roles1 = new Set(participant1.roles);
      const roles2 = new Set(participant2.roles);
      const intersection = new Set([...roles1].filter(x => roles2.has(x)));
      const union = new Set([...roles1, ...roles2]);
      similarity += union.size > 0 ? intersection.size / union.size : 0;
      factors++;
    }
    
    return factors > 0 ? similarity / factors : 0;
  }
  
  /**
   * Analyze a cluster of similar workflows with AI
   */
  async analyzeCluster(cluster, organizationContext) {
    try {
      this.logger.debug('Analyzing workflow cluster', {
        cluster_size: cluster.length,
        organization_id: organizationContext.organization_id
      });
      
      // Prepare cluster data for AI analysis
      const clusterSummary = this.summarizeCluster(cluster);
      
      // AI analysis prompt
      const analysisPrompt = this.buildClusterAnalysisPrompt(clusterSummary, organizationContext);
      
      // Use AI analysis to discover patterns intelligently
      try {
        const aiAnalysis = await this.aiAnalyzer.analyzeSignal({
          title: `Workflow Pattern Analysis - ${cluster.length} workflows`,
          content: analysisPrompt,
          category: 'workflow_analysis'
        }, organizationContext);
        
        const pattern = this.parseAIAnalysisToPattern(cluster, clusterSummary, aiAnalysis);
        return pattern;
      } catch (aiError) {
        this.logger.warn('AI analysis failed, falling back to basic pattern creation', {
          error: aiError.message,
          cluster_size: cluster.length
        });
        return this.createBasicPattern(cluster, clusterSummary);
      }
      
      return pattern;
      
    } catch (error) {
      this.logger.error('Cluster analysis failed', {
        cluster_size: cluster.length,
        error: error.message
      });
      
      // Return basic pattern without AI analysis
      return this.createBasicPattern(cluster);
    }
  }
  
  /**
   * Summarize cluster for AI analysis
   */
  summarizeCluster(cluster) {
    const summary = {
      size: cluster.length,
      avg_duration: cluster.reduce((sum, w) => sum + (w.duration_days || 0), 0) / cluster.length,
      avg_deal_value: cluster.reduce((sum, w) => sum + (w.deal_value || 0), 0) / cluster.length,
      success_rate: cluster.filter(w => 
        w.status === 'completed' || 
        w.status === 'won' || 
        (w.stages && w.stages.some(stage => stage.is_closed_won)) ||
        (w.hubspot_metadata && w.deal_value > 0 && w.status === 'active')
      ).length / cluster.length,
      
      common_stages: this.findCommonStages(cluster),
      common_activities: this.findCommonActivities(cluster),
      participant_patterns: this.analyzeParticipantPatterns(cluster),
      
      bottlenecks: this.identifyClusterBottlenecks(cluster),
      success_factors: this.identifyClusterSuccessFactors(cluster),
      
      sample_workflows: cluster.slice(0, 3).map(w => ({
        id: w.id,
        duration: w.duration_days,
        value: w.deal_value,
        status: w.status,
        activities: w.activities || [],
        participants: w.participants || [],
        stages: w.stages || [],
        // Enhanced data for AI analysis
        activity_breakdown: this.analyzeActivityBreakdown(w.activities),
        participant_breakdown: this.analyzeParticipantBreakdown(w.participants),
        stage_progression: this.analyzeStageProgression(w.stages),
        data_completeness: this.calculateDataCompleteness(w),
        engagement_level: this.calculateEngagementLevel(w)
      }))
    };
    
    return summary;
  }
  
  /**
   * Build AI analysis prompt for cluster
   */
  buildClusterAnalysisPrompt(clusterSummary, organizationContext) {
    return `
    You are an expert CRM workflow analyst. Analyze this cluster of ${clusterSummary.size} workflows to identify meaningful patterns and issues beyond just timing metrics.

    DETAILED WORKFLOW DATA:
    ${clusterSummary.sample_workflows.map((w, i) => `
    Workflow ${i+1}:
    - Duration: ${w.duration} days, Value: $${w.value?.toLocaleString()}, Status: ${w.status}
    - Activities: ${w.activities?.length || 0} total
    - Participants: ${w.participants?.length || 0} people involved
    - Stages: ${w.stages?.length || 0} stages tracked
    `).join('')}

    ANALYSIS FRAMEWORK - Look for diverse pattern types:

    1. ENGAGEMENT PATTERNS:
       - Low engagement (few activities relative to duration)
       - Over-engagement (too many activities, not progressing)
       - Unbalanced communication (all emails, no calls/meetings)
       - Ghost prospects (no customer activities recorded)

    2. PROCESS PATTERNS:
       - Stuck workflows (long time in single stage)
       - Stage skipping (missing critical stages)
       - Inconsistent progression (random stage jumping)
       - No-stage workflows (deals with no pipeline tracking)

    3. COLLABORATION PATTERNS:
       - Single-threaded (only 1-2 participants)
       - Over-complicated (too many participants)
       - Handoff failures (participant changes mid-process)

    4. DATA QUALITY PATTERNS:
       - Incomplete data (missing activities, contacts, stages)
       - Manual process gaps (activities not being logged)
       - System adoption issues (low CRM usage)

    5. VALUE PATTERNS:
       - Value sizing issues (deals with $0 value)
       - Qualification problems (wide value variance)
       - Discovery gaps

    PROVIDE COMPREHENSIVE ANALYSIS in this JSON format:
    {
      "pattern_name": "Specific descriptive name (NOT just 'long sales cycle')",
      "pattern_type": "engagement_issue|process_breakdown|collaboration_problem|data_quality_issue|qualification_gap|pipeline_health",
      "confidence": 0.85,
      "description": "Rich description of what you actually observe in the data",
      "primary_issue_category": "The main category of problem",
      "key_characteristics": [
        "Specific observable characteristics from the data",
        "Quantifiable metrics that support the pattern"
      ],
      "root_causes": [
        "Likely underlying causes of this pattern",
        "System, process, or training issues"
      ],
      "business_impact": {
        "revenue_impact": "How this affects revenue",
        "efficiency_impact": "How this affects team productivity",
        "customer_experience": "How this affects customer satisfaction"
      },
      "actionable_recommendations": [
        "Specific, implementable actions to address this pattern",
        "Process improvements with measurable outcomes"
      ],
      "success_indicators": [
        "Metrics to track improvement",
        "What good would look like"
      ],
      "benchmark_metrics": {
        "cycle_time": ${clusterSummary.avg_duration},
        "conversion_rate": ${clusterSummary.success_rate},
        "efficiency_score": "calculated_score"
      }
    }

    Focus on finding the REAL workflow issues, not just duration analysis. What's actually broken in these sales processes?
    `;
  }
  
  /**
   * Parse AI analysis into structured pattern
   */
  parsePatternAnalysis(aiAnalysis, cluster, clusterSummary) {
    try {
      // Try to parse JSON response
      const analysisText = typeof aiAnalysis === 'string' ? aiAnalysis : aiAnalysis.content || '';
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      
      let parsedAnalysis;
      if (jsonMatch) {
        parsedAnalysis = JSON.parse(jsonMatch[0]);
      } else {
        // Fallback to basic pattern if parsing fails
        return this.createBasicPattern(cluster);
      }
      
      // Structure the pattern
      const pattern = {
        id: `pattern_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        pattern_name: parsedAnalysis.pattern_name || 'Unnamed Pattern',
        pattern_type: parsedAnalysis.pattern_type || 'deal_progression',
        confidence: Math.min(1, Math.max(0, parsedAnalysis.confidence || 0.5)),
        
        // Cluster metadata
        workflow_count: cluster.length,
        sample_workflow_ids: cluster.slice(0, 5).map(w => w.id),
        
        // Pattern characteristics
        description: parsedAnalysis.description || '',
        key_characteristics: parsedAnalysis.key_characteristics || [],
        
        // Performance metrics
        benchmark_metrics: {
          avg_cycle_time: clusterSummary.avg_duration,
          avg_deal_value: clusterSummary.avg_deal_value,
          success_rate: clusterSummary.success_rate,
          efficiency_score: parsedAnalysis.benchmark_metrics?.efficiency_score || 0.5,
          ...parsedAnalysis.benchmark_metrics
        },
        
        // Issues and opportunities
        bottlenecks: parsedAnalysis.bottlenecks || [],
        success_factors: parsedAnalysis.success_factors || [],
        optimization_opportunities: parsedAnalysis.optimization_opportunities || [],
        
        // Analysis metadata
        analyzed_at: new Date(),
        ai_model: this.aiAnalyzer.options.model,
        cluster_summary: clusterSummary
      };
      
      return pattern;
      
    } catch (error) {
      this.logger.warn('Failed to parse AI analysis, using basic pattern', {
        error: error.message
      });
      return this.createBasicPattern(cluster);
    }
  }
  
  /**
   * Create basic pattern without AI analysis
   */
  createBasicPattern(cluster, clusterSummary = null) {
    if (!clusterSummary) {
      clusterSummary = this.summarizeCluster(cluster);
    }
    
    return {
      id: `pattern_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      pattern_name: `Pattern ${cluster.length} Workflows`,
      pattern_type: 'deal_progression',
      confidence: 0.6,
      
      workflow_count: cluster.length,
      sample_workflow_ids: cluster.slice(0, 5).map(w => w.id),
      
      description: `Pattern identified from ${cluster.length} similar workflows`,
      key_characteristics: [
        `Average duration: ${Math.round(clusterSummary.avg_duration)} days`,
        `Average deal value: $${Math.round(clusterSummary.avg_deal_value).toLocaleString()}`,
        `Success rate: ${Math.round(clusterSummary.success_rate * 100)}%`
      ],
      
      benchmark_metrics: {
        avg_cycle_time: clusterSummary.avg_duration,
        avg_deal_value: clusterSummary.avg_deal_value,
        success_rate: clusterSummary.success_rate,
        efficiency_score: 0.5
      },
      
      bottlenecks: clusterSummary.bottlenecks || [],
      success_factors: clusterSummary.success_factors || [],
      optimization_opportunities: [],
      
      analyzed_at: new Date(),
      ai_model: 'basic_analysis',
      cluster_summary: clusterSummary
    };
  }
  
  /**
   * Find common stages across cluster
   */
  findCommonStages(cluster) {
    const stageFrequency = {};
    
    cluster.forEach(workflow => {
      if (workflow.stages) {
        workflow.stages.forEach(stage => {
          stageFrequency[stage.name] = (stageFrequency[stage.name] || 0) + 1;
        });
      }
    });
    
    // Return stages that appear in at least 50% of workflows
    const threshold = cluster.length * 0.5;
    return Object.entries(stageFrequency)
      .filter(([stage, count]) => count >= threshold)
      .sort((a, b) => b[1] - a[1])
      .map(([stage, count]) => stage);
  }
  
  /**
   * Find common activities across cluster
   */
  findCommonActivities(cluster) {
    const activityFrequency = {};
    
    cluster.forEach(workflow => {
      if (workflow.activities) {
        workflow.activities.forEach(activity => {
          const type = activity.type || 'unknown';
          activityFrequency[type] = (activityFrequency[type] || 0) + 1;
        });
      }
    });
    
    return activityFrequency;
  }
  
  /**
   * Analyze participant patterns across cluster
   */
  analyzeParticipantPatterns(cluster) {
    const patterns = {
      avg_contacts: 0,
      avg_companies: 0,
      common_roles: {},
      engagement_distribution: {}
    };
    
    let totalContacts = 0;
    let totalCompanies = 0;
    
    cluster.forEach(workflow => {
      if (workflow.participants) {
        const contacts = workflow.participants.filter(p => p.type === 'contact');
        const companies = workflow.participants.filter(p => p.type === 'company');
        
        totalContacts += contacts.length;
        totalCompanies += companies.length;
        
        contacts.forEach(contact => {
          if (contact && contact.job_title) {
            patterns.common_roles[contact.job_title] = (patterns.common_roles[contact.job_title] || 0) + 1;
          }
          if (contact && contact.engagement_level) {
            patterns.engagement_distribution[contact.engagement_level] = 
              (patterns.engagement_distribution[contact.engagement_level] || 0) + 1;
          }
        });
      }
    });
    
    patterns.avg_contacts = totalContacts / cluster.length;
    patterns.avg_companies = totalCompanies / cluster.length;
    
    return patterns;
  }
  
  /**
   * Identify bottlenecks across cluster
   */
  identifyClusterBottlenecks(cluster) {
    const bottlenecks = [];
    
    // Analyze stage durations
    const stageDurations = {};
    cluster.forEach(workflow => {
      if (workflow.stages) {
        workflow.stages.forEach(stage => {
          if (!stageDurations[stage.name]) {
            stageDurations[stage.name] = [];
          }
          stageDurations[stage.name].push(stage.duration || 0);
        });
      }
    });
    
    // Find stages with high variance or long durations (adjusted thresholds)
    Object.entries(stageDurations).forEach(([stageName, durations]) => {
      const avg = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      const variance = durations.reduce((sum, d) => sum + Math.pow(d - avg, 2), 0) / durations.length;
      
      // Bottleneck detection requires domain-specific thresholds
      // Remove hardcoded thresholds - these should be configurable based on industry/context
      if (avg > 0 && variance > 0) {
        bottlenecks.push({
          location: stageName,
          issue: 'Stage duration analysis available',
          impact: `Average: ${Math.round(avg)} days, Variance: ${Math.round(variance)}`,
          severity: 'medium', // Default severity without hardcoded thresholds
          note: 'Bottleneck severity assessment requires industry-specific thresholds'
        });
      }
    });
    
    // Add bottlenecks based on overall workflow metrics
    const avgWorkflowDuration = cluster.reduce((sum, w) => sum + (w.duration_days || 0), 0) / cluster.length;
    const successRate = cluster.filter(w => w.status === 'won').length / cluster.length;
    const avgDealValue = cluster.reduce((sum, w) => sum + (w.deal_value || 0), 0) / cluster.length;
    
    // Remove hardcoded thresholds for workflow metrics
    // These should be based on industry benchmarks and organizational context
    if (avgWorkflowDuration > 0) {
      this.logger.debug('Workflow duration analysis available', {
        avg_duration: avgWorkflowDuration,
        note: 'Duration assessment requires industry-specific benchmarks'
      });
    }
    
    if (successRate >= 0) {
      this.logger.debug('Conversion rate analysis available', {
        success_rate: successRate,
        note: 'Conversion assessment requires industry-specific benchmarks'
      });
    }
    
    if (avgDealValue > 0) {
      this.logger.debug('Deal value analysis available', {
        avg_deal_value: avgDealValue,
        note: 'Value assessment requires organizational context'
      });
    }
    
    return bottlenecks;
  }
  
  /**
   * Identify success factors across cluster
   */
  identifyClusterSuccessFactors(cluster) {
    const successFactors = [];
    
    const successful = cluster.filter(w => w.status === 'won');
    const unsuccessful = cluster.filter(w => w.status === 'lost');
    
    if (successful.length > 0 && unsuccessful.length > 0) {
      // Compare successful vs unsuccessful workflows
      const successfulAvgDuration = successful.reduce((sum, w) => sum + (w.duration_days || 0), 0) / successful.length;
      const unsuccessfulAvgDuration = unsuccessful.reduce((sum, w) => sum + (w.duration_days || 0), 0) / unsuccessful.length;
      
      if (successfulAvgDuration < unsuccessfulAvgDuration * 0.8) {
        successFactors.push({
          factor: 'Fast Execution',
          correlation: 0.7,
          description: 'Successful workflows complete significantly faster',
          actionable_insight: 'Focus on accelerating deal velocity'
        });
      }
      
      // Analyze participant engagement
      const successfulAvgParticipants = successful.reduce((sum, w) => sum + (w.participants?.length || 0), 0) / successful.length;
      const unsuccessfulAvgParticipants = unsuccessful.reduce((sum, w) => sum + (w.participants?.length || 0), 0) / unsuccessful.length;
      
      if (successfulAvgParticipants > unsuccessfulAvgParticipants * 1.2) {
        successFactors.push({
          factor: 'Multi-threading',
          correlation: 0.6,
          description: 'Successful workflows involve more stakeholders',
          actionable_insight: 'Engage multiple stakeholders early in the process'
        });
      }
    }
    
    return successFactors;
  }
  
  /**
   * Generate cross-pattern insights
   */
  async generateCrossPatternInsights(patterns, organizationContext) {
    try {
      if (patterns.length < 2) {
        return [];
      }
      
      const insightsPrompt = `
      Analyze these workflow patterns and provide cross-pattern insights:
      
      PATTERNS SUMMARY:
      ${patterns.map((p, i) => `
      Pattern ${i + 1}: ${p.pattern_name || 'Unknown Pattern'}
      - Type: ${p.pattern_type || 'unknown'}
      - Workflows: ${p.workflow_count || 0}
      - Avg Cycle Time: ${Math.round((p.benchmark_metrics?.avg_cycle_time || 0))} days
      - Success Rate: ${Math.round((p.benchmark_metrics?.success_rate || 0) * 100)}%
      - Key Bottlenecks: ${(p.bottlenecks || []).map(b => b.location || 'unknown').join(', ')}
      `).join('\n')}
      
      ORGANIZATION: ${organizationContext.industry || 'Unknown'} industry, ${organizationContext.company_size || 'Unknown'} size
      
      Provide insights about:
      1. Overall workflow health across patterns
      2. Common bottlenecks that appear across multiple patterns
      3. Best performing patterns and what makes them successful
      4. Opportunities for standardization or improvement
      5. Resource allocation recommendations
      
      Format as JSON array of insight objects with type, description, and recommendations.
      `;
      
      const aiInsights = await this.aiAnalyzer.analyzeText(crossPatternPrompt, {
        content: insightsPrompt,
        type: 'cross_pattern_analysis'
      });
      
      return this.parseInsights(aiInsights);
      
    } catch (error) {
      this.logger.error('Cross-pattern analysis failed', {
        error: error.message,
        pattern_count: patterns.length
      });
      return [];
    }
  }
  
  /**
   * Parse AI analysis response into workflow pattern
   */
  parseAIAnalysisToPattern(cluster, clusterSummary, aiAnalysis) {
    try {
      // Extract pattern information from AI analysis
      const pattern = {
        pattern_id: this.generatePatternId(),
        pattern_name: this.extractPatternName(aiAnalysis) || `AI Pattern ${cluster.length} Workflows`,
        pattern_type: this.extractPatternType(aiAnalysis) || 'ai_discovered',
        workflow_count: cluster.length,
        confidence: this.extractConfidence(aiAnalysis) || 0.7,
        
        // AI-discovered characteristics
        description: this.extractDescription(aiAnalysis) || 'AI-discovered workflow pattern',
        key_characteristics: this.extractKeyCharacteristics(aiAnalysis) || [],
        issues_identified: this.extractIssues(aiAnalysis) || [],
        success_factors: this.extractSuccessFactors(aiAnalysis) || [],
        bottlenecks: this.extractBottlenecks(aiAnalysis) || [],
        
        // Include cluster summary for context
        benchmark_metrics: {
          avg_cycle_time: clusterSummary.avg_duration,
          success_rate: clusterSummary.success_rate,
          avg_deal_value: clusterSummary.avg_deal_value,
          efficiency_score: this.calculateEfficiencyScore(clusterSummary)
        },
        
        // Raw AI analysis for debugging
        ai_raw_analysis: aiAnalysis,
        
        workflows: cluster,
        created_at: new Date()
      };
      
      this.logger.info('AI-powered pattern created', {
        pattern_name: pattern.pattern_name,
        pattern_type: pattern.pattern_type,
        confidence: pattern.confidence,
        workflow_count: pattern.workflow_count
      });
      
      return pattern;
      
    } catch (error) {
      this.logger.error('Failed to parse AI analysis to pattern', {
        error: error.message
      });
      // Fallback to basic pattern
      return this.createBasicPattern(cluster, clusterSummary);
    }
  }
  
  /**
   * Extract pattern name from AI analysis
   */
  extractPatternName(aiAnalysis) {
    try {
      const text = typeof aiAnalysis === 'string' ? aiAnalysis : aiAnalysis.summary || '';
      
      // Look for pattern names in common formats
      const namePatterns = [
        /Pattern Name:?\s*([^\n]+)/i,
        /Pattern:?\s*([^\n]+)/i,
        /Workflow Type:?\s*([^\n]+)/i,
        /"pattern_name":\s*"([^"]+)"/i
      ];
      
      for (const pattern of namePatterns) {
        const match = text.match(pattern);
        if (match) return match[1].trim();
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }
  
  /**
   * Extract pattern type from AI analysis
   */
  extractPatternType(aiAnalysis) {
    try {
      const text = typeof aiAnalysis === 'string' ? aiAnalysis : aiAnalysis.summary || '';
      
      // Common workflow pattern types
      const typeKeywords = {
        'stagnation': /stagnant|stuck|delay|slow/i,
        'communication_gap': /communication|contact|follow.*up|response/i,
        'high_velocity': /fast|quick|efficient|rapid/i,
        'complex_sale': /complex|long|enterprise|multiple.*stakeholder/i,
        'low_engagement': /low.*activity|inactive|minimal.*contact/i,
        'successful_pattern': /successful|winning|effective|high.*conversion/i
      };
      
      for (const [type, regex] of Object.entries(typeKeywords)) {
        if (regex.test(text)) {
          return type;
        }
      }
      
      return 'ai_discovered';
    } catch (error) {
      return 'ai_discovered';
    }
  }
  
  /**
   * Extract confidence score from AI analysis
   */
  extractConfidence(aiAnalysis) {
    try {
      const text = typeof aiAnalysis === 'string' ? aiAnalysis : JSON.stringify(aiAnalysis);
      
      // Look for confidence scores
      const confidenceMatch = text.match(/confidence["\s:]*(\d*\.?\d+)/i);
      if (confidenceMatch) {
        const confidence = parseFloat(confidenceMatch[1]);
        return confidence > 1 ? confidence / 100 : confidence; // Normalize to 0-1
      }
      
      return 0.7; // Default confidence
    } catch (error) {
      return 0.7;
    }
  }
  
  /**
   * Extract key issues from AI analysis
   */
  extractIssues(aiAnalysis) {
    try {
      const text = typeof aiAnalysis === 'string' ? aiAnalysis : aiAnalysis.summary || '';
      
      const issues = [];
      
      // Common issue patterns
      const issuePatterns = [
        /issue[s]?[:\s]*([^\n]+)/gi,
        /problem[s]?[:\s]*([^\n]+)/gi,
        /bottleneck[s]?[:\s]*([^\n]+)/gi,
        /concern[s]?[:\s]*([^\n]+)/gi
      ];
      
      for (const pattern of issuePatterns) {
        const matches = text.matchAll(pattern);
        for (const match of matches) {
          issues.push(match[1].trim());
        }
      }
      
      return issues.slice(0, 5); // Limit to top 5 issues
    } catch (error) {
      return [];
    }
  }
  
  /**
   * Extract description from AI analysis
   */
  extractDescription(aiAnalysis) {
    try {
      const text = typeof aiAnalysis === 'string' ? aiAnalysis : aiAnalysis.summary || '';
      
      // Look for description patterns
      const descPatterns = [
        /description[:\s]*([^\n]+)/i,
        /summary[:\s]*([^\n]+)/i,
        /overview[:\s]*([^\n]+)/i
      ];
      
      for (const pattern of descPatterns) {
        const match = text.match(pattern);
        if (match) return match[1].trim();
      }
      
      // Use first sentence as fallback
      const sentences = text.split(/[.!?]/);
      return sentences[0]?.trim() || 'AI-discovered workflow pattern';
    } catch (error) {
      return 'AI-discovered workflow pattern';
    }
  }
  
  /**
   * Extract key characteristics from AI analysis
   */
  extractKeyCharacteristics(aiAnalysis) {
    try {
      const text = typeof aiAnalysis === 'string' ? aiAnalysis : aiAnalysis.summary || '';
      
      const characteristics = [];
      
      // Look for characteristic patterns
      const charPatterns = [
        /characteristic[s]?[:\s]*([^\n]+)/gi,
        /feature[s]?[:\s]*([^\n]+)/gi,
        /trait[s]?[:\s]*([^\n]+)/gi
      ];
      
      for (const pattern of charPatterns) {
        const matches = text.matchAll(pattern);
        for (const match of matches) {
          characteristics.push(match[1].trim());
        }
      }
      
      return characteristics.slice(0, 5);
    } catch (error) {
      return [];
    }
  }
  
  /**
   * Extract success factors from AI analysis
   */
  extractSuccessFactors(aiAnalysis) {
    try {
      const text = typeof aiAnalysis === 'string' ? aiAnalysis : aiAnalysis.summary || '';
      
      const factors = [];
      
      // Look for success factor patterns
      const factorPatterns = [
        /success.*factor[s]?[:\s]*([^\n]+)/gi,
        /key.*to.*success[:\s]*([^\n]+)/gi,
        /effective.*when[:\s]*([^\n]+)/gi
      ];
      
      for (const pattern of factorPatterns) {
        const matches = text.matchAll(pattern);
        for (const match of matches) {
          factors.push({
            factor: match[1].trim(),
            correlation: 0.8, // Default correlation
            description: match[1].trim(),
            actionable_insight: `Apply: ${match[1].trim()}`
          });
        }
      }
      
      return factors.slice(0, 3);
    } catch (error) {
      return [];
    }
  }
  
  /**
   * Extract bottlenecks from AI analysis
   */
  extractBottlenecks(aiAnalysis) {
    try {
      const text = typeof aiAnalysis === 'string' ? aiAnalysis : aiAnalysis.summary || '';
      
      const bottlenecks = [];
      
      // Look for bottleneck patterns
      const bottleneckPatterns = [
        /bottleneck[s]?[:\s]*([^\n]+)/gi,
        /delay[s]?[:\s]*([^\n]+)/gi,
        /slow.*point[s]?[:\s]*([^\n]+)/gi
      ];
      
      for (const pattern of bottleneckPatterns) {
        const matches = text.matchAll(pattern);
        for (const match of matches) {
          bottlenecks.push({
            location: match[1].trim(),
            issue: `Identified bottleneck: ${match[1].trim()}`,
            impact: 'Medium',
            severity: 'medium'
          });
        }
      }
      
      return bottlenecks.slice(0, 3);
    } catch (error) {
      return [];
    }
  }
  
  /**
   * Calculate efficiency score from cluster summary
   */
  calculateEfficiencyScore(clusterSummary) {
    try {
      // Simple efficiency calculation based on success rate and duration
      const successWeight = 0.6;
      const speedWeight = 0.4;
      
      const successScore = clusterSummary.success_rate || 0;
      
      // Speed score (inverse of duration, normalized)
      const avgDuration = clusterSummary.avg_duration || 365;
      const speedScore = Math.max(0, Math.min(1, (365 - avgDuration) / 365));
      
      return (successScore * successWeight + speedScore * speedWeight);
    } catch (error) {
      return 0.5; // Neutral score
    }
  }
  
  /**
   * Generate unique pattern ID
   */
  generatePatternId() {
    return `pattern_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Analyze activity breakdown for workflow insights
   */
  analyzeActivityBreakdown(activities) {
    if (!activities || activities.length === 0) {
      return { issue: 'no_activities', total: 0, types: {} };
    }
    
    const breakdown = {};
    activities.forEach(activity => {
      const type = activity.type || 'unknown';
      breakdown[type] = (breakdown[type] || 0) + 1;
    });
    
    // Detect patterns
    const issues = [];
    const totalActivities = activities.length;
    
    if (totalActivities === 0) issues.push('no_activities');
    if (totalActivities < 3) issues.push('low_activity');
    if (!breakdown.email && !breakdown.call && !breakdown.meeting) {
      issues.push('no_communication_activities');
    }
    if (breakdown.email > totalActivities * 0.8) issues.push('email_only');
    if (breakdown.note > totalActivities * 0.7) issues.push('note_heavy');
    
    return {
      total: totalActivities,
      types: breakdown,
      issues: issues,
      communication_ratio: (breakdown.email || 0) + (breakdown.call || 0) + (breakdown.meeting || 0) / totalActivities
    };
  }
  
  /**
   * Analyze participant breakdown
   */
  analyzeParticipantBreakdown(participants) {
    if (!participants || participants.length === 0) {
      return { issue: 'no_participants', total: 0 };
    }
    
    const breakdown = {
      total: participants.length,
      contacts: participants.filter(p => p.type === 'contact').length,
      companies: participants.filter(p => p.type === 'company').length,
      internal: participants.filter(p => p.type === 'user').length
    };
    
    const issues = [];
    if (breakdown.total === 0) issues.push('no_participants');
    if (breakdown.total === 1) issues.push('single_threaded');
    if (breakdown.total > 10) issues.push('too_many_participants');
    if (breakdown.contacts === 0) issues.push('no_customer_contacts');
    if (breakdown.companies > 3) issues.push('complex_deal_structure');
    
    return { ...breakdown, issues };
  }
  
  /**
   * Analyze stage progression
   */
  analyzeStageProgression(stages) {
    if (!stages || stages.length === 0) {
      return { issue: 'no_stages', total: 0 };
    }
    
    const issues = [];
    if (stages.length === 0) issues.push('no_pipeline_tracking');
    if (stages.length === 1) issues.push('stuck_in_one_stage');
    if (stages.length > 8) issues.push('too_many_stages');
    
    // Check for stage skipping (would need historical data)
    // Check for backwards movement (would need timestamps)
    
    return {
      total: stages.length,
      stage_names: stages.map(s => s.name || s),
      issues: issues
    };
  }
  
  /**
   * Calculate data completeness score
   */
  calculateDataCompleteness(workflow) {
    let score = 0;
    let maxScore = 0;
    
    // Check for essential data
    if (workflow.deal_value !== undefined && workflow.deal_value !== null) { score += 20; }
    maxScore += 20;
    
    if (workflow.activities && workflow.activities.length > 0) { score += 25; }
    maxScore += 25;
    
    if (workflow.participants && workflow.participants.length > 0) { score += 20; }
    maxScore += 20;
    
    if (workflow.stages && workflow.stages.length > 0) { score += 15; }
    maxScore += 15;
    
    if (workflow.created_at) { score += 10; }
    maxScore += 10;
    
    if (workflow.status) { score += 10; }
    maxScore += 10;
    
    return maxScore > 0 ? score / maxScore : 0;
  }
  
  /**
   * Calculate engagement level
   */
  calculateEngagementLevel(workflow) {
    const duration = workflow.duration_days || 1;
    const activities = workflow.activities?.length || 0;
    const participants = workflow.participants?.length || 0;
    
    const activityDensity = activities / duration;
    const participantEngagement = participants > 0 ? activities / participants : 0;
    
    let level = 'low';
    if (activityDensity > 0.2 && participantEngagement > 2) level = 'high';
    else if (activityDensity > 0.1 || participantEngagement > 1) level = 'medium';
    
    return {
      level: level,
      activity_density: activityDensity,
      participant_engagement: participantEngagement,
      total_touchpoints: activities
    };
  }
  
  /**
   * Parse AI insights response
   */
  parseInsights(aiInsights) {
    try {
      const insightsText = typeof aiInsights === 'string' ? aiInsights : aiInsights.content || '';
      const jsonMatch = insightsText.match(/\[[\s\S]*\]/);
      
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      return [];
      
    } catch (error) {
      this.logger.warn('Failed to parse cross-pattern insights', {
        error: error.message
      });
      return [];
    }
  }
}

module.exports = WorkflowPatternDetector;
