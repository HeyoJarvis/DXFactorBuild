/**
 * Tool Recommendation Schema - AI-powered tool recommendations with ROI analysis
 * 
 * Features:
 * 1. Tool recommendation storage and tracking
 * 2. ROI calculations and projections
 * 3. Implementation planning and progress
 * 4. Market intelligence and benchmarking
 * 5. Success tracking and validation
 */

const { v4: uuidv4 } = require('uuid');

const ToolRecommendationSchema = {
  // Primary identification
  id: {
    type: 'uuid',
    primary: true,
    default: () => uuidv4()
  },
  
  // Recommendation context
  workflow_id: {
    type: 'uuid',
    required: true,
    description: 'Workflow this recommendation addresses'
  },
  bottleneck_id: {
    type: 'uuid',
    description: 'Specific bottleneck being addressed'
  },
  organization_id: {
    type: 'uuid',
    required: true
  },
  
  // Tool information
  recommended_tool: {
    type: 'string',
    required: true,
    description: 'Primary recommended tool name'
  },
  tool_category: {
    type: 'string',
    enum: ['lead_generation', 'email_automation', 'meeting_scheduling', 'proposal_automation', 
           'crm_enhancement', 'analytics', 'workflow_automation', 'video_engagement', 'other'],
    required: true
  },
  tool_stack: {
    type: 'jsonb',
    default: [],
    description: 'Complete tool stack if multiple tools recommended'
  },
  
  // Problem and solution
  addresses_issue: {
    type: 'string',
    required: true,
    description: 'Specific issue or bottleneck being addressed'
  },
  solution_description: {
    type: 'text',
    description: 'How the tool solves the problem'
  },
  expected_improvement: {
    type: 'jsonb',
    default: {},
    description: 'Expected improvements in metrics'
  },
  
  // ROI Analysis
  roi_analysis: {
    type: 'jsonb',
    default: {},
    description: 'Complete ROI analysis with scenarios'
  },
  implementation_cost: {
    type: 'decimal',
    description: 'Total first-year implementation cost'
  },
  annual_savings: {
    type: 'decimal',
    description: 'Projected annual cost savings'
  },
  revenue_impact: {
    type: 'decimal',
    description: 'Projected annual revenue impact'
  },
  payback_period_months: {
    type: 'float',
    description: 'Months to break even on investment'
  },
  roi_percentage: {
    type: 'float',
    description: '12-month ROI percentage'
  },
  
  // Time impact analysis
  time_savings: {
    type: 'jsonb',
    default: {},
    description: 'Time savings analysis per rep/team'
  },
  efficiency_gains: {
    type: 'jsonb',
    default: {},
    description: 'Process efficiency improvements'
  },
  
  // Implementation planning
  implementation_plan: {
    type: 'jsonb',
    default: {},
    description: 'Detailed implementation roadmap'
  },
  implementation_effort: {
    type: 'integer',
    description: 'Implementation effort score (1-10)'
  },
  estimated_weeks: {
    type: 'integer',
    description: 'Estimated implementation time in weeks'
  },
  prerequisites: {
    type: 'jsonb',
    default: [],
    description: 'Prerequisites for implementation'
  },
  
  // Risk assessment
  risk_factors: {
    type: 'jsonb',
    default: [],
    description: 'Implementation and ongoing risks'
  },
  mitigation_strategies: {
    type: 'jsonb',
    default: [],
    description: 'Risk mitigation approaches'
  },
  success_probability: {
    type: 'float',
    description: 'Probability of successful implementation (0-1)'
  },
  
  // Market intelligence
  market_data: {
    type: 'jsonb',
    default: {},
    description: 'Current market data for the tool'
  },
  peer_results: {
    type: 'jsonb',
    default: {},
    description: 'Results from similar organizations'
  },
  tool_maturity: {
    type: 'float',
    description: 'Tool maturity score (0-1)'
  },
  vendor_stability: {
    type: 'float',
    description: 'Vendor stability score (0-1)'
  },
  
  // Alternative options
  alternatives: {
    type: 'jsonb',
    default: [],
    description: 'Alternative tool options with comparisons'
  },
  
  // AI analysis metadata
  ai_confidence: {
    type: 'float',
    description: 'AI confidence in recommendation (0-1)'
  },
  analysis_model: {
    type: 'string',
    description: 'AI model used for analysis'
  },
  data_sources: {
    type: 'jsonb',
    default: [],
    description: 'Data sources used for recommendation'
  },
  
  // Status and tracking
  status: {
    type: 'string',
    enum: ['pending', 'approved', 'in_implementation', 'completed', 'rejected', 'on_hold'],
    default: 'pending'
  },
  priority: {
    type: 'string',
    enum: ['critical', 'high', 'medium', 'low'],
    default: 'medium'
  },
  
  // Implementation tracking
  approved_by: {
    type: 'uuid',
    description: 'User who approved the recommendation'
  },
  approved_at: {
    type: 'timestamp'
  },
  implementation_started_at: {
    type: 'timestamp'
  },
  implementation_completed_at: {
    type: 'timestamp'
  },
  
  // Results tracking
  actual_roi: {
    type: 'float',
    description: 'Actual ROI achieved after implementation'
  },
  actual_savings: {
    type: 'decimal',
    description: 'Actual cost savings realized'
  },
  actual_revenue_impact: {
    type: 'decimal',
    description: 'Actual revenue impact measured'
  },
  success_metrics: {
    type: 'jsonb',
    default: {},
    description: 'Measured success metrics post-implementation'
  },
  
  // Timestamps
  created_at: {
    type: 'timestamp',
    default: () => new Date()
  },
  updated_at: {
    type: 'timestamp',
    default: () => new Date()
  }
};

// Helper class for tool recommendation operations
class ToolRecommendationHelpers {
  static generateId() {
    return uuidv4();
  }
  
  static calculateROIScore(recommendation) {
    // Calculate overall ROI attractiveness score
    let score = 0;
    
    // ROI percentage weight (40%)
    if (recommendation.roi_percentage) {
      score += Math.min(0.4, recommendation.roi_percentage / 1000 * 0.4);
    }
    
    // Payback period weight (30%) - shorter is better
    if (recommendation.payback_period_months) {
      const paybackScore = Math.max(0, 1 - recommendation.payback_period_months / 24);
      score += paybackScore * 0.3;
    }
    
    // Implementation effort weight (20%) - lower effort is better
    if (recommendation.implementation_effort) {
      const effortScore = (10 - recommendation.implementation_effort) / 10;
      score += effortScore * 0.2;
    }
    
    // Success probability weight (10%)
    if (recommendation.success_probability) {
      score += recommendation.success_probability * 0.1;
    }
    
    return Math.min(1.0, score);
  }
  
  static prioritizeRecommendations(recommendations) {
    return recommendations
      .map(rec => ({
        ...rec,
        roi_score: this.calculateROIScore(rec)
      }))
      .sort((a, b) => {
        // Sort by priority first, then ROI score
        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
        
        if (priorityDiff !== 0) return priorityDiff;
        return b.roi_score - a.roi_score;
      });
  }
  
  static validateROIProjections(recommendation) {
    const warnings = [];
    
    // Check for overly optimistic projections
    if (recommendation.roi_percentage > 500) {
      warnings.push('ROI projection may be overly optimistic (>500%)');
    }
    
    if (recommendation.payback_period_months < 1) {
      warnings.push('Payback period may be unrealistically short (<1 month)');
    }
    
    // Check for data consistency
    if (recommendation.implementation_cost && recommendation.annual_savings) {
      const calculatedPayback = recommendation.implementation_cost / (recommendation.annual_savings / 12);
      const projectedPayback = recommendation.payback_period_months;
      
      if (Math.abs(calculatedPayback - projectedPayback) > 2) {
        warnings.push('Payback period calculation may be inconsistent');
      }
    }
    
    return warnings;
  }
  
  static generateImplementationTimeline(recommendation) {
    const phases = [];
    const totalWeeks = recommendation.estimated_weeks || 8;
    
    // Phase 1: Planning and Setup (25% of time)
    phases.push({
      phase: 1,
      name: 'Planning & Setup',
      duration_weeks: Math.ceil(totalWeeks * 0.25),
      tasks: [
        'Finalize tool selection and pricing',
        'Set up accounts and initial configuration',
        'Plan integration with existing systems',
        'Prepare team training materials'
      ],
      success_criteria: ['Tool configured', 'Integration plan approved', 'Training scheduled']
    });
    
    // Phase 2: Implementation (50% of time)
    phases.push({
      phase: 2,
      name: 'Implementation',
      duration_weeks: Math.ceil(totalWeeks * 0.5),
      tasks: [
        'Execute integrations with CRM and other tools',
        'Configure workflows and automation',
        'Conduct team training sessions',
        'Begin pilot testing with select users'
      ],
      success_criteria: ['Integrations functional', 'Team trained', 'Pilot users active']
    });
    
    // Phase 3: Optimization (25% of time)
    phases.push({
      phase: 3,
      name: 'Optimization & Rollout',
      duration_weeks: Math.ceil(totalWeeks * 0.25),
      tasks: [
        'Optimize based on pilot feedback',
        'Roll out to full team',
        'Establish monitoring and reporting',
        'Document processes and best practices'
      ],
      success_criteria: ['Full team adoption', 'Metrics tracking active', 'ROI measurement in place']
    });
    
    return phases;
  }
  
  static trackImplementationProgress(recommendation, currentPhase, completedTasks) {
    const timeline = this.generateImplementationTimeline(recommendation);
    const totalTasks = timeline.reduce((sum, phase) => sum + phase.tasks.length, 0);
    const completedCount = completedTasks.length;
    
    return {
      overall_progress: completedCount / totalTasks,
      current_phase: currentPhase,
      phase_progress: completedTasks.filter(task => 
        timeline[currentPhase - 1]?.tasks.includes(task)
      ).length / (timeline[currentPhase - 1]?.tasks.length || 1),
      next_milestones: timeline[currentPhase - 1]?.success_criteria || [],
      estimated_completion: this.calculateEstimatedCompletion(recommendation, completedCount, totalTasks)
    };
  }
  
  static calculateEstimatedCompletion(recommendation, completedTasks, totalTasks) {
    const progressRatio = completedTasks / totalTasks;
    const remainingWeeks = (recommendation.estimated_weeks || 8) * (1 - progressRatio);
    const completionDate = new Date();
    completionDate.setDate(completionDate.getDate() + (remainingWeeks * 7));
    
    return completionDate;
  }
  
  static validate(recommendationData) {
    const errors = [];
    
    // Required fields
    if (!recommendationData.workflow_id) {
      errors.push('Workflow ID is required');
    }
    
    if (!recommendationData.recommended_tool) {
      errors.push('Recommended tool is required');
    }
    
    if (!recommendationData.addresses_issue) {
      errors.push('Issue description is required');
    }
    
    if (!recommendationData.organization_id) {
      errors.push('Organization ID is required');
    }
    
    // Numeric validations
    if (recommendationData.roi_percentage && recommendationData.roi_percentage < 0) {
      errors.push('ROI percentage cannot be negative');
    }
    
    if (recommendationData.payback_period_months && recommendationData.payback_period_months <= 0) {
      errors.push('Payback period must be positive');
    }
    
    if (recommendationData.implementation_effort && 
        (recommendationData.implementation_effort < 1 || recommendationData.implementation_effort > 10)) {
      errors.push('Implementation effort must be between 1 and 10');
    }
    
    if (errors.length > 0) {
      throw new Error(`Tool recommendation validation failed: ${errors.join(', ')}`);
    }
    
    return recommendationData;
  }
  
  static sanitize(recommendationData) {
    const sanitized = { ...recommendationData };
    
    // Ensure arrays are arrays
    if (!Array.isArray(sanitized.tool_stack)) sanitized.tool_stack = [];
    if (!Array.isArray(sanitized.prerequisites)) sanitized.prerequisites = [];
    if (!Array.isArray(sanitized.risk_factors)) sanitized.risk_factors = [];
    if (!Array.isArray(sanitized.mitigation_strategies)) sanitized.mitigation_strategies = [];
    if (!Array.isArray(sanitized.alternatives)) sanitized.alternatives = [];
    if (!Array.isArray(sanitized.data_sources)) sanitized.data_sources = [];
    
    // Ensure objects are objects
    if (typeof sanitized.expected_improvement !== 'object') sanitized.expected_improvement = {};
    if (typeof sanitized.roi_analysis !== 'object') sanitized.roi_analysis = {};
    if (typeof sanitized.time_savings !== 'object') sanitized.time_savings = {};
    if (typeof sanitized.efficiency_gains !== 'object') sanitized.efficiency_gains = {};
    if (typeof sanitized.implementation_plan !== 'object') sanitized.implementation_plan = {};
    if (typeof sanitized.market_data !== 'object') sanitized.market_data = {};
    if (typeof sanitized.peer_results !== 'object') sanitized.peer_results = {};
    if (typeof sanitized.success_metrics !== 'object') sanitized.success_metrics = {};
    
    // Set updated timestamp
    sanitized.updated_at = new Date();
    
    return sanitized;
  }
}

module.exports = { ToolRecommendationSchema, ToolRecommendationHelpers };
