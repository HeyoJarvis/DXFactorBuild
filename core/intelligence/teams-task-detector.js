/**
 * Teams Task Detector
 * 
 * AI-based detection of action items and work requests from Microsoft Teams messages
 * Mirrors the Slack task detection pattern for consistency
 * 
 * Features:
 * 1. Analyze Teams channel messages and direct chats for action items
 * 2. Use Claude/Anthropic AI for intelligent task extraction
 * 3. Extract task metadata: title, urgency, work type, confidence
 * 4. Filter noise and false positives
 */

const winston = require('winston');
const AIAnalyzer = require('../ai/anthropic-analyzer');

class TeamsTaskDetector {
  constructor(options = {}) {
    this.options = {
      model: options.model || 'claude-3-5-sonnet-20241022',
      temperature: options.temperature || 0.3,
      confidenceThreshold: options.confidenceThreshold || 0.6,
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
          filename: 'logs/teams-task-detector.log',
          maxsize: 5242880, // 5MB
          maxFiles: 5
        })
      ],
      defaultMeta: { service: 'teams-task-detector' }
    });

    // Initialize AI Analyzer
    this.aiAnalyzer = new AIAnalyzer();

    this.logger.info('Teams Task Detector initialized', {
      model: this.options.model,
      confidenceThreshold: this.options.confidenceThreshold
    });
  }

  /**
   * Analyze Teams message for work requests using AI
   * @param {Object} message - Teams message object
   * @param {Object} context - Additional context (team, channel, sender)
   * @returns {Promise<Object>} Analysis result
   */
  async analyzeForWorkRequest(message, context = {}) {
    try {
      // Extract message text
      const messageText = this._extractMessageText(message);
      
      if (!messageText || messageText.trim().length === 0) {
        return this.fallbackAnalysis(message, false, 'Empty message');
      }

      this.logger.debug('Analyzing Teams message', {
        messageId: message.id,
        teamName: context.teamName,
        channelName: context.channelName,
        messageLength: messageText.length
      });

      const prompt = `You are a work request detector for Microsoft Teams. Analyze if this Teams message is a work request/task assignment.

MESSAGE: "${messageText}"

CONTEXT:
- Sender: ${context.senderName || 'unknown'}
- Team: ${context.teamName || 'unknown'}
- Channel: ${context.channelName || 'direct message'}
- Message Type: ${context.messageType || 'message'}

Classify this message and respond in JSON format:
{
  "isWorkRequest": true/false,
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation",
  "urgency": "low|medium|high|urgent",
  "workType": "coding|design|analysis|support|meeting|review|other",
  "taskTitle": "extracted task title (max 100 chars)",
  "estimatedEffort": "quick|medium|large"
}

GUIDELINES:
- isWorkRequest = true if it's asking someone to do something, requesting action, assigning work
- isWorkRequest = true for: "can you...", "please...", "need you to...", "finish...", "complete...", "work on...", "collaborate..."
- isWorkRequest = false for: greetings, questions, status updates, casual chat, automated bot messages
- Even casual phrasing like "John finish the presentation" should be detected as a work request
- confidence should be 0.7+ for clear requests, 0.5-0.7 for implicit requests, <0.5 for unclear
- Filter out automated messages from bots/connectors

Respond ONLY with valid JSON.`;

      const response = await this.aiAnalyzer.anthropic.messages.create({
        model: this.options.model,
        max_tokens: 300,
        temperature: this.options.temperature,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const analysisText = response.content[0].text;
      
      // Parse JSON response
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        this.logger.error('AI response not JSON', { 
          messageId: message.id,
          response: analysisText 
        });
        return this.fallbackAnalysis(message, false, 'Invalid AI response');
      }

      const analysis = JSON.parse(jsonMatch[0]);
      
      // Validate and normalize
      const result = {
        isWorkRequest: analysis.isWorkRequest === true,
        confidence: Math.min(Math.max(analysis.confidence || 0, 0), 1),
        reasoning: analysis.reasoning || 'No reasoning provided',
        urgency: ['low', 'medium', 'high', 'urgent'].includes(analysis.urgency) 
          ? analysis.urgency 
          : 'medium',
        workType: analysis.workType || 'other',
        taskTitle: analysis.taskTitle || this._extractTaskTitle(messageText),
        estimatedEffort: analysis.estimatedEffort || 'medium',
        source: 'teams',
        sourceId: message.id,
        analyzedAt: new Date().toISOString()
      };

      this.logger.info('Teams message analyzed', {
        messageId: message.id,
        isWorkRequest: result.isWorkRequest,
        confidence: result.confidence,
        urgency: result.urgency,
        workType: result.workType
      });

      return result;

    } catch (error) {
      this.logger.error('AI analysis failed', {
        messageId: message?.id,
        error: error.message,
        stack: error.stack
      });
      
      return this.fallbackAnalysis(message, false, error.message);
    }
  }

  /**
   * Fallback analysis using simple pattern matching
   * @param {Object} message - Teams message
   * @param {boolean} isTask - Whether it's detected as task
   * @param {string} reason - Reason for fallback
   * @returns {Object} Basic analysis result
   */
  fallbackAnalysis(message, isTask = false, reason = 'Fallback') {
    const messageText = this._extractMessageText(message);
    
    // Simple keyword detection
    const taskKeywords = ['task', 'todo', 'can you', 'could you', 'please', 'need to', 'should', 'must', 'action item'];
    const hasTaskKeyword = taskKeywords.some(keyword => 
      messageText.toLowerCase().includes(keyword)
    );

    return {
      isWorkRequest: hasTaskKeyword && isTask,
      confidence: hasTaskKeyword ? 0.4 : 0.1,
      reasoning: `Fallback analysis: ${reason}`,
      urgency: 'medium',
      workType: 'other',
      taskTitle: this._extractTaskTitle(messageText),
      estimatedEffort: 'medium',
      source: 'teams',
      sourceId: message?.id,
      analyzedAt: new Date().toISOString(),
      fallback: true
    };
  }

  /**
   * Extract plain text from Teams message (handles HTML content)
   * @param {Object} message - Teams message object
   * @returns {string} Plain text content
   */
  _extractMessageText(message) {
    if (!message) return '';
    
    // Teams messages can have body.content (HTML) or body.plainText
    if (message.body?.content) {
      // Strip HTML tags for plain text
      return message.body.content
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ')
        .trim();
    }
    
    return message.body?.plainText || message.body || '';
  }

  /**
   * Extract task title from message text
   * @param {string} text - Message text
   * @returns {string} Extracted task title
   */
  _extractTaskTitle(text) {
    if (!text) return 'Untitled Task';
    
    // Remove Teams mentions (@name format)
    let cleanText = text.replace(/@\w+/g, '').trim();
    
    // Take first sentence or first 100 chars
    const firstSentence = cleanText.split(/[.!?]/)[0];
    const title = firstSentence.substring(0, 100).trim();
    
    return title || 'Untitled Task';
  }

  /**
   * Check if message should be filtered out (bot messages, system notifications)
   * @param {Object} message - Teams message
   * @returns {boolean} True if should be filtered
   */
  shouldFilterMessage(message) {
    if (!message) return true;
    
    // Filter out bot messages
    if (message.from?.user?.userIdentityType === 'bot') {
      return true;
    }
    
    // Filter out system messages
    if (message.messageType === 'systemEventMessage') {
      return true;
    }
    
    // Filter out empty messages
    const messageText = this._extractMessageText(message);
    if (!messageText || messageText.trim().length < 10) {
      return true;
    }
    
    return false;
  }

  /**
   * Batch analyze multiple Teams messages
   * @param {Array} messages - Array of Teams messages
   * @param {Object} context - Shared context
   * @returns {Promise<Array>} Array of analysis results
   */
  async analyzeBatch(messages, context = {}) {
    this.logger.info('Batch analyzing Teams messages', {
      messageCount: messages.length
    });

    const results = [];
    
    for (const message of messages) {
      // Skip filtered messages
      if (this.shouldFilterMessage(message)) {
        continue;
      }
      
      try {
        const analysis = await this.analyzeForWorkRequest(message, context);
        
        // Only include work requests above threshold
        if (analysis.isWorkRequest && analysis.confidence >= this.options.confidenceThreshold) {
          results.push({
            message,
            analysis
          });
        }
      } catch (error) {
        this.logger.error('Batch analysis error for message', {
          messageId: message.id,
          error: error.message
        });
      }
    }

    this.logger.info('Batch analysis complete', {
      totalMessages: messages.length,
      workRequestsFound: results.length
    });

    return results;
  }
}

module.exports = TeamsTaskDetector;

