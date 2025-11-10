/**
 * Base Report Generator
 * Template pattern for all report generators
 */

const EventEmitter = require('events');
const winston = require('winston');
const Anthropic = require('@anthropic-ai/sdk');

class BaseReportGenerator extends EventEmitter {
  constructor(jiraService, confluenceService, options = {}) {
    super();
    
    this.jiraService = jiraService;
    this.confluenceService = confluenceService;
    
    this.options = {
      logLevel: options.logLevel || 'info',
      aiEnabled: options.aiEnabled !== false,
      cacheTTL: options.cacheTTL || 3600000, // 1 hour
      ...options
    };

    // Initialize Anthropic client for AI summarization
    if (this.options.aiEnabled && process.env.ANTHROPIC_API_KEY) {
      this.anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY
      });
    }
    
    this.logger = winston.createLogger({
      level: this.options.logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({
          filename: `logs/${this.constructor.name}.log`,
          maxsize: 5242880,
          maxFiles: 5
        })
      ],
      defaultMeta: { service: this.constructor.name }
    });
  }

  /**
   * Main entry point - generates report
   */
  async generateReport(entityId, options = {}) {
    try {
      this.logger.info(`Generating ${this._getReportType()} report`, { entityId });

      // 1. Fetch data
      const data = await this._fetchData(entityId, options);

      // 2. Calculate metrics
      const metrics = await this._calculateMetrics(data, options);

      // 3. Generate summary (now async to support AI summarization)
      const summary = await this._generateBasicSummary(metrics, data);

      // 4. Build report
      const report = {
        reportType: this._getReportType(),
        entityId,
        entityName: this._getEntityName(data),
        generatedAt: new Date().toISOString(),
        period: this._getPeriod(options),
        metrics,
        summary,
        data // Raw data for debugging
      };

      // 5. Emit event for monitoring
      this.emit('report_generated', {
        reportType: this._getReportType(),
        entityId,
        success: true
      });

      return report;

    } catch (error) {
      this.logger.error(`Failed to generate ${this._getReportType()} report`, {
        entityId,
        error: error.message,
        stack: error.stack
      });
      
      this.emit('report_error', {
        reportType: this._getReportType(),
        entityId,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Override in subclass
   */
  async _fetchData(entityId, options) {
    throw new Error('_fetchData must be implemented');
  }

  /**
   * Override in subclass
   */
  async _calculateMetrics(data, options) {
    throw new Error('_calculateMetrics must be implemented');
  }

  /**
   * Generate basic text summary (can be async for AI summarization)
   */
  async _generateBasicSummary(metrics, data) {
    return 'Report generated successfully';
  }

  /**
   * Override in subclass
   */
  _getReportType() {
    throw new Error('_getReportType must be implemented');
  }

  /**
   * Use AI to summarize text content
   */
  async _aiSummarize(text, context = '') {
    if (!this.anthropic || !text) {
      return text;
    }

    try {
      const prompt = context 
        ? `${context}\n\n${text}\n\nYour response MUST be at least 150 words. Write multiple detailed sentences. Do NOT be brief or concise - be thorough and comprehensive.`
        : `Extract and explain ALL information from this content in great detail. Write at least 150 words covering every important point.\n\n${text}\n\nYour response MUST be at least 150 words. Write multiple detailed sentences. Do NOT be brief or concise - be thorough and comprehensive.`;

      const message = await this.anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 2000,
        temperature: 0.7,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      let summary = message.content[0]?.text || text;
      
      // Strip any markdown formatting that AI might have added despite instructions
      summary = this._stripMarkdown(summary);
      
      this.logger.info('AI summarization completed', { 
        originalLength: text.length, 
        summaryLength: summary.length 
      });
      
      return summary;

    } catch (error) {
      this.logger.warn('AI summarization failed, using original text', { 
        error: error.message 
      });
      return text;
    }
  }

  /**
   * Strip markdown formatting from text
   */
  _stripMarkdown(text) {
    if (!text || typeof text !== 'string') {
      return text;
    }
    
    let cleaned = text;
    
    // Remove bold (**text** or __text__)
    cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1');
    cleaned = cleaned.replace(/__([^_]+)__/g, '$1');
    
    // Remove italic (*text* or _text_) - but be careful with underscores in words
    cleaned = cleaned.replace(/\*([^*]+)\*/g, '$1');
    cleaned = cleaned.replace(/\b_([^_]+)_\b/g, '$1');
    
    // Remove strikethrough (~~text~~)
    cleaned = cleaned.replace(/~~([^~]+)~~/g, '$1');
    
    // Remove headers (# text)
    cleaned = cleaned.replace(/^#{1,6}\s+/gm, '');
    
    // Remove inline code (`text`)
    cleaned = cleaned.replace(/`([^`]+)`/g, '$1');
    
    return cleaned;
  }

  /**
   * Utility methods - override as needed
   */
  _getEntityName(data) { return 'Unknown'; }
  
  _getPeriod(options) {
    const now = new Date();
    const defaultStart = new Date(now.getTime() - 90*24*3600*1000); // 90 days ago
    
    return {
      start: options.startDate || defaultStart.toISOString().split('T')[0],
      end: options.endDate || now.toISOString().split('T')[0]
    };
  }
}

module.exports = BaseReportGenerator;

