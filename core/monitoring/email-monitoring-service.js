/**
 * Email Monitoring Service
 * 
 * Continuously monitors Outlook inbox for new emails
 * Detects actionable emails and auto-creates tasks (like Slack integration)
 * 
 * Features:
 * - Polls inbox periodically for unread emails
 * - Uses EmailTaskDetector AI to identify action items
 * - Filters spam, newsletters, automated emails
 * - Auto-creates tasks in database
 * - Tracks processed emails to avoid duplicates
 * - Emits events for UI updates
 */

const EventEmitter = require('events');
const winston = require('winston');

class EmailMonitoringService extends EventEmitter {
  constructor(graphService, emailTaskDetector, dbAdapter, options = {}) {
    super();
    
    this.graphService = graphService;
    this.emailTaskDetector = emailTaskDetector;
    this.dbAdapter = dbAdapter;
    
    this.options = {
      pollInterval: options.pollInterval || 5 * 60 * 1000, // 5 minutes (less frequent than Teams)
      maxEmailsPerPoll: options.maxEmailsPerPoll || 20,
      autoCreateTasks: options.autoCreateTasks !== false,
      autoMarkAsRead: options.autoMarkAsRead || false, // Don't mark as read by default
      confidenceThreshold: options.confidenceThreshold || 0.65,
      ...options
    };
    
    // State tracking
    this.isMonitoring = false;
    this.pollTimer = null;
    this.processedEmails = new Set(); // Track email IDs to avoid duplicates
    this.lastPollTime = new Date();
    this.stats = {
      emailsProcessed: 0,
      tasksCreated: 0,
      errors: 0,
      lastPoll: null
    };
    
    // Initialize logger
    this.logger = winston.createLogger({
      level: options.logLevel || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ 
          filename: 'desktop/logs/email-monitoring.log',
          maxsize: 5242880,
          maxFiles: 5
        })
      ],
      defaultMeta: { service: 'email-monitoring' }
    });
    
    this.logger.info('Email Monitoring Service initialized', this.options);
  }
  
  /**
   * Start monitoring emails
   */
  async startMonitoring(userId) {
    if (this.isMonitoring) {
      this.logger.warn('Monitoring already active');
      return;
    }
    
    this.userId = userId;
    this.isMonitoring = true;
    this.logger.info('Starting email monitoring', { userId });
    
    // Do initial poll immediately
    await this.pollInbox();
    
    // Set up recurring polling
    this.pollTimer = setInterval(() => {
      this.pollInbox().catch(error => {
        this.logger.error('Poll error', { error: error.message });
        this.stats.errors++;
      });
    }, this.options.pollInterval);
    
    this.emit('monitoring:started', { userId });
  }
  
  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (!this.isMonitoring) {
      return;
    }
    
    this.isMonitoring = false;
    
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    
    this.logger.info('Email monitoring stopped', this.stats);
    this.emit('monitoring:stopped', this.stats);
  }
  
  /**
   * Poll inbox for new emails
   */
  async pollInbox() {
    const pollStartTime = Date.now();
    this.logger.debug('Starting inbox poll');
    
    try {
      // Fetch unread emails from inbox
      const emails = await this.graphService.getUnreadEmails(
        'inbox',
        this.options.maxEmailsPerPoll
      );
      
      // Filter out already processed emails
      const newEmails = emails.filter(email => !this.isEmailProcessed(email.id));
      
      this.logger.info('Poll completed', {
        totalUnread: emails.length,
        newEmails: newEmails.length,
        duration: Date.now() - pollStartTime
      });
      
      // Process new emails for task detection
      if (newEmails.length > 0) {
        await this.processEmails(newEmails);
      }
      
      this.stats.lastPoll = new Date();
      this.lastPollTime = new Date();
      this.emit('poll:completed', { emailCount: newEmails.length });
      
    } catch (error) {
      this.logger.error('Poll failed', { error: error.message, stack: error.stack });
      this.stats.errors++;
      this.emit('poll:error', { error: error.message });
    }
  }
  
  /**
   * Process emails for task detection
   */
  async processEmails(emails) {
    for (const email of emails) {
      try {
        await this.processEmail(email);
        this.stats.emailsProcessed++;
      } catch (error) {
        this.logger.error('Failed to process email', {
          emailId: email.id,
          subject: email.subject,
          error: error.message
        });
      }
    }
  }
  
  /**
   * Process individual email
   */
  async processEmail(email) {
    // Mark as processed
    this.markEmailAsProcessed(email.id);
    
    this.logger.debug('Processing email', {
      emailId: email.id,
      from: email.from?.emailAddress?.address,
      subject: email.subject,
      receivedDateTime: email.receivedDateTime
    });
    
    // Run AI task detection (includes spam/newsletter filtering)
    const analysis = await this.emailTaskDetector.analyzeForActionItems(email);
    
    // Check if it's actionable
    if (!analysis.isActionableEmail || analysis.confidence < this.options.confidenceThreshold) {
      this.logger.debug('Not actionable', {
        emailId: email.id,
        confidence: analysis.confidence,
        reason: analysis.reason
      });
      return;
    }
    
    this.logger.info('Actionable email detected!', {
      emailId: email.id,
      confidence: analysis.confidence,
      title: analysis.taskTitle,
      urgency: analysis.urgency
    });
    
    // Auto-create task if enabled
    if (this.options.autoCreateTasks && this.userId) {
      await this.createTaskFromEmail(email, analysis);
    } else {
      // Just emit event for manual approval
      this.emit('task:detected', { email, analysis });
    }
    
    // Mark email as read if configured
    if (this.options.autoMarkAsRead) {
      try {
        await this.graphService.markEmailAsRead(email.id);
        this.logger.debug('Email marked as read', { emailId: email.id });
      } catch (error) {
        this.logger.warn('Failed to mark email as read', {
          emailId: email.id,
          error: error.message
        });
      }
    }
  }
  
  /**
   * Create task from actionable email
   */
  async createTaskFromEmail(email, analysis) {
    try {
      // Extract email body text (strip HTML)
      const emailBody = this.extractEmailBodyText(email);
      
      // Build task data
      const taskData = {
        title: analysis.taskTitle || email.subject || 'Task from Email',
        priority: this.urgencyToPriority(analysis.urgency),
        description: `${analysis.actionRequired || ''}\n\n---\n\nFrom: ${email.from?.emailAddress?.name} <${email.from?.emailAddress?.address}>\nSubject: ${email.subject}\n\n${emailBody.substring(0, 500)}${emailBody.length > 500 ? '...' : ''}`,
        tags: ['email-auto', analysis.urgency],
        source: 'email',
        source_id: email.id,
        source_context: {
          emailId: email.id,
          conversationId: email.conversationId,
          subject: email.subject,
          from: email.from?.emailAddress?.address,
          fromName: email.from?.emailAddress?.name,
          receivedDateTime: email.receivedDateTime,
          hasAttachments: email.hasAttachments,
          importance: email.importance,
          webLink: email.webLink,
          actionRequired: analysis.actionRequired,
          deadline: analysis.deadline,
          estimatedEffort: analysis.estimatedEffort
        }
      };
      
      // Create task in database
      const result = await this.dbAdapter.createTask(this.userId, taskData);
      
      if (result.success) {
        this.stats.tasksCreated++;
        
        this.logger.info('Task auto-created from email', {
          taskId: result.task.id,
          title: taskData.title,
          from: email.from?.emailAddress?.address
        });
        
        // Emit event for UI notification
        this.emit('task:created', {
          task: result.task,
          email,
          analysis
        });
      } else {
        this.logger.error('Failed to create task', {
          error: result.error,
          emailId: email.id
        });
      }
      
    } catch (error) {
      this.logger.error('Task creation error', {
        emailId: email.id,
        error: error.message,
        stack: error.stack
      });
    }
  }
  
  /**
   * Extract email body text (strip HTML)
   */
  extractEmailBodyText(email) {
    if (!email.body?.content) {
      return '';
    }
    
    let text = email.body.content;
    
    // Strip HTML tags if body is HTML
    if (email.body.contentType === 'html') {
      text = text.replace(/<[^>]*>/g, ' ');
      text = text.replace(/&nbsp;/g, ' ');
      text = text.replace(/&amp;/g, '&');
      text = text.replace(/&lt;/g, '<');
      text = text.replace(/&gt;/g, '>');
      text = text.replace(/&quot;/g, '"');
    }
    
    // Clean up whitespace
    text = text.replace(/\s+/g, ' ').trim();
    
    return text;
  }
  
  /**
   * Convert urgency to priority
   */
  urgencyToPriority(urgency) {
    const mapping = {
      'critical': 'urgent',
      'high': 'high',
      'medium': 'medium',
      'low': 'low'
    };
    return mapping[urgency?.toLowerCase()] || 'medium';
  }
  
  /**
   * Check if email has been processed
   */
  isEmailProcessed(emailId) {
    return this.processedEmails.has(emailId);
  }
  
  /**
   * Mark email as processed
   */
  markEmailAsProcessed(emailId) {
    this.processedEmails.add(emailId);
    
    // Limit set size to prevent memory issues
    if (this.processedEmails.size > 10000) {
      const toDelete = Array.from(this.processedEmails).slice(0, 5000);
      toDelete.forEach(id => this.processedEmails.delete(id));
    }
  }
  
  /**
   * Get monitoring stats
   */
  getStats() {
    return {
      ...this.stats,
      isMonitoring: this.isMonitoring,
      userId: this.userId,
      processedEmailCount: this.processedEmails.size
    };
  }
  
  /**
   * Reset stats
   */
  resetStats() {
    this.stats = {
      emailsProcessed: 0,
      tasksCreated: 0,
      errors: 0,
      lastPoll: null
    };
  }
}

module.exports = EmailMonitoringService;

