/**
 * Email Task Detector
 * 
 * AI-based detection of action items and work requests from Outlook emails
 * Filters newsletters, automated emails, and OOO replies
 * 
 * Features:
 * 1. Analyze email subject and body for actionable items
 * 2. Use Claude/Anthropic AI for intelligent task extraction
 * 3. Filter noise (newsletters, automation, spam)
 * 4. Extract task metadata with deadlines and urgency
 */

const winston = require('winston');
const AIAnalyzer = require('../ai/anthropic-analyzer');

class EmailTaskDetector {
  constructor(options = {}) {
    this.options = {
      model: options.model || 'claude-3-5-sonnet-20241022',
      temperature: options.temperature || 0.3,
      confidenceThreshold: options.confidenceThreshold || 0.65,
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
          filename: 'logs/email-task-detector.log',
          maxsize: 5242880, // 5MB
          maxFiles: 5
        })
      ],
      defaultMeta: { service: 'email-task-detector' }
    });

    // Initialize AI Analyzer
    this.aiAnalyzer = new AIAnalyzer();

    this.logger.info('Email Task Detector initialized', {
      model: this.options.model,
      confidenceThreshold: this.options.confidenceThreshold
    });
  }

  /**
   * Analyze email for actionable items using AI
   * @param {Object} email - Outlook email object
   * @returns {Promise<Object>} Analysis result
   */
  async analyzeForActionItems(email) {
    try {
      // Pre-filter spam, newsletters, automated emails
      if (this.shouldFilterEmail(email)) {
        this.logger.debug('Email filtered out', {
          emailId: email.id,
          subject: email.subject,
          reason: 'Filtered as noise/automated'
        });
        
        return this.fallbackAnalysis(email, false, 'Filtered email');
      }

      const emailBody = this._extractEmailBody(email);
      const subject = email.subject || 'No subject';
      const sender = email.from?.emailAddress?.address || 'unknown';
      const senderName = email.from?.emailAddress?.name || sender;

      this.logger.debug('Analyzing email', {
        emailId: email.id,
        subject,
        sender,
        bodyLength: emailBody.length
      });

      const prompt = `You are an action item detector for email management. Analyze if this email contains actionable tasks or work requests.

EMAIL DETAILS:
FROM: ${senderName} <${sender}>
SUBJECT: ${subject}
BODY: ${emailBody.substring(0, 2000)} ${emailBody.length > 2000 ? '...(truncated)' : ''}

Classify this email and respond in JSON format:
{
  "isActionableEmail": true/false,
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation",
  "urgency": "low|medium|high|urgent",
  "workType": "coding|design|analysis|support|meeting|review|approval|other",
  "taskTitle": "extracted task title (max 100 chars)",
  "actionRequired": "specific action needed",
  "deadline": "extracted deadline if mentioned, or null",
  "estimatedEffort": "quick|medium|large"
}

GUIDELINES:
- isActionableEmail = true if it's requesting action, assigning work, asking for response/approval/review
- Look for action verbs: "please review", "need you to", "can you", "action required", "complete by", "respond to"
- isActionableEmail = false for: newsletters, automated notifications, out-of-office replies, marketing emails, receipts
- Extract specific deadline if mentioned ("by Friday", "EOD", "end of week", specific dates)
- confidence should be 0.8+ for clear requests with explicit actions, 0.65-0.8 for implicit requests
- If email is just FYI or informational without action needed, isActionableEmail = false

Respond ONLY with valid JSON.`;

      const response = await this.aiAnalyzer.anthropic.messages.create({
        model: this.options.model,
        max_tokens: 350,
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
          emailId: email.id,
          response: analysisText 
        });
        return this.fallbackAnalysis(email, false, 'Invalid AI response');
      }

      const analysis = JSON.parse(jsonMatch[0]);
      
      // Validate and normalize
      const result = {
        isActionableEmail: analysis.isActionableEmail === true,
        confidence: Math.min(Math.max(analysis.confidence || 0, 0), 1),
        reasoning: analysis.reasoning || 'No reasoning provided',
        urgency: ['low', 'medium', 'high', 'urgent'].includes(analysis.urgency) 
          ? analysis.urgency 
          : 'medium',
        workType: analysis.workType || 'other',
        taskTitle: analysis.taskTitle || subject,
        actionRequired: analysis.actionRequired || 'Review and respond',
        deadline: analysis.deadline || null,
        estimatedEffort: analysis.estimatedEffort || 'medium',
        source: 'email',
        sourceId: email.id,
        emailMetadata: {
          subject,
          sender,
          senderName,
          receivedDateTime: email.receivedDateTime,
          importance: email.importance,
          hasAttachments: email.hasAttachments
        },
        analyzedAt: new Date().toISOString()
      };

      this.logger.info('Email analyzed', {
        emailId: email.id,
        isActionableEmail: result.isActionableEmail,
        confidence: result.confidence,
        urgency: result.urgency,
        workType: result.workType,
        hasDeadline: !!result.deadline
      });

      return result;

    } catch (error) {
      this.logger.error('AI analysis failed', {
        emailId: email?.id,
        error: error.message,
        stack: error.stack
      });
      
      return this.fallbackAnalysis(email, false, error.message);
    }
  }

  /**
   * Fallback analysis using simple heuristics
   * @param {Object} email - Email object
   * @param {boolean} isActionable - Whether it's detected as actionable
   * @param {string} reason - Reason for fallback
   * @returns {Object} Basic analysis result
   */
  fallbackAnalysis(email, isActionable = false, reason = 'Fallback') {
    const subject = email?.subject || 'No subject';
    const body = this._extractEmailBody(email);
    
    // Simple keyword detection
    const actionKeywords = ['action required', 'please', 'urgent', 'asap', 'need', 'can you', 'could you', 'review', 'approve', 'respond'];
    const hasActionKeyword = actionKeywords.some(keyword => 
      subject.toLowerCase().includes(keyword) || body.toLowerCase().includes(keyword)
    );

    return {
      isActionableEmail: hasActionKeyword && isActionable,
      confidence: hasActionKeyword ? 0.4 : 0.1,
      reasoning: `Fallback analysis: ${reason}`,
      urgency: subject.toLowerCase().includes('urgent') ? 'urgent' : 'medium',
      workType: 'other',
      taskTitle: subject,
      actionRequired: 'Review email',
      deadline: null,
      estimatedEffort: 'medium',
      source: 'email',
      sourceId: email?.id,
      emailMetadata: {
        subject,
        sender: email?.from?.emailAddress?.address,
        senderName: email?.from?.emailAddress?.name,
        receivedDateTime: email?.receivedDateTime,
        importance: email?.importance
      },
      analyzedAt: new Date().toISOString(),
      fallback: true
    };
  }

  /**
   * Extract plain text from email body (handles HTML)
   * @param {Object} email - Email object
   * @returns {string} Plain text content
   */
  _extractEmailBody(email) {
    if (!email?.body) return '';
    
    let bodyText = '';
    
    if (email.body.contentType === 'html' && email.body.content) {
      // Strip HTML tags for plain text
      bodyText = email.body.content
        .replace(/<style[^>]*>.*?<\/style>/gi, '')
        .replace(/<script[^>]*>.*?<\/script>/gi, '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ')
        .trim();
    } else if (email.body.content) {
      bodyText = email.body.content;
    } else if (email.bodyPreview) {
      bodyText = email.bodyPreview;
    }
    
    return bodyText;
  }

  /**
   * Check if email should be filtered out (spam, newsletters, automation)
   * @param {Object} email - Email object
   * @returns {boolean} True if should be filtered
   */
  shouldFilterEmail(email) {
    if (!email) return true;
    
    const subject = (email.subject || '').toLowerCase();
    const sender = (email.from?.emailAddress?.address || '').toLowerCase();
    const senderName = (email.from?.emailAddress?.name || '').toLowerCase();
    
    // Filter out auto-reply/OOO
    const oooKeywords = ['out of office', 'automatic reply', 'away from office', 'vacation', 'auto-reply'];
    if (oooKeywords.some(keyword => subject.includes(keyword))) {
      return true;
    }
    
    // Filter out newsletters and marketing
    const newsletterKeywords = ['unsubscribe', 'newsletter', 'digest', 'weekly update', 'monthly update', 'promotional'];
    if (newsletterKeywords.some(keyword => subject.includes(keyword) || senderName.includes(keyword))) {
      return true;
    }
    
    // Filter out common automated senders
    const automatedSenders = ['noreply', 'no-reply', 'donotreply', 'automated', 'notifications', 'alerts'];
    if (automatedSenders.some(keyword => sender.includes(keyword))) {
      return true;
    }
    
    // Filter out very short emails (likely automated)
    const body = this._extractEmailBody(email);
    if (body.length < 50) {
      return true;
    }
    
    return false;
  }

  /**
   * Batch analyze multiple emails
   * @param {Array} emails - Array of email objects
   * @returns {Promise<Array>} Array of analysis results
   */
  async analyzeBatch(emails) {
    this.logger.info('Batch analyzing emails', {
      emailCount: emails.length
    });

    const results = [];
    
    for (const email of emails) {
      try {
        const analysis = await this.analyzeForActionItems(email);
        
        // Only include actionable emails above threshold
        if (analysis.isActionableEmail && analysis.confidence >= this.options.confidenceThreshold) {
          results.push({
            email,
            analysis
          });
        }
      } catch (error) {
        this.logger.error('Batch analysis error for email', {
          emailId: email.id,
          subject: email.subject,
          error: error.message
        });
      }
    }

    this.logger.info('Batch analysis complete', {
      totalEmails: emails.length,
      actionableEmailsFound: results.length
    });

    return results;
  }
}

module.exports = EmailTaskDetector;

