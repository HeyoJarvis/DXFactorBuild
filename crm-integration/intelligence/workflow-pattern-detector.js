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
      minPatternSize: 3,
      similarityThreshold: 0.7,
      confidenceThreshold: 0.6,
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
      defaultMeta: { service: 'workflow-pattern-detector' }
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
      return {};
    }
    
    const activityCounts = {};
    const activitySequence = [];
    
    workflow.activities.forEach(activity => {
      const type = activity.type || 'unknown';
      activityCounts[type] = (activityCounts[type] || 0) + 1;
      activitySequence.push(type);
    });
    
    return {
      counts: activityCounts,
      sequence: activitySequence,
      total: workflow.activities.length,
      unique_types: Object.keys(activityCounts).length,
      activity_density: workflow.activities.length / (workflow.duration_days || 1)
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
      roles: contacts.map(c => c.role || 'unknown')
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
    
    // Stage sequence similarity (40% weight)
    const stageSeqSim = this.calculateStageSequenceSimilarity(
      workflow1.features.stage_sequence,
      workflow2.features.stage_sequence
    );
    similarity += stageSeqSim * 0.4;
    weights += 0.4;
    
    // Activity pattern similarity (30% weight)
    const activitySim = this.calculateActivityPatternSimilarity(
      workflow1.features.activity_pattern,
      workflow2.features.activity_pattern
    );
    similarity += activitySim * 0.3;
    weights += 0.3;
    
    // Duration profile similarity (20% weight)
    const durationSim = this.calculateDurationSimilarity(
      workflow1.features.duration_profile,
      workflow2.features.duration_profile
    );
    similarity += durationSim * 0.2;
    weights += 0.2;
    
    // Value category similarity (10% weight)
    const valueSim = workflow1.features.value_profile.value_category === 
      workflow2.features.value_profile.value_category ? 1 : 0;
    similarity += valueSim * 0.1;
    weights += 0.1;
    
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
      
      // Get AI analysis
      const aiAnalysis = await this.aiAnalyzer.performAnalysis({
        content: analysisPrompt,
        type: 'workflow_pattern_analysis'
      });
      
      // Parse and structure the analysis
      const pattern = this.parsePatternAnalysis(aiAnalysis, cluster, clusterSummary);
      
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
      success_rate: cluster.filter(w => w.status === 'completed').length / cluster.length,
      
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
        stages: w.stages?.map(s => s.name) || []
      }))
    };
    
    return summary;
  }
  
  /**
   * Build AI analysis prompt for cluster
   */
  buildClusterAnalysisPrompt(clusterSummary, organizationContext) {
    return `
    Analyze this workflow pattern cluster and provide detailed insights:
    
    CLUSTER SUMMARY:
    - Size: ${clusterSummary.size} workflows
    - Average Duration: ${Math.round(clusterSummary.avg_duration)} days
    - Average Deal Value: $${Math.round(clusterSummary.avg_deal_value).toLocaleString()}
    - Success Rate: ${Math.round(clusterSummary.success_rate * 100)}%
    
    COMMON PATTERNS:
    - Stages: ${clusterSummary.common_stages.join(' → ')}
    - Activities: ${Object.entries(clusterSummary.common_activities).map(([type, count]) => `${type} (${count})`).join(', ')}
    
    ORGANIZATION CONTEXT:
    - Industry: ${organizationContext.industry || 'Not specified'}
    - Company Size: ${organizationContext.company_size || 'Not specified'}
    - Sales Model: ${organizationContext.sales_model || 'Not specified'}
    
    SAMPLE WORKFLOWS:
    ${clusterSummary.sample_workflows.map(w => 
      `- ID: ${w.id}, Duration: ${w.duration}d, Value: $${w.value?.toLocaleString()}, Status: ${w.status}`
    ).join('\n')}
    
    Please provide analysis in the following JSON format:
    {
      "pattern_name": "Descriptive name for this workflow pattern",
      "pattern_type": "lead_conversion|deal_progression|customer_expansion|renewal_process",
      "confidence": 0.85,
      "description": "Detailed description of the pattern",
      "key_characteristics": [
        "Characteristic 1",
        "Characteristic 2"
      ],
      "bottlenecks": [
        {
          "location": "Stage or transition name",
          "issue": "Description of bottleneck",
          "impact": "Impact description",
          "severity": "high|medium|low"
        }
      ],
      "success_factors": [
        {
          "factor": "Success factor name",
          "correlation": 0.75,
          "description": "How this factor contributes to success",
          "actionable_insight": "What teams can do about it"
        }
      ],
      "optimization_opportunities": [
        {
          "opportunity": "Optimization description",
          "potential_impact": "Expected improvement",
          "implementation_effort": "low|medium|high"
        }
      ],
      "benchmark_metrics": {
        "cycle_time": ${clusterSummary.avg_duration},
        "conversion_rate": ${clusterSummary.success_rate},
        "efficiency_score": "calculated_score"
      }
    }
    
    Focus on actionable insights that can help improve workflow performance.
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
  createBasicPattern(cluster) {
    const clusterSummary = this.summarizeCluster(cluster);
    
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
      
      bottlenecks: [],
      success_factors: [],
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
          if (contact.role) {
            patterns.common_roles[contact.role] = (patterns.common_roles[contact.role] || 0) + 1;
          }
          if (contact.engagement_level) {
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
    
    // Find stages with high variance or long durations
    Object.entries(stageDurations).forEach(([stageName, durations]) => {
      const avg = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      const variance = durations.reduce((sum, d) => sum + Math.pow(d - avg, 2), 0) / durations.length;
      
      if (avg > 14 || variance > 100) { // More than 2 weeks average or high variance
        bottlenecks.push({
          location: stageName,
          issue: avg > 14 ? 'Long average duration' : 'High duration variance',
          impact: `Average: ${Math.round(avg)} days, Variance: ${Math.round(variance)}`,
          severity: avg > 21 ? 'high' : 'medium'
        });
      }
    });
    
    return bottlenecks;
  }
  
  /**
   * Identify success factors across cluster
   */
  identifyClusterSuccessFactors(cluster) {
    const successFactors = [];
    
    const successful = cluster.filter(w => w.status === 'completed');
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
      Pattern ${i + 1}: ${p.pattern_name}
      - Type: ${p.pattern_type}
      - Workflows: ${p.workflow_count}
      - Avg Cycle Time: ${Math.round(p.benchmark_metrics.avg_cycle_time)} days
      - Success Rate: ${Math.round(p.benchmark_metrics.success_rate * 100)}%
      - Key Bottlenecks: ${p.bottlenecks.map(b => b.location).join(', ')}
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
      
      const aiInsights = await this.aiAnalyzer.performAnalysis({
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
