/**
 * Work Request Alert System - Simplified
 * 
 * Monitors Slack messages and sends notifications when work requests are detected
 * Uses simple pattern matching instead of AI to avoid conflicts
 */

class WorkRequestAlertSystem {
  constructor(options = {}) {
    this.options = {
      alertThreshold: 0.7,
      adminUserId: process.env.ADMIN_USER_ID || 'U08NCU64UKH',
      ...options
    };
    
    // Store active work requests in memory
    this.activeWorkRequests = new Map();
  }

  /**
   * Analyze message for work request patterns using simple pattern matching
   */
  analyzeForWorkRequest(message, context = {}) {
    try {
      const workRequestPatterns = [
        // Direct requests
        /can you (please )?(?:help|do|make|create|fix|update|build)/i,
        /could you (please )?(?:help|do|make|create|fix|update|build)/i,
        /would you (mind )?(?:helping|doing|making|creating|fixing|updating|building)/i,
        
        // Task assignments
        /please (?:help|do|make|create|fix|update|build|work on)/i,
        /need you to (?:help|do|make|create|fix|update|build|work on)/i,
        /i need (?:help|assistance|support) (?:with|on)/i,
        
        // Urgent requests
        /urgent[ly]?[:\s]/i,
        /asap[:\s]/i,
        /as soon as possible/i,
        /high priority/i,
        /emergency/i,
        
        // Project/task keywords
        /(?:project|task|issue|bug|feature|request|requirement)/i,
        /(?:deadline|due|timeline|schedule)/i,
        
        // Action words
        /(?:implement|develop|design|analyze|review|test|deploy)/i,
      ];

      // Check for work request patterns
      const patternMatches = workRequestPatterns.filter(pattern => 
        pattern.test(message.text)
      );

      if (patternMatches.length === 0) {
        return { isWorkRequest: false, confidence: 0 };
      }

      // Simple analysis based on patterns
      const confidence = Math.min(0.3 + (patternMatches.length * 0.2), 0.9);
      
      return {
        isWorkRequest: confidence >= this.options.alertThreshold,
        confidence: confidence,
        urgency: this.detectUrgency(message.text),
        workType: this.detectWorkType(message.text),
        estimatedEffort: this.detectEffort(message.text),
        keyActions: this.extractActions(message.text),
        suggestedResponse: this.generateSuggestedResponse(message.text),
        patternMatches: patternMatches.length,
        metadata: {
          messageLength: message.text.length,
          hasQuestionMark: message.text.includes('?'),
          hasMentions: /<@[A-Z0-9]+>/.test(message.text),
          timestamp: message.timestamp || new Date(),
          channel: context.channel,
          user: context.user
        }
      };

    } catch (error) {
      console.error('Work request analysis failed:', error);
      return { 
        isWorkRequest: false, 
        confidence: 0, 
        error: error.message 
      };
    }
  }

  /**
   * Process incoming Slack message for work request detection
   */
  async processSlackMessage(messageEvent) {
    try {
      const { user, channel, text, ts } = messageEvent;
      
      // Skip messages from admin (you) - only alert on inbound requests
      if (user === this.options.adminUserId) {
        return { processed: false, reason: 'admin_message' };
      }

      // Skip bot messages
      if (messageEvent.subtype === 'bot_message' || messageEvent.bot_id) {
        return { processed: false, reason: 'bot_message' };
      }

      const message = {
        text,
        timestamp: new Date(parseFloat(ts) * 1000),
        user,
        channel
      };

      const analysis = this.analyzeForWorkRequest(message, { 
        user, 
        channel,
        messageEvent 
      });

      if (analysis.isWorkRequest) {
        const workRequestId = this.createWorkRequest(message, analysis);
        this.sendAlerts(workRequestId, message, analysis);
        
        return {
          processed: true,
          workRequestId,
          analysis,
          alertsSent: true
        };
      }

      return {
        processed: true,
        isWorkRequest: false,
        confidence: analysis.confidence
      };

    } catch (error) {
      console.error('Error processing Slack message for work requests:', error);
      return { processed: false, error: error.message };
    }
  }

  /**
   * Create work request record
   */
  createWorkRequest(message, analysis) {
    const workRequestId = `wr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const workRequest = {
      id: workRequestId,
      user_id: message.user,
      channel_id: message.channel,
      message_text: message.text,
      timestamp: message.timestamp,
      urgency: analysis.urgency,
      work_type: analysis.workType,
      estimated_effort: analysis.estimatedEffort,
      confidence_score: analysis.confidence,
      key_actions: analysis.keyActions,
      suggested_response: analysis.suggestedResponse,
      status: 'pending',
      created_at: new Date(),
      metadata: analysis.metadata
    };

    // Store in memory for quick access
    this.activeWorkRequests.set(workRequestId, workRequest);

    console.log(`📋 Work request created: ${workRequestId}`, {
      user: message.user,
      urgency: analysis.urgency,
      confidence: analysis.confidence
    });

    return workRequestId;
  }

  /**
   * Send alerts for detected work request
   */
  sendAlerts(workRequestId, message, analysis) {
    console.log(`🔔 WORK REQUEST ALERT: ${workRequestId}`, {
      urgency: analysis.urgency.toUpperCase(),
      user: message.user,
      channel: message.channel,
      message: message.text.substring(0, 100) + '...',
      confidence: analysis.confidence,
      suggestedResponse: analysis.suggestedResponse,
      keyActions: analysis.keyActions
    });
  }

  /**
   * Helper methods
   */
  detectUrgency(text) {
    const urgentKeywords = ['urgent', 'asap', 'emergency', 'critical', 'immediate'];
    const highKeywords = ['high priority', 'important', 'soon', 'quickly'];
    
    const textLower = text.toLowerCase();
    
    if (urgentKeywords.some(keyword => textLower.includes(keyword))) {
      return 'urgent';
    } else if (highKeywords.some(keyword => textLower.includes(keyword))) {
      return 'high';
    } else if (textLower.includes('?') || textLower.includes('please')) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  detectWorkType(text) {
    const textLower = text.toLowerCase();
    
    if (/code|develop|program|build|implement|debug|fix/.test(textLower)) {
      return 'coding';
    } else if (/design|ui|ux|mockup|wireframe/.test(textLower)) {
      return 'design';
    } else if (/analyze|research|investigate|review/.test(textLower)) {
      return 'analysis';
    } else if (/help|support|assist|explain/.test(textLower)) {
      return 'support';
    } else {
      return 'other';
    }
  }

  detectEffort(text) {
    const textLower = text.toLowerCase();
    
    if (/quick|small|minor|simple/.test(textLower)) {
      return 'quick';
    } else if (/large|big|major|complex|project/.test(textLower)) {
      return 'large';
    } else {
      return 'medium';
    }
  }

  extractActions(text) {
    const actionWords = text.match(/\b(create|make|build|fix|update|implement|develop|design|analyze|review|test|deploy|help|support)\b/gi);
    return actionWords ? [...new Set(actionWords.map(w => w.toLowerCase()))] : [];
  }

  generateSuggestedResponse(text) {
    const textLower = text.toLowerCase();
    
    if (/urgent|asap|emergency/.test(textLower)) {
      return "I'll prioritize this and get back to you ASAP.";
    } else if (/help|support/.test(textLower)) {
      return "I'd be happy to help with this. Let me look into it.";
    } else if (/fix|bug|issue/.test(textLower)) {
      return "I'll investigate this issue and work on a fix.";
    } else {
      return "I'll take care of this for you.";
    }
  }

  /**
   * Get active work requests
   */
  async getActiveWorkRequests() {
    return Array.from(this.activeWorkRequests.values());
  }

  /**
   * Health check
   */
  async healthCheck() {
    return {
      status: 'healthy',
      activeRequests: this.activeWorkRequests.size
    };
  }
}

module.exports = WorkRequestAlertSystem;
