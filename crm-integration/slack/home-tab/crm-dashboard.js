/**
 * Slack CRM Home Tab Dashboard
 * 
 * Provides a real-time CRM dashboard directly in Slack's App Home tab
 * Features:
 * - Live pipeline health metrics
 * - Recent workflow changes
 * - Interactive buttons for CRM actions
 * - Real-time updates from background service
 */

const { App } = require('@slack/bolt');
const axios = require('axios');

class CRMDashboardHomeTab {
  constructor(backgroundServiceUrl = 'http://localhost:3001') {
    this.backgroundServiceUrl = backgroundServiceUrl;
    this.lastUpdateTime = new Map(); // userId -> last update time
    this.cachedData = new Map(); // userId -> cached dashboard data
  }

  /**
   * Register home tab event handlers with Slack app
   */
  register(app) {
    // Handle app home opened event
    app.event('app_home_opened', async ({ event, client, logger }) => {
      try {
        if (event.tab === 'home') {
          await this.publishHomeView(client, event.user);
        }
      } catch (error) {
        logger.error('Error publishing home view:', error);
      }
    });

    // Handle interactive button clicks
    app.action('refresh_dashboard', async ({ ack, body, client, logger }) => {
      await ack();
      try {
        await this.refreshDashboard(client, body.user.id, true);
      } catch (error) {
        logger.error('Error refreshing dashboard:', error);
      }
    });

    app.action('trigger_analysis', async ({ ack, body, client, logger }) => {
      await ack();
      try {
        await this.triggerAnalysis(client, body.user.id);
      } catch (error) {
        logger.error('Error triggering analysis:', error);
      }
    });

    app.action('view_insights', async ({ ack, body, client, logger }) => {
      await ack();
      try {
        await this.showInsightsModal(client, body.trigger_id, body.user.id);
      } catch (error) {
        logger.error('Error showing insights:', error);
      }
    });

    app.action('configure_alerts', async ({ ack, body, client, logger }) => {
      await ack();
      try {
        await this.showAlertConfigModal(client, body.trigger_id, body.user.id);
      } catch (error) {
        logger.error('Error showing alert config:', error);
      }
    });
  }

  /**
   * Publish the main home view
   */
  async publishHomeView(client, userId, forceRefresh = false) {
    try {
      const dashboardData = await this.getDashboardData(userId, forceRefresh);
      const homeView = this.buildHomeView(dashboardData);

      await client.views.publish({
        user_id: userId,
        view: homeView
      });

      this.lastUpdateTime.set(userId, new Date());
    } catch (error) {
      console.error('Error publishing home view:', error);
      
      // Publish error view
      await client.views.publish({
        user_id: userId,
        view: this.buildErrorView(error.message)
      });
    }
  }

  /**
   * Get dashboard data from background service
   */
  async getDashboardData(userId, forceRefresh = false) {
    const cacheKey = userId;
    const now = new Date();
    const lastUpdate = this.lastUpdateTime.get(userId);
    
    // Use cache if data is less than 2 minutes old and not forcing refresh
    if (!forceRefresh && lastUpdate && (now - lastUpdate) < 120000) {
      const cached = this.cachedData.get(cacheKey);
      if (cached) return cached;
    }

    try {
      // Get health data
      const healthResponse = await axios.get(`${this.backgroundServiceUrl}/health`);
      const health = healthResponse.data;

      // Get insights for default org
      const insightsResponse = await axios.get(`${this.backgroundServiceUrl}/insights/default_org`);
      const insights = insightsResponse.data;

      // Simulate getting current pipeline data (in production, this would be a real endpoint)
      const pipelineData = await this.getPipelineData();

      const dashboardData = {
        health,
        insights,
        pipeline: pipelineData,
        lastUpdated: now,
        organizationId: 'default_org'
      };

      this.cachedData.set(cacheKey, dashboardData);
      return dashboardData;

    } catch (error) {
      console.error('Error fetching dashboard data:', error.message);
      throw new Error(`Failed to fetch CRM data: ${error.message}`);
    }
  }

  /**
   * Get pipeline data (mock implementation - replace with real CRM data)
   */
  async getPipelineData() {
    return {
      totalDeals: 45,
      totalValue: 2850000,
      avgDealSize: 63333,
      conversionRate: 23.5,
      avgCycleTime: 67,
      stagnantDeals: 8,
      healthScore: 72,
      topStage: 'Proposal',
      recentActivity: [
        { type: 'deal_created', deal: 'Acme Corp - $125K', time: '2 hours ago' },
        { type: 'stage_change', deal: 'TechStart Inc - $89K', time: '4 hours ago' },
        { type: 'deal_won', deal: 'Global Solutions - $156K', time: '1 day ago' }
      ]
    };
  }

  /**
   * Build the main home view
   */
  buildHomeView(data) {
    const { health, insights, pipeline } = data;
    
    return {
      type: 'home',
      blocks: [
        // Header
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🏢 CRM Workflow Dashboard'
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Last Updated:* ${new Date().toLocaleString()}\n*Organization:* ${data.organizationId}`
          },
          accessory: {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '🔄 Refresh'
            },
            action_id: 'refresh_dashboard',
            style: 'primary'
          }
        },
        { type: 'divider' },

        // Pipeline Health Score
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: this.buildHealthScoreText(pipeline.healthScore)
          }
        },

        // Key Metrics
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*📊 Total Deals*\n${pipeline.totalDeals}`
            },
            {
              type: 'mrkdwn',
              text: `*💰 Pipeline Value*\n$${(pipeline.totalValue / 1000000).toFixed(1)}M`
            },
            {
              type: 'mrkdwn',
              text: `*📈 Avg Deal Size*\n$${(pipeline.avgDealSize / 1000).toFixed(0)}K`
            },
            {
              type: 'mrkdwn',
              text: `*⏱️ Avg Cycle Time*\n${pipeline.avgCycleTime} days`
            },
            {
              type: 'mrkdwn',
              text: `*🎯 Conversion Rate*\n${pipeline.conversionRate}%`
            },
            {
              type: 'mrkdwn',
              text: `*⚠️ Stagnant Deals*\n${pipeline.stagnantDeals}`
            }
          ]
        },
        { type: 'divider' },

        // System Status
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*🤖 Background Service Status*\n${this.buildSystemStatusText(health)}`
          }
        },

        // Recent Activity
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*📋 Recent Activity*'
          }
        },
        ...this.buildRecentActivityBlocks(pipeline.recentActivity),

        { type: 'divider' },

        // Learning Insights
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*🧠 AI Learning Status*\n${this.buildLearningStatusText(insights)}`
          }
        },

        // Action Buttons
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '🔍 View Detailed Insights'
              },
              action_id: 'view_insights',
              style: 'primary'
            },
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '⚡ Trigger Analysis'
              },
              action_id: 'trigger_analysis'
            },
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '🔔 Configure Alerts'
              },
              action_id: 'configure_alerts'
            }
          ]
        },

        // Footer
        { type: 'divider' },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `🤖 Powered by HeyJarvis CRM Intelligence • Updates every 2 minutes • Service uptime: ${Math.floor(health.uptime_seconds / 3600)}h`
            }
          ]
        }
      ]
    };
  }

  /**
   * Build health score display text
   */
  buildHealthScoreText(score) {
    let emoji = '🟢';
    let status = 'Healthy';
    
    if (score < 40) {
      emoji = '🔴';
      status = 'Critical';
    } else if (score < 70) {
      emoji = '🟡';
      status = 'Needs Attention';
    }
    
    return `*${emoji} Pipeline Health Score: ${score}/100*\n_Status: ${status}_`;
  }

  /**
   * Build system status text
   */
  buildSystemStatusText(health) {
    const uptimeHours = Math.floor(health.uptime_seconds / 3600);
    const memoryMB = health.memory_usage_mb || 0;
    
    return `✅ Online • Uptime: ${uptimeHours}h • Memory: ${memoryMB}MB\n` +
           `📊 Monitoring ${health.organizations_monitored} orgs • ${health.learning_patterns} patterns learned\n` +
           `⚡ Queue: ${health.queue_size} events`;
  }

  /**
   * Build learning status text
   */
  buildLearningStatusText(insights) {
    const confidence = insights.health_summary?.learning_confidence || 0;
    const patterns = insights.learning_patterns?.length || 0;
    
    let confidenceEmoji = '🟢';
    if (confidence < 0.5) confidenceEmoji = '🔴';
    else if (confidence < 0.7) confidenceEmoji = '🟡';
    
    return `${confidenceEmoji} Learning Confidence: ${Math.round(confidence * 100)}%\n` +
           `📚 ${patterns} patterns recognized • ${insights.recent_changes?.length || 0} recent changes tracked`;
  }

  /**
   * Build recent activity blocks
   */
  buildRecentActivityBlocks(activities) {
    if (!activities || activities.length === 0) {
      return [{
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '_No recent activity_'
        }
      }];
    }

    return activities.slice(0, 5).map(activity => ({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${this.getActivityEmoji(activity.type)} ${activity.deal} • _${activity.time}_`
      }
    }));
  }

  /**
   * Get emoji for activity type
   */
  getActivityEmoji(type) {
    const emojiMap = {
      'deal_created': '🆕',
      'stage_change': '📈',
      'deal_won': '🎉',
      'deal_lost': '❌',
      'deal_stagnant': '⚠️',
      'value_change': '💰'
    };
    return emojiMap[type] || '📊';
  }

  /**
   * Build error view
   */
  buildErrorView(errorMessage) {
    return {
      type: 'home',
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '❌ CRM Dashboard Error'
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Error:* ${errorMessage}\n\nPlease check that the background service is running and try refreshing.`
          }
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '🔄 Try Again'
              },
              action_id: 'refresh_dashboard',
              style: 'primary'
            }
          ]
        }
      ]
    };
  }

  /**
   * Refresh dashboard
   */
  async refreshDashboard(client, userId, showLoading = false) {
    if (showLoading) {
      // Show loading state
      await client.views.publish({
        user_id: userId,
        view: this.buildLoadingView()
      });
    }

    // Refresh with new data
    await this.publishHomeView(client, userId, true);
  }

  /**
   * Build loading view
   */
  buildLoadingView() {
    return {
      type: 'home',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '🔄 *Refreshing CRM Dashboard...*\n\nFetching latest data from your CRM system.'
          }
        }
      ]
    };
  }

  /**
   * Trigger analysis
   */
  async triggerAnalysis(client, userId) {
    try {
      // Show loading
      await client.views.publish({
        user_id: userId,
        view: {
          type: 'home',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '⚡ *Triggering CRM Analysis...*\n\nThis may take a few moments.'
              }
            }
          ]
        }
      });

      // Trigger analysis via background service
      await axios.post(`${this.backgroundServiceUrl}/trigger/default_org`, {
        reason: 'manual_slack_trigger'
      });

      // Wait a moment for processing
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Refresh dashboard with new data
      await this.refreshDashboard(client, userId);

    } catch (error) {
      console.error('Error triggering analysis:', error);
      
      await client.views.publish({
        user_id: userId,
        view: {
          type: 'home',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `❌ *Analysis Failed*\n\n${error.message}`
              }
            },
            {
              type: 'actions',
              elements: [
                {
                  type: 'button',
                  text: {
                    type: 'plain_text',
                    text: '🔄 Back to Dashboard'
                  },
                  action_id: 'refresh_dashboard'
                }
              ]
            }
          ]
        }
      });
    }
  }

  /**
   * Show detailed insights modal
   */
  async showInsightsModal(client, triggerId, userId) {
    try {
      const data = await this.getDashboardData(userId);
      
      await client.views.open({
        trigger_id: triggerId,
        view: {
          type: 'modal',
          title: {
            type: 'plain_text',
            text: '🔍 Detailed CRM Insights'
          },
          close: {
            type: 'plain_text',
            text: 'Close'
          },
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '*📊 Recent Changes Detected*'
              }
            },
            ...this.buildInsightsBlocks(data.insights),
            { type: 'divider' },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '*🤖 AI Recommendations*'
              }
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: this.buildRecommendationsText(data.insights)
              }
            }
          ]
        }
      });

    } catch (error) {
      console.error('Error showing insights modal:', error);
    }
  }

  /**
   * Build insights blocks
   */
  buildInsightsBlocks(insights) {
    const changes = insights.recent_changes || [];
    
    if (changes.length === 0) {
      return [{
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '_No recent changes detected_'
        }
      }];
    }

    return changes.slice(0, 10).map(change => ({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${this.getActivityEmoji(change.type)} *${change.type.replace(/_/g, ' ').toUpperCase()}*\n` +
              `${change.reason || 'Change detected'} • _${new Date(change.timestamp).toLocaleString()}_`
      }
    }));
  }

  /**
   * Build recommendations text
   */
  buildRecommendationsText(insights) {
    // Recommendations must come from actual analysis results
    if (!insights || !insights.recommendations || insights.recommendations.length === 0) {
      return '📋 *No tool recommendations available*\n' +
             'Tool recommendations require CRM workflow analysis and external tool databases.';
    }
    
    return insights.recommendations.map(rec => 
      `🚀 *${rec.recommended_tool || 'Tool recommendation'}* - ${rec.addresses_issue || 'Addresses workflow issue'}`
    ).join('\n');
  }

  /**
   * Show alert configuration modal
   */
  async showAlertConfigModal(client, triggerId, userId) {
    await client.views.open({
      trigger_id: triggerId,
      view: {
        type: 'modal',
        title: {
          type: 'plain_text',
          text: '🔔 Configure Alerts'
        },
        submit: {
          type: 'plain_text',
          text: 'Save Settings'
        },
        close: {
          type: 'plain_text',
          text: 'Cancel'
        },
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '*Alert Preferences*\nConfigure when you want to receive CRM alerts.'
            }
          },
          {
            type: 'input',
            element: {
              type: 'checkboxes',
              options: [
                {
                  text: {
                    type: 'mrkdwn',
                    text: '*Critical Health Alerts* - Pipeline health drops below 30%'
                  },
                  value: 'critical_health'
                },
                {
                  text: {
                    type: 'mrkdwn',
                    text: '*Stagnation Alerts* - Multiple deals become stagnant'
                  },
                  value: 'stagnation'
                },
                {
                  text: {
                    type: 'mrkdwn',
                    text: '*High ROI Opportunities* - AI detects high-value recommendations'
                  },
                  value: 'high_roi'
                },
                {
                  text: {
                    type: 'mrkdwn',
                    text: '*Weekly Summaries* - Comprehensive weekly reports'
                  },
                  value: 'weekly_summary'
                }
              ],
              initial_options: [
                {
                  text: {
                    type: 'mrkdwn',
                    text: '*Critical Health Alerts* - Pipeline health drops below 30%'
                  },
                  value: 'critical_health'
                }
              ]
            },
            label: {
              type: 'plain_text',
              text: 'Alert Types'
            }
          }
        ]
      }
    });
  }

  /**
   * Schedule periodic updates for active users
   */
  startPeriodicUpdates(client) {
    setInterval(async () => {
      const now = new Date();
      
      for (const [userId, lastUpdate] of this.lastUpdateTime) {
        // Update if user was active in last 30 minutes
        if ((now - lastUpdate) < 1800000) {
          try {
            await this.publishHomeView(client, userId);
          } catch (error) {
            console.error(`Error updating home view for user ${userId}:`, error);
          }
        }
      }
    }, 120000); // Update every 2 minutes
  }
}

module.exports = CRMDashboardHomeTab;
