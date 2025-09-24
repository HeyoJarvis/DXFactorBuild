/**
 * Workflow Schema - CRM workflow pattern definitions and analysis results
 * 
 * Features:
 * 1. Workflow pattern storage and classification
 * 2. Performance metrics and benchmarks
 * 3. AI analysis results and insights
 * 4. Bottleneck identification and tracking
 * 5. Success factor correlation analysis
 */

const { v4: uuidv4 } = require('uuid');

const WorkflowSchema = {
  // Primary identification
  id: {
    type: 'uuid',
    primary: true,
    default: () => uuidv4()
  },
  
  // CRM source information
  crm_source: {
    type: 'string',
    required: true,
    enum: ['hubspot', 'salesforce', 'pipedrive', 'copper', 'other']
  },
  external_deal_id: {
    type: 'string',
    required: true
  },
  
  // Workflow classification
  workflow_type: {
    type: 'string',
    enum: ['lead_conversion', 'deal_progression', 'customer_expansion', 'renewal_process', 'custom'],
    required: true
  },
  pattern_signature: {
    type: 'string',
    description: 'Unique identifier for similar workflow patterns'
  },
  pattern_name: {
    type: 'string',
    description: 'Human-readable pattern name (e.g., "Enterprise Consultative Sale")'
  },
  
  // Workflow structure
  stages: {
    type: 'jsonb',
    default: [],
    description: 'Array of workflow stages with durations and activities'
  },
  activities: {
    type: 'jsonb', 
    default: [],
    description: 'Chronological list of all activities in the workflow'
  },
  participants: {
    type: 'jsonb',
    default: [],
    description: 'All people involved in the workflow with roles'
  },
  timeline: {
    type: 'jsonb',
    default: {},
    description: 'Key dates and milestones in the workflow'
  },
  
  // Performance metrics
  duration_days: {
    type: 'integer',
    description: 'Total workflow duration in days'
  },
  success_rate: {
    type: 'float',
    description: 'Success rate for this workflow pattern (0-1)'
  },
  efficiency_score: {
    type: 'float',
    description: 'AI-calculated efficiency score (0-1)'
  },
  deal_value: {
    type: 'decimal',
    description: 'Final deal value in USD'
  },
  conversion_rate: {
    type: 'float',
    description: 'Conversion rate at each stage'
  },
  
  // AI analysis results
  ai_insights: {
    type: 'jsonb',
    default: {},
    description: 'AI-generated insights and analysis'
  },
  bottlenecks: {
    type: 'jsonb',
    default: [],
    description: 'Identified bottlenecks with impact analysis'
  },
  success_factors: {
    type: 'jsonb',
    default: [],
    description: 'Key factors that correlate with success'
  },
  recommendations: {
    type: 'jsonb',
    default: [],
    description: 'AI-generated improvement recommendations'
  },
  confidence_score: {
    type: 'float',
    description: 'Confidence in the analysis (0-1)'
  },
  
  // Organization context
  organization_id: {
    type: 'uuid',
    required: true
  },
  team_id: {
    type: 'uuid'
  },
  sales_rep_id: {
    type: 'uuid'
  },
  
  // Status and metadata
  status: {
    type: 'string',
    enum: ['active', 'completed', 'lost', 'analyzing', 'archived'],
    default: 'analyzing'
  },
  data_completeness: {
    type: 'float',
    description: 'Percentage of expected data available (0-1)'
  },
  last_analyzed_at: {
    type: 'timestamp'
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

// Helper class for workflow operations
class WorkflowHelpers {
  static generateId() {
    return uuidv4();
  }
  
  static createPatternSignature(workflow) {
    // Create a unique signature based on stages and activities
    const stageNames = workflow.stages.map(s => s.name).join('→');
    const activityTypes = [...new Set(workflow.activities.map(a => a.type))].sort().join(',');
    return `${stageNames}|${activityTypes}`;
  }
  
  static calculateEfficiencyScore(workflow, benchmarks) {
    // AI-assisted efficiency calculation
    let score = 0.5; // Base score
    
    // Duration efficiency (compared to similar workflows)
    if (benchmarks.avg_duration && workflow.duration_days) {
      const durationRatio = benchmarks.avg_duration / workflow.duration_days;
      score += Math.min(0.3, durationRatio * 0.3);
    }
    
    // Activity efficiency (activities per day)
    const activitiesPerDay = workflow.activities.length / workflow.duration_days;
    if (activitiesPerDay > benchmarks.avg_activities_per_day) {
      score += 0.1;
    }
    
    // Success indicators
    if (workflow.status === 'completed') {
      score += 0.2;
    }
    
    return Math.min(1.0, Math.max(0.0, score));
  }
  
  static identifyBottlenecks(workflow) {
    const bottlenecks = [];
    
    // Analyze stage durations
    workflow.stages.forEach((stage, index) => {
      if (stage.duration > stage.expected_duration * 1.5) {
        bottlenecks.push({
          type: 'stage_duration',
          location: stage.name,
          severity: 'high',
          impact: stage.duration - stage.expected_duration,
          description: `Stage taking ${stage.duration - stage.expected_duration} days longer than expected`
        });
      }
    });
    
    // Analyze activity gaps
    const activities = workflow.activities.sort((a, b) => new Date(a.date) - new Date(b.date));
    for (let i = 1; i < activities.length; i++) {
      const gap = (new Date(activities[i].date) - new Date(activities[i-1].date)) / (1000 * 60 * 60 * 24);
      if (gap > 7) { // More than 7 days between activities
        bottlenecks.push({
          type: 'activity_gap',
          location: `Between ${activities[i-1].type} and ${activities[i].type}`,
          severity: gap > 14 ? 'high' : 'medium',
          impact: gap,
          description: `${gap} day gap between activities`
        });
      }
    }
    
    return bottlenecks;
  }
  
  static extractSuccessFactors(workflow, similarWorkflows) {
    const successFactors = [];
    
    // Analyze what makes this workflow successful compared to others
    if (workflow.status === 'completed' && similarWorkflows.length > 0) {
      const avgDuration = similarWorkflows.reduce((sum, w) => sum + w.duration_days, 0) / similarWorkflows.length;
      
      if (workflow.duration_days < avgDuration * 0.8) {
        successFactors.push({
          factor: 'fast_execution',
          correlation: 0.8,
          description: 'Completed significantly faster than average',
          actionable_insight: 'Replicate rapid execution patterns'
        });
      }
      
      // Analyze participant engagement
      const participantCount = workflow.participants.length;
      const avgParticipants = similarWorkflows.reduce((sum, w) => sum + w.participants.length, 0) / similarWorkflows.length;
      
      if (participantCount > avgParticipants) {
        successFactors.push({
          factor: 'multi_threading',
          correlation: 0.7,
          description: 'Higher stakeholder engagement than average',
          actionable_insight: 'Engage multiple stakeholders early'
        });
      }
    }
    
    return successFactors;
  }
  
  static validate(workflowData) {
    const errors = [];
    
    // Required field validation
    if (!workflowData.crm_source) {
      errors.push('CRM source is required');
    }
    
    if (!workflowData.external_deal_id) {
      errors.push('External deal ID is required');
    }
    
    if (!workflowData.workflow_type) {
      errors.push('Workflow type is required');
    }
    
    if (!workflowData.organization_id) {
      errors.push('Organization ID is required');
    }
    
    // Data validation
    if (workflowData.success_rate && (workflowData.success_rate < 0 || workflowData.success_rate > 1)) {
      errors.push('Success rate must be between 0 and 1');
    }
    
    if (workflowData.efficiency_score && (workflowData.efficiency_score < 0 || workflowData.efficiency_score > 1)) {
      errors.push('Efficiency score must be between 0 and 1');
    }
    
    if (errors.length > 0) {
      throw new Error(`Workflow validation failed: ${errors.join(', ')}`);
    }
    
    return workflowData;
  }
  
  static sanitize(workflowData) {
    const sanitized = { ...workflowData };
    
    // Ensure arrays are arrays
    if (!Array.isArray(sanitized.stages)) sanitized.stages = [];
    if (!Array.isArray(sanitized.activities)) sanitized.activities = [];
    if (!Array.isArray(sanitized.participants)) sanitized.participants = [];
    if (!Array.isArray(sanitized.bottlenecks)) sanitized.bottlenecks = [];
    if (!Array.isArray(sanitized.success_factors)) sanitized.success_factors = [];
    if (!Array.isArray(sanitized.recommendations)) sanitized.recommendations = [];
    
    // Ensure objects are objects
    if (typeof sanitized.timeline !== 'object') sanitized.timeline = {};
    if (typeof sanitized.ai_insights !== 'object') sanitized.ai_insights = {};
    
    // Set updated timestamp
    sanitized.updated_at = new Date();
    
    return sanitized;
  }
}

module.exports = { WorkflowSchema, WorkflowHelpers };
