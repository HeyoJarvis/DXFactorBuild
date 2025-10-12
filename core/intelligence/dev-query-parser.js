/**
 * Developer Query Parser
 * 
 * Parses natural language queries from developers and routes to appropriate services:
 * - Intent detection (ticket, code, deploy, sprint, team)
 * - Entity extraction (sprint ID, ticket key, team member, environment)
 * - Query routing to relevant services
 * - Response formatting
 * 
 * Features:
 * 1. Natural language understanding
 * 2. Context-aware query interpretation
 * 3. Multi-service orchestration
 * 4. Rich response formatting with links
 * 5. Query history and learning
 */

const winston = require('winston');
const EventEmitter = require('events');

class DevQueryParser extends EventEmitter {
  constructor(services, options = {}) {
    super();
    
    this.services = services; // Object with jira, github, sprint, deployment, etc.
    
    this.options = {
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
          filename: 'logs/dev-query-parser.log',
          maxsize: 5242880, // 5MB
          maxFiles: 5
        })
      ],
      defaultMeta: { service: 'dev-query-parser' }
    });

    // Intent patterns
    this.intentPatterns = {
      sprint_status: [
        /sprint\s+(status|progress|health)/i,
        /how\s+(is|are)\s+(?:the\s+)?(?:current\s+)?sprint/i,
        /what'?s\s+(?:the\s+)?sprint\s+(?:status|looking\s+like)/i,
        /summarize\s+(?:the\s+)?(?:current\s+)?sprint/i
      ],
      blockers: [
        /what'?s\s+block(?:ing|ed)/i,
        /show\s+(?:me\s+)?block(?:ers|ed)/i,
        /block(?:ing|ed)\s+(?:issues|tickets|deploy)/i,
        /what\s+is\s+preventing/i
      ],
      deployment_status: [
        /deploy(?:ment)?\s+status/i,
        /what\s+(?:was|is)\s+deploy(?:ed|ing)/i,
        /(?:production|staging)\s+deploy/i,
        /ci\/cd\s+status/i,
        /pipeline\s+status/i
      ],
      ticket_query: [
        /(?:show|get|find)\s+(?:me\s+)?(?:ticket|issue|bug)s?/i,
        /my\s+(?:ticket|issue|bug)s/i,
        /[A-Z]+-\d+/i, // Direct ticket reference
        /high\s+priority\s+(?:ticket|issue|bug)s/i
      ],
      pr_review: [
        /(?:pr|pull\s+request)s?\s+(?:to\s+)?review/i,
        /what\s+pr/i,
        /need(?:s)?\s+(?:my\s+)?review/i,
        /review\s+queue/i
      ],
      velocity: [
        /velocity/i,
        /(?:team|sprint)\s+performance/i,
        /how\s+(?:fast|quick)/i
      ],
      standup: [
        /standup/i,
        /daily\s+update/i,
        /what\s+did\s+(?:i|we)/i,
        /progress\s+(?:report|update)/i
      ]
    };

    this.logger.info('Dev Query Parser initialized');
  }

  /**
   * Parse and execute developer query
   */
  async parseAndExecute(query, context = {}) {
    try {
      this.logger.info('Parsing developer query', {
        query: query.substring(0, 100),
        contextKeys: Object.keys(context)
      });

      // Detect intent
      const intent = this._detectIntent(query);
      
      // Extract entities
      const entities = this._extractEntities(query, context);

      this.logger.debug('Intent and entities detected', {
        intent,
        entities
      });

      // Route to appropriate handler
      const result = await this._routeQuery(intent, entities, query, context);

      this.emit('query_executed', {
        intent,
        entities,
        success: true
      });

      return result;

    } catch (error) {
      this.logger.error('Failed to parse and execute query', {
        query,
        error: error.message
      });

      this.emit('query_failed', {
        query,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Detect query intent
   */
  _detectIntent(query) {
    for (const [intent, patterns] of Object.entries(this.intentPatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(query)) {
          return intent;
        }
      }
    }
    return 'general';
  }

  /**
   * Extract entities from query
   */
  _extractEntities(query, context) {
    const entities = {};

    // Extract ticket keys
    const ticketPattern = /[A-Z]+-\d+/g;
    const tickets = query.match(ticketPattern);
    if (tickets) {
      entities.ticket_keys = tickets;
    }

    // Extract sprint references
    if (/current\s+sprint/i.test(query)) {
      entities.sprint = 'current';
    } else if (/last\s+sprint/i.test(query)) {
      entities.sprint = 'last';
    } else if (/next\s+sprint/i.test(query)) {
      entities.sprint = 'next';
    }

    // Extract environment
    if (/production|prod/i.test(query)) {
      entities.environment = 'production';
    } else if (/staging|stage/i.test(query)) {
      entities.environment = 'staging';
    }

    // Extract priority
    if (/high\s+priority|critical|urgent/i.test(query)) {
      entities.priority = 'high';
    }

    // Extract status
    if (/in\s+progress/i.test(query)) {
      entities.status = 'in_progress';
    } else if (/blocked/i.test(query)) {
      entities.status = 'blocked';
    } else if (/done|completed/i.test(query)) {
      entities.status = 'done';
    }

    // Extract assignee (from context or query)
    if (/my|mine|assigned\s+to\s+me/i.test(query)) {
      entities.assignee = context.currentUser || 'current_user';
    }

    // Extract team member mentions
    const mentionPattern = /@(\w+)/g;
    const mentions = query.match(mentionPattern);
    if (mentions) {
      entities.mentioned_users = mentions.map(m => m.substring(1));
    }

    return entities;
  }

  /**
   * Route query to appropriate handler
   */
  async _routeQuery(intent, entities, query, context) {
    switch (intent) {
      case 'sprint_status':
        return await this._handleSprintStatus(entities, context);
      
      case 'blockers':
        return await this._handleBlockers(entities, context);
      
      case 'deployment_status':
        return await this._handleDeploymentStatus(entities, context);
      
      case 'ticket_query':
        return await this._handleTicketQuery(entities, context);
      
      case 'pr_review':
        return await this._handlePRReview(entities, context);
      
      case 'velocity':
        return await this._handleVelocity(entities, context);
      
      case 'standup':
        return await this._handleStandup(entities, context);
      
      default:
        return {
          intent: 'general',
          response: 'I can help you with sprint status, blockers, deployments, tickets, PRs, and more. Try asking "What\'s the current sprint status?" or "Show me blocked tickets".',
          suggestions: [
            'What\'s the current sprint status?',
            'Show me blocked tickets',
            'What\'s deployed to production?',
            'What PRs need my review?'
          ]
        };
    }
  }

  /**
   * Handle sprint status query
   */
  async _handleSprintStatus(entities, context) {
    try {
      this.logger.info('Handling sprint status query');

      if (!this.services.sprintAnalyzer) {
        throw new Error('Sprint analyzer not available');
      }

      // Get current sprint (simplified - would need to get from JIRA)
      const sprintId = context.currentSprintId || entities.sprint_id;
      
      if (!sprintId) {
        return {
          intent: 'sprint_status',
          response: 'Please specify a sprint ID or configure the current sprint.',
          error: 'no_sprint_specified'
        };
      }

      const report = await this.services.sprintAnalyzer.generateSprintReport(sprintId);

      return {
        intent: 'sprint_status',
        response: report.summary,
        data: report,
        quick_stats: report.quick_stats,
        links: [
          {
            text: 'View in JIRA',
            url: `${context.jiraSiteUrl}/sprint/${sprintId}`
          }
        ]
      };

    } catch (error) {
      this.logger.error('Failed to handle sprint status query', {
        error: error.message
      });
      return {
        intent: 'sprint_status',
        response: 'Sorry, I couldn\'t fetch the sprint status. ' + error.message,
        error: error.message
      };
    }
  }

  /**
   * Handle blockers query
   */
  async _handleBlockers(entities, context) {
    try {
      this.logger.info('Handling blockers query');

      if (!this.services.sprintAnalyzer) {
        throw new Error('Sprint analyzer not available');
      }

      const sprintId = context.currentSprintId || entities.sprint_id;
      
      if (!sprintId) {
        return {
          intent: 'blockers',
          response: 'Please specify a sprint ID.',
          error: 'no_sprint_specified'
        };
      }

      const bottlenecks = await this.services.sprintAnalyzer.identifyBottlenecks(sprintId);
      const blockedBottlenecks = bottlenecks.filter(b => b.type === 'blocked_issues');

      if (blockedBottlenecks.length === 0) {
        return {
          intent: 'blockers',
          response: '🎉 Great news! There are no blocked issues in the current sprint.',
          data: { blockers: [] }
        };
      }

      const blockerSummary = blockedBottlenecks.map(b => 
        `• ${b.description} (${b.count} issue${b.count > 1 ? 's' : ''})`
      ).join('\n');

      return {
        intent: 'blockers',
        response: `⚠️ Found ${blockedBottlenecks[0].count} blocked issue(s):\n\n${blockerSummary}`,
        data: { blockers: blockedBottlenecks },
        action_items: blockedBottlenecks.map(b => ({
          title: 'Unblock issues',
          priority: b.severity,
          issues: b.issues
        }))
      };

    } catch (error) {
      this.logger.error('Failed to handle blockers query', {
        error: error.message
      });
      return {
        intent: 'blockers',
        response: 'Sorry, I couldn\'t fetch the blockers. ' + error.message,
        error: error.message
      };
    }
  }

  /**
   * Handle deployment status query
   */
  async _handleDeploymentStatus(entities, context) {
    try {
      this.logger.info('Handling deployment status query');

      if (!this.services.deploymentAnalyzer) {
        throw new Error('Deployment analyzer not available');
      }

      const environment = entities.environment || 'production';
      const deployments = await this.services.githubActionsService.getRecentDeploymentsWithStatus({
        environment,
        limit: 5
      });

      if (deployments.length === 0) {
        return {
          intent: 'deployment_status',
          response: `No recent deployments found for ${environment}.`,
          data: { deployments: [] }
        };
      }

      const latestDeployment = deployments[0];
      const statusEmoji = latestDeployment.current_status === 'success' ? '✅' : 
                          latestDeployment.current_status === 'failure' ? '❌' : '⏳';

      return {
        intent: 'deployment_status',
        response: `${statusEmoji} Latest ${environment} deployment: ${latestDeployment.current_status}\n\nSHA: ${latestDeployment.sha.substring(0, 7)}\nDeployed: ${new Date(latestDeployment.created_at).toLocaleString()}`,
        data: {
          environment,
          latest_deployment: latestDeployment,
          recent_deployments: deployments
        },
        links: [
          {
            text: 'View deployment',
            url: latestDeployment.url
          }
        ]
      };

    } catch (error) {
      this.logger.error('Failed to handle deployment status query', {
        error: error.message
      });
      return {
        intent: 'deployment_status',
        response: 'Sorry, I couldn\'t fetch the deployment status. ' + error.message,
        error: error.message
      };
    }
  }

  /**
   * Handle ticket query
   */
  async _handleTicketQuery(entities, context) {
    try {
      this.logger.info('Handling ticket query', { entities });

      if (!this.services.jiraService) {
        throw new Error('JIRA service not available');
      }

      // Build JQL query
      let jql = '';
      const conditions = [];

      if (entities.assignee === 'current_user' && context.currentUser) {
        conditions.push(`assignee = "${context.currentUser}"`);
      }

      if (entities.status) {
        conditions.push(`status = "${entities.status}"`);
      }

      if (entities.priority) {
        conditions.push(`priority = "${entities.priority}"`);
      }

      jql = conditions.length > 0 ? conditions.join(' AND ') : 'ORDER BY updated DESC';

      const result = await this.services.jiraService.getIssues(jql, {
        maxResults: 10
      });

      const ticketList = result.issues.map((issue, index) => 
        `${index + 1}. ${issue.key}: ${issue.summary} [${issue.status.name}]`
      ).join('\n');

      return {
        intent: 'ticket_query',
        response: `Found ${result.total} ticket(s):\n\n${ticketList}`,
        data: {
          total: result.total,
          tickets: result.issues
        },
        links: result.issues.slice(0, 3).map(issue => ({
          text: issue.key,
          url: issue.url
        }))
      };

    } catch (error) {
      this.logger.error('Failed to handle ticket query', {
        error: error.message
      });
      return {
        intent: 'ticket_query',
        response: 'Sorry, I couldn\'t fetch the tickets. ' + error.message,
        error: error.message
      };
    }
  }

  /**
   * Handle PR review query
   */
  async _handlePRReview(entities, context) {
    return {
      intent: 'pr_review',
      response: 'PR review tracking will be available soon. This requires additional GitHub API integration.',
      data: { prs: [] }
    };
  }

  /**
   * Handle velocity query
   */
  async _handleVelocity(entities, context) {
    try {
      this.logger.info('Handling velocity query');

      if (!this.services.sprintAnalyzer) {
        throw new Error('Sprint analyzer not available');
      }

      const sprintId = context.currentSprintId;
      
      if (!sprintId) {
        return {
          intent: 'velocity',
          response: 'Please specify a sprint ID.',
          error: 'no_sprint_specified'
        };
      }

      const velocity = await this.services.sprintAnalyzer.calculateVelocity(sprintId);

      return {
        intent: 'velocity',
        response: `Sprint Velocity:\n• Completion Rate: ${Math.round(velocity.completion_rate * 100)}%\n• Story Points: ${velocity.completed_story_points}/${velocity.total_story_points}\n• Issues: ${velocity.completed_issues}/${velocity.total_issues}`,
        data: velocity
      };

    } catch (error) {
      this.logger.error('Failed to handle velocity query', {
        error: error.message
      });
      return {
        intent: 'velocity',
        response: 'Sorry, I couldn\'t fetch the velocity data. ' + error.message,
        error: error.message
      };
    }
  }

  /**
   * Handle standup query
   */
  async _handleStandup(entities, context) {
    try {
      this.logger.info('Handling standup query');

      if (!this.services.sprintAnalyzer) {
        throw new Error('Sprint analyzer not available');
      }

      const sprintId = context.currentSprintId;
      
      if (!sprintId) {
        return {
          intent: 'standup',
          response: 'Please specify a sprint ID.',
          error: 'no_sprint_specified'
        };
      }

      const report = await this.services.sprintAnalyzer.generateSprintReport(sprintId);

      return {
        intent: 'standup',
        response: `📊 Standup Summary:\n\n${report.summary}\n\n**Quick Stats:**\n• Completion: ${report.quick_stats.completion_rate}\n• Blocked: ${report.quick_stats.blocked_issues}\n• Risk: ${report.quick_stats.risk_level}`,
        data: report
      };

    } catch (error) {
      this.logger.error('Failed to handle standup query', {
        error: error.message
      });
      return {
        intent: 'standup',
        response: 'Sorry, I couldn\'t generate the standup summary. ' + error.message,
        error: error.message
      };
    }
  }
}

module.exports = DevQueryParser;


