/**
 * AI Task Recommendation Generator - Intelligent tool suggestions based on task+CRM context
 * 
 * Features:
 * 1. Generates specific tool recommendations for tasks
 * 2. Provides step-by-step completion guidance
 * 3. Includes ROI and success probability estimates
 * 4. Personalizes recommendations based on CRM context
 */

const winston = require('winston');
const AIAnalyzer = require('../ai/anthropic-analyzer');

class AITaskRecommendationGenerator {
  constructor(options = {}) {
    this.options = {
      logLevel: 'info',
      maxRecommendations: 5,
      minConfidence: 0.4,
      includeROI: true,
      ...options
    };
    
    this.logger = winston.createLogger({
      level: this.options.logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/ai-task-recommendations.log' })
      ],
      defaultMeta: { service: 'ai-task-recommendations' }
    });
    
    this.aiAnalyzer = new AIAnalyzer(options);
    
    // Tool knowledge base
    this.toolDatabase = this.initializeToolDatabase();
  }

  /**
   * Generate comprehensive task completion recommendations
   */
  async generateTaskRecommendations(enrichedTaskContext) {
    try {
      this.logger.info('Generating task recommendations', {
        task_id: enrichedTaskContext.task_id,
        task_type: enrichedTaskContext.task_type,
        urgency: enrichedTaskContext.urgency
      });

      // Step 1: Generate tool recommendations
      const toolRecommendations = await this.generateToolRecommendations(enrichedTaskContext);
      
      // Step 2: Create step-by-step guidance
      const stepByStepGuidance = await this.generateStepByStepGuidance(enrichedTaskContext, toolRecommendations);
      
      // Step 3: Generate success strategies
      const successStrategies = await this.generateSuccessStrategies(enrichedTaskContext);
      
      // Step 4: Create personalized message for assignee
      const personalizedMessage = await this.generatePersonalizedMessage(
        enrichedTaskContext, 
        toolRecommendations, 
        stepByStepGuidance
      );
      
      // Step 5: Compile final recommendations
      const finalRecommendations = {
        task_id: enrichedTaskContext.task_id,
        assignee: enrichedTaskContext.assignee,
        task_summary: enrichedTaskContext.action_required,
        urgency: enrichedTaskContext.urgency,
        
        tool_recommendations: toolRecommendations,
        step_by_step_guidance: stepByStepGuidance,
        success_strategies: successStrategies,
        personalized_message: personalizedMessage,
        
        confidence_score: this.calculateOverallConfidence(
          toolRecommendations, 
          stepByStepGuidance, 
          enrichedTaskContext
        ),
        
        generated_at: new Date(),
        expires_at: new Date(Date.now() + (24 * 60 * 60 * 1000)) // 24 hours
      };
      
      this.logger.info('Task recommendations generated successfully', {
        task_id: enrichedTaskContext.task_id,
        tools_recommended: toolRecommendations.length,
        steps_provided: stepByStepGuidance.steps?.length || 0,
        confidence: finalRecommendations.confidence_score
      });
      
      return finalRecommendations;
      
    } catch (error) {
      this.logger.error('Failed to generate task recommendations', {
        task_id: enrichedTaskContext.task_id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Generate specific tool recommendations using AI
   */
  async generateToolRecommendations(enrichedTaskContext) {
    const prompt = `
Analyze this task and recommend specific tools for completion:

TASK DETAILS:
- Type: ${enrichedTaskContext.task_type}
- Action: ${enrichedTaskContext.action_required}
- Urgency: ${enrichedTaskContext.urgency}
- Assignee: ${enrichedTaskContext.assignee || 'Team member'}

CRM CONTEXT:
- Company matches: ${JSON.stringify(enrichedTaskContext.crm_matches)}
- Business stage: ${enrichedTaskContext.context_analysis?.business_stage || 'Unknown'}
- Criticality: ${enrichedTaskContext.context_analysis?.criticality || 'Medium'}

COMPANY CONTEXT:
- Industry: ${enrichedTaskContext.company_context?.organization_context?.industry || 'Unknown'}
- Size: ${enrichedTaskContext.company_context?.organization_context?.company_size || 'Unknown'}
- Tech stack: ${JSON.stringify(enrichedTaskContext.company_context?.technology_stack || {})}

Based on this context, recommend specific tools that would help complete this task effectively.

For each tool recommendation, provide:
1. Tool name and category
2. Why it's recommended for this specific task
3. How it addresses the CRM context
4. Estimated time savings
5. Success probability with this tool
6. Specific features to use

Respond in JSON format:
{
  "recommendations": [
    {
      "tool_name": "only suggest tools that exist in the company's technology stack",
      "category": "based on actual company tools",
      "reasoning": "why this existing tool is perfect for this task",
      "crm_relevance": "how it connects to the actual CRM context"
    }
  ],
  "overall_strategy": "approach using only existing company tools",
  "confidence": 0.0-1.0
}

Focus on tools that actually exist and are commonly used in business environments.
`;

    try {
      const analysis = await this.aiAnalyzer.analyzeText(enrichedTaskContext.action_required, {
        analysisType: 'tool_recommendations',
        prompt: prompt
      });
      
      let recommendations;
      if (typeof analysis === 'string') {
        recommendations = JSON.parse(analysis);
      } else {
        recommendations = analysis;
      }
      
      // Enhance recommendations with additional data
      return this.enhanceToolRecommendations(recommendations.recommendations || [], enrichedTaskContext);
      
    } catch (error) {
      this.logger.warn('AI tool recommendations failed - no recommendations available', { error: error.message });
      return [];
    }
  }

  /**
   * Generate step-by-step completion guidance
   */
  async generateStepByStepGuidance(enrichedTaskContext, toolRecommendations) {
    const prompt = `
Create a detailed step-by-step guide for completing this task:

TASK: ${enrichedTaskContext.action_required}
URGENCY: ${enrichedTaskContext.urgency}
DEADLINE: ${enrichedTaskContext.deadline || 'Not specified'}

RECOMMENDED TOOLS: ${JSON.stringify(toolRecommendations.slice(0, 3))}

CRM INSIGHTS:
- Business criticality: ${enrichedTaskContext.context_analysis?.criticality}
- Risks if delayed: ${JSON.stringify(enrichedTaskContext.context_analysis?.risks || [])}
- Success factors: ${JSON.stringify(enrichedTaskContext.success_factors?.key_factors || [])}

Create a practical, actionable step-by-step guide that:
1. Starts with immediate preparation steps
2. Uses the recommended tools effectively
3. Addresses the CRM context and business criticality
4. Includes checkpoints and validation steps
5. Provides contingency plans for common issues

Respond in JSON format:
{
  "steps": [
    {
      "step_number": number,
      "title": "step title",
      "description": "detailed description",
      "estimated_time_minutes": number,
      "tools_needed": ["tool1", "tool2"],
      "success_criteria": "how to know this step is complete",
      "potential_issues": ["issue1", "issue2"],
      "tips": ["tip1", "tip2"]
    }
  ],
  "total_estimated_time_hours": number,
  "critical_checkpoints": ["checkpoint1", "checkpoint2"],
  "contingency_plans": {
    "if_delayed": "what to do if running behind",
    "if_blocked": "what to do if stuck",
    "if_escalation_needed": "when and how to escalate"
  },
  "confidence": 0.0-1.0
}
`;

    try {
      const analysis = await this.aiAnalyzer.analyzeText(enrichedTaskContext.action_required, {
        analysisType: 'step_by_step_guidance',
        prompt: prompt
      });
      
      let guidance;
      if (typeof analysis === 'string') {
        guidance = JSON.parse(analysis);
      } else {
        guidance = analysis;
      }
      
      return guidance;
      
    } catch (error) {
      this.logger.warn('Step-by-step guidance generation failed - no guidance available', { error: error.message });
      return null;
    }
  }

  /**
   * Generate success strategies based on CRM patterns
   */
  async generateSuccessStrategies(enrichedTaskContext) {
    const prompt = `
Based on this task and CRM context, provide success strategies:

TASK: ${enrichedTaskContext.action_required}
TASK TYPE: ${enrichedTaskContext.task_type}

CRM CONTEXT:
- Similar patterns: ${enrichedTaskContext.success_factors?.similar_patterns || 'None identified'}
- Key success factors: ${JSON.stringify(enrichedTaskContext.success_factors?.key_factors || [])}
- Cautions: ${JSON.stringify(enrichedTaskContext.success_factors?.cautions || [])}

COMPANY CONTEXT:
- Industry: ${enrichedTaskContext.company_context?.organization_context?.industry}
- Business model: ${enrichedTaskContext.company_context?.organization_context?.business_model}

Provide strategic advice for maximizing success:

Respond in JSON format:
{
  "success_strategies": [
    {
      "strategy": "strategy description",
      "why_effective": "explanation of effectiveness",
      "implementation": "how to implement",
      "success_indicators": ["indicator1", "indicator2"]
    }
  ],
  "risk_mitigation": [
    {
      "risk": "potential risk",
      "probability": "high|medium|low",
      "mitigation": "how to prevent or address"
    }
  ],
  "best_practices": ["practice1", "practice2"],
  "confidence": 0.0-1.0
}
`;

    try {
      const analysis = await this.aiAnalyzer.analyzeText(enrichedTaskContext.action_required, {
        analysisType: 'success_strategies',
        prompt: prompt
      });
      
      let strategies;
      if (typeof analysis === 'string') {
        strategies = JSON.parse(analysis);
      } else {
        strategies = analysis;
      }
      
      return strategies;
      
    } catch (error) {
      this.logger.warn('Success strategies generation failed', { error: error.message });
      return {
        success_strategies: [],
        risk_mitigation: [],
        best_practices: ['Follow up regularly', 'Document progress', 'Communicate status'],
        confidence: 0.3
      };
    }
  }

  /**
   * Generate personalized message for the task assignee
   */
  async generatePersonalizedMessage(enrichedTaskContext, toolRecommendations, stepByStepGuidance) {
    const assigneeName = enrichedTaskContext.assignee || 'Team member';
    const urgencyEmoji = enrichedTaskContext.urgency === 'high' ? '🚨' : enrichedTaskContext.urgency === 'medium' ? '⚡' : '📋';
    
    const prompt = `
Create a personalized, helpful message for the task assignee:

ASSIGNEE: ${assigneeName}
TASK: ${enrichedTaskContext.action_required}
URGENCY: ${enrichedTaskContext.urgency}

TOP TOOLS RECOMMENDED: ${toolRecommendations.slice(0, 2).map(t => t.tool_name).join(', ')}
ESTIMATED TIME: ${stepByStepGuidance.total_estimated_time_hours || 'Unknown'} hours

Create a friendly, professional message that:
1. Acknowledges the task assignment
2. Provides immediate value with key insights
3. Highlights the most important tools/steps
4. Motivates action with success factors
5. Offers support and guidance

Keep it concise but helpful. Use a supportive, collaborative tone.

Respond with just the message text (no JSON wrapper).
`;

    try {
      const message = await this.aiAnalyzer.analyzeText(enrichedTaskContext.action_required, {
        analysisType: 'personalized_message',
        prompt: prompt
      });
      
      return `${urgencyEmoji} **Task Guidance for ${assigneeName}**\n\n${message}`;
      
    } catch (error) {
      this.logger.warn('Personalized message generation failed', { error: error.message });
      
      // Fallback message
      return `${urgencyEmoji} **Task Guidance for ${assigneeName}**\n\nI've analyzed your task: "${enrichedTaskContext.action_required}"\n\nBased on our CRM data and company context, I've prepared specific tool recommendations and step-by-step guidance to help you complete this efficiently.\n\nCheck the detailed recommendations below for the best approach!`;
    }
  }

  /**
   * Enhance tool recommendations with additional data
   */
  enhanceToolRecommendations(recommendations, enrichedTaskContext) {
    return recommendations.map(rec => ({
      ...rec,
      task_id: enrichedTaskContext.task_id,
      recommendation_id: `rec_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      priority_score: this.calculatePriorityScore(rec, enrichedTaskContext),
      implementation_url: this.getImplementationUrl(rec.tool_name),
      generated_at: new Date()
    }));
  }

  /**
   * Calculate priority score for recommendations
   */
  calculatePriorityScore(recommendation, enrichedTaskContext) {
    let score = 0;
    
    // Base score from success probability
    score += (recommendation.success_probability || 0.5) * 40;
    
    // Time savings bonus
    score += Math.min((recommendation.time_savings_hours || 0) * 5, 20);
    
    // Urgency multiplier
    if (enrichedTaskContext.urgency === 'high') score *= 1.3;
    else if (enrichedTaskContext.urgency === 'low') score *= 0.8;
    
    // Setup time penalty
    score -= Math.min((recommendation.setup_time_minutes || 0) / 10, 15);
    
    // Cost consideration
    if (recommendation.cost_estimate === 'free') score += 10;
    else if (recommendation.cost_estimate === 'high') score -= 10;
    
    return Math.round(Math.max(0, Math.min(100, score)));
  }

  /**
   * Get implementation URL for tools
   */
  getImplementationUrl(toolName) {
    // No hardcoded URLs - would need external tool database integration
    return null;
  }




  /**
   * Calculate overall confidence score
   */
  calculateOverallConfidence(toolRecommendations, stepByStepGuidance, enrichedTaskContext) {
    const toolConfidence = toolRecommendations.length > 0 ? 0.8 : 0.3;
    const guidanceConfidence = stepByStepGuidance.confidence || 0.5;
    const taskConfidence = enrichedTaskContext.confidence_score || 0.5;
    
    return Math.round((toolConfidence + guidanceConfidence + taskConfidence) / 3 * 100) / 100;
  }

  /**
   * Initialize tool knowledge database
   */
  initializeToolDatabase() {
    return {
      categories: ['crm', 'communication', 'scheduling', 'document', 'automation', 'analytics'],
      note: 'Tool recommendations must come from real company technology stack analysis'
    };
  }
}

module.exports = AITaskRecommendationGenerator;
