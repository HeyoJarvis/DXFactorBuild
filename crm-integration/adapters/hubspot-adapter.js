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
      
      // Try different connection methods based on available permissions
      let accountInfo = null;
      
      // Method 1: Try to get user info (requires settings.users.read)
      try {
        accountInfo = await this.hubspotClient.settings.users.usersApi.getById('me');
        this.logger.info('Connected with full user permissions');
      } catch (userError) {
        this.logger.warn('User API not accessible, trying alternative connection test', {
          error: userError.message
        });
        
        // Method 2: Try to get account info (requires oauth scopes)
        try {
          const tokenInfo = await this.hubspotClient.oauth.accessTokensApi.get(this.crmConfig.access_token);
          accountInfo = { id: 'unknown', email: 'unknown', tokenInfo };
          this.logger.info('Connected with limited permissions');
        } catch (tokenError) {
          this.logger.warn('Token API not accessible, trying basic CRM access', {
            error: tokenError.message
          });
          
          // Method 3: Try a basic CRM call to test connectivity
          try {
            await this.hubspotClient.crm.deals.basicApi.getPage(1);
            accountInfo = { id: 'unknown', email: 'unknown', access: 'basic_crm' };
            this.logger.info('Connected with basic CRM permissions');
          } catch (crmError) {
            throw new Error(`No accessible HubSpot permissions: ${crmError.message}`);
          }
        }
      }
      
      this.isConnected = true;
      this.logger.info('Successfully connected to HubSpot', {
        user_id: accountInfo.id,
        user_email: accountInfo.email,
        connection_method: accountInfo.access || 'full'
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
        includeArchived = true // Include all deals to get more data
      } = options;
      
      this.logger.info('Fetching deals from HubSpot', { limit, after, dateRange });
      
      // First, get deals with the most activity potential - sort by recent activity
      const searchRequest = {
        limit: Math.min(limit, 100), // HubSpot limit
        properties: this.hubspotConfig.dealProperties,
        associations: ['contacts', 'companies'],
        sorts: [
          { propertyName: 'hs_lastmodifieddate', direction: 'DESCENDING' }
        ]
      };
      
      // Only add after if it's not null
      if (after) {
        searchRequest.after = after;
      }
      
      // Prefer deals that have associated contacts (more likely to have rich data)
      searchRequest.filterGroups = [];
      
      // Only get deals with at least 1 contact to ensure rich data
      searchRequest.filterGroups.push({
        filters: [{
          propertyName: 'num_associated_contacts',
          operator: 'GTE',
          value: '1'
        }]
      });
      
      // Add additional filters if specified
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
      
      let response;
      
      // Try search API first (requires crm.objects.deals.read)
      try {
        response = await this.hubspotClient.crm.deals.searchApi.doSearch(searchRequest);
        this.logger.info(`Retrieved ${response.results.length} deals from HubSpot via Search API`);
      } catch (searchError) {
        this.logger.warn('Search API not accessible, trying Basic API', {
          error: searchError.message
        });
        
        // Fallback to basic API (requires basic crm permissions)
        try {
          response = await this.hubspotClient.crm.deals.basicApi.getPage(
            limit,
            after || undefined, // Don't pass null, use undefined
            this.hubspotConfig.dealProperties,
            undefined, // propertiesWithHistory
            ['contacts', 'companies'], // associations
            !includeArchived // archived
          );
          this.logger.info(`Retrieved ${response.results.length} deals from HubSpot via Basic API`);
        } catch (basicError) {
          this.logger.error('Both Search and Basic APIs failed', {
            searchError: searchError.message,
            basicError: basicError.message
          });
          throw basicError;
        }
      }
      
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
      
      // Try to get associated calls
      try {
        const callsResponse = await this.hubspotClient.crm.associations.v4.basicApi
          .getPage('deals', dealId, 'calls');
        
        for (const association of callsResponse.results || []) {
          try {
            const call = await this.hubspotClient.crm.objects.calls.basicApi
              .getById(association.toObjectId, ['hs_call_title', 'hs_call_body', 'hs_call_duration', 'hs_call_status', 'hs_createdate']);
            activities.push({
              id: call.id,
              type: 'call',
              subject: call.properties.hs_call_title || 'Call',
              description: call.properties.hs_call_body,
              created_date: call.properties.hs_createdate,
              duration: call.properties.hs_call_duration,
              outcome: call.properties.hs_call_status,
              source: 'hubspot_call'
            });
          } catch (error) {
            this.logger.debug(`Failed to get call details for ${association.toObjectId}`);
          }
        }
      } catch (error) {
        this.logger.debug(`No calls found for deal ${dealId}`);
      }
      
      // Try to get associated emails
      try {
        const emailsResponse = await this.hubspotClient.crm.associations.v4.basicApi
          .getPage('deals', dealId, 'emails');
        
        for (const association of emailsResponse.results || []) {
          try {
            const email = await this.hubspotClient.crm.objects.emails.basicApi
              .getById(association.toObjectId, ['hs_email_subject', 'hs_email_text', 'hs_email_status', 'hs_createdate']);
            activities.push({
              id: email.id,
              type: 'email',
              subject: email.properties.hs_email_subject || 'Email',
              description: email.properties.hs_email_text,
              created_date: email.properties.hs_createdate,
              outcome: email.properties.hs_email_status,
              source: 'hubspot_email'
            });
          } catch (error) {
            this.logger.debug(`Failed to get email details for ${association.toObjectId}`);
          }
        }
      } catch (error) {
        this.logger.debug(`No emails found for deal ${dealId}`);
      }
      
      // Try to get associated meetings
      try {
        const meetingsResponse = await this.hubspotClient.crm.associations.v4.basicApi
          .getPage('deals', dealId, 'meetings');
        
        for (const association of meetingsResponse.results || []) {
          try {
            const meeting = await this.hubspotClient.crm.objects.meetings.basicApi
              .getById(association.toObjectId, ['hs_meeting_title', 'hs_meeting_body', 'hs_meeting_outcome', 'hs_createdate']);
            activities.push({
              id: meeting.id,
              type: 'meeting',
              subject: meeting.properties.hs_meeting_title || 'Meeting',
              description: meeting.properties.hs_meeting_body,
              created_date: meeting.properties.hs_createdate,
              outcome: meeting.properties.hs_meeting_outcome,
              source: 'hubspot_meeting'
            });
          } catch (error) {
            this.logger.debug(`Failed to get meeting details for ${association.toObjectId}`);
          }
        }
      } catch (error) {
        this.logger.debug(`No meetings found for deal ${dealId}`);
      }
      
      return activities.sort((a, b) => new Date(a.created_date || 0) - new Date(b.created_date || 0));
      
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
      const response = await this.hubspotClient.crm.associations.v4.basicApi
        .getPage('deals', dealId, 'contacts');
      
      const contacts = [];
      
      for (const association of response.results) {
        try {
          const contact = await this.hubspotClient.crm.contacts.basicApi
            .getById(association.toObjectId, this.hubspotConfig.contactProperties);
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
      const response = await this.hubspotClient.crm.associations.v4.basicApi
        .getPage('deals', dealId, 'companies');
      
      const companies = [];
      
      for (const association of response.results) {
        try {
          const company = await this.hubspotClient.crm.companies.basicApi
            .getById(association.toObjectId, this.hubspotConfig.companyProperties);
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
      const response = await this.hubspotClient.crm.associations.v4.basicApi
        .getPage('deals', dealId, 'notes');
      
      const notes = [];
      
      for (const association of response.results) {
        try {
          const note = await this.hubspotClient.crm.objects.notes.basicApi
            .getById(association.toObjectId, ['hs_note_body', 'hs_createdate', 'hs_lastmodifieddate']);
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
      const response = await this.hubspotClient.crm.associations.v4.basicApi
        .getPage('deals', dealId, 'tasks');
      
      const tasks = [];
      
      for (const association of response.results) {
        try {
          const task = await this.hubspotClient.crm.objects.tasks.basicApi
            .getById(association.toObjectId, [
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
      // Stage history is optional and often not available in basic HubSpot plans
      // Don't spam logs with warnings for expected 404s
      if (error.message.includes('404')) {
        this.logger.debug('Deal stage history not available (normal for basic HubSpot plans)', {
          deal_id: dealId
        });
      } else {
        this.logger.warn('Failed to fetch deal stage history', {
          deal_id: dealId,
          error: error.message
        });
      }
      return [];
    }
  }
  
  /**
   * Enhanced workflow extraction with HubSpot-specific features
   */
  async extractWorkflowFromDeal(deal) {
    try {
      // Get the base workflow first (this is working)
      const workflow = await super.extractWorkflowFromDeal(deal);
      
      if (!workflow) return null;
      
      // Try to enhance with pipeline information, but don't fail if it doesn't work
      try {
        const [pipelines, stageHistory] = await Promise.all([
          this.getPipelines(),
          this.getDealStageHistory(deal.id).catch(() => []) // Don't fail if stage history fails
        ]);
        
        // Find the deal's pipeline
        const dealPipeline = pipelines.find(p => p.id === deal.pipeline);
        
        if (dealPipeline) {
          // Enhance workflow with pipeline information
          workflow.pipeline_stages = dealPipeline.stages.map((stage, index) => ({
            id: stage.id,
            name: stage.label,
            order: index + 1,
            probability: stage.probability,
            is_closed_won: stage.closed_won,
            current: stage.id === deal.stage
          }));
          
          // Enhance stages if they exist
          if (workflow.stages && workflow.stages.length > 0) {
            workflow.stages = this.enhanceStagesWithPipeline(workflow.stages, dealPipeline, stageHistory);
          }
          
          workflow.pattern_name = this.generatePatternName(workflow, dealPipeline);
        }
        
        // Add HubSpot-specific metadata
        workflow.hubspot_metadata = {
          pipeline_id: deal.pipeline,
          pipeline_name: dealPipeline?.label,
          current_stage_id: deal.stage,
          source: deal.source,
          contact_count: deal.contact_count,
          probability: deal.probability
        };
        
      } catch (enhancementError) {
        this.logger.warn('Failed to enhance workflow with pipeline data, using base workflow', {
          deal_id: deal.id,
          error: enhancementError.message
        });
      }
      
      return workflow;
      
    } catch (error) {
      this.logger.error('Failed to extract HubSpot workflow', {
        deal_id: deal.id,
        error: error.message
      });
      return null;
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
