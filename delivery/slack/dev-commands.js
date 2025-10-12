/**
 * Slack Developer Commands
 * 
 * Slash commands for developers:
 * - /jarvis sprint - Get current sprint status
 * - /jarvis blockers - Show all blocked tickets
 * - /jarvis deploy - Get deployment pipeline status
 * - /jarvis velocity - Show team velocity trends
 * - /jarvis standup - Generate standup summary
 * 
 * Features:
 * 1. Rich interactive responses
 * 2. Real-time data from JIRA and GitHub
 * 3. Actionable buttons and links
 * 4. Team collaboration features
 */

const winston = require('winston');

class DevCommands {
  constructor(services, options = {}) {
    this.services = services; // jiraService, githubActionsService, sprintAnalyzer, etc.
    
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
        new winston.transports.File({ filename: 'logs/slack-dev-commands.log' })
      ],
      defaultMeta: { service: 'slack-dev-commands' }
    });

    this.logger.info('Slack Dev Commands initialized');
  }

  /**
   * Register commands with Slack app
   */
  register(slackApp) {
    slackApp.command('/jarvis-sprint', this.handleSprintCommand.bind(this));
    slackApp.command('/jarvis-blockers', this.handleBlockersCommand.bind(this));
    slackApp.command('/jarvis-deploy', this.handleDeployCommand.bind(this));
    slackApp.command('/jarvis-velocity', this.handleVelocityCommand.bind(this));
    slackApp.command('/jarvis-standup', this.handleStandupCommand.bind(this));

    this.logger.info('Developer commands registered');
  }

  /**
   * Handle /jarvis-sprint command
   */
  async handleSprintCommand({ command, ack, respond }) {
    await ack();

    try {
      this.logger.info('Sprint command received', {
        userId: command.user_id,
        text: command.text
      });

      // Parse sprint ID from command text (or use current sprint)
      const sprintId = command.text.trim() || this._getCurrentSprintId();

      if (!sprintId) {
        await respond({
          response_type: 'ephemeral',
          text: '⚠️ Please specify a sprint ID or configure the current sprint.'
        });
        return;
      }

      // Generate sprint report
      const report = await this.services.sprintAnalyzer.generateSprintReport(sprintId);

      // Build Slack response
      const response = {
        response_type: 'in_channel',
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: `📊 Sprint Status: ${report.sprint_name || sprintId}`,
              emoji: true
            }
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: report.summary
            }
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*Completion:*\n${report.quick_stats.completion_rate}`
              },
              {
                type: 'mrkdwn',
                text: `*Blocked Issues:*\n${report.quick_stats.blocked_issues}`
              },
              {
                type: 'mrkdwn',
                text: `*Days Remaining:*\n${report.quick_stats.days_remaining}`
              },
              {
                type: 'mrkdwn',
                text: `*Risk Level:*\n${this._getRiskEmoji(report.quick_stats.risk_level)} ${report.quick_stats.risk_level.toUpperCase()}`
              }
            ]
          },
          {
            type: 'divider'
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Issues Breakdown:*\n• Completed: ${report.metrics.velocity.completed_issues}\n• In Progress: ${report.metrics.velocity.in_progress_issues}\n• To Do: ${report.metrics.velocity.todo_issues}\n• Blocked: ${report.metrics.velocity.blocked_issues}`
            }
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: '📋 View in JIRA'
                },
                url: `${process.env.JIRA_SITE_URL}/sprint/${sprintId}`,
                style: 'primary'
              },
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: '🚨 Show Blockers'
                },
                action_id: 'show_blockers'
              }
            ]
          }
        ]
      };

      await respond(response);

      this.logger.info('Sprint command completed', {
        userId: command.user_id,
        sprintId
      });

    } catch (error) {
      this.logger.error('Sprint command failed', {
        userId: command.user_id,
        error: error.message
      });

      await respond({
        response_type: 'ephemeral',
        text: `❌ Failed to fetch sprint status: ${error.message}`
      });
    }
  }

  /**
   * Handle /jarvis-blockers command
   */
  async handleBlockersCommand({ command, ack, respond }) {
    await ack();

    try {
      this.logger.info('Blockers command received', {
        userId: command.user_id
      });

      const sprintId = this._getCurrentSprintId();

      if (!sprintId) {
        await respond({
          response_type: 'ephemeral',
          text: '⚠️ Current sprint not configured.'
        });
        return;
      }

      // Get bottlenecks (includes blockers)
      const bottlenecks = await this.services.sprintAnalyzer.identifyBottlenecks(sprintId);
      const blockedBottlenecks = bottlenecks.filter(b => b.type === 'blocked_issues');

      if (blockedBottlenecks.length === 0) {
        await respond({
          response_type: 'in_channel',
          text: '🎉 Great news! There are no blocked issues in the current sprint.'
        });
        return;
      }

      // Build blocks for each blocker
      const blocks = [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🚨 Blocked Issues',
            emoji: true
          }
        }
      ];

      blockedBottlenecks.forEach(blocker => {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${blocker.description}*\n_Severity: ${blocker.severity.toUpperCase()}_`
          }
        });

        // Add issue list
        if (blocker.issues && blocker.issues.length > 0) {
          const issueList = blocker.issues.map(issue => 
            `• <${process.env.JIRA_SITE_URL}/browse/${issue.key}|${issue.key}>: ${issue.summary}`
          ).join('\n');

          blocks.push({
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: issueList
            }
          });
        }

        blocks.push({
          type: 'divider'
        });
      });

      // Add action button
      blocks.push({
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '📋 View Sprint Board'
            },
            url: `${process.env.JIRA_SITE_URL}/sprint/${sprintId}`,
            style: 'primary'
          }
        ]
      });

      await respond({
        response_type: 'in_channel',
        blocks
      });

      this.logger.info('Blockers command completed', {
        userId: command.user_id,
        blockerCount: blockedBottlenecks.length
      });

    } catch (error) {
      this.logger.error('Blockers command failed', {
        userId: command.user_id,
        error: error.message
      });

      await respond({
        response_type: 'ephemeral',
        text: `❌ Failed to fetch blockers: ${error.message}`
      });
    }
  }

  /**
   * Handle /jarvis-deploy command
   */
  async handleDeployCommand({ command, ack, respond }) {
    await ack();

    try {
      this.logger.info('Deploy command received', {
        userId: command.user_id,
        text: command.text
      });

      const environment = command.text.trim() || 'production';

      // Get recent deployments
      const deployments = await this.services.githubActionsService.getRecentDeploymentsWithStatus({
        environment,
        limit: 5
      });

      if (deployments.length === 0) {
        await respond({
          response_type: 'ephemeral',
          text: `No recent deployments found for ${environment}.`
        });
        return;
      }

      const latestDeployment = deployments[0];
      const statusEmoji = this._getDeploymentStatusEmoji(latestDeployment.current_status);

      // Build Slack response
      const blocks = [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `🚀 Deployment Status: ${environment}`,
            emoji: true
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `${statusEmoji} *Latest Deployment*\n*Status:* ${latestDeployment.current_status}\n*SHA:* \`${latestDeployment.sha.substring(0, 7)}\`\n*Deployed:* ${new Date(latestDeployment.created_at).toLocaleString()}`
          }
        },
        {
          type: 'divider'
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*Recent Deployments:*'
          }
        }
      ];

      // Add recent deployments list
      deployments.slice(0, 3).forEach(deploy => {
        const emoji = this._getDeploymentStatusEmoji(deploy.current_status);
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `${emoji} \`${deploy.sha.substring(0, 7)}\` - ${deploy.current_status} - ${new Date(deploy.created_at).toLocaleTimeString()}`
          },
          accessory: {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View'
            },
            url: deploy.url
          }
        });
      });

      await respond({
        response_type: 'in_channel',
        blocks
      });

      this.logger.info('Deploy command completed', {
        userId: command.user_id,
        environment
      });

    } catch (error) {
      this.logger.error('Deploy command failed', {
        userId: command.user_id,
        error: error.message
      });

      await respond({
        response_type: 'ephemeral',
        text: `❌ Failed to fetch deployment status: ${error.message}`
      });
    }
  }

  /**
   * Handle /jarvis-velocity command
   */
  async handleVelocityCommand({ command, ack, respond }) {
    await ack();

    try {
      this.logger.info('Velocity command received', {
        userId: command.user_id
      });

      const sprintId = this._getCurrentSprintId();

      if (!sprintId) {
        await respond({
          response_type: 'ephemeral',
          text: '⚠️ Current sprint not configured.'
        });
        return;
      }

      const velocity = await this.services.sprintAnalyzer.calculateVelocity(sprintId);

      const response = {
        response_type: 'in_channel',
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: '📈 Sprint Velocity',
              emoji: true
            }
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*Completion Rate:*\n${Math.round(velocity.completion_rate * 100)}%`
              },
              {
                type: 'mrkdwn',
                text: `*Velocity Rate:*\n${Math.round(velocity.velocity_rate * 100)}%`
              },
              {
                type: 'mrkdwn',
                text: `*Story Points:*\n${velocity.completed_story_points}/${velocity.total_story_points}`
              },
              {
                type: 'mrkdwn',
                text: `*Issues Completed:*\n${velocity.completed_issues}/${velocity.total_issues}`
              }
            ]
          },
          {
            type: 'divider'
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '*By Issue Type:*'
            }
          }
        ]
      };

      // Add by_type breakdown
      Object.entries(velocity.by_type).forEach(([type, data]) => {
        response.blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `• *${type}*: ${data.count} issues (${data.story_points} points)`
          }
        });
      });

      await respond(response);

      this.logger.info('Velocity command completed', {
        userId: command.user_id,
        sprintId
      });

    } catch (error) {
      this.logger.error('Velocity command failed', {
        userId: command.user_id,
        error: error.message
      });

      await respond({
        response_type: 'ephemeral',
        text: `❌ Failed to fetch velocity: ${error.message}`
      });
    }
  }

  /**
   * Handle /jarvis-standup command
   */
  async handleStandupCommand({ command, ack, respond }) {
    await ack();

    try {
      this.logger.info('Standup command received', {
        userId: command.user_id
      });

      const sprintId = this._getCurrentSprintId();

      if (!sprintId) {
        await respond({
          response_type: 'ephemeral',
          text: '⚠️ Current sprint not configured.'
        });
        return;
      }

      const report = await this.services.sprintAnalyzer.generateSprintReport(sprintId);

      const response = {
        response_type: 'in_channel',
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: '📊 Daily Standup Summary',
              emoji: true
            }
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: report.summary
            }
          },
          {
            type: 'divider'
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*Completion:* ${report.quick_stats.completion_rate}`
              },
              {
                type: 'mrkdwn',
                text: `*Blocked:* ${report.quick_stats.blocked_issues} issues`
              },
              {
                type: 'mrkdwn',
                text: `*Days Left:* ${report.quick_stats.days_remaining}`
              },
              {
                type: 'mrkdwn',
                text: `*Risk:* ${this._getRiskEmoji(report.quick_stats.risk_level)} ${report.quick_stats.risk_level}`
              }
            ]
          }
        ]
      };

      // Add blockers if any
      if (report.quick_stats.blocked_issues > 0) {
        response.blocks.push({
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `⚠️ _${report.quick_stats.blocked_issues} issue(s) need immediate attention. Use \`/jarvis-blockers\` for details._`
            }
          ]
        });
      }

      await respond(response);

      this.logger.info('Standup command completed', {
        userId: command.user_id,
        sprintId
      });

    } catch (error) {
      this.logger.error('Standup command failed', {
        userId: command.user_id,
        error: error.message
      });

      await respond({
        response_type: 'ephemeral',
        text: `❌ Failed to generate standup summary: ${error.message}`
      });
    }
  }

  /**
   * Get current sprint ID (placeholder - would get from context/config)
   */
  _getCurrentSprintId() {
    // In production, this would:
    // 1. Check user/team configuration
    // 2. Query JIRA for active sprint
    // 3. Use cached sprint ID
    return process.env.CURRENT_SPRINT_ID || null;
  }

  /**
   * Get risk emoji
   */
  _getRiskEmoji(riskLevel) {
    switch (riskLevel) {
      case 'low':
        return '✅';
      case 'medium':
        return '⚠️';
      case 'high':
        return '🚨';
      default:
        return '❓';
    }
  }

  /**
   * Get deployment status emoji
   */
  _getDeploymentStatusEmoji(status) {
    switch (status) {
      case 'success':
        return '✅';
      case 'failure':
      case 'error':
        return '❌';
      case 'pending':
      case 'in_progress':
        return '⏳';
      default:
        return '❓';
    }
  }
}

module.exports = DevCommands;


