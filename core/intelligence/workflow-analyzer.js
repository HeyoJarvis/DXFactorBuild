/**
 * Workflow Intelligence System - Captures and analyzes user workflow patterns
 * 
 * Features:
 * 1. Inbound request analysis (what users ask for)
 * 2. Outbound action tracking (what users do)
 * 3. Context pattern recognition
 * 4. Actionable intelligence generation
 * 5. Workflow optimization suggestions
 */

const AIAnalyzer = require('../signals/enrichment/ai-analyzer');
const AccessControlManager = require('../security/access-control');
const winston = require('winston');

class WorkflowIntelligenceSystem {
  constructor(options = {}) {
    this.options = {
      logLevel: 'info',
      analysisWindow: 7, // days
      minPatternOccurrences: 3,
      maxInsightsPerUser: 10,
      insightCooldownHours: 24,
      ...options
    };
    
    this.logger = winston.createLogger({
      level: this.options.logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      defaultMeta: { service: 'workflow-intelligence' }
    });
    
    this.aiAnalyzer = new AIAnalyzer(options);
    this.accessControl = new AccessControlManager(options);
    
    // Hierarchical workflow pattern storage: user → channel → date → interactions
    this.userWorkflows = new Map(); // userId → Map(channelId → Map(dateKey → interactions[]))
    this.teamPatterns = new Map();  // channelId → patterns
    this.actionableInsights = new Map(); // userId → insights[]
    this.lastInsightShare = new Map(); // userId → timestamp
    this.channelMetadata = new Map(); // channelId → { name, type, team_id, etc }
    
    // Tool and workflow knowledge base
    this.toolKnowledge = this.initializeToolKnowledge();
    this.workflowTemplates = this.initializeWorkflowTemplates();
  }

  /**
   * Capture inbound user request/message
   */
  async captureInboundRequest(userId, channelId, message, context = {}) {
    try {
      // Extract assignor and assignee information
      const assignmentInfo = this.extractAssignmentInfo(message, userId, context);

      const requestData = {
        id: this.generateId(),
        userId,
        channelId,
        timestamp: new Date(),
        type: 'inbound',
        content: message,
        context: {
          messageType: this.classifyMessageType(message),
          urgency: this.detectUrgency(message),
          intent: await this.extractIntent(message),
          entities: await this.extractEntities(message),
          tools_mentioned: this.extractToolMentions(message),
          sentiment: this.analyzeSentiment(message),
          assignor: assignmentInfo.assignor,
          assignee: assignmentInfo.assignee,
          mentioned_users: assignmentInfo.mentionedUsers,
          is_assignment: assignmentInfo.isAssignment,
          ...context
        }
      };

      await this.storeWorkflowData(requestData);
      
      // Analyze patterns and generate insights asynchronously
      setImmediate(() => this.analyzeRequestPattern(requestData));
      
      this.logger.info('Captured inbound request', {
        user_id: userId,
        message_type: requestData.context.messageType,
        intent: requestData.context.intent?.intent,
        tools_mentioned: requestData.context.tools_mentioned?.length || 0
      });

      return requestData;
      
    } catch (error) {
      this.logger.error('Failed to capture inbound request', {
        user_id: userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Capture outbound user action/response
   */
  async captureOutboundAction(userId, channelId, action, context = {}) {
    try {
      const actionData = {
        id: this.generateId(),
        userId,
        channelId,
        timestamp: new Date(),
        type: 'outbound',
        action,
        context: {
          actionType: this.classifyActionType(action),
          completion_status: context.completion_status || 'unknown',
          tools_used: context.tools_used || [],
          time_taken: context.time_taken,
          follow_up_needed: context.follow_up_needed || false,
          success: context.success !== false, // default to true unless explicitly false
          ...context
        }
      };

      await this.storeWorkflowData(actionData);
      
      // Analyze patterns asynchronously
      setImmediate(() => this.analyzeActionPattern(actionData));
      
      this.logger.info('Captured outbound action', {
        user_id: userId,
        action_type: actionData.context.actionType,
        completion_status: actionData.context.completion_status,
        success: actionData.context.success
      });

      return actionData;
      
    } catch (error) {
      this.logger.error('Failed to capture outbound action', {
        user_id: userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Classify message types for pattern recognition
   */
  classifyMessageType(message) {
    const lowerMessage = message.toLowerCase();
    
    const patterns = {
      'help_request': ['help', 'how', 'what', 'explain', 'guide', 'tutorial'],
      'automation_inquiry': ['automate', 'workflow', 'process', 'streamline', 'optimize'],
      'integration_request': ['integrate', 'connect', 'sync', 'link', 'combine'],
      'reporting_request': ['report', 'dashboard', 'analytics', 'metrics', 'data'],
      'scheduling_request': ['meeting', 'schedule', 'calendar', 'appointment', 'time'],
      'task_management': ['task', 'todo', 'project', 'assign', 'deadline'],
      'issue_report': ['bug', 'issue', 'problem', 'error', 'broken', 'not working'],
      'feature_request': ['feature', 'suggestion', 'improvement', 'enhancement', 'add'],
      'tool_inquiry': ['tool', 'software', 'app', 'platform', 'service', 'recommendation']
    };
    
    for (const [type, keywords] of Object.entries(patterns)) {
      if (keywords.some(keyword => lowerMessage.includes(keyword))) {
        return type;
      }
    }
    
    return 'general_inquiry';
  }


  /**
   * Extract assignor (sender) and assignee (mentioned user) information
   * @param {string} message - The Slack message content
   * @param {string} senderId - The user ID who sent the message
   * @param {Object} context - Additional context (may include user_name, real_name, etc.)
   * @returns {Object} Assignment info with assignor and assignee
   */
  extractAssignmentInfo(message, senderId, context = {}) {
    const assignmentInfo = {
      assignor: {
        id: senderId,
        name: context.user_name || context.userName || context.real_name || null,
        slack_user_id: context.slack_user_id || senderId,
        email: context.email || null
      },
      assignee: null,
      mentionedUsers: [],
      isAssignment: false // Whether this looks like a task assignment
    };

    // Extract Slack user mentions (<@U12345678> or <@U12345678|username> format)
    const slackMentions = message.match(/<@([UW][A-Z0-9]+)(?:\|[^>]+)?>/g) || [];
    const mentionedUserIds = slackMentions.map(mention => {
      const match = mention.match(/<@([UW][A-Z0-9]+)(?:\|([^>]+))?>/);
      return {
        id: match[1],
        name: match[2] || null
      };
    });

    // Extract @username mentions (fallback for non-Slack format)
    const atMentions = message.match(/@(\w+)/g) || [];
    const mentionedUsernames = atMentions.map(mention => 
      mention.replace('@', '')
    );

    // Combine all mentioned users
    assignmentInfo.mentionedUsers = [
      ...mentionedUserIds.map(user => ({ 
        type: 'slack_user', 
        id: user.id, 
        name: user.name 
      })),
      ...mentionedUsernames.map(name => ({ 
        type: 'username', 
        value: name 
      }))
    ];

    // Check for assignment keywords (polite requests)
    const assignmentKeywords = [
      /can you|could you|please/i,
      /assign(?:ed)? to/i,
      /for you to|need you to|want you to/i,
      /your task|your responsibility/i,
      /handle|take care of|work on/i,
      /due|deadline|by (tomorrow|today|friday|monday|eod)/i
    ];

    // Check for imperative verbs (direct commands)
    const imperativeVerbs = [
      /^schedule|^set up|^setup|^create|^send|^draft|^write/i,
      /^call|^email|^contact|^reach out/i,
      /^review|^analyze|^check|^update|^complete/i,
      /^prepare|^organize|^coordinate|^arrange/i,
      /^follow up|^followup|^respond|^reply/i,
      /^book|^reserve|^confirm|^finalize/i
    ];

    // Check if message starts with @mention followed by imperative verb
    const mentionImperativePattern = /<@[UW][A-Z0-9]+(?:\|[^>]+)?>\s+(schedule|set up|setup|create|send|draft|write|call|email|contact|reach out|review|analyze|check|update|complete|prepare|organize|coordinate|arrange|follow up|followup|respond|reply|book|reserve|confirm|finalize)/i;
    
    const hasAssignmentKeyword = assignmentKeywords.some(pattern => 
      pattern.test(message)
    );

    const hasImperativeVerb = imperativeVerbs.some(pattern =>
      pattern.test(message)
    );

    const hasMentionWithImperative = mentionImperativePattern.test(message);

    // Determine if this is an assignment
    // It's an assignment if:
    // 1. Has assignment keywords + mentions, OR
    // 2. Starts with imperative verb + has mentions, OR
    // 3. Has @mention followed directly by imperative verb
    assignmentInfo.isAssignment = 
      (hasAssignmentKeyword && (mentionedUserIds.length > 0 || mentionedUsernames.length > 0)) ||
      (hasImperativeVerb && (mentionedUserIds.length > 0 || mentionedUsernames.length > 0)) ||
      hasMentionWithImperative;

    // Determine primary assignee (first mentioned user)
    if (mentionedUserIds.length > 0) {
      assignmentInfo.assignee = {
        id: mentionedUserIds[0].id,
        name: mentionedUserIds[0].name,
        type: 'slack_user',
        slack_user_id: mentionedUserIds[0].id
      };
    } else if (mentionedUsernames.length > 0) {
      assignmentInfo.assignee = {
        name: mentionedUsernames[0],
        type: 'username'
      };
    }

    // Refined assignee detection using contextual patterns
    const assignmentPatterns = [
      /can you (?:please )?(.+?),?\s+handle/i,
      /(?:assign|assigned) to\s+<?@?(\w+)>?/i,
      /<?@?(\w+)>?,?\s+(?:can|could|please) you/i,
      /(?:for|to)\s+<?@?(\w+)>?\s+to (?:work on|complete|handle|do)/i,
      /hey\s+<?@?(\w+)>?,?\s+(?:can|could)/i,
      /<?@?(\w+)>?\s+-\s+(?:please|can you)/i
    ];

    for (const pattern of assignmentPatterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        const potentialAssignee = match[1].replace(/[<>@]/g, '');
        
        if (!assignmentInfo.assignee || assignmentInfo.assignee.type === 'username') {
          assignmentInfo.assignee = {
            name: potentialAssignee,
            type: 'inferred_from_pattern'
          };
          assignmentInfo.isAssignment = true;
        }
        break;
      }
    }

    this.logger.debug('Extracted assignment info', {
      sender_id: senderId,
      is_assignment: assignmentInfo.isAssignment,
      assignee: assignmentInfo.assignee?.id || assignmentInfo.assignee?.name,
      mentioned_count: assignmentInfo.mentionedUsers.length
    });

    return assignmentInfo;
  }


  /**
   * Detect urgency in messages
   */
  detectUrgency(message) {
    const urgentKeywords = ['urgent', 'asap', 'immediately', 'emergency', 'critical', 'now', 'today', 'deadline'];
    const lowerMessage = message.toLowerCase();
    
    const urgencyScore = urgentKeywords.reduce((score, keyword) => {
      return lowerMessage.includes(keyword) ? score + 1 : score;
    }, 0);

    // Check for time indicators
    const timeIndicators = ['today', 'tonight', 'this morning', 'by end of day', 'eod'];
    const hasTimeIndicator = timeIndicators.some(indicator => lowerMessage.includes(indicator));
    
    if (urgencyScore >= 2 || hasTimeIndicator) return 'high';
    if (urgencyScore === 1) return 'medium';
    return 'low';
  }

  /**
   * Extract user intent using AI
   */
  async extractIntent(message) {
    const intentPrompt = `Analyze this user message and identify the primary intent:

Message: "${message}"

Classify the intent into one of these categories:
- information_seeking: User wants information or answers
- task_automation: User wants to automate a process
- tool_recommendation: User needs tool suggestions
- workflow_optimization: User wants to improve their workflow
- integration_help: User needs help connecting tools
- problem_solving: User has a specific problem to solve
- learning: User wants to learn how to do something
- status_check: User wants to check on something
- collaboration: User wants to work with others
- productivity_help: User wants to be more productive
- other: Doesn't fit other categories

Respond with just the category name and a confidence score (0-1).
Format: category_name:confidence_score`;

    try {
      // Create a mock signal object for the AI analyzer
      const mockSignal = {
        id: 'intent_analysis',
        title: message,
        content: message,
        url: 'internal://intent-analysis'
      };
      
      const analysis = await this.aiAnalyzer.analyzeSignal(mockSignal, {
        systemPrompt: intentPrompt,
        analysisType: 'intent_classification'
      });
      
      // Extract intent from analysis
      const response = analysis.analysis || analysis.summary || analysis.toString();
      const lines = response.split('\n');
      const intentLine = lines.find(line => line.includes(':')) || response;
      const [intent, confidence] = intentLine.split(':');
      
      return {
        intent: intent?.trim() || 'other',
        confidence: parseFloat(confidence) || 0.5
      };
    } catch (error) {
      this.logger.warn('Intent extraction failed, using fallback', { error: error.message });
      return { intent: this.fallbackIntentClassification(message), confidence: 0.4 };
    }
  }

  /**
   * Fallback intent classification using keywords
   */
  fallbackIntentClassification(message) {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('help') || lowerMessage.includes('how')) return 'information_seeking';
    if (lowerMessage.includes('automate') || lowerMessage.includes('workflow')) return 'task_automation';
    if (lowerMessage.includes('tool') || lowerMessage.includes('recommend')) return 'tool_recommendation';
    if (lowerMessage.includes('integrate') || lowerMessage.includes('connect')) return 'integration_help';
    if (lowerMessage.includes('problem') || lowerMessage.includes('issue')) return 'problem_solving';
    
    return 'other';
  }

  /**
   * Extract entities (tools, people, concepts) from message
   */
  async extractEntities(message) {
    // Simple entity extraction - can be enhanced with AI if needed
    const entities = {
      tools: this.extractToolMentions(message),
      people: this.extractPeopleMentions(message),
      concepts: this.extractConcepts(message),
      actions: this.extractActions(message),
      timeframes: this.extractTimeframes(message)
    };
    
    return entities;
  }

  /**
   * Extract tool mentions from message
   */
  extractToolMentions(message) {
    const commonTools = [
      'slack', 'notion', 'trello', 'asana', 'jira', 'github', 'figma', 
      'zoom', 'teams', 'google', 'microsoft', 'zapier', 'monday',
      'airtable', 'salesforce', 'hubspot', 'intercom', 'zendesk',
      'discord', 'linear', 'clickup', 'basecamp', 'dropbox', 'drive'
    ];
    
    const lowerMessage = message.toLowerCase();
    return commonTools.filter(tool => lowerMessage.includes(tool));
  }

  /**
   * Extract people mentions (@mentions, roles)
   */
  extractPeopleMentions(message) {
    const mentions = [];
    
    // Extract @mentions
    const atMentions = message.match(/@\w+/g) || [];
    mentions.push(...atMentions);
    
    // Extract role mentions
    const roles = ['manager', 'team', 'developer', 'designer', 'pm', 'ceo', 'cto'];
    const lowerMessage = message.toLowerCase();
    roles.forEach(role => {
      if (lowerMessage.includes(role)) {
        mentions.push(role);
      }
    });
    
    return mentions;
  }

  /**
   * Extract business concepts
   */
  extractConcepts(message) {
    const concepts = ['workflow', 'process', 'automation', 'integration', 'productivity', 
                     'efficiency', 'collaboration', 'reporting', 'analytics', 'dashboard'];
    
    const lowerMessage = message.toLowerCase();
    return concepts.filter(concept => lowerMessage.includes(concept));
  }

  /**
   * Extract action words
   */
  extractActions(message) {
    const actions = ['create', 'update', 'delete', 'share', 'send', 'schedule', 
                    'integrate', 'automate', 'optimize', 'improve', 'fix'];
    
    const lowerMessage = message.toLowerCase();
    return actions.filter(action => lowerMessage.includes(action));
  }

  /**
   * Extract time references
   */
  extractTimeframes(message) {
    const timePatterns = [
      /today|tonight|tomorrow/gi,
      /this (week|month|year)/gi,
      /next (week|month|year)/gi,
      /by (end of day|eod|friday|monday)/gi,
      /in \d+ (days|weeks|months)/gi,
      /deadline|due date/gi
    ];
    
    const timeframes = [];
    timePatterns.forEach(pattern => {
      const matches = message.match(pattern);
      if (matches) {
        timeframes.push(...matches);
      }
    });
    
    return timeframes;
  }

  /**
   * Analyze sentiment of message
   */
  analyzeSentiment(message) {
    const positiveWords = ['good', 'great', 'awesome', 'love', 'excellent', 'perfect', 'thanks'];
    const negativeWords = ['bad', 'terrible', 'hate', 'awful', 'broken', 'frustrated', 'annoying'];
    
    const lowerMessage = message.toLowerCase();
    const positiveScore = positiveWords.filter(word => lowerMessage.includes(word)).length;
    const negativeScore = negativeWords.filter(word => lowerMessage.includes(word)).length;
    
    if (positiveScore > negativeScore) return 'positive';
    if (negativeScore > positiveScore) return 'negative';
    return 'neutral';
  }

  /**
   * Classify action types
   */
  classifyActionType(action) {
    const actionString = typeof action === 'string' ? action : JSON.stringify(action);
    const lowerAction = actionString.toLowerCase();
    
    const actionTypes = {
      'creation': ['create', 'add', 'new', 'make', 'build'],
      'modification': ['update', 'edit', 'change', 'modify', 'revise'],
      'deletion': ['delete', 'remove', 'clear', 'cancel'],
      'communication': ['share', 'send', 'message', 'notify', 'email'],
      'scheduling': ['schedule', 'plan', 'book', 'reserve'],
      'integration': ['integrate', 'connect', 'sync', 'link'],
      'automation': ['automate', 'workflow', 'trigger', 'rule'],
      'analysis': ['analyze', 'report', 'dashboard', 'metrics']
    };
    
    for (const [type, keywords] of Object.entries(actionTypes)) {
      if (keywords.some(keyword => lowerAction.includes(keyword))) {
        return type;
      }
    }
    
    return 'general_action';
  }

  /**
   * Analyze request patterns for insights
   */
  async analyzeRequestPattern(requestData) {
    try {
      const userId = requestData.userId;
      
      // Get user's recent requests
      const recentRequests = await this.getUserRecentWorkflow(userId, 'inbound');
      
      if (recentRequests.length < this.options.minPatternOccurrences) {
        return; // Not enough data for pattern analysis
      }
      
      // Detect patterns
      const patterns = {
        frequent_intents: this.findFrequentIntents(recentRequests),
        tool_mentions: this.analyzeToolMentionPatterns(recentRequests),
        urgency_patterns: this.analyzeUrgencyPatterns(recentRequests),
        time_patterns: this.analyzeTimePatterns(recentRequests),
        recurring_themes: this.identifyRecurringThemes(recentRequests)
      };

      // Generate insights if patterns are significant
      if (this.hasSignificantPatterns(patterns)) {
        const insights = await this.generateRequestInsights(patterns, requestData);
        
        if (insights.actionable_suggestions.length > 0) {
          await this.storeActionableInsight(userId, insights);
        }
      }
      
    } catch (error) {
      this.logger.error('Request pattern analysis failed', {
        user_id: requestData.userId,
        error: error.message
      });
    }
  }

  /**
   * Analyze action patterns for workflow optimization
   */
  async analyzeActionPattern(actionData) {
    try {
      const userId = actionData.userId;
      
      // Get user's recent actions
      const recentActions = await this.getUserRecentWorkflow(userId, 'outbound');
      
      if (recentActions.length < this.options.minPatternOccurrences) {
        return;
      }
      
      // Detect workflow inefficiencies
      const inefficiencies = {
        repeated_actions: this.findRepeatedActions(recentActions),
        incomplete_workflows: this.findIncompleteWorkflows(recentActions),
        tool_switching: this.analyzeToolSwitching(recentActions),
        time_inefficiencies: this.analyzeTimeInefficiencies(recentActions)
      };

      // Generate optimization suggestions
      if (this.hasSignificantInefficiencies(inefficiencies)) {
        const optimizations = await this.generateOptimizationSuggestions(inefficiencies, actionData);
        
        if (optimizations.suggestions.length > 0) {
          await this.storeActionableInsight(userId, optimizations);
        }
      }
      
    } catch (error) {
      this.logger.error('Action pattern analysis failed', {
        user_id: actionData.userId,
        error: error.message
      });
    }
  }

  /**
   * Generate actionable insights from patterns
   */
  async generateRequestInsights(patterns, currentRequest) {
    const insightPrompt = `Based on user workflow patterns, generate actionable insights:

CURRENT REQUEST:
Intent: ${currentRequest.context.intent?.intent}
Message Type: ${currentRequest.context.messageType}
Tools Mentioned: ${currentRequest.context.tools_mentioned?.join(', ') || 'none'}
Urgency: ${currentRequest.context.urgency}

PATTERNS DETECTED:
Frequent Intents: ${JSON.stringify(patterns.frequent_intents)}
Tool Usage: ${JSON.stringify(patterns.tool_mentions)}
Urgency Patterns: ${JSON.stringify(patterns.urgency_patterns)}

Generate insights in this JSON format:
{
  "key_observations": [
    "observation 1",
    "observation 2"
  ],
  "actionable_suggestions": [
    {
      "suggestion": "specific suggestion",
      "rationale": "why this helps",
      "implementation": "how to implement",
      "priority": "high|medium|low",
      "estimated_time_savings": "hours per week",
      "category": "automation|tool|workflow|integration"
    }
  ],
  "automation_opportunities": [
    {
      "process": "what to automate",
      "trigger": "when to trigger",
      "tools": ["required tools"],
      "complexity": "easy|moderate|complex"
    }
  ]
}`;

    try {
      // Create a mock signal object for the AI analyzer
      const mockSignal = {
        id: 'insight_generation',
        title: 'Workflow Pattern Analysis',
        content: insightPrompt,
        url: 'internal://insight-generation'
      };
      
      const analysis = await this.aiAnalyzer.analyzeSignal(mockSignal, {
        analysisType: 'workflow_insights'
      });
      
      const response = analysis.analysis || analysis.summary || analysis.toString();
      
      // Try to parse as JSON, fallback to extracting insights from text
      try {
        return JSON.parse(response);
      } catch (parseError) {
        // Extract insights from text response
        return this.parseInsightsFromText(response);
      }
      
    } catch (error) {
      this.logger.warn('Insight generation failed, using fallback', { error: error.message });
      return this.generateFallbackInsights(patterns, currentRequest);
    }
  }

  /**
   * Parse insights from AI text response when JSON parsing fails
   */
  parseInsightsFromText(response) {
    const insights = {
      key_observations: [],
      actionable_suggestions: [],
      automation_opportunities: []
    };
    
    // Extract key observations from Claude's analysis
    if (response.includes('trend') || response.includes('pattern') || response.includes('indicates')) {
      insights.key_observations.push("AI detected workflow patterns in your recent activity");
    }
    
    // Generate actionable suggestions based on Claude's analysis
    if (response.includes('automation') || response.includes('automate')) {
      insights.actionable_suggestions.push({
        suggestion: "Set up workflow automation for repetitive tasks",
        rationale: "AI analysis shows interest in automation solutions",
        implementation: "Use tools like Zapier or Microsoft Power Automate to connect your apps",
        priority: "high",
        estimated_time_savings: "2-3 hours per week",
        category: "automation"
      });
      
      insights.automation_opportunities.push({
        process: "Weekly reporting automation",
        trigger: "Recurring manual reporting tasks",
        tools: ["Zapier", "Google Sheets", "Slack"],
        complexity: "moderate"
      });
    }
    
    if (response.includes('tool') || response.includes('software')) {
      insights.actionable_suggestions.push({
        suggestion: "Consolidate your tool stack for better workflow",
        rationale: "Multiple tool mentions suggest potential integration opportunities",
        implementation: "Review current tools and identify integration possibilities",
        priority: "medium",
        estimated_time_savings: "1-2 hours per week",
        category: "tool"
      });
    }
    
    if (response.includes('integration') || response.includes('connect')) {
      insights.actionable_suggestions.push({
        suggestion: "Implement tool integrations for seamless workflow",
        rationale: "AI detected interest in connecting different platforms",
        implementation: "Set up integrations between Slack, Notion, and other tools",
        priority: "medium",
        estimated_time_savings: "1-2 hours per week",
        category: "integration"
      });
    }
    
    return insights;
  }

  /**
   * Generate fallback insights when AI fails
   */
  generateFallbackInsights(patterns, currentRequest) {
    const insights = {
      key_observations: [],
      actionable_suggestions: [],
      automation_opportunities: []
    };
    
    // Analyze frequent intents
    const topIntent = patterns.frequent_intents[0];
    if (topIntent && topIntent.count >= 3) {
      insights.key_observations.push(`You frequently ask for ${topIntent.intent} (${topIntent.count} times recently)`);
      
      if (topIntent.intent === 'task_automation') {
        insights.actionable_suggestions.push({
          suggestion: "Set up workflow automation templates",
          rationale: "You frequently ask about automation",
          implementation: "Create Zapier workflows or use built-in automation tools",
          priority: "high",
          estimated_time_savings: "2-3 hours per week",
          category: "automation"
        });
      }
    }
    
    // Analyze tool mentions
    const topTool = patterns.tool_mentions[0];
    if (topTool && topTool.count >= 2) {
      insights.actionable_suggestions.push({
        suggestion: `Optimize your ${topTool.tool} workflow`,
        rationale: `You mention ${topTool.tool} frequently (${topTool.count} times)`,
        implementation: `Review ${topTool.tool} integrations and automation options`,
        priority: "medium",
        estimated_time_savings: "1-2 hours per week",
        category: "tool"
      });
    }
    
    return insights;
  }

  /**
   * Find frequent user intents
   */
  findFrequentIntents(requests) {
    const intentCounts = {};
    
    requests.forEach(req => {
      const intent = req.context?.intent?.intent || 'unknown';
      intentCounts[intent] = (intentCounts[intent] || 0) + 1;
    });
    
    return Object.entries(intentCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([intent, count]) => ({ intent, count }));
  }

  /**
   * Analyze tool mention patterns
   */
  analyzeToolMentionPatterns(requests) {
    const toolCounts = {};
    
    requests.forEach(req => {
      (req.context?.tools_mentioned || []).forEach(tool => {
        toolCounts[tool] = (toolCounts[tool] || 0) + 1;
      });
    });
    
    return Object.entries(toolCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([tool, count]) => ({ tool, count }));
  }

  /**
   * Analyze urgency patterns
   */
  analyzeUrgencyPatterns(requests) {
    const urgencyCounts = { high: 0, medium: 0, low: 0 };
    
    requests.forEach(req => {
      const urgency = req.context?.urgency || 'low';
      urgencyCounts[urgency]++;
    });
    
    return urgencyCounts;
  }

  /**
   * Analyze time patterns (when user is most active)
   */
  analyzeTimePatterns(requests) {
    const hourCounts = {};
    
    requests.forEach(req => {
      const hour = new Date(req.timestamp).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });
    
    const sortedHours = Object.entries(hourCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3);
    
    return {
      most_active_hours: sortedHours.map(([hour, count]) => ({ hour: parseInt(hour), count })),
      total_requests: requests.length
    };
  }

  /**
   * Identify recurring themes in requests
   */
  identifyRecurringThemes(requests) {
    const themes = {};
    
    requests.forEach(req => {
      const concepts = req.context?.entities?.concepts || [];
      concepts.forEach(concept => {
        themes[concept] = (themes[concept] || 0) + 1;
      });
    });
    
    return Object.entries(themes)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([theme, count]) => ({ theme, count }));
  }

  /**
   * Check if patterns are significant enough to generate insights
   */
  hasSignificantPatterns(patterns) {
    return (
      patterns.frequent_intents.length > 0 &&
      patterns.frequent_intents[0].count >= Math.min(2, this.options.minPatternOccurrences) // Lower threshold for demo
    ) || (
      patterns.tool_mentions.length > 0 &&
      patterns.tool_mentions[0].count >= 2
    );
  }

  /**
   * Find repeated actions that could be automated
   */
  findRepeatedActions(actions) {
    const actionCounts = {};
    
    actions.forEach(action => {
      const key = `${action.context.actionType}_${JSON.stringify(action.action)}`;
      actionCounts[key] = (actionCounts[key] || 0) + 1;
    });
    
    return Object.entries(actionCounts)
      .filter(([,count]) => count >= 3)
      .sort(([,a], [,b]) => b - a)
      .map(([action, count]) => ({ action, count }));
  }

  /**
   * Find incomplete workflows
   */
  findIncompleteWorkflows(actions) {
    return actions.filter(action => 
      action.context.completion_status === 'incomplete' ||
      action.context.follow_up_needed === true ||
      action.context.success === false
    );
  }

  /**
   * Analyze tool switching patterns
   */
  analyzeToolSwitching(actions) {
    const toolSwitches = [];
    let lastTool = null;
    
    actions.forEach(action => {
      const tools = action.context.tools_used || [];
      if (tools.length > 0) {
        const currentTool = tools[0];
        if (lastTool && lastTool !== currentTool) {
          toolSwitches.push({ from: lastTool, to: currentTool, timestamp: action.timestamp });
        }
        lastTool = currentTool;
      }
    });
    
    return toolSwitches;
  }

  /**
   * Analyze time inefficiencies
   */
  analyzeTimeInefficiencies(actions) {
    const timeData = actions
      .filter(action => action.context.time_taken)
      .map(action => ({
        actionType: action.context.actionType,
        time_taken: action.context.time_taken
      }));
    
    // Group by action type and find average times
    const avgTimes = {};
    timeData.forEach(data => {
      if (!avgTimes[data.actionType]) {
        avgTimes[data.actionType] = { total: 0, count: 0 };
      }
      avgTimes[data.actionType].total += data.time_taken;
      avgTimes[data.actionType].count++;
    });
    
    return Object.entries(avgTimes).map(([actionType, data]) => ({
      actionType,
      average_time: data.total / data.count,
      occurrences: data.count
    }));
  }

  /**
   * Check if inefficiencies are significant
   */
  hasSignificantInefficiencies(inefficiencies) {
    return inefficiencies.repeated_actions.length > 0 ||
           inefficiencies.incomplete_workflows.length > 2 ||
           inefficiencies.tool_switching.length > 5;
  }

  /**
   * Generate optimization suggestions
   */
  async generateOptimizationSuggestions(inefficiencies, actionData) {
    // Simple rule-based optimization for now
    const suggestions = [];
    
    if (inefficiencies.repeated_actions.length > 0) {
      suggestions.push({
        suggestion: "Automate repeated actions",
        rationale: `You perform similar actions ${inefficiencies.repeated_actions[0].count} times`,
        implementation: "Set up automation rules or templates",
        priority: "high",
        category: "automation"
      });
    }
    
    if (inefficiencies.tool_switching.length > 5) {
      suggestions.push({
        suggestion: "Reduce tool switching",
        rationale: `You switch between tools ${inefficiencies.tool_switching.length} times`,
        implementation: "Use integrated tools or create unified workflows",
        priority: "medium",
        category: "workflow"
      });
    }
    
    return { suggestions };
  }

  /**
   * Get user's actionable insights (with access control)
   */
  async getUserActionableInsights(userId, limit = 10, requestingUserId = null, sessionId = null) {
    // If no requesting user specified, assume self-access
    const actualRequestingUserId = requestingUserId || userId;
    
    // Check access permissions
    if (!this.accessControl.canAccessUserData(actualRequestingUserId, userId, sessionId)) {
      this.accessControl.logAccessAttempt(actualRequestingUserId, 'getUserActionableInsights', userId, false, sessionId);
      throw new Error('Access denied: Insufficient permissions to view this user\'s insights');
    }
    
    this.accessControl.logAccessAttempt(actualRequestingUserId, 'getUserActionableInsights', userId, true, sessionId);
    const insights = this.actionableInsights.get(userId) || [];
    
    return insights
      .filter(insight => !insight.dismissed && !insight.completed)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Store workflow data with hierarchical organization
   */
  async storeWorkflowData(data) {
    const { userId, channelId, timestamp } = data;
    const dateKey = this.getDateKey(timestamp);
    
    // Initialize user structure if needed
    if (!this.userWorkflows.has(userId)) {
      this.userWorkflows.set(userId, new Map());
    }
    
    const userChannels = this.userWorkflows.get(userId);
    
    // Initialize channel structure if needed
    if (!userChannels.has(channelId)) {
      userChannels.set(channelId, new Map());
    }
    
    const channelDates = userChannels.get(channelId);
    
    // Initialize date structure if needed
    if (!channelDates.has(dateKey)) {
      channelDates.set(dateKey, []);
    }
    
    const dayInteractions = channelDates.get(dateKey);
    dayInteractions.push(data);
    
    // Cleanup old data (keep last 30 days per channel)
    this.cleanupOldData(userId, channelId);
    
    this.logger.debug('Stored workflow data', {
      user_id: userId,
      channel_id: channelId,
      date_key: dateKey,
      interactions_today: dayInteractions.length
    });
  }

  /**
   * Generate date key for organizing data
   */
  getDateKey(timestamp) {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  /**
   * Cleanup old workflow data
   */
  cleanupOldData(userId, channelId) {
    const userChannels = this.userWorkflows.get(userId);
    if (!userChannels) return;
    
    const channelDates = userChannels.get(channelId);
    if (!channelDates) return;
    
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const cutoffDateKey = this.getDateKey(thirtyDaysAgo);
    
    // Remove old date entries
    for (const [dateKey] of channelDates) {
      if (dateKey < cutoffDateKey) {
        channelDates.delete(dateKey);
      }
    }
    
    // If channel has no recent data, remove it
    if (channelDates.size === 0) {
      userChannels.delete(channelId);
    }
    
    // If user has no channels, remove user
    if (userChannels.size === 0) {
      this.userWorkflows.delete(userId);
    }
  }

  /**
   * Get user's recent workflow data with enhanced filtering
   */
  async getUserRecentWorkflow(userId, type = null, days = 7, channelId = null) {
    const userChannels = this.userWorkflows.get(userId);
    if (!userChannels) return [];
    
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const cutoffDateKey = this.getDateKey(cutoffDate);
    
    let allInteractions = [];
    
    // Iterate through channels
    for (const [currentChannelId, channelDates] of userChannels) {
      // Skip if filtering by specific channel
      if (channelId && currentChannelId !== channelId) continue;
      
      // Iterate through dates
      for (const [dateKey, dayInteractions] of channelDates) {
        // Skip if date is too old
        if (dateKey < cutoffDateKey) continue;
        
        // Filter by timestamp for partial day inclusion
        const validInteractions = dayInteractions.filter(item => 
          new Date(item.timestamp) >= cutoffDate
        );
        
        allInteractions.push(...validInteractions);
      }
    }
    
    // Filter by type if specified
    if (type) {
      allInteractions = allInteractions.filter(item => item.type === type);
    }
    
    return allInteractions.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get workflow data for specific channel
   */
  async getChannelWorkflow(userId, channelId, days = 7) {
    return this.getUserRecentWorkflow(userId, null, days, channelId);
  }

  /**
   * Get user's workflow analytics by channel
   */
  async getUserWorkflowByChannel(userId, days = 7) {
    const userChannels = this.userWorkflows.get(userId);
    if (!userChannels) return {};
    
    const channelAnalytics = {};
    
    for (const [channelId] of userChannels) {
      const channelData = await this.getChannelWorkflow(userId, channelId, days);
      
      if (channelData.length > 0) {
        channelAnalytics[channelId] = {
          total_interactions: channelData.length,
          inbound_requests: channelData.filter(d => d.type === 'inbound').length,
          outbound_actions: channelData.filter(d => d.type === 'outbound').length,
          channel_metadata: this.channelMetadata.get(channelId) || {},
          most_recent: channelData[0]?.timestamp,
          date_range: this.getChannelDateRange(channelData)
        };
      }
    }
    
    return channelAnalytics;
  }

  /**
   * Get date range for channel data
   */
  getChannelDateRange(channelData) {
    if (channelData.length === 0) return null;
    
    const timestamps = channelData.map(d => new Date(d.timestamp));
    const earliest = new Date(Math.min(...timestamps));
    const latest = new Date(Math.max(...timestamps));
    
    return {
      earliest: earliest.toISOString(),
      latest: latest.toISOString(),
      span_days: Math.ceil((latest - earliest) / (24 * 60 * 60 * 1000))
    };
  }

  /**
   * Store actionable insight
   */
  async storeActionableInsight(userId, insight) {
    if (!this.actionableInsights.has(userId)) {
      this.actionableInsights.set(userId, []);
    }
    
    const userInsights = this.actionableInsights.get(userId);
    
    // Prevent duplicate insights
    const isDuplicate = userInsights.some(existing => 
      existing.actionable_suggestions?.some(existingSugg =>
        insight.actionable_suggestions?.some(newSugg =>
          existingSugg.suggestion === newSugg.suggestion
        )
      )
    );
    
    if (isDuplicate) {
      return;
    }
    
    userInsights.push({
      ...insight,
      id: this.generateId(),
      timestamp: new Date(),
      dismissed: false,
      completed: false
    });
    
    // Keep only recent insights
    if (userInsights.length > this.options.maxInsightsPerUser) {
      userInsights.splice(0, userInsights.length - this.options.maxInsightsPerUser);
    }
    
    this.actionableInsights.set(userId, userInsights);
    
    this.logger.info('Stored actionable insight', {
      user_id: userId,
      suggestions_count: insight.actionable_suggestions?.length || 0
    });
  }

  /**
   * Mark insight as completed
   */
  async markInsightCompleted(userId, insightId) {
    const userInsights = this.actionableInsights.get(userId) || [];
    const insight = userInsights.find(i => i.id === insightId);
    
    if (insight) {
      insight.completed = true;
      insight.completed_at = new Date();
      
      this.logger.info('Insight marked as completed', {
        user_id: userId,
        insight_id: insightId
      });
    }
  }

  /**
   * Dismiss insight
   */
  async dismissInsight(userId, insightId) {
    const userInsights = this.actionableInsights.get(userId) || [];
    const insight = userInsights.find(i => i.id === insightId);
    
    if (insight) {
      insight.dismissed = true;
      insight.dismissed_at = new Date();
      
      this.logger.info('Insight dismissed', {
        user_id: userId,
        insight_id: insightId
      });
    }
  }

  /**
   * Check if user should receive insights (rate limiting)
   */
  shouldShareInsights(userId) {
    const lastShared = this.lastInsightShare.get(userId);
    const cooldownTime = this.options.insightCooldownHours * 60 * 60 * 1000;
    
    return !lastShared || (Date.now() - lastShared.getTime()) > cooldownTime;
  }

  /**
   * Mark that insights were shared with user
   */
  markInsightsShared(userId) {
    this.lastInsightShare.set(userId, new Date());
  }

  /**
   * Get enhanced workflow analytics for user (with access control)
   */
  async getUserWorkflowAnalytics(userId, days = 7, requestingUserId = null, sessionId = null) {
    // If no requesting user specified, assume self-access
    const actualRequestingUserId = requestingUserId || userId;
    
    // Check access permissions
    if (!this.accessControl.canAccessUserData(actualRequestingUserId, userId, sessionId)) {
      this.accessControl.logAccessAttempt(actualRequestingUserId, 'getUserWorkflowAnalytics', userId, false, sessionId);
      throw new Error('Access denied: Insufficient permissions to view this user\'s analytics');
    }
    
    this.accessControl.logAccessAttempt(actualRequestingUserId, 'getUserWorkflowAnalytics', userId, true, sessionId);
    const recentWorkflow = await this.getUserRecentWorkflow(userId, null, days);
    const inboundRequests = recentWorkflow.filter(w => w.type === 'inbound');
    const outboundActions = recentWorkflow.filter(w => w.type === 'outbound');
    const channelBreakdown = await this.getUserWorkflowByChannel(userId, days);
    
    return {
      user_id: userId,
      period_days: days,
      total_interactions: recentWorkflow.length,
      inbound_requests: inboundRequests.length,
      outbound_actions: outboundActions.length,
      active_insights: (await this.getUserActionableInsights(userId)).length,
      
      // Enhanced analytics
      channel_breakdown: channelBreakdown,
      daily_patterns: this.analyzeDailyPatterns(recentWorkflow),
      top_intents: this.findFrequentIntents(inboundRequests),
      tool_usage: this.analyzeToolMentionPatterns(recentWorkflow),
      urgency_distribution: this.analyzeUrgencyPatterns(inboundRequests),
      time_patterns: this.analyzeTimePatterns(recentWorkflow),
      
      // Context-aware insights
      most_active_channel: this.findMostActiveChannel(channelBreakdown),
      workflow_consistency: this.analyzeWorkflowConsistency(recentWorkflow),
      productivity_trends: this.analyzeProductivityTrends(recentWorkflow, days)
    };
  }

  /**
   * Analyze daily activity patterns
   */
  analyzeDailyPatterns(workflow) {
    const dailyStats = {};
    
    workflow.forEach(item => {
      const dateKey = this.getDateKey(item.timestamp);
      
      if (!dailyStats[dateKey]) {
        dailyStats[dateKey] = {
          date: dateKey,
          total: 0,
          inbound: 0,
          outbound: 0,
          channels: new Set(),
          peak_hour: null,
          hourly_distribution: {}
        };
      }
      
      const stats = dailyStats[dateKey];
      stats.total++;
      stats[item.type]++;
      stats.channels.add(item.channelId);
      
      // Track hourly distribution
      const hour = new Date(item.timestamp).getHours();
      stats.hourly_distribution[hour] = (stats.hourly_distribution[hour] || 0) + 1;
    });
    
    // Convert channels Set to count and find peak hours
    Object.values(dailyStats).forEach(stats => {
      stats.unique_channels = stats.channels.size;
      delete stats.channels;
      
      // Find peak hour
      const hourCounts = Object.entries(stats.hourly_distribution);
      if (hourCounts.length > 0) {
        const [peakHour] = hourCounts.reduce(([maxHour, maxCount], [hour, count]) => 
          count > maxCount ? [hour, count] : [maxHour, maxCount]
        );
        stats.peak_hour = parseInt(peakHour);
      }
    });
    
    return Object.values(dailyStats).sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Find most active channel
   */
  findMostActiveChannel(channelBreakdown) {
    const channels = Object.entries(channelBreakdown);
    if (channels.length === 0) return null;
    
    const [mostActiveChannelId, channelData] = channels.reduce(
      ([maxId, maxData], [channelId, data]) => 
        data.total_interactions > maxData.total_interactions ? [channelId, data] : [maxId, maxData]
    );
    
    return {
      channel_id: mostActiveChannelId,
      ...channelData
    };
  }

  /**
   * Analyze workflow consistency across time
   */
  analyzeWorkflowConsistency(workflow) {
    if (workflow.length < 2) return { consistency_score: 0, pattern: 'insufficient_data' };
    
    // Group by day and analyze patterns
    const dailyPatterns = this.analyzeDailyPatterns(workflow);
    
    if (dailyPatterns.length < 2) return { consistency_score: 0, pattern: 'insufficient_data' };
    
    // Calculate consistency metrics
    const dailyTotals = dailyPatterns.map(d => d.total);
    const mean = dailyTotals.reduce((sum, val) => sum + val, 0) / dailyTotals.length;
    const variance = dailyTotals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / dailyTotals.length;
    const stdDev = Math.sqrt(variance);
    const coefficient = mean > 0 ? stdDev / mean : 1;
    
    // Consistency score (0-1, higher is more consistent)
    const consistencyScore = Math.max(0, 1 - coefficient);
    
    let pattern = 'irregular';
    if (consistencyScore > 0.8) pattern = 'very_consistent';
    else if (consistencyScore > 0.6) pattern = 'consistent';
    else if (consistencyScore > 0.4) pattern = 'somewhat_consistent';
    
    return {
      consistency_score: Math.round(consistencyScore * 100) / 100,
      pattern,
      daily_average: Math.round(mean * 100) / 100,
      daily_std_dev: Math.round(stdDev * 100) / 100,
      most_active_day: dailyPatterns.reduce((max, day) => 
        day.total > max.total ? day : max
      ).date
    };
  }

  /**
   * Analyze productivity trends over time
   */
  analyzeProductivityTrends(workflow, days) {
    const dailyPatterns = this.analyzeDailyPatterns(workflow);
    
    if (dailyPatterns.length < 3) {
      return { trend: 'insufficient_data', slope: 0 };
    }
    
    // Calculate trend using linear regression
    const n = dailyPatterns.length;
    const xSum = dailyPatterns.reduce((sum, _, index) => sum + index, 0);
    const ySum = dailyPatterns.reduce((sum, day) => sum + day.total, 0);
    const xySum = dailyPatterns.reduce((sum, day, index) => sum + (index * day.total), 0);
    const x2Sum = dailyPatterns.reduce((sum, _, index) => sum + (index * index), 0);
    
    const slope = (n * xySum - xSum * ySum) / (n * x2Sum - xSum * xSum);
    
    let trend = 'stable';
    if (slope > 0.5) trend = 'increasing';
    else if (slope < -0.5) trend = 'decreasing';
    
    return {
      trend,
      slope: Math.round(slope * 100) / 100,
      recent_activity: dailyPatterns.slice(-3).map(d => ({
        date: d.date,
        interactions: d.total
      })),
      weekly_average: Math.round((ySum / Math.min(days, dailyPatterns.length)) * 100) / 100
    };
  }

  /**
   * Initialize tool knowledge base
   */
  initializeToolKnowledge() {
    return {
      'slack': { category: 'communication', integrations: ['zapier', 'notion', 'github'] },
      'notion': { category: 'productivity', integrations: ['slack', 'zapier', 'figma'] },
      'zapier': { category: 'automation', integrations: ['slack', 'notion', 'airtable'] },
      'github': { category: 'development', integrations: ['slack', 'linear', 'figma'] },
      'figma': { category: 'design', integrations: ['notion', 'slack', 'github'] }
    };
  }

  /**
   * Initialize workflow templates
   */
  initializeWorkflowTemplates() {
    return [
      {
        name: 'Task Management Workflow',
        triggers: ['task', 'todo', 'project'],
        tools: ['notion', 'trello', 'asana'],
        automation_potential: 'high'
      },
      {
        name: 'Communication Workflow',
        triggers: ['meeting', 'message', 'update'],
        tools: ['slack', 'zoom', 'calendar'],
        automation_potential: 'medium'
      }
    ];
  }

  /**
   * Set channel metadata for better analytics
   */
  setChannelMetadata(channelId, metadata) {
    this.channelMetadata.set(channelId, {
      ...this.channelMetadata.get(channelId),
      ...metadata,
      last_updated: new Date()
    });
  }

  /**
   * Get channel metadata
   */
  getChannelMetadata(channelId) {
    return this.channelMetadata.get(channelId) || {};
  }

  /**
   * Get team-wide analytics across all channels (with access control)
   */
  async getTeamAnalytics(days = 7, requestingUserId = null, sessionId = null) {
    // Check if user can access team analytics
    if (requestingUserId && !this.accessControl.canAccessTeamAnalytics(requestingUserId, sessionId)) {
      this.accessControl.logAccessAttempt(requestingUserId, 'getTeamAnalytics', 'team_data', false, sessionId);
      throw new Error('Access denied: Insufficient permissions to view team analytics');
    }
    
    if (requestingUserId) {
      this.accessControl.logAccessAttempt(requestingUserId, 'getTeamAnalytics', 'team_data', true, sessionId);
    }
    const teamStats = {
      total_users: this.userWorkflows.size,
      total_interactions: 0,
      channels: {},
      daily_patterns: {},
      top_tools: {},
      top_intents: {}
    };
    
    // Aggregate data from all users
    for (const [userId, userChannels] of this.userWorkflows) {
      const userWorkflow = await this.getUserRecentWorkflow(userId, null, days);
      teamStats.total_interactions += userWorkflow.length;
      
      // Aggregate by channel
      for (const [channelId] of userChannels) {
        if (!teamStats.channels[channelId]) {
          teamStats.channels[channelId] = {
            unique_users: new Set(),
            total_interactions: 0,
            metadata: this.getChannelMetadata(channelId)
          };
        }
        
        const channelWorkflow = await this.getChannelWorkflow(userId, channelId, days);
        teamStats.channels[channelId].unique_users.add(userId);
        teamStats.channels[channelId].total_interactions += channelWorkflow.length;
      }
      
      // Aggregate tools and intents
      userWorkflow.forEach(item => {
        // Tools
        (item.context?.tools_mentioned || []).forEach(tool => {
          teamStats.top_tools[tool] = (teamStats.top_tools[tool] || 0) + 1;
        });
        
        // Intents (for inbound requests)
        if (item.type === 'inbound' && item.context?.intent?.intent) {
          const intent = item.context.intent.intent;
          teamStats.top_intents[intent] = (teamStats.top_intents[intent] || 0) + 1;
        }
        
        // Daily patterns
        const dateKey = this.getDateKey(item.timestamp);
        if (!teamStats.daily_patterns[dateKey]) {
          teamStats.daily_patterns[dateKey] = 0;
        }
        teamStats.daily_patterns[dateKey]++;
      });
    }
    
    // Convert Sets to counts and sort results
    Object.values(teamStats.channels).forEach(channel => {
      channel.unique_users = channel.unique_users.size;
    });
    
    teamStats.top_tools = Object.entries(teamStats.top_tools)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([tool, count]) => ({ tool, count }));
      
    teamStats.top_intents = Object.entries(teamStats.top_intents)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([intent, count]) => ({ intent, count }));
    
    return teamStats;
  }

  /**
   * Set user role and organization (delegate to access control)
   */
  setUserRole(userId, role, organizationId = null) {
    return this.accessControl.setUserRole(userId, role, organizationId);
  }

  /**
   * Set organization hierarchy (delegate to access control)
   */
  setOrganizationHierarchy(organizationId, hierarchy) {
    return this.accessControl.setOrganizationHierarchy(organizationId, hierarchy);
  }

  /**
   * Create authenticated session (delegate to access control)
   */
  createSession(userId, additionalContext = {}) {
    return this.accessControl.createSession(userId, additionalContext);
  }

  /**
   * Get accessible users for a requesting user
   */
  async getAccessibleUsersAnalytics(requestingUserId, days = 7, sessionId = null) {
    const accessibleUsers = this.accessControl.getAccessibleUsers(requestingUserId, sessionId);
    const userAnalytics = {};
    
    for (const userId of accessibleUsers) {
      try {
        userAnalytics[userId] = await this.getUserWorkflowAnalytics(userId, days, requestingUserId, sessionId);
      } catch (error) {
        // Skip users that can't be accessed (shouldn't happen with proper access control)
        this.logger.warn('Skipped user analytics due to access error', {
          requesting_user: requestingUserId,
          target_user: userId,
          error: error.message
        });
      }
    }
    
    return {
      requesting_user: requestingUserId,
      accessible_users: accessibleUsers,
      analytics: userAnalytics,
      generated_at: new Date().toISOString()
    };
  }

  /**
   * Get filtered team analytics based on user role
   */
  async getFilteredTeamAnalytics(requestingUserId, days = 7, sessionId = null) {
    // Get full team analytics (with permission check)
    const fullAnalytics = await this.getTeamAnalytics(days, requestingUserId, sessionId);
    
    // Filter based on user permissions
    const filteredAnalytics = this.accessControl.filterAnalyticsData(requestingUserId, fullAnalytics, sessionId);
    
    return filteredAnalytics;
  }

  /**
   * Get user permissions and role information
   */
  getUserPermissions(userId) {
    return this.accessControl.getUserPermissions(userId);
  }

  /**
   * Initialize demo organization for testing
   */
  initializeDemoOrganization() {
    return this.accessControl.initializeDemoOrganization();
  }

  /**
   * Generate unique ID
   */
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}

module.exports = WorkflowIntelligenceSystem;
