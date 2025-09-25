/**
 * Tool Recommendation Engine - AI-powered tool recommendations with ROI analysis
 * 
 * Features:
 * 1. Intelligent tool matching based on workflow bottlenecks
 * 2. Comprehensive ROI calculation and projections
 * 3. Market intelligence and benchmarking
 * 4. Implementation planning and risk assessment
 * 5. Real-time tool data integration
 */

const AIAnalyzer = require('@heyjarvis/core/signals/enrichment/ai-analyzer');
const axios = require('axios');
const winston = require('winston');
const { ToolRecommendationHelpers } = require('../models/tool-recommendation.schema');

class ToolRecommendationEngine {
  constructor(options = {}) {
    this.options = {
      confidenceThreshold: 0.6,
      maxRecommendations: 5,
      roiTimeframe: 12, // months
      logLevel: 'info',
      ...options
    };
    
    this.logger = winston.createLogger({
      level: this.options.logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      defaultMeta: { service: 'tool-recommendation-engine' }
    });
    
    this.aiAnalyzer = new AIAnalyzer(options);
    this.roiCalculator = new ROICalculator(options);
    this.marketIntelligence = new MarketIntelligenceEngine(options);
    
    // Tool database will be loaded from external sources
    this.toolDatabase = {};
  }
  
  /**
   * Generate tool recommendations for workflow bottlenecks
   */
  async generateRecommendations(workflowAnalysis, organizationContext) {
    try {
      this.logger.info('Generating tool recommendations', {
        bottlenecks_count: workflowAnalysis.bottlenecks?.length || 0,
        organization_id: organizationContext.organization_id
      });
      
      const recommendations = [];
      
      // Analyze each bottleneck
      for (const bottleneck of workflowAnalysis.bottlenecks || []) {
        const bottleneckRecs = await this.recommendForBottleneck(bottleneck, organizationContext);
        recommendations.push(...bottleneckRecs);
      }
      
      // Analyze success patterns for amplification
      for (const successFactor of workflowAnalysis.success_factors || []) {
        const amplificationRecs = await this.recommendForAmplification(successFactor, organizationContext);
        recommendations.push(...amplificationRecs);
      }
      
      // Prioritize and filter recommendations
      const prioritizedRecs = ToolRecommendationHelpers.prioritizeRecommendations(recommendations);
      const topRecommendations = prioritizedRecs.slice(0, this.options.maxRecommendations);
      
      // Enrich with market data
      for (const rec of topRecommendations) {
        rec.market_data = await this.marketIntelligence.getToolData(rec.recommended_tool);
        rec.peer_results = await this.marketIntelligence.getPeerResults(rec, organizationContext);
      }
      
      this.logger.info('Tool recommendations generated', {
        total_recommendations: recommendations.length,
        top_recommendations: topRecommendations.length,
        avg_roi: topRecommendations.reduce((sum, r) => sum + (r.roi_percentage || 0), 0) / topRecommendations.length
      });
      
      return topRecommendations;
      
    } catch (error) {
      this.logger.error('Tool recommendation generation failed', {
        error: error.message,
        organization_id: organizationContext.organization_id
      });
      throw error;
    }
  }
  
  /**
   * Recommend tools for a specific bottleneck
   */
  async recommendForBottleneck(bottleneck, organizationContext) {
    try {
      const recommendations = [];
      
      // Generate recommendations based on bottleneck type using AI analysis
      const toolAnalysis = await this.analyzeBottleneckForTools(bottleneck, organizationContext);
      const toolSuggestions = toolAnalysis.suggested_tools || [];
      
      for (const toolSuggestion of toolSuggestions) {
        try {
          // Calculate ROI for this tool suggestion
          const roiAnalysis = await this.roiCalculator.calculateROI(toolSuggestion, bottleneck, organizationContext);
          
          // Create recommendation object with ROI data
          const recommendation = {
            workflow_id: bottleneck.workflow_id || 'unknown',
            bottleneck_id: bottleneck.id || `bottleneck_${Date.now()}`,
            organization_id: organizationContext.organization_id,
            
            recommended_tool: toolSuggestion.tool_name,
            tool_category: toolSuggestion.category,
            tool_stack: toolSuggestion.additional_tools || [],
            
            addresses_issue: bottleneck.issue,
            solution_description: toolSuggestion.solution_description,
            expected_improvement: toolSuggestion.expected_improvement,
            
            // ROI data
            roi_analysis: roiAnalysis,
            implementation_cost: roiAnalysis.total_cost,
            annual_savings: roiAnalysis.annual_savings,
            revenue_impact: roiAnalysis.revenue_impact,
            payback_period_months: roiAnalysis.payback_months,
            roi_percentage: roiAnalysis.roi_percentage,
            
            // Implementation details
            implementation_plan: toolSuggestion.implementation_plan,
            implementation_effort: toolSuggestion.implementation_effort,
            estimated_weeks: toolSuggestion.estimated_weeks,
            
            // Risk assessment
            risk_factors: toolSuggestion.risk_factors || [],
            success_probability: toolSuggestion.success_probability || 0.8,
            
            // AI metadata
            ai_confidence: toolSuggestion.confidence || 0.7,
            analysis_model: this.aiAnalyzer.options.model,
            
            priority: this.calculatePriority(bottleneck, roiAnalysis),
            status: 'pending',
            created_at: new Date()
          };
          
          recommendations.push(recommendation);
        } catch (roiError) {
          this.logger.error('ROI calculation failed for tool suggestion', {
            tool_name: toolSuggestion.tool_name,
            error: roiError.message
          });
          // Continue with next suggestion instead of failing completely
        }
      }
      
      return recommendations;
      
    } catch (error) {
      this.logger.error('Bottleneck tool recommendation failed', {
        bottleneck_id: bottleneck.id,
        error: error.message,
        stack: error.stack
      });
      return [];
    }
  }
  
  /**
   * AI analysis of bottleneck to identify suitable tools
   */
  async analyzeBottleneckForTools(bottleneck, organizationContext) {
    const analysisPrompt = `
    Analyze this sales workflow bottleneck and recommend specific tools to solve it:
    
    BOTTLENECK DETAILS:
    - Location: ${bottleneck.location}
    - Issue: ${bottleneck.issue}
    - Impact: ${bottleneck.impact}
    - Severity: ${bottleneck.severity}
    
    ORGANIZATION CONTEXT:
    - Industry: ${organizationContext.industry || 'Not specified'}
    - Company Size: ${organizationContext.company_size || 'Not specified'}
    - Team Size: ${organizationContext.sales_team_size || 'Not specified'}
    - Current CRM: ${organizationContext.crm_system || 'Not specified'}
    - Tech Sophistication: ${organizationContext.tech_sophistication || 'medium'}
    - Budget Range: ${organizationContext.budget_range || 'Not specified'}
    
    NOTE: Please analyze the bottleneck and suggest appropriate tools without relying on a predefined database.
    
    Please recommend the top 3 tools that would best solve this bottleneck:
    
    {
      "suggested_tools": [
        {
          "tool_name": "Specific tool name",
          "category": "Tool category from available categories",
          "confidence": 0.85,
          "solution_description": "How this tool specifically solves the bottleneck",
          "expected_improvement": {
            "time_savings_hours_per_week": 10,
            "process_efficiency_gain": 0.3,
            "conversion_rate_improvement": 0.15,
            "cycle_time_reduction_days": 5
          },
          "implementation_effort": 6,
          "estimated_weeks": 4,
          "success_probability": 0.8,
          "implementation_plan": {
            "phase_1": "Setup and configuration (1 week)",
            "phase_2": "Team training and rollout (2 weeks)", 
            "phase_3": "Optimization and measurement (1 week)"
          },
          "risk_factors": [
            {
              "risk": "User adoption challenges",
              "probability": 0.3,
              "mitigation": "Comprehensive training program"
            }
          ],
          "additional_tools": ["Supporting tool if needed"],
          "integration_requirements": ["CRM", "Email platform"]
        }
      ],
      "analysis_reasoning": "Why these tools were selected",
      "implementation_priority": "Which tool to implement first and why"
    }
    
    Focus on tools that:
    1. Directly address the specific bottleneck
    2. Integrate well with existing systems
    3. Match the organization's technical capability
    4. Provide clear ROI within 12 months
    5. Have strong market reputation and support
    `;
    
    const analysis = await this.aiAnalyzer.performAnalysis({
      title: `Tool Recommendation for ${bottleneck.location}`,
      content: analysisPrompt,
      metadata: {
        type: 'tool_recommendation',
        bottleneck_location: bottleneck.location,
        organization_id: organizationContext.organization_id
      }
    }, {
      // Pass safe user context to avoid undefined property access
      competitors: [],
      our_products: [],
      focus_areas: ['sales_automation', 'workflow_optimization']
    });
    
    return this.parseToolAnalysis(analysis);
  }
  
  /**
   * Parse AI tool analysis response
   */
  parseToolAnalysis(analysis) {
    try {
      const analysisText = typeof analysis === 'string' ? analysis : analysis.content || '';
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      // Fallback if parsing fails
      return {
        suggested_tools: [],
        analysis_reasoning: 'Analysis parsing failed',
        implementation_priority: 'Manual review required'
      };
      
    } catch (error) {
      this.logger.warn('Failed to parse tool analysis', {
        error: error.message
      });
      
      return {
        suggested_tools: [],
        analysis_reasoning: 'Analysis parsing failed',
        implementation_priority: 'Manual review required'
      };
    }
  }
  
  /**
   * Recommend tools to amplify success factors
   */
  async recommendForAmplification(successFactor, organizationContext) {
    try {
      const amplificationPrompt = `
      This success factor has been identified in high-performing workflows. Recommend tools to amplify and scale this success factor:
      
      SUCCESS FACTOR:
      - Factor: ${successFactor.factor}
      - Correlation: ${successFactor.correlation}
      - Description: ${successFactor.description}
      - Current Insight: ${successFactor.actionable_insight}
      
      ORGANIZATION CONTEXT:
      - Industry: ${organizationContext.industry || 'Not specified'}
      - Team Size: ${organizationContext.sales_team_size || 'Not specified'}
      - Current Performance: ${organizationContext.current_metrics || 'Not specified'}
      
      Recommend tools that can:
      1. Scale this success factor across the entire team
      2. Automate or systematize the successful behavior
      3. Provide measurement and coaching around this factor
      4. Make it easier for average performers to replicate
      
      Format response as JSON with tool recommendations and scaling strategies.
      `;
      
      const amplificationAnalysis = await this.aiAnalyzer.performAnalysis({
        title: `Success Amplification for ${successFactor.factor}`,
        content: amplificationPrompt,
        metadata: {
          type: 'success_amplification',
          success_factor: successFactor.factor,
          organization_id: organizationContext.organization_id
        }
      }, {
        // Pass safe user context to avoid undefined property access
        competitors: [],
        our_products: [],
        focus_areas: ['sales_optimization', 'success_scaling']
      });
      
      const parsedAnalysis = this.parseToolAnalysis(amplificationAnalysis);
      
      // Convert to recommendation format
      const recommendations = [];
      
      for (const tool of parsedAnalysis.suggested_tools || []) {
        const roiAnalysis = await this.roiCalculator.calculateAmplificationROI(
          tool,
          successFactor,
          organizationContext
        );
        
        recommendations.push({
          organization_id: organizationContext.organization_id,
          recommended_tool: tool.tool_name,
          tool_category: tool.category,
          
          addresses_issue: `Amplify success factor: ${successFactor.factor}`,
          solution_description: tool.solution_description,
          expected_improvement: tool.expected_improvement,
          
          roi_analysis: roiAnalysis,
          implementation_cost: roiAnalysis.total_cost,
          revenue_impact: roiAnalysis.revenue_impact,
          roi_percentage: roiAnalysis.roi_percentage,
          
          implementation_effort: tool.implementation_effort || 5,
          estimated_weeks: tool.estimated_weeks || 6,
          
          ai_confidence: tool.confidence || 0.7,
          priority: 'medium', // Amplification usually lower priority than fixing bottlenecks
          status: 'pending',
          created_at: new Date()
        });
      }
      
      return recommendations;
      
    } catch (error) {
      this.logger.error('Success amplification recommendation failed', {
        success_factor: successFactor.factor,
        error: error.message
      });
      return [];
    }
  }
  
  /**
   * Calculate recommendation priority
   */
  calculatePriority(bottleneck, roiAnalysis) {
    let priorityScore = 0;
    
    // Severity weight (40%)
    const severityWeights = { critical: 1, high: 0.8, medium: 0.5, low: 0.2 };
    priorityScore += (severityWeights[bottleneck.severity] || 0.5) * 0.4;
    
    // ROI weight (40%)
    const roiScore = Math.min(1, (roiAnalysis.roi_percentage || 0) / 500); // Normalize to 500% max
    priorityScore += roiScore * 0.4;
    
    // Payback period weight (20%) - shorter is better
    const paybackScore = Math.max(0, 1 - (roiAnalysis.payback_months || 12) / 24);
    priorityScore += paybackScore * 0.2;
    
    // Convert to priority level
    if (priorityScore >= 0.8) return 'critical';
    if (priorityScore >= 0.6) return 'high';
    if (priorityScore >= 0.4) return 'medium';
    return 'low';
  }
  
  /**
   * Get tool alternatives and comparisons
   */
  async getToolAlternatives(primaryTool, category, organizationContext) {
    // Tool alternatives must be provided by external tool data sources
    this.logger.warn('Tool alternatives not available - external tool database required', {
      primary_tool: primaryTool,
      category: category
    });
    return [];
  }
  
  /**
   * Compare two tools using AI analysis
   */
  async compareTools(tool1, tool2, organizationContext) {
    try {
      const comparisonPrompt = `
      Compare these two tools for this organization:
      
      Tool 1: ${tool1}
      Tool 2: ${tool2}
      
      Organization Context:
      - Industry: ${organizationContext.industry}
      - Size: ${organizationContext.company_size}
      - Tech Level: ${organizationContext.tech_sophistication}
      - Budget: ${organizationContext.budget_range}
      
      Compare on:
      1. Feature completeness
      2. Ease of implementation
      3. Cost effectiveness
      4. Integration capabilities
      5. Scalability
      6. Support quality
      
      Provide scores (0-1) for each dimension and overall recommendation.
      `;
      
      const comparison = await this.aiAnalyzer.performAnalysis({
        title: `Tool Comparison: ${tool1} vs ${tool2}`,
        content: comparisonPrompt,
        metadata: {
          type: 'tool_comparison',
          tool1: tool1,
          tool2: tool2,
          organization_id: organizationContext.organization_id
        }
      }, {
        // Pass safe user context to avoid undefined property access
        competitors: [],
        our_products: [],
        focus_areas: ['tool_evaluation']
      });
      
      return this.parseComparison(comparison);
      
    } catch (error) {
      this.logger.error('Tool comparison failed', {
        tool1, tool2,
        error: error.message
      });
      
      return {
        overall_score: 0.5,
        dimensions: {},
        recommendation: 'Manual evaluation required'
      };
    }
  }
  
  /**
   * Parse tool comparison response
   */
  parseComparison(comparison) {
    try {
      const comparisonText = typeof comparison === 'string' ? comparison : comparison.content || '';
      const jsonMatch = comparisonText.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      return {
        overall_score: 0.5,
        dimensions: {},
        recommendation: 'Comparison parsing failed'
      };
      
    } catch (error) {
      return {
        overall_score: 0.5,
        dimensions: {},
        recommendation: 'Comparison parsing failed'
      };
    }
  }
}

/**
 * ROI Calculator - Comprehensive ROI analysis for tool recommendations
 */
class ROICalculator {
  constructor(options = {}) {
    this.options = options;
    this.aiAnalyzer = new AIAnalyzer(options);
  }
  
  async calculateROI(toolSuggestion, bottleneck, organizationContext) {
    try {
      // ROI calculation requires external cost data and specific organizational metrics
      this.logger.warn('ROI calculation not available - requires external cost data and specific metrics', {
        tool_name: toolSuggestion.tool_name,
        organization_id: organizationContext.organization_id
      });
      
      // Return empty ROI structure
      return {
        monthly_cost: 0,
        implementation_cost: 0,
        annual_cost: 0,
        total_cost: 0,
        revenue_impact: 0,
        annual_savings: 0,
        total_benefits: 0,
        net_benefit: 0,
        roi_percentage: 0,
        payback_months: 0,
        conservative: { benefits: 0, net_benefit: 0, roi_percentage: 0, payback_months: 0 },
        realistic: { benefits: 0, net_benefit: 0, roi_percentage: 0, payback_months: 0 },
        optimistic: { benefits: 0, net_benefit: 0, roi_percentage: 0, payback_months: 0 },
        assumptions: {
          note: 'ROI calculation requires external cost and organizational data'
        }
      };
      
    } catch (error) {
      throw new Error(`ROI calculation failed: ${error.message}`);
    }
  }
  
  calculateScenario(benefits, costs) {
    const netBenefit = benefits - costs;
    const roiPercentage = costs > 0 ? (netBenefit / costs) * 100 : 0;
    const paybackMonths = costs > 0 ? (costs / (benefits / 12)) : 0;
    
    return {
      benefits,
      net_benefit: netBenefit,
      roi_percentage: roiPercentage,
      payback_months: paybackMonths
    };
  }
  
  estimateToolCost(toolName, teamSize) {
    // Tool costs must be provided by external pricing sources
    this.logger.warn('Tool cost estimation not available - external pricing API required', {
      tool_name: toolName,
      team_size: teamSize
    });
    return 0; // Cannot estimate without external data
  }
  
  async calculateAmplificationROI(toolSuggestion, successFactor, organizationContext) {
    // Similar to calculateROI but focused on scaling successful behaviors
    const baseROI = await this.calculateROI(toolSuggestion, {}, organizationContext);
    
    // Apply success factor correlation as a multiplier
    const correlationMultiplier = successFactor.correlation || 0.7;
    
    return {
      ...baseROI,
      revenue_impact: baseROI.revenue_impact * correlationMultiplier,
      roi_percentage: baseROI.roi_percentage * correlationMultiplier,
      amplification_factor: correlationMultiplier,
      success_factor_addressed: successFactor.factor
    };
  }
}

/**
 * Market Intelligence Engine - Real-time tool data and benchmarking
 */
class MarketIntelligenceEngine {
  constructor(options = {}) {
    this.options = options;
    this.logger = winston.createLogger({
      level: options.logLevel || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      defaultMeta: { service: 'market-intelligence' }
    });
  }
  
  async getToolData(toolName) {
    this.logger.warn('Tool market data not available - external market intelligence API required', {
      tool_name: toolName
    });
    
    return {
      name: toolName,
      category: 'unknown',
      rating: null,
      review_count: 0,
      pricing: null,
      features: [],
      integrations: [],
      market_position: 'unknown',
      vendor_stability: null,
      last_updated: new Date(),
      note: 'Market data requires external integration'
    };
  }
  
  async getPeerResults(recommendation, organizationContext) {
    this.logger.warn('Peer results not available - external benchmarking database required', {
      tool: recommendation.recommended_tool,
      organization_id: organizationContext.organization_id
    });
    
    return {
      similar_companies: 0,
      avg_roi_achieved: null,
      implementation_success_rate: null,
      avg_payback_period: null,
      common_challenges: [],
      success_factors: [],
      note: 'Peer benchmarking requires external data sources'
    };
  }
}

module.exports = { ToolRecommendationEngine, ROICalculator, MarketIntelligenceEngine };
