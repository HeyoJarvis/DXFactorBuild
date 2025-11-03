/**
 * AI Model Router
 * 
 * Routes AI requests to appropriate providers based on task type:
 * - Anthropic Claude for general tasks, ticket classification, sprint summaries
 * - OpenAI GPT for documentation (optional)
 * - GitHub Copilot for code queries (optional, when available)
 * 
 * Features:
 * 1. Config-driven routing rules
 * 2. Provider adapters (normalize responses)
 * 3. Fallback chain if primary provider fails
 * 4. Cost and quality optimization
 * 5. Provider health monitoring
 */

const winston = require('winston');
const Anthropic = require('@anthropic-ai/sdk');
const EventEmitter = require('events');

class ModelRouter extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      defaultProvider: options.defaultProvider || process.env.DEFAULT_MODEL_PROVIDER || 'anthropic',
      anthropicApiKey: options.anthropicApiKey || process.env.ANTHROPIC_API_KEY,
      openaiApiKey: options.openaiApiKey || process.env.OPENAI_API_KEY,
      githubToken: options.githubToken || process.env.GITHUB_TOKEN,
      logLevel: options.logLevel || 'info',
      ...options
    };

    // Initialize logger
    this.logger = winston.createLogger({
      level: this.options.logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ 
          filename: 'logs/model-router.log',
          maxsize: 5242880, // 5MB
          maxFiles: 5
        })
      ],
      defaultMeta: { service: 'model-router' }
    });

    // Initialize providers
    this.providers = {};
    this._initializeProviders();

    // Default routing rules
    this.routingRules = {
      code_query: { 
        provider: 'anthropic', 
        model: 'claude-3-5-sonnet-20240620',
        fallback: []
      },
      ticket_classification: { 
        provider: 'anthropic', 
        model: 'claude-3-5-sonnet-20240620',
        fallback: []
      },
      documentation: { 
        provider: 'anthropic', 
        model: 'claude-3-5-sonnet-20240620',
        fallback: []
      },
      sprint_summary: { 
        provider: 'anthropic', 
        model: 'claude-3-5-sonnet-20240620',
        fallback: []
      },
      general: { 
        provider: 'anthropic', 
        model: 'claude-3-5-sonnet-20240620',
        fallback: []
      }
    };

    this.logger.info('Model Router initialized', {
      defaultProvider: this.options.defaultProvider,
      availableProviders: Object.keys(this.providers)
    });
  }

  /**
   * Initialize AI providers
   */
  _initializeProviders() {
    // Initialize Anthropic (required)
    if (this.options.anthropicApiKey) {
      try {
        this.providers.anthropic = {
          client: new Anthropic({ apiKey: this.options.anthropicApiKey }),
          adapter: this._anthropicAdapter.bind(this),
          available: true
        };
        this.logger.info('Anthropic provider initialized');
      } catch (error) {
        this.logger.error('Failed to initialize Anthropic provider', {
          error: error.message
        });
      }
    } else {
      this.logger.warn('Anthropic API key not configured');
    }

    // Initialize OpenAI (optional)
    if (this.options.openaiApiKey) {
      try {
        this.providers.openai = {
          client: null, // Lazy initialization
          adapter: this._openaiAdapter.bind(this),
          available: true
        };
        this.logger.info('OpenAI provider configured (will initialize on first use)');
      } catch (error) {
        this.logger.error('Failed to configure OpenAI provider', {
          error: error.message
        });
      }
    }

    // GitHub Copilot (optional, future)
    if (this.options.githubToken) {
      this.providers.copilot = {
        client: null, // Will be initialized when Copilot Chat API is ready
        adapter: this._copilotAdapter.bind(this),
        available: false // Not yet implemented
      };
      this.logger.info('GitHub Copilot provider configured (not yet active)');
    }
  }

  /**
   * Route AI request to appropriate provider
   */
  async route(taskType, prompt, context = {}) {
    try {
      const startTime = Date.now();

      this.logger.info('Routing AI request', {
        taskType,
        promptLength: prompt.length,
        context: Object.keys(context)
      });

      // Get routing rule for task type
      const rule = this.routingRules[taskType] || this.routingRules.general;
      
      // Try primary provider
      try {
        const result = await this._callProvider(
          rule.provider,
          rule.model,
          prompt,
          context
        );

        const duration = Date.now() - startTime;

        this.logger.info('AI request completed', {
          taskType,
          provider: rule.provider,
          model: rule.model,
          duration
        });

        this.emit('request_completed', {
          taskType,
          provider: rule.provider,
          model: rule.model,
          duration,
          success: true
        });

        return result;

      } catch (error) {
        this.logger.warn('Primary provider failed, trying fallbacks', {
          provider: rule.provider,
          error: error.message
        });

        // Try fallback providers
        for (const fallbackProvider of rule.fallback || []) {
          try {
            const result = await this._callProvider(
              fallbackProvider,
              rule.model,
              prompt,
              context
            );

            const duration = Date.now() - startTime;

            this.logger.info('AI request completed with fallback', {
              taskType,
              primaryProvider: rule.provider,
              fallbackProvider,
              duration
            });

            this.emit('request_completed', {
              taskType,
              provider: fallbackProvider,
              model: rule.model,
              duration,
              success: true,
              usedFallback: true
            });

            return result;

          } catch (fallbackError) {
            this.logger.warn('Fallback provider failed', {
              provider: fallbackProvider,
              error: fallbackError.message
            });
          }
        }

        // All providers failed
        throw error;
      }

    } catch (error) {
      this.logger.error('AI request failed', {
        taskType,
        error: error.message
      });

      this.emit('request_failed', {
        taskType,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Call specific provider
   */
  async _callProvider(providerName, model, prompt, context) {
    const provider = this.providers[providerName];

    if (!provider) {
      throw new Error(`Provider ${providerName} not configured`);
    }

    if (!provider.available) {
      throw new Error(`Provider ${providerName} not available`);
    }

    return await provider.adapter(model, prompt, context);
  }

  /**
   * Anthropic adapter
   */
  async _anthropicAdapter(model, prompt, context) {
    try {
      const systemPrompt = context.systemPrompt || this._buildSystemPrompt(context);

      const response = await this.providers.anthropic.client.messages.create({
        model: model || 'claude-3-haiku-20240307',
        max_tokens: context.maxTokens || 4096,
        temperature: context.temperature || 0.7,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      return {
        content: response.content[0].text,
        model: response.model,
        provider: 'anthropic',
        usage: {
          input_tokens: response.usage.input_tokens,
          output_tokens: response.usage.output_tokens
        }
      };

    } catch (error) {
      this.logger.error('Anthropic API error', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * OpenAI adapter (lazy initialization)
   */
  async _openaiAdapter(model, prompt, context) {
    try {
      // Lazy initialize OpenAI client
      if (!this.providers.openai.client) {
        const { Configuration, OpenAIApi } = await import('openai');
        const configuration = new Configuration({
          apiKey: this.options.openaiApiKey
        });
        this.providers.openai.client = new OpenAIApi(configuration);
      }

      const systemPrompt = context.systemPrompt || this._buildSystemPrompt(context);

      const response = await this.providers.openai.client.createChatCompletion({
        model: model || 'gpt-4-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: context.temperature || 0.7,
        max_tokens: context.maxTokens || 4096
      });

      return {
        content: response.data.choices[0].message.content,
        model: response.data.model,
        provider: 'openai',
        usage: {
          input_tokens: response.data.usage.prompt_tokens,
          output_tokens: response.data.usage.completion_tokens
        }
      };

    } catch (error) {
      this.logger.error('OpenAI API error', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * GitHub Copilot adapter (placeholder for future)
   */
  async _copilotAdapter(model, prompt, context) {
    // This will be implemented when GitHub Copilot Chat API is fully integrated
    throw new Error('GitHub Copilot adapter not yet implemented');
  }

  /**
   * Build system prompt from context
   */
  _buildSystemPrompt(context) {
    const parts = [];

    // Base prompt
    parts.push('You are HeyJarvis, an AI assistant for engineering teams.');

    // Add role-specific context
    if (context.role) {
      parts.push(`You are assisting a ${context.role}.`);
    }

    // Add task-specific context
    if (context.taskContext) {
      parts.push(context.taskContext);
    }

    // Add data context
    if (context.dataContext) {
      parts.push('\nRelevant context:');
      parts.push(JSON.stringify(context.dataContext, null, 2));
    }

    return parts.join('\n\n');
  }

  /**
   * Set routing rule for task type
   */
  setRouting(taskType, config) {
    this.logger.info('Setting routing rule', {
      taskType,
      provider: config.provider,
      model: config.model
    });

    this.routingRules[taskType] = {
      provider: config.provider,
      model: config.model,
      fallback: config.fallback || []
    };
  }

  /**
   * Add custom provider
   */
  addProvider(name, adapter) {
    this.logger.info('Adding custom provider', { name });

    this.providers[name] = {
      client: null,
      adapter: adapter,
      available: true
    };
  }

  /**
   * Get available providers
   */
  getAvailableProviders() {
    return Object.entries(this.providers)
      .filter(([_, provider]) => provider.available)
      .map(([name]) => name);
  }

  /**
   * Health check
   */
  async healthCheck() {
    const health = {
      status: 'healthy',
      providers: {}
    };

    for (const [name, provider] of Object.entries(this.providers)) {
      health.providers[name] = {
        available: provider.available,
        configured: !!provider.client || name === 'anthropic'
      };
    }

    return health;
  }
}

module.exports = ModelRouter;

