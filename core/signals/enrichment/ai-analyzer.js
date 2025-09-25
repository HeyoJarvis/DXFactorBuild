/**
 * AI Analyzer - Uses Anthropic Claude for general assistance and analysis
 * 
 * Features:
 * 1. General productivity assistance
 * 2. Code and development help
 * 3. Project management guidance
 * 4. Tool recommendations
 * 5. Workflow optimization
 */

const Anthropic = require('@anthropic-ai/sdk');
const winston = require('winston');

class AIAnalyzer {
  constructor(options = {}) {
    this.options = {
      model: 'claude-3-haiku-20240307',
      maxTokens: 1000,
      temperature: 0.7,
      logLevel: 'info',
      ...options
    };
    
    this.logger = winston.createLogger({
      level: this.options.logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      defaultMeta: { service: 'ai-analyzer' }
    });
    
    // Initialize Anthropic client
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || 'demo-key'
    });
  }
  
  /**
   * Analyze signal content for general assistance
   */
  async analyzeSignal(signal, userContext = {}) {
    try {
      this.logger.info('Processing user query with Claude', {
        signal_id: signal.id,
        title: signal.title
      });
      
      const analysis = await this.performGeneralAnalysis(signal, userContext);
      
      return {
        summary: analysis.content,
        insights: [],
        relevance_score: 1.0,
        sentiment: 'neutral',
        metadata: {
          model_used: this.options.model,
          tokens_used: analysis.usage?.total_tokens || 0,
          processing_time_ms: Date.now() - Date.now()
        }
      };
      
    } catch (error) {
      this.logger.error('Analysis failed', { error: error.message });
      
      return {
        summary: "I apologize, but I encountered an issue processing your request. Please try again.",
        insights: [],
        relevance_score: 0.0,
        sentiment: 'neutral',
        metadata: {
          error: error.message,
          model_used: 'fallback'
        }
      };
    }
  }

  /**
   * Perform general AI analysis
   */
  async performGeneralAnalysis(signal, userContext) {
    const systemPrompt = userContext.systemPrompt || `You are HeyJarvis, a helpful AI assistant focused on productivity and tooling. You help with:

- Code and development tasks
- Project management and organization  
- Workflow optimization
- Tool recommendations
- General problem-solving
- Task automation ideas
- File organization and management
- Process improvement

Be concise, practical, and actionable. Focus on helping the user be more productive. When possible, provide specific steps or code examples.`;

    const messages = [];

    // Add conversation history if provided
    if (userContext.messages && userContext.messages.length > 0) {
      messages.push(...userContext.messages);
    } else {
      messages.push({
        role: 'user',
        content: signal.content
      });
    }

    const response = await this.anthropic.messages.create({
      model: this.options.model,
      max_tokens: userContext.maxTokens || this.options.maxTokens,
      temperature: userContext.temperature || this.options.temperature,
      messages: messages.filter(m => m.role !== 'system'),
      system: systemPrompt
    });

    return {
      content: response.content[0].text,
      usage: response.usage
    };
  }
  
  /**
   * Analyze content for actionable insights
   */
  async analyzeContent(content, context = {}) {
    try {
      const signal = {
        id: 'content_' + Date.now(),
        title: 'Content Analysis',
        content: content,
        url: 'internal://content-analysis',
        metadata: context
      };

      return await this.analyzeSignal(signal, context);
    } catch (error) {
      this.logger.error('Content analysis failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Generate task recommendations
   */
  async generateTaskRecommendations(userInput, context = {}) {
    try {
      const systemPrompt = `You are HeyJarvis, a productivity assistant. Based on the user's input, provide specific, actionable task recommendations. Format your response as:

1. **Immediate Actions** - Things they can do right now
2. **Tools & Resources** - Specific tools or resources that would help
3. **Next Steps** - Follow-up actions to consider

Be specific and practical.`;

      const signal = {
        id: 'task_rec_' + Date.now(),
        title: 'Task Recommendations',
        content: userInput,
        url: 'internal://task-recommendations',
        metadata: context
      };

      return await this.analyzeSignal(signal, { ...context, systemPrompt });
    } catch (error) {
      this.logger.error('Task recommendation failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Analyze code or technical content
   */
  async analyzeCode(code, language, context = {}) {
    try {
      const systemPrompt = `You are HeyJarvis, a coding assistant. Analyze the provided ${language} code and provide:

1. **Code Review** - Quality, best practices, potential issues
2. **Improvements** - Specific suggestions for enhancement
3. **Documentation** - Brief explanation of what the code does

Be constructive and educational.`;

      const signal = {
        id: 'code_analysis_' + Date.now(),
        title: `${language} Code Analysis`,
        content: `\`\`\`${language}\n${code}\n\`\`\``,
        url: 'internal://code-analysis',
        metadata: { language, ...context }
      };

      return await this.analyzeSignal(signal, { ...context, systemPrompt });
    } catch (error) {
      this.logger.error('Code analysis failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Get workflow optimization suggestions
   */
  async optimizeWorkflow(workflowDescription, context = {}) {
    try {
      const systemPrompt = `You are HeyJarvis, a workflow optimization expert. Analyze the described workflow and provide:

1. **Current State Analysis** - What's working and what isn't
2. **Optimization Opportunities** - Specific areas for improvement
3. **Tool Recommendations** - Software or tools that could help
4. **Implementation Steps** - How to make the changes

Focus on practical, implementable improvements.`;

      const signal = {
        id: 'workflow_opt_' + Date.now(),
        title: 'Workflow Optimization',
        content: workflowDescription,
        url: 'internal://workflow-optimization',
        metadata: context
      };

      return await this.analyzeSignal(signal, { ...context, systemPrompt });
    } catch (error) {
      this.logger.error('Workflow optimization failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Health check for the AI service
   */
  async healthCheck() {
    try {
      const testSignal = {
        id: 'health_check',
        title: 'Health Check',
        content: 'Hello',
        url: 'internal://health-check',
        metadata: {}
      };

      const result = await this.performGeneralAnalysis(testSignal, {
        systemPrompt: 'You are a helpful assistant. Respond with "AI service is healthy" if you receive this message.',
        maxTokens: 50
      });

      return {
        status: 'healthy',
        response_time_ms: Date.now() - Date.now(),
        model: this.options.model,
        response: result.content
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        model: this.options.model
      };
    }
  }

  /**
   * Get default analysis when AI fails
   */
  getDefaultAnalysis(signal) {
    return {
      summary: "I'm currently unable to process your request due to a technical issue. Please try again in a moment.",
      insights: [],
      relevance_score: 0.0,
      sentiment: 'neutral',
      metadata: {
        model_used: 'fallback',
        error: 'AI service unavailable'
      }
    };
  }
}

module.exports = AIAnalyzer;
