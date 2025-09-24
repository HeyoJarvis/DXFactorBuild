/**
 * HubSpot CRM Adapter - Specific implementation for HubSpot API integration
 * 
 * Features:
 * 1. HubSpot API v3 integration
 * 2. Deal, contact, and activity extraction
 * 3. Pipeline and stage mapping
 * 4. Property and custom field handling
 * 5. Rate limiting and error handling
 */

const { Client } = require('@hubspot/api-client');
const BaseCRMAdapter = require('./base-crm-adapter');

class HubSpotAdapter extends BaseCRMAdapter {
  constructor(crmConfig, options = {}) {
    super(crmConfig, options);
    
    this.hubspotClient = new Client({
      accessToken: crmConfig.access_token,
      basePath: crmConfig.base_url || 'https://api.hubapi.com'
    });
    
    // HubSpot specific configuration
    this.hubspotConfig = {
      dealProperties: [
        'dealname', 'amount', 'dealstage', 'pipeline', 'closedate', 
        'createdate', 'hs_lastmodifieddate', 'dealtype', 'amount_in_home_currency',
        'hs_deal_stage_probability', 'num_associated_contacts', 'hs_analytics_source'
      ],
      contactProperties: [
        'firstname', 'lastname', 'email', 'jobtitle', 'company', 
        'phone', 'hs_lead_status', 'lifecyclestage', 'createdate'
      ],
      companyProperties: [
        'name', 'domain', 'industry', 'numberofemployees', 'annualrevenue',
        'city', 'state', 'country', 'type', 'createdate'
      ],
      activityTypes: [
        'calls', 'emails', 'meetings', 'notes', 'tasks', 'communications'
      ],
      batchSize: 100,
      maxRetries: 3
    };
  }
  
  getCRMType() {
    return 'hubspot';
  }
  
  async connect() {
    try {
      this.logger.info('Connecting to HubSpot API');
      
      // Test connection by getting account info
      const accountInfo = await this.hubspotClient.settings.users.usersApi.getById('me');
      
      this.isConnected = true;
      this.logger.info('Successfully connected to HubSpot', {
        user_id: accountInfo.id,
        user_email: accountInfo.email
      });
      
      return accountInfo;
      
    } catch (error) {
      this.isConnected = false;
      this.logger.error('Failed to connect to HubSpot', {
        error: error.message,
        status: error.response?.status
      });
      throw error;
    }
  }
  
  async getDeals(options = {}) {
    try {
      const {
        limit = 100,
        after = null,
        dateRange = null,
        pipeline = null,
        includeArchived = false
      } = options;
      
      this.logger.info('Fetching deals from HubSpot', { limit, after, dateRange });
      
      const searchRequest = {
        limit,
        after,
        properties: this.hubspotConfig.dealProperties,
        associations: ['contacts', 'companies']
      };
      
      // Add filters if specified
      if (dateRange || pipeline || !includeArchived) {
        searchRequest.filterGroups = [];
        
        if (dateRange) {
          searchRequest.filterGroups.push({
            filters: [{
              propertyName: 'createdate',
              operator: 'GTE',
              value: dateRange.start.getTime()
            }, {
              propertyName: 'createdate', 
              operator: 'LTE',
              value: dateRange.end.getTime()
            }]
          });
        }
        
        if (pipeline) {
          searchRequest.filterGroups.push({
            filters: [{
              propertyName: 'pipeline',
              operator: 'EQ',
              value: pipeline
            }]
          });
        }
        
        if (!includeArchived) {
          searchRequest.filterGroups.push({
            filters: [{
              propertyName: 'hs_is_closed',
              operator: 'EQ',
              value: 'false'
            }]
          });
        }
      }
      
      const response = await this.hubspotClient.crm.deals.searchApi.doSearch(searchRequest);
      
      this.logger.info(`Retrieved ${response.results.length} deals from HubSpot`);
      
      return response.results.map(deal => this.normalizeDeal(deal));
      
    } catch (error) {
      this.logger.error('Failed to fetch deals from HubSpot', {
        error: error.message,
        status: error.response?.status
      });
      throw error;
    }
  }
  
  async getDealActivities(dealId) {
    try {
      const activities = [];
      
      // Get different types of activities
      const activityPromises = this.hubspotConfig.activityTypes.map(async (activityType) => {
        try {
          const response = await this.hubspotClient.crm.objects.calls.associationsApi
            .getAll(dealId, 'deals', activityType);
          return response.results || [];
        } catch (error) {
          // Some activity types might not be available
          this.logger.debug(`No ${activityType} found for deal ${dealId}`);
          return [];
        }
      });
      
      const activityResults = await Promise.all(activityPromises);
      activityResults.forEach(result => activities.push(...result));
      
      // Get engagement activities (emails, calls, meetings)
      try {
        const engagements = await this.hubspotClient.crm.deals.associationsApi
          .getAll(dealId, 'engagements');
        
        for (const engagement of engagements.results) {
          const engagementDetail = await this.hubspotClient.engagements.engagementsApi
            .getById(engagement.id);
          activities.push(this.normalizeEngagement(engagementDetail));
        }
      } catch (error) {
        this.logger.debug(`No engagements found for deal ${dealId}`);
      }
      
      return activities.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
      
    } catch (error) {
      this.logger.error('Failed to fetch deal activities', {
        deal_id: dealId,
        error: error.message
      });
      return [];
    }
  }
  
  async getDealContacts(dealId) {
    try {
      const response = await this.hubspotClient.crm.deals.associationsApi
        .getAll(dealId, 'contacts');
      
      const contacts = [];
      
      for (const association of response.results) {
        try {
          const contact = await this.hubspotClient.crm.contacts.basicApi
            .getById(association.id, this.hubspotConfig.contactProperties);
          contacts.push(this.normalizeContact(contact));
        } catch (error) {
          this.logger.warn('Failed to fetch contact details', {
            contact_id: association.id,
            error: error.message
          });
        }
      }
      
      return contacts;
      
    } catch (error) {
      this.logger.error('Failed to fetch deal contacts', {
        deal_id: dealId,
        error: error.message
      });
      return [];
    }
  }
  
  async getDealCompanies(dealId) {
    try {
      const response = await this.hubspotClient.crm.deals.associationsApi
        .getAll(dealId, 'companies');
      
      const companies = [];
      
      for (const association of response.results) {
        try {
          const company = await this.hubspotClient.crm.companies.basicApi
            .getById(association.id, this.hubspotConfig.companyProperties);
          companies.push(this.normalizeCompany(company));
        } catch (error) {
          this.logger.warn('Failed to fetch company details', {
            company_id: association.id,
            error: error.message
          });
        }
      }
      
      return companies;
      
    } catch (error) {
      this.logger.error('Failed to fetch deal companies', {
        deal_id: dealId,
        error: error.message
      });
      return [];
    }
  }
  
  async getDealNotes(dealId) {
    try {
      const response = await this.hubspotClient.crm.deals.associationsApi
        .getAll(dealId, 'notes');
      
      const notes = [];
      
      for (const association of response.results) {
        try {
          const note = await this.hubspotClient.crm.objects.notes.basicApi
            .getById(association.id, ['hs_note_body', 'hs_createdate', 'hs_lastmodifieddate']);
          notes.push(this.normalizeNote(note));
        } catch (error) {
          this.logger.warn('Failed to fetch note details', {
            note_id: association.id,
            error: error.message
          });
        }
      }
      
      return notes.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
      
    } catch (error) {
      this.logger.error('Failed to fetch deal notes', {
        deal_id: dealId,
        error: error.message
      });
      return [];
    }
  }
  
  async getDealTasks(dealId) {
    try {
      const response = await this.hubspotClient.crm.deals.associationsApi
        .getAll(dealId, 'tasks');
      
      const tasks = [];
      
      for (const association of response.results) {
        try {
          const task = await this.hubspotClient.crm.objects.tasks.basicApi
            .getById(association.id, [
              'hs_task_subject', 'hs_task_body', 'hs_task_status', 
              'hs_task_priority', 'hs_createdate', 'hs_timestamp'
            ]);
          tasks.push(this.normalizeTask(task));
        } catch (error) {
          this.logger.warn('Failed to fetch task details', {
            task_id: association.id,
            error: error.message
          });
        }
      }
      
      return tasks.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
      
    } catch (error) {
      this.logger.error('Failed to fetch deal tasks', {
        deal_id: dealId,
        error: error.message
      });
      return [];
    }
  }
  
  /**
   * Get pipeline information for stage mapping
   */
  async getPipelines() {
    try {
      const response = await this.hubspotClient.crm.pipelines.pipelinesApi
        .getAll('deals');
      
      return response.results.map(pipeline => ({
        id: pipeline.id,
        label: pipeline.label,
        stages: pipeline.stages.map(stage => ({
          id: stage.id,
          label: stage.label,
          probability: stage.metadata?.probability || 0,
          closed_won: stage.metadata?.isClosed && stage.metadata?.isWon
        }))
      }));
      
    } catch (error) {
      this.logger.error('Failed to fetch pipelines', {
        error: error.message
      });
      return [];
    }
  }
  
  /**
   * Normalize HubSpot deal data
   */
  normalizeDeal(hubspotDeal) {
    const properties = hubspotDeal.properties;
    
    return {
      id: hubspotDeal.id,
      name: properties.dealname,
      amount: parseFloat(properties.amount || properties.amount_in_home_currency || 0),
      stage: properties.dealstage,
      pipeline: properties.pipeline,
      probability: parseFloat(properties.hs_deal_stage_probability || 0) / 100,
      created_date: properties.createdate,
      modified_date: properties.hs_lastmodifieddate,
      closed_date: properties.closedate,
      deal_type: properties.dealtype,
      source: properties.hs_analytics_source,
      contact_count: parseInt(properties.num_associated_contacts || 0),
      raw_properties: properties
    };
  }
  
  /**
   * Normalize HubSpot contact data
   */
  normalizeContact(hubspotContact) {
    const properties = hubspotContact.properties;
    
    return {
      id: hubspotContact.id,
      first_name: properties.firstname,
      last_name: properties.lastname,
      email: properties.email,
      job_title: properties.jobtitle,
      company_name: properties.company,
      phone: properties.phone,
      lead_status: properties.hs_lead_status,
      lifecycle_stage: properties.lifecyclestage,
      created_date: properties.createdate
    };
  }
  
  /**
   * Normalize HubSpot company data
   */
  normalizeCompany(hubspotCompany) {
    const properties = hubspotCompany.properties;
    
    return {
      id: hubspotCompany.id,
      name: properties.name,
      domain: properties.domain,
      industry: properties.industry,
      employee_count: parseInt(properties.numberofemployees || 0),
      annual_revenue: parseFloat(properties.annualrevenue || 0),
      city: properties.city,
      state: properties.state,
      country: properties.country,
      type: properties.type,
      created_date: properties.createdate
    };
  }
  
  /**
   * Normalize HubSpot engagement data
   */
  normalizeEngagement(engagement) {
    return {
      id: engagement.engagement.id,
      type: engagement.engagement.type,
      subject: engagement.metadata?.subject || engagement.metadata?.title,
      body: engagement.metadata?.body || engagement.metadata?.text,
      created_date: new Date(engagement.engagement.createdAt),
      duration: engagement.metadata?.durationMilliseconds,
      outcome: engagement.metadata?.disposition,
      participants: engagement.associations?.contactIds || []
    };
  }
  
  /**
   * Normalize HubSpot note data
   */
  normalizeNote(hubspotNote) {
    const properties = hubspotNote.properties;
    
    return {
      id: hubspotNote.id,
      body: properties.hs_note_body,
      created_date: properties.hs_createdate,
      modified_date: properties.hs_lastmodifieddate
    };
  }
  
  /**
   * Normalize HubSpot task data
   */
  normalizeTask(hubspotTask) {
    const properties = hubspotTask.properties;
    
    return {
      id: hubspotTask.id,
      subject: properties.hs_task_subject,
      description: properties.hs_task_body,
      status: properties.hs_task_status,
      priority: properties.hs_task_priority,
      created_date: properties.hs_createdate,
      due_date: properties.hs_timestamp,
      completed: properties.hs_task_status === 'COMPLETED'
    };
  }
  
  /**
   * Get deal stage history for timeline analysis
   */
  async getDealStageHistory(dealId) {
    try {
      // HubSpot doesn't have a direct stage history API, but we can infer from property history
      const response = await this.hubspotClient.crm.deals.basicApi
        .getById(dealId, ['dealstage'], undefined, undefined, undefined, 'propertiesWithHistory');
      
      const stageHistory = [];
      const dealstageHistory = response.propertiesWithHistory?.dealstage;
      
      if (dealstageHistory) {
        dealstageHistory.forEach(entry => {
          stageHistory.push({
            stage: entry.value,
            timestamp: new Date(entry.timestamp),
            source: entry.sourceType
          });
        });
      }
      
      return stageHistory.sort((a, b) => a.timestamp - b.timestamp);
      
    } catch (error) {
      this.logger.warn('Failed to fetch deal stage history', {
        deal_id: dealId,
        error: error.message
      });
      return [];
    }
  }
  
  /**
   * Enhanced workflow extraction with HubSpot-specific features
   */
  async extractWorkflowFromDeal(deal) {
    try {
      // Get the base workflow
      const workflow = await super.extractWorkflowFromDeal(deal);
      
      if (!workflow) return null;
      
      // Add HubSpot-specific enhancements
      const [pipelines, stageHistory] = await Promise.all([
        this.getPipelines(),
        this.getDealStageHistory(deal.id)
      ]);
      
      // Enhance stages with pipeline information
      const dealPipeline = pipelines.find(p => p.id === deal.pipeline);
      if (dealPipeline) {
        workflow.stages = this.enhanceStagesWithPipeline(workflow.stages, dealPipeline, stageHistory);
        workflow.pattern_name = this.generatePatternName(workflow, dealPipeline);
      }
      
      // Add HubSpot-specific metadata
      workflow.hubspot_metadata = {
        pipeline_id: deal.pipeline,
        pipeline_name: dealPipeline?.label,
        source: deal.source,
        contact_count: deal.contact_count,
        probability: deal.probability
      };
      
      return workflow;
      
    } catch (error) {
      this.logger.error('Failed to extract enhanced HubSpot workflow', {
        deal_id: deal.id,
        error: error.message
      });
      
      // Fall back to base extraction
      return await super.extractWorkflowFromDeal(deal);
    }
  }
  
  /**
   * Enhance stages with pipeline information
   */
  enhanceStagesWithPipeline(stages, pipeline, stageHistory) {
    return stages.map(stage => {
      const pipelineStage = pipeline.stages.find(ps => ps.label === stage.name);
      
      if (pipelineStage) {
        stage.probability = pipelineStage.probability;
        stage.is_closed_won = pipelineStage.closed_won;
        
        // Add actual duration from stage history
        const stageEntry = stageHistory.find(sh => sh.stage === pipelineStage.id);
        if (stageEntry) {
          stage.actual_duration = this.calculateStageActualDuration(stageEntry, stageHistory);
        }
      }
      
      return stage;
    });
  }
  
  /**
   * Generate a descriptive pattern name
   */
  generatePatternName(workflow, pipeline) {
    const dealValue = workflow.deal_value || 0;
    const duration = workflow.duration_days || 0;
    
    let patternName = pipeline.label || 'Sales Process';
    
    // Add deal size qualifier
    if (dealValue > 100000) {
      patternName = `Enterprise ${patternName}`;
    } else if (dealValue > 25000) {
      patternName = `Mid-Market ${patternName}`;
    } else {
      patternName = `SMB ${patternName}`;
    }
    
    // Add velocity qualifier
    if (duration < 30) {
      patternName = `Fast ${patternName}`;
    } else if (duration > 90) {
      patternName = `Extended ${patternName}`;
    }
    
    return patternName;
  }
  
  /**
   * Calculate actual stage duration from history
   */
  calculateStageActualDuration(stageEntry, stageHistory) {
    const stageIndex = stageHistory.findIndex(sh => sh.timestamp.getTime() === stageEntry.timestamp.getTime());
    
    if (stageIndex === -1 || stageIndex === stageHistory.length - 1) {
      return 0; // Can't calculate duration
    }
    
    const nextStage = stageHistory[stageIndex + 1];
    const duration = (nextStage.timestamp - stageEntry.timestamp) / (1000 * 60 * 60 * 24);
    
    return Math.ceil(duration);
  }
}

module.exports = HubSpotAdapter;
