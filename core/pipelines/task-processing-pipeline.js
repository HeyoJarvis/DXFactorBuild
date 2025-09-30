/**
 * Task Processing Pipeline - Connects message collection → task detection → AI analysis → delivery
 * 
 * Features:
 * 1. Processes incoming Slack messages for task detection
 * 2. Orchestrates AI analysis and recommendation generation
 * 3. Delivers personalized guidance to assignees
 * 4. Tracks task completion and outcomes
 */

const winston = require('winston');
const EventEmitter = require('events');

class TaskProcessingPipeline extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      logLevel: 'info',
      taskServiceUrl: 'http://localhost:3002',
      slackDeliveryEnabled: true,
      desktopDeliveryEnabled: true,
      minConfidenceThreshold: 0.4,
      processingTimeout: 30000, // 30 seconds
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
        new winston.transports.File({ filename: 'logs/task-processing-pipeline.log' })
      ],
      defaultMeta: { service: 'task-processing-pipeline' }
    });
    
    // Processing state
    this.activeProcessing = new Map(); // messageId -> processing state
    this.processedTasks = new Map(); // taskId -> task results
    this.deliveryQueue = [];
    
    // Statistics
    this.stats = {
      messagesProcessed: 0,
      tasksDetected: 0,
      recommendationsGenerated: 0,
      deliveriesCompleted: 0,
      errors: 0
    };
    
    // Initialize delivery systems
    this.deliverySystems = new Map();
    
    this.logger.info('Task Processing Pipeline initialized', {
      task_service_url: this.options.taskServiceUrl,
      slack_delivery: this.options.slackDeliveryEnabled,
      desktop_delivery: this.options.desktopDeliveryEnabled
    });
  }

  /**
   * Main processing method - handles incoming Slack messages
   */
  async processMessage(messageData, messageContext) {
    const messageId = this.generateMessageId(messageData, messageContext);
    
    try {
      this.logger.info('Starting message processing', {
        message_id: messageId,
        channel: messageContext.channel_name,
        user: messageContext.user_id,
        message_length: messageData.text?.length || 0
      });
      
      // Track processing state
      this.activeProcessing.set(messageId, {
        messageId,
        startTime: Date.now(),
        stage: 'started',
        messageData,
        messageContext
      });
      
      this.stats.messagesProcessed++;
      
      // Step 1: Check if message contains task keywords (quick filter)
      const containsTaskKeywords = this.quickTaskFilter(messageData.text);
      if (!containsTaskKeywords) {
        this.logger.debug('Message filtered out - no task keywords', { message_id: messageId });
        this.activeProcessing.delete(messageId);
        return { processed: false, reason: 'no_task_keywords' };
      }
      
      // Step 2: Process through AI task analysis
      const taskAnalysisResult = await this.analyzeTaskWithAI(messageData, messageContext, messageId);
      
      if (!taskAnalysisResult.success || !taskAnalysisResult.is_task) {
        this.logger.debug('Message not identified as task', {
          message_id: messageId,
          confidence: taskAnalysisResult.confidence_score
        });
        this.activeProcessing.delete(messageId);
        return { processed: false, reason: 'not_a_task', analysis: taskAnalysisResult };
      }
      
      this.stats.tasksDetected++;
      
      // Step 3: Generate recommendations if confidence is high enough
      let recommendations = null;
      if (taskAnalysisResult.confidence_score >= this.options.minConfidenceThreshold) {
        recommendations = await this.generateRecommendations(taskAnalysisResult, messageId);
        if (recommendations) {
          this.stats.recommendationsGenerated++;
        }
      }
      
      // Step 4: Prepare delivery data
      const deliveryData = this.prepareDeliveryData(taskAnalysisResult, recommendations, messageContext);
      
      // Step 5: Deliver to appropriate channels
      const deliveryResults = await this.deliverTaskGuidance(deliveryData, messageId);
      
      // Step 6: Store results and cleanup
      const finalResult = {
        message_id: messageId,
        task_id: taskAnalysisResult.task_id,
        processed: true,
        is_task: true,
        confidence_score: taskAnalysisResult.confidence_score,
        has_recommendations: !!recommendations,
        delivery_results: deliveryResults,
        processed_at: new Date(),
        processing_time_ms: Date.now() - this.activeProcessing.get(messageId).startTime
      };
      
      this.processedTasks.set(taskAnalysisResult.task_id, finalResult);
      this.activeProcessing.delete(messageId);
      
      // Emit completion event
      this.emit('task_processed', finalResult);
      
      this.logger.info('Message processing completed successfully', {
        message_id: messageId,
        task_id: taskAnalysisResult.task_id,
        processing_time_ms: finalResult.processing_time_ms,
        deliveries: deliveryResults.length
      });
      
      return finalResult;
      
    } catch (error) {
      this.stats.errors++;
      this.logger.error('Message processing failed', {
        message_id: messageId,
        error: error.message,
        stack: error.stack
      });
      
      this.activeProcessing.delete(messageId);
      this.emit('processing_error', { messageId, error });
      
      throw error;
    }
  }

  /**
   * Quick filter to check if message contains task-related keywords
   */
  quickTaskFilter(messageText) {
    if (!messageText || typeof messageText !== 'string') {
      return false;
    }
    
    const taskKeywords = [
      'task', 'assigned', 'todo', 'deadline', 'completed', 'finished', 'done',
      'can you', 'please', 'need you to', 'could you', 'would you',
      'follow up', 'reach out', 'contact', 'call', 'email', 'meeting',
      'by friday', 'by tomorrow', 'asap', 'urgent', 'priority'
    ];
    
    const lowerText = messageText.toLowerCase();
    return taskKeywords.some(keyword => lowerText.includes(keyword));
  }

  /**
   * Analyze message using AI task processing service
   */
  async analyzeTaskWithAI(messageData, messageContext, messageId) {
    try {
      this.updateProcessingStage(messageId, 'ai_analysis');
      
      const fetch = require('node-fetch');
      
      const response = await fetch(`${this.options.taskServiceUrl}/tasks/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_message: messageData.text,
          message_context: {
            channel_id: messageContext.channel_id,
            channel_name: messageContext.channel_name,
            user_id: messageContext.user_id,
            timestamp: messageContext.timestamp || new Date(),
            thread_ts: messageData.thread_ts,
            message_ts: messageData.ts
          },
          organization_id: messageContext.organization_id || 'default_org'
        }),
        timeout: this.options.processingTimeout
      });
      
      if (!response.ok) {
        throw new Error(`Task analysis API failed: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      
      this.logger.debug('AI task analysis completed', {
        message_id: messageId,
        task_id: result.task_id,
        is_task: result.is_task,
        confidence: result.confidence_score
      });
      
      return result;
      
    } catch (error) {
      this.logger.error('AI task analysis failed', {
        message_id: messageId,
        error: error.message
      });
      
      // Return fallback result
      return {
        success: false,
        is_task: false,
        confidence_score: 0,
        error: error.message
      };
    }
  }

  /**
   * Generate recommendations using the task analysis results
   */
  async generateRecommendations(taskAnalysisResult, messageId) {
    try {
      this.updateProcessingStage(messageId, 'generating_recommendations');
      
      // Recommendations are already included in the task analysis result
      // from the /tasks/process endpoint
      if (taskAnalysisResult.recommendations) {
        this.logger.debug('Recommendations received from task analysis', {
          message_id: messageId,
          task_id: taskAnalysisResult.task_id,
          recommendation_count: taskAnalysisResult.recommendations.tool_recommendations?.length || 0
        });
        
        return taskAnalysisResult.recommendations;
      }
      
      // If no recommendations in the analysis result, generate them separately
      const fetch = require('node-fetch');
      
      const response = await fetch(`${this.options.taskServiceUrl}/tasks/recommendations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enriched_task_context: taskAnalysisResult.enriched_context
        }),
        timeout: this.options.processingTimeout
      });
      
      if (!response.ok) {
        throw new Error(`Recommendations API failed: ${response.status}`);
      }
      
      const result = await response.json();
      return result.recommendations;
      
    } catch (error) {
      this.logger.warn('Recommendation generation failed', {
        message_id: messageId,
        task_id: taskAnalysisResult.task_id,
        error: error.message
      });
      
      return null;
    }
  }

  /**
   * Prepare data for delivery to various channels
   */
  prepareDeliveryData(taskAnalysisResult, recommendations, messageContext) {
    const assignee = taskAnalysisResult.enriched_context?.assignee;
    const taskSummary = taskAnalysisResult.enriched_context?.action_required;
    const urgency = taskAnalysisResult.enriched_context?.urgency || 'medium';
    
    return {
      task_id: taskAnalysisResult.task_id,
      assignee: assignee,
      task_summary: taskSummary,
      urgency: urgency,
      confidence_score: taskAnalysisResult.confidence_score,
      
      // Original message context
      original_message: taskAnalysisResult.enriched_context?.original_message,
      channel_id: messageContext.channel_id,
      channel_name: messageContext.channel_name,
      message_user_id: messageContext.user_id,
      
      // Recommendations
      recommendations: recommendations,
      
      // Delivery preferences
      delivery_channels: this.determineDeliveryChannels(assignee, urgency, messageContext),
      
      prepared_at: new Date()
    };
  }

  /**
   * Determine which delivery channels to use
   */
  determineDeliveryChannels(assignee, urgency, messageContext) {
    const channels = [];
    
    // Always deliver to desktop if enabled
    if (this.options.desktopDeliveryEnabled) {
      channels.push({
        type: 'desktop',
        target: 'dashboard',
        priority: urgency === 'high' ? 'high' : 'normal'
      });
    }
    
    // Slack delivery based on urgency and assignee
    if (this.options.slackDeliveryEnabled) {
      if (assignee && urgency === 'high') {
        // High urgency: DM to assignee
        channels.push({
          type: 'slack_dm',
          target: assignee,
          priority: 'high'
        });
      } else if (assignee) {
        // Normal: DM to assignee
        channels.push({
          type: 'slack_dm',
          target: assignee,
          priority: 'normal'
        });
      }
      
      // Also post in original channel as thread if appropriate
      if (urgency !== 'low') {
        channels.push({
          type: 'slack_thread',
          target: messageContext.channel_id,
          thread_ts: messageContext.message_ts,
          priority: 'low'
        });
      }
    }
    
    return channels;
  }

  /**
   * Deliver task guidance to appropriate channels
   */
  async deliverTaskGuidance(deliveryData, messageId) {
    const deliveryResults = [];
    
    this.updateProcessingStage(messageId, 'delivering');
    
    for (const channel of deliveryData.delivery_channels) {
      try {
        let result;
        
        switch (channel.type) {
          case 'desktop':
            result = await this.deliverToDesktop(deliveryData, channel);
            break;
            
          case 'slack_dm':
            result = await this.deliverToSlackDM(deliveryData, channel);
            break;
            
          case 'slack_thread':
            result = await this.deliverToSlackThread(deliveryData, channel);
            break;
            
          default:
            this.logger.warn('Unknown delivery channel type', { type: channel.type });
            continue;
        }
        
        if (result.success) {
          this.stats.deliveriesCompleted++;
        }
        
        deliveryResults.push({
          channel: channel.type,
          target: channel.target,
          success: result.success,
          message_id: result.message_id,
          delivered_at: new Date()
        });
        
      } catch (error) {
        this.logger.error('Delivery failed', {
          message_id: messageId,
          channel_type: channel.type,
          error: error.message
        });
        
        deliveryResults.push({
          channel: channel.type,
          target: channel.target,
          success: false,
          error: error.message,
          attempted_at: new Date()
        });
      }
    }
    
    return deliveryResults;
  }

  /**
   * Deliver to desktop dashboard
   */
  async deliverToDesktop(deliveryData, channel) {
    // Emit event for desktop listeners
    this.emit('desktop_delivery', {
      task_id: deliveryData.task_id,
      assignee: deliveryData.assignee,
      task_summary: deliveryData.task_summary,
      urgency: deliveryData.urgency,
      recommendations: deliveryData.recommendations,
      priority: channel.priority
    });
    
    return {
      success: true,
      message_id: `desktop_${deliveryData.task_id}`,
      delivery_method: 'event_emission'
    };
  }

  /**
   * Deliver to Slack DM
   */
  async deliverToSlackDM(deliveryData, channel) {
    // Emit event for Slack delivery system
    this.emit('slack_dm_delivery', {
      task_id: deliveryData.task_id,
      assignee: deliveryData.assignee,
      target_user: channel.target,
      task_summary: deliveryData.task_summary,
      urgency: deliveryData.urgency,
      recommendations: deliveryData.recommendations,
      priority: channel.priority
    });
    
    return {
      success: true,
      message_id: `slack_dm_${deliveryData.task_id}`,
      delivery_method: 'event_emission'
    };
  }

  /**
   * Deliver to Slack thread
   */
  async deliverToSlackThread(deliveryData, channel) {
    // Emit event for Slack thread delivery
    this.emit('slack_thread_delivery', {
      task_id: deliveryData.task_id,
      channel_id: channel.target,
      thread_ts: channel.thread_ts,
      task_summary: deliveryData.task_summary,
      recommendations: deliveryData.recommendations,
      priority: channel.priority
    });
    
    return {
      success: true,
      message_id: `slack_thread_${deliveryData.task_id}`,
      delivery_method: 'event_emission'
    };
  }

  /**
   * Register a delivery system
   */
  registerDeliverySystem(type, deliverySystem) {
    this.deliverySystems.set(type, deliverySystem);
    this.logger.info('Delivery system registered', { type });
  }

  /**
   * Update processing stage
   */
  updateProcessingStage(messageId, stage) {
    const processing = this.activeProcessing.get(messageId);
    if (processing) {
      processing.stage = stage;
      processing.lastUpdate = Date.now();
    }
  }

  /**
   * Generate unique message ID
   */
  generateMessageId(messageData, messageContext) {
    const timestamp = messageData.ts || Date.now();
    const channel = messageContext.channel_id || 'unknown';
    const user = messageContext.user_id || 'unknown';
    
    return `msg_${timestamp}_${channel}_${user}`.replace(/[^a-zA-Z0-9_]/g, '_');
  }

  /**
   * Get processing statistics
   */
  getStats() {
    return {
      ...this.stats,
      active_processing: this.activeProcessing.size,
      processed_tasks: this.processedTasks.size,
      uptime_ms: Date.now() - (this.startTime || Date.now())
    };
  }

  /**
   * Get task by ID
   */
  getTask(taskId) {
    return this.processedTasks.get(taskId);
  }

  /**
   * Start the pipeline
   */
  start() {
    this.startTime = Date.now();
    this.logger.info('Task Processing Pipeline started', {
      task_service_url: this.options.taskServiceUrl,
      min_confidence: this.options.minConfidenceThreshold
    });
  }

  /**
   * Stop the pipeline
   */
  stop() {
    this.logger.info('Task Processing Pipeline stopping', {
      active_processing: this.activeProcessing.size,
      stats: this.getStats()
    });
    
    this.activeProcessing.clear();
    this.removeAllListeners();
  }
}

module.exports = TaskProcessingPipeline;
