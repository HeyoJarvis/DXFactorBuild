/**
 * Base CRM Adapter - Foundation class for all CRM integrations
 * 
 * Features:
 * 1. Common CRM data extraction patterns
 * 2. Error handling and retry logic
 * 3. Rate limiting and API management
 * 4. Data normalization and validation
 * 5. Workflow pattern detection
 */

const EventEmitter = require('events');
const winston = require('winston');
const { v4: uuidv4 } = require('uuid');
const { WorkflowHelpers } = require('../models/workflow.schema');

class BaseCRMAdapter extends EventEmitter {
  constructor(crmConfig, options = {}) {
    super();
    
    this.crmConfig = crmConfig;
    this.options = {
      timeout: 30000,
      maxRetries: 3,
      retryDelay: 5000,
      batchSize: 100,
      rateLimitDelay: 1000,
      logLevel: 'info',
      ...options
    };
    
    this.logger = winston.createLogger({
      level: this.options.logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      defaultMeta: { 
        service: 'crm-adapter',
        crm_type: this.getCRMType(),
        organization_id: crmConfig.organization_id
      }
    });
    
    // Connection state
    this.isConnected = false;
    this.lastSyncTime = null;
    this.consecutiveErrors = 0;
    
    // Data extraction state
    this.extractionProgress = {
      deals_processed: 0,
      workflows_detected: 0,
      errors_encountered: 0,
      start_time: null
    };
  }
  
  /**
   * Get CRM type - to be implemented by subclasses
   */
  getCRMType() {
    throw new Error('getCRMType() must be implemented by subclass');
  }
  
  /**
   * Connect to CRM - to be implemented by subclasses
   */
  async connect() {
    throw new Error('connect() must be implemented by subclass');
  }
  
  /**
   * Extract workflow data from CRM
   */
  async extractWorkflows(options = {}) {
    try {
      this.logger.info('Starting workflow extraction', {
        options,
        crm_type: this.getCRMType()
      });
      
      this.extractionProgress.start_time = Date.now();
      
      // Ensure connection
      if (!this.isConnected) {
        await this.connect();
      }
      
      // Get deals within date range
      const deals = await this.getDeals(options);
      this.logger.info(`Retrieved ${deals.length} deals for analysis`);
      
      // Process deals in batches
      const workflows = [];
      const batchSize = this.options.batchSize;
      
      for (let i = 0; i < deals.length; i += batchSize) {
        const batch = deals.slice(i, i + batchSize);
        const batchWorkflows = await this.processDealBatch(batch);
        workflows.push(...batchWorkflows);
        
        // Rate limiting
        if (i + batchSize < deals.length) {
          await this.delay(this.options.rateLimitDelay);
        }
      }
      
      this.logger.info('Workflow extraction completed', {
        total_deals: deals.length,
        workflows_detected: workflows.length,
        processing_time_ms: Date.now() - this.extractionProgress.start_time
      });
      
      this.emit('extraction_completed', {
        workflows,
        stats: this.extractionProgress
      });
      
      return workflows;
      
    } catch (error) {
      this.logger.error('Workflow extraction failed', {
        error: error.message,
        stack: error.stack
      });
      
      this.emit('extraction_error', error);
      throw error;
    }
  }
  
  /**
   * Process a batch of deals to extract workflows
   */
  async processDealBatch(deals) {
    const workflows = [];
    
    for (const deal of deals) {
      try {
        const workflow = await this.extractWorkflowFromDeal(deal);
        if (workflow) {
          workflows.push(workflow);
          this.extractionProgress.workflows_detected++;
        }
        
        this.extractionProgress.deals_processed++;
        
      } catch (error) {
        this.logger.warn('Failed to process deal', {
          deal_id: deal.id,
          error: error.message
        });
        
        this.extractionProgress.errors_encountered++;
      }
    }
    
    return workflows;
  }
  
  /**
   * Extract workflow from a single deal
   */
  async extractWorkflowFromDeal(deal) {
    try {
      // Get all related data for the deal
      const [activities, contacts, companies, notes, tasks] = await Promise.all([
        this.getDealActivities(deal.id),
        this.getDealContacts(deal.id),
        this.getDealCompanies(deal.id),
        this.getDealNotes(deal.id),
        this.getDealTasks(deal.id)
      ]);
      
      // Normalize and structure the data
      const workflowData = {
        id: uuidv4(),
        crm_source: this.getCRMType(),
        external_deal_id: deal.id.toString(),
        workflow_type: this.classifyWorkflowType(deal, activities),
        organization_id: this.crmConfig.organization_id,
        
        // Deal information
        deal_value: deal.amount || 0,
        status: this.normalizeStatus(deal.stage, deal.closed_date),
        
        // Extracted workflow components
        stages: this.extractStages(deal, activities),
        activities: this.normalizeActivities(activities, notes, tasks),
        participants: this.extractParticipants(contacts, companies, activities),
        timeline: this.buildTimeline(deal, activities),
        
        // Calculated metrics
        duration_days: this.calculateDuration(deal),
        data_completeness: this.assessDataCompleteness({
          deal, activities, contacts, companies, notes, tasks
        }),
        
        // Metadata
        last_analyzed_at: new Date(),
        created_at: new Date(deal.created_date || Date.now()),
        updated_at: new Date()
      };
      
      // Generate pattern signature
      workflowData.pattern_signature = WorkflowHelpers.createPatternSignature(workflowData);
      
      // Validate the workflow data
      return WorkflowHelpers.validate(workflowData);
      
    } catch (error) {
      this.logger.error('Failed to extract workflow from deal', {
        deal_id: deal.id,
        error: error.message
      });
      return null;
    }
  }
  
  /**
   * Classify the type of workflow based on deal and activity patterns
   */
  classifyWorkflowType(deal, activities) {
    // Simple classification logic - can be enhanced with AI
    const dealValue = deal.amount || 0;
    const activityCount = activities.length;
    
    if (dealValue > 100000 && activityCount > 20) {
      return 'deal_progression'; // Enterprise deal
    } else if (dealValue < 10000 && activityCount < 10) {
      return 'lead_conversion'; // Simple lead conversion
    } else if (deal.deal_type === 'existing_business') {
      return 'customer_expansion';
    } else {
      return 'deal_progression'; // Default
    }
  }
  
  /**
   * Extract workflow stages from deal progression
   */
  extractStages(deal, activities) {
    const stages = [];
    
    // Try to get stages from deal pipeline
    if (deal.pipeline_stages && Array.isArray(deal.pipeline_stages)) {
      deal.pipeline_stages.forEach((stage, index) => {
        stages.push({
          name: stage.name,
          order: index + 1,
          duration: this.calculateStageDuration(stage, activities),
          activities: this.getStageActivities(stage, activities),
          conversion_rate: stage.conversion_rate || null
        });
      });
    } else {
      // Infer stages from activities if not explicitly available
      stages.push(...this.inferStagesFromActivities(activities));
    }
    
    return stages;
  }
  
  /**
   * Infer workflow stages from activity patterns
   */
  inferStagesFromActivities(activities) {
    const stages = [];
    const sortedActivities = activities.sort((a, b) => 
      new Date(a.created_date) - new Date(b.created_date)
    );
    
    // Basic stage inference based on activity types
    const stagePatterns = [
      { name: 'Initial Contact', keywords: ['call', 'email', 'outreach', 'connect'] },
      { name: 'Discovery', keywords: ['discovery', 'qualification', 'needs', 'demo'] },
      { name: 'Proposal', keywords: ['proposal', 'quote', 'pricing', 'contract'] },
      { name: 'Negotiation', keywords: ['negotiation', 'review', 'legal', 'terms'] },
      { name: 'Closing', keywords: ['close', 'sign', 'agreement', 'won'] }
    ];
    
    stagePatterns.forEach((pattern, index) => {
      const stageActivities = sortedActivities.filter(activity => 
        pattern.keywords.some(keyword => 
          (activity.subject || activity.type || '').toLowerCase().includes(keyword)
        )
      );
      
      if (stageActivities.length > 0) {
        stages.push({
          name: pattern.name,
          order: index + 1,
          duration: this.calculateActivityGroupDuration(stageActivities),
          activities: stageActivities.map(a => a.type),
          inferred: true
        });
      }
    });
    
    return stages;
  }
  
  /**
   * Normalize activities from different sources
   */
  normalizeActivities(activities, notes, tasks) {
    const normalized = [];
    
    // Process CRM activities
    activities.forEach(activity => {
      normalized.push({
        id: activity.id,
        type: this.normalizeActivityType(activity.type),
        subject: activity.subject || activity.title,
        description: activity.description || activity.body,
        date: new Date(activity.created_date || activity.date),
        duration: activity.duration || null,
        outcome: activity.outcome || null,
        participants: activity.participants || [],
        source: 'crm_activity'
      });
    });
    
    // Process notes
    notes.forEach(note => {
      normalized.push({
        id: note.id,
        type: 'note',
        subject: note.subject || 'Note',
        description: note.body || note.content,
        date: new Date(note.created_date),
        source: 'note'
      });
    });
    
    // Process tasks
    tasks.forEach(task => {
      normalized.push({
        id: task.id,
        type: 'task',
        subject: task.subject || task.title,
        description: task.description,
        date: new Date(task.created_date),
        completed: task.completed || false,
        source: 'task'
      });
    });
    
    // Sort by date
    return normalized.sort((a, b) => a.date - b.date);
  }
  
  /**
   * Normalize activity types across different CRMs
   */
  normalizeActivityType(type) {
    const typeMap = {
      'call': 'call',
      'phone_call': 'call',
      'email': 'email',
      'meeting': 'meeting',
      'demo': 'demo',
      'presentation': 'demo',
      'note': 'note',
      'task': 'task',
      'proposal': 'proposal',
      'quote': 'proposal'
    };
    
    return typeMap[type?.toLowerCase()] || 'other';
  }
  
  /**
   * Extract participants from contacts and activities
   */
  extractParticipants(contacts, companies, activities) {
    const participants = [];
    
    // Add contacts
    contacts.forEach(contact => {
      participants.push({
        id: contact.id,
        name: `${contact.first_name || ''} ${contact.last_name || ''}`.trim(),
        email: contact.email,
        role: contact.job_title || 'Contact',
        company: contact.company_name,
        type: 'contact',
        engagement_level: this.calculateEngagementLevel(contact, activities)
      });
    });
    
    // Add company information
    companies.forEach(company => {
      participants.push({
        id: company.id,
        name: company.name,
        type: 'company',
        industry: company.industry,
        size: company.employee_count
      });
    });
    
    return participants;
  }
  
  /**
   * Calculate engagement level for a contact
   */
  calculateEngagementLevel(contact, activities) {
    const contactActivities = activities.filter(activity => 
      activity.participants?.some(p => p.email === contact.email)
    );
    
    if (contactActivities.length > 10) return 'high';
    if (contactActivities.length > 5) return 'medium';
    if (contactActivities.length > 0) return 'low';
    return 'none';
  }
  
  /**
   * Build timeline from deal and activities
   */
  buildTimeline(deal, activities) {
    const timeline = {
      created: new Date(deal.created_date),
      first_activity: activities.length > 0 ? new Date(activities[0].created_date) : null,
      last_activity: activities.length > 0 ? new Date(activities[activities.length - 1].created_date) : null
    };
    
    if (deal.closed_date) {
      timeline.closed = new Date(deal.closed_date);
    }
    
    return timeline;
  }
  
  /**
   * Calculate workflow duration
   */
  calculateDuration(deal) {
    const start = new Date(deal.created_date);
    const end = deal.closed_date ? new Date(deal.closed_date) : new Date();
    
    return Math.ceil((end - start) / (1000 * 60 * 60 * 24)); // Days
  }
  
  /**
   * Assess data completeness
   */
  assessDataCompleteness(data) {
    const { deal, activities, contacts, companies, notes, tasks } = data;
    let score = 0;
    let maxScore = 0;
    
    // Deal data (30%)
    maxScore += 30;
    if (deal.amount) score += 10;
    if (deal.stage) score += 10;
    if (deal.created_date) score += 10;
    
    // Activities (40%)
    maxScore += 40;
    if (activities.length > 0) score += 20;
    if (activities.length > 5) score += 10;
    if (activities.length > 10) score += 10;
    
    // Contacts (20%)
    maxScore += 20;
    if (contacts.length > 0) score += 10;
    if (contacts.length > 1) score += 10;
    
    // Additional data (10%)
    maxScore += 10;
    if (notes.length > 0) score += 5;
    if (tasks.length > 0) score += 5;
    
    return score / maxScore;
  }
  
  /**
   * Normalize deal status
   */
  normalizeStatus(stage, closedDate) {
    if (closedDate) {
      return stage?.toLowerCase().includes('won') ? 'completed' : 'lost';
    }
    return 'active';
  }
  
  /**
   * Calculate duration for a group of activities
   */
  calculateActivityGroupDuration(activities) {
    if (activities.length < 2) return 0;
    
    const sorted = activities.sort((a, b) => 
      new Date(a.created_date) - new Date(b.created_date)
    );
    
    const start = new Date(sorted[0].created_date);
    const end = new Date(sorted[sorted.length - 1].created_date);
    
    return Math.ceil((end - start) / (1000 * 60 * 60 * 24));
  }
  
  /**
   * Utility method for delays
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Abstract methods to be implemented by subclasses
   */
  async getDeals(options) {
    throw new Error('getDeals() must be implemented by subclass');
  }
  
  async getDealActivities(dealId) {
    throw new Error('getDealActivities() must be implemented by subclass');
  }
  
  async getDealContacts(dealId) {
    throw new Error('getDealContacts() must be implemented by subclass');
  }
  
  async getDealCompanies(dealId) {
    throw new Error('getDealCompanies() must be implemented by subclass');
  }
  
  async getDealNotes(dealId) {
    throw new Error('getDealNotes() must be implemented by subclass');
  }
  
  async getDealTasks(dealId) {
    throw new Error('getDealTasks() must be implemented by subclass');
  }
}

module.exports = BaseCRMAdapter;
