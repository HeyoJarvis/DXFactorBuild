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
    
    // Tool database with categories and capabilities
    this.toolDatabase = {
      lead_generation: [
        { name: 'Apollo', pricing: 'from_$49', features: ['prospecting', 'email_finder', 'sequences'] },
        { name: 'ZoomInfo', pricing: 'from_$79', features: ['database', 'intent_data', 'technographics'] },
        { name: 'Outreach', pricing: 'from_$100', features: ['sequences', 'automation', 'analytics'] },
        { name: 'SalesLoft', pricing: 'from_$125', features: ['cadences', 'dialer', 'analytics'] }
      ],
      email_automation: [
        { name: 'Outreach', pricing: 'from_$100', features: ['sequences', 'personalization', 'analytics'] },
        { name: 'SalesLoft', pricing: 'from_$125', features: ['cadences', 'templates', 'tracking'] },
        { name: 'Mailchimp', pricing: 'from_$10', features: ['campaigns', 'automation', 'segmentation'] },
        { name: 'HubSpot', pricing: 'from_$45', features: ['workflows', 'personalization', 'crm_integration'] }
      ],
      meeting_scheduling: [
        { name: 'Calendly', pricing: 'from_$8', features: ['scheduling', 'integrations', 'automation'] },
        { name: 'Chili Piper', pricing: 'from_$30', features: ['routing', 'qualification', 'handoff'] },
        { name: 'Acuity', pricing: 'from_$14', features: ['booking', 'payments', 'customization'] }
      ],
      proposal_automation: [
        { name: 'PandaDoc', pricing: 'from_$19', features: ['templates', 'esignature', 'analytics'] },
        { name: 'DocuSign', pricing: 'from_$10', features: ['esignature', 'workflows', 'compliance'] },
        { name: 'Proposify', pricing: 'from_$19', features: ['proposals', 'templates', 'tracking'] },
        { name: 'Qwilr', pricing: 'from_$35', features: ['interactive', 'analytics', 'integrations'] }
      ],
      workflow_automation: [
        { name: 'Zapier', pricing: 'from_$19', features: ['integrations', 'workflows', 'triggers'] },
        { name: 'Microsoft Power Automate', pricing: 'from_$15', features: ['flows', 'connectors', 'ai'] },
        { name: 'Integromat', pricing: 'from_$9', features: ['scenarios', 'data_processing', 'scheduling'] }
      ],
      analytics: [
        { name: 'Gong', pricing: 'from_$200', features: ['conversation_ai', 'coaching', 'forecasting'] },
        { name: 'Chorus', pricing: 'from_$180', features: ['call_analysis', 'insights', 'coaching'] },
        { name: 'Tableau', pricing: 'from_$70', features: ['visualization', 'dashboards', 'analytics'] }
      ],
      video_engagement: [
        { name: 'Loom', pricing: 'from_$8', features: ['screen_recording', 'video_messages', 'analytics'] },
        { name: 'Vidyard', pricing: 'from_$19', features: ['video_sales', 'personalization', 'tracking'] },
        { name: 'BombBomb', pricing: 'from_$33', features: ['video_email', 'automation', 'crm_integration'] }
      ]
    };
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
      // AI analysis to identify tool categories and specific tools
      const toolAnalysis = await this.analyzeBottleneckForTools(bottleneck, organizationContext);
      
      const recommendations = [];
      
      for (const toolSuggestion of toolAnalysis.suggested_tools || []) {
        // Calculate ROI for this tool
        const roiAnalysis = await this.roiCalculator.calculateROI(
          toolSuggestion,
          bottleneck,
          organizationContext
        );
        
        // Create recommendation object
        const recommendation = {
          workflow_id: bottleneck.workflow_id,
          bottleneck_id: bottleneck.id,
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
      }
      
      return recommendations;
      
    } catch (error) {
      this.logger.error('Bottleneck tool recommendation failed', {
        bottleneck_id: bottleneck.id,
        error: error.message
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
    
    AVAILABLE TOOL CATEGORIES:
    ${JSON.stringify(Object.keys(this.toolDatabase), null, 2)}
    
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
      content: analysisPrompt,
      type: 'tool_recommendation',
      max_tokens: 2000
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
        content: amplificationPrompt,
        type: 'success_amplification',
        max_tokens: 1500
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
    try {
      const alternatives = this.toolDatabase[category] || [];
      const comparisons = [];
      
      for (const alt of alternatives) {
        if (alt.name !== primaryTool) {
          const comparison = await this.compareTools(primaryTool, alt.name, organizationContext);
          comparisons.push({
            tool_name: alt.name,
            pricing: alt.pricing,
            features: alt.features,
            comparison: comparison,
            recommendation_score: comparison.overall_score
          });
        }
      }
      
      return comparisons.sort((a, b) => b.recommendation_score - a.recommendation_score);
      
    } catch (error) {
      this.logger.error('Failed to get tool alternatives', {
        primary_tool: primaryTool,
        category: category,
        error: error.message
      });
      return [];
    }
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
        content: comparisonPrompt,
        type: 'tool_comparison',
        max_tokens: 1000
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
      // Base calculations
      const teamSize = organizationContext.sales_team_size || 10;
      const avgDealSize = organizationContext.avg_deal_size || 50000;
      const currentConversion = organizationContext.current_conversion_rate || 0.2;
      const currentCycleTime = organizationContext.avg_cycle_time || 60;
      
      // Tool costs
      const monthlyCost = this.estimateToolCost(toolSuggestion.tool_name, teamSize);
      const implementationCost = monthlyCost * 2; // Assume 2 months implementation cost
      const annualCost = monthlyCost * 12;
      const totalFirstYearCost = implementationCost + annualCost;
      
      // Expected improvements
      const improvements = toolSuggestion.expected_improvement || {};
      const conversionImprovement = improvements.conversion_rate_improvement || 0.1;
      const cycleTimeReduction = improvements.cycle_time_reduction_days || 5;
      const timeSavingsHours = improvements.time_savings_hours_per_week || 5;
      
      // Revenue impact calculations
      const additionalDeals = (currentConversion * conversionImprovement) * teamSize * 12; // Monthly deals
      const revenueFromAdditionalDeals = additionalDeals * avgDealSize;
      
      const fasterCycles = (cycleTimeReduction / currentCycleTime) * currentConversion * teamSize * 12;
      const revenueFromFasterCycles = fasterCycles * avgDealSize;
      
      const totalRevenueImpact = revenueFromAdditionalDeals + revenueFromFasterCycles;
      
      // Cost savings
      const hourlyCost = 75; // Assume $75/hour loaded cost
      const weeklySavings = timeSavingsHours * hourlyCost;
      const annualTimeSavings = weeklySavings * 52 * teamSize;
      
      // ROI calculations
      const totalBenefits = totalRevenueImpact + annualTimeSavings;
      const netBenefit = totalBenefits - totalFirstYearCost;
      const roiPercentage = totalFirstYearCost > 0 ? (netBenefit / totalFirstYearCost) * 100 : 0;
      const paybackMonths = totalFirstYearCost > 0 ? (totalFirstYearCost / (totalBenefits / 12)) : 0;
      
      return {
        // Costs
        monthly_cost: monthlyCost,
        implementation_cost: implementationCost,
        annual_cost: annualCost,
        total_cost: totalFirstYearCost,
        
        // Benefits
        revenue_impact: totalRevenueImpact,
        annual_savings: annualTimeSavings,
        total_benefits: totalBenefits,
        
        // ROI metrics
        net_benefit: netBenefit,
        roi_percentage: roiPercentage,
        payback_months: paybackMonths,
        
        // Scenarios
        conservative: this.calculateScenario(totalBenefits * 0.7, totalFirstYearCost),
        realistic: this.calculateScenario(totalBenefits, totalFirstYearCost),
        optimistic: this.calculateScenario(totalBenefits * 1.3, totalFirstYearCost),
        
        // Assumptions
        assumptions: {
          team_size: teamSize,
          avg_deal_size: avgDealSize,
          current_conversion: currentConversion,
          current_cycle_time: currentCycleTime,
          hourly_cost: hourlyCost
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
    // Simple cost estimation - in production, this would use real pricing APIs
    const baseCosts = {
      'Apollo': 49,
      'ZoomInfo': 79,
      'Outreach': 100,
      'SalesLoft': 125,
      'Calendly': 8,
      'Chili Piper': 30,
      'PandaDoc': 19,
      'DocuSign': 10,
      'Zapier': 19,
      'Gong': 200,
      'Chorus': 180,
      'Loom': 8,
      'Vidyard': 19
    };
    
    const baseCost = baseCosts[toolName] || 50;
    
    // Apply team size multiplier with volume discounts
    let multiplier = teamSize;
    if (teamSize > 50) multiplier = teamSize * 0.8; // 20% volume discount
    if (teamSize > 100) multiplier = teamSize * 0.7; // 30% volume discount
    
    return baseCost * multiplier;
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
    try {
      // In production, this would integrate with G2, Capterra, etc.
      // For now, return mock data structure
      return {
        name: toolName,
        category: 'sales_tool',
        rating: 4.2 + Math.random() * 0.6, // Mock rating 4.2-4.8
        review_count: Math.floor(Math.random() * 1000) + 100,
        pricing: {
          starting_price: Math.floor(Math.random() * 100) + 20,
          pricing_model: 'per_user_monthly'
        },
        features: [],
        integrations: [],
        market_position: 'established',
        vendor_stability: 0.8 + Math.random() * 0.2,
        last_updated: new Date()
      };
      
    } catch (error) {
      this.logger.error('Failed to get tool market data', {
        tool_name: toolName,
        error: error.message
      });
      
      return {
        name: toolName,
        rating: 4.0,
        review_count: 0,
        market_position: 'unknown',
        vendor_stability: 0.7,
        last_updated: new Date()
      };
    }
  }
  
  async getPeerResults(recommendation, organizationContext) {
    try {
      // Mock peer results - in production, this would query a database of implementations
      return {
        similar_companies: Math.floor(Math.random() * 50) + 10,
        avg_roi_achieved: (recommendation.roi_percentage || 0) * (0.8 + Math.random() * 0.4),
        implementation_success_rate: 0.7 + Math.random() * 0.2,
        avg_payback_period: (recommendation.payback_period_months || 6) * (0.9 + Math.random() * 0.2),
        common_challenges: [
          'User adoption',
          'Integration complexity',
          'Change management'
        ],
        success_factors: [
          'Executive sponsorship',
          'Comprehensive training',
          'Phased rollout'
        ]
      };
      
    } catch (error) {
      this.logger.error('Failed to get peer results', {
        tool: recommendation.recommended_tool,
        error: error.message
      });
      
      return {
        similar_companies: 0,
        avg_roi_achieved: 0,
        implementation_success_rate: 0.5,
        avg_payback_period: 12
      };
    }
  }
}

module.exports = { ToolRecommendationEngine, ROICalculator, MarketIntelligenceEngine };
