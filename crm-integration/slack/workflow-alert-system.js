/**
 * Workflow Alert System - Slack integration for CRM workflow insights
 * 
 * Features:
 * 1. Real-time workflow alerts and notifications
 * 2. Interactive Block Kit components
 * 3. Action handlers for workflow management
 * 4. Digest and summary reports
 * 5. Team collaboration features
 */

const winston = require('winston');
const { WorkflowAlertCard } = require('./blocks/workflow-alert-card');
const { WorkflowActionHandlers } = require('./handlers/workflow-actions');

class WorkflowAlertSystem {
  constructor(slackApp, options = {}) {
    this.slackApp = slackApp;
    this.options = {
      logLevel: 'info',
      defaultChannel: '#sales-alerts',
      digestSchedule: '0 9 * * 1-5', // 9 AM weekdays
      ...options
    };
    
    this.logger = winston.createLogger({
      level: this.options.logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      defaultMeta: { service: 'workflow-alert-system' }
    });
    
    this.alertCard = new WorkflowAlertCard();
    this.actionHandlers = new WorkflowActionHandlers(slackApp, this);
    
    // Alert type configurations
    this.alertTypes = {
      'deal_stagnation': {
        emoji: '🚨',
        color: '#FF0000',
        urgency: 'critical',
        channels: ['sales-alerts', 'dm'],
        threshold: 'immediate'
      },
      'bottleneck_detected': {
        emoji: '⚠️',
        color: '#FF8C00',
        urgency: 'high', 
        channels: ['sales-ops', 'sales-alerts'],
        threshold: 'immediate'
      },
      'conversion_drop': {
        emoji: '📉',
        color: '#FF6600',
        urgency: 'high',
        channels: ['sales-leadership', 'sales-alerts'],
        threshold: 'immediate'
      },
      'high_value_at_risk': {
        emoji: '💰',
        color: '#FF0000',
        urgency: 'critical',
        channels: ['sales-leadership', 'dm'],
        threshold: 'immediate'
      },
      'success_pattern_detected': {
        emoji: '🎯',
        color: '#32CD32',
        urgency: 'medium',
        channels: ['sales-team', 'sales-ops'],
        threshold: 'daily_digest'
      },
      'rep_performance_anomaly': {
        emoji: '👤',
        color: '#FF8C00',
        urgency: 'medium',
        channels: ['sales-managers', 'dm'],
        threshold: 'immediate'
      },
      'roi_opportunity': {
        emoji: '🚀',
        color: '#32CD32',
        urgency: 'medium',
        channels: ['sales-ops', 'leadership'],
        threshold: 'weekly_digest'
      },
      'workflow_optimization': {
        emoji: '⚡',
        color: '#1E90FF',
        urgency: 'low',
        channels: ['sales-ops'],
        threshold: 'weekly_digest'
      }
    };
    
    // Setup handlers
    this.setupActionHandlers();
  }
  
  /**
   * Send workflow alert to appropriate channels
   */
  async sendWorkflowAlert(alertType, alertData, recipients = []) {
    try {
      const alertConfig = this.alertTypes[alertType];
      if (!alertConfig) {
        throw new Error(`Unknown alert type: ${alertType}`);
      }
      
      this.logger.info('Sending workflow alert', {
        alert_type: alertType,
        urgency: alertConfig.urgency,
        recipient_count: recipients.length
      });
      
      // Create alert blocks
      const blocks = this.alertCard.createWorkflowAlertBlocks(alertType, alertData, alertConfig);
      
      // Determine delivery strategy based on urgency
      const deliveryResults = await this.deliverAlert(blocks, alertConfig, alertData, recipients);
      
      // Track alert delivery
      await this.trackAlertDelivery(alertType, alertData, deliveryResults);
      
      return deliveryResults;
      
    } catch (error) {
      this.logger.error('Failed to send workflow alert', {
        alert_type: alertType,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Deliver alert based on configuration and urgency
   */
  async deliverAlert(blocks, alertConfig, alertData, recipients) {
    const results = {
      channels_notified: [],
      users_notified: [],
      errors: []
    };
    
    try {
      // Deliver to configured channels
      for (const channelName of alertConfig.channels) {
        if (channelName === 'dm') {
          // Send direct messages to specific users
          await this.sendDirectMessages(blocks, alertData, recipients, results);
        } else {
          // Send to public channels
          await this.sendChannelMessage(blocks, channelName, alertData, results);
        }
      }
      
      // Send additional notifications based on urgency
      if (alertConfig.urgency === 'critical') {
        await this.sendCriticalAlertNotifications(blocks, alertData, recipients, results);
      }
      
      return results;
      
    } catch (error) {
      this.logger.error('Alert delivery failed', {
        alert_type: alertConfig.urgency,
        error: error.message
      });
      results.errors.push(error.message);
      return results;
    }
  }
  
  /**
   * Send message to a specific channel
   */
  async sendChannelMessage(blocks, channelName, alertData, results) {
    try {
      const channel = channelName.startsWith('#') ? channelName : `#${channelName}`;
      
      const response = await this.slackApp.client.chat.postMessage({
        channel: channel,
        blocks: blocks,
        text: `Workflow Alert: ${alertData.title || 'New Alert'}`,
        unfurl_links: false,
        unfurl_media: false
      });
      
      results.channels_notified.push({
        channel: channel,
        message_ts: response.ts,
        success: true
      });
      
      this.logger.debug('Channel message sent', {
        channel: channel,
        message_ts: response.ts
      });
      
    } catch (error) {
      this.logger.error('Failed to send channel message', {
        channel: channelName,
        error: error.message
      });
      
      results.errors.push(`Channel ${channelName}: ${error.message}`);
    }
  }
  
  /**
   * Send direct messages to specific users
   */
  async sendDirectMessages(blocks, alertData, recipients, results) {
    for (const recipient of recipients) {
      try {
        const userId = recipient.slack_user_id || recipient.user_id;
        if (!userId) continue;
        
        const response = await this.slackApp.client.chat.postMessage({
          channel: userId,
          blocks: blocks,
          text: `Workflow Alert: ${alertData.title || 'New Alert'}`
        });
        
        results.users_notified.push({
          user_id: userId,
          user_name: recipient.name || 'Unknown',
          message_ts: response.ts,
          success: true
        });
        
      } catch (error) {
        this.logger.error('Failed to send DM', {
          user_id: recipient.slack_user_id,
          error: error.message
        });
        
        results.errors.push(`User ${recipient.name}: ${error.message}`);
      }
    }
  }
  
  /**
   * Send critical alert notifications with additional urgency
   */
  async sendCriticalAlertNotifications(blocks, alertData, recipients, results) {
    try {
      // Send to emergency channel if configured
      if (this.options.emergencyChannel) {
        await this.sendChannelMessage(blocks, this.options.emergencyChannel, alertData, results);
      }
      
      // Send push notifications to mobile users (if configured)
      if (this.options.enablePushNotifications) {
        await this.sendPushNotifications(alertData, recipients);
      }
      
      // Create calendar reminders for follow-up
      if (alertData.requires_followup) {
        await this.createFollowupReminders(alertData, recipients);
      }
      
    } catch (error) {
      this.logger.error('Critical alert notifications failed', {
        error: error.message
      });
    }
  }
  
  /**
   * Send daily workflow digest
   */
  async sendDailyDigest(userId, workflowMetrics, organizationId) {
    try {
      const digestBlocks = this.createDailyDigestBlocks(workflowMetrics);
      
      const response = await this.slackApp.client.chat.postMessage({
        channel: userId,
        blocks: digestBlocks,
        text: '📊 Daily Workflow Digest'
      });
      
      this.logger.info('Daily digest sent', {
        user_id: userId,
        organization_id: organizationId,
        message_ts: response.ts
      });
      
      return response;
      
    } catch (error) {
      this.logger.error('Failed to send daily digest', {
        user_id: userId,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Create daily digest blocks
   */
  createDailyDigestBlocks(metrics) {
    return [
      {
        "type": "header",
        "text": {
          "type": "plain_text",
          "text": "📊 Daily Workflow Digest"
        }
      },
      {
        "type": "context",
        "elements": [{
          "type": "mrkdwn",
          "text": `${new Date().toLocaleDateString()} • Generated at ${new Date().toLocaleTimeString()}`
        }]
      },
      {
        "type": "section",
        "fields": [
          {
            "type": "mrkdwn",
            "text": `*Deals Progressed:* ${metrics.deals_progressed || 0}`
          },
          {
            "type": "mrkdwn",
            "text": `*Bottlenecks Resolved:* ${metrics.bottlenecks_resolved || 0}`
          },
          {
            "type": "mrkdwn",
            "text": `*Revenue at Risk:* $${(metrics.revenue_at_risk || 0).toLocaleString()}`
          },
          {
            "type": "mrkdwn",
            "text": `*Efficiency Score:* ${metrics.efficiency_score || 0}/100`
          }
        ]
      },
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": `*🚨 Action Required:*\n${(metrics.action_items || []).map(item => `• ${item}`).join('\n') || 'No critical actions today'}`
        }
      },
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": `*🎯 Opportunities:*\n${(metrics.opportunities || []).map(opp => `• ${opp}`).join('\n') || 'No new opportunities identified'}`
        }
      },
      {
        "type": "actions",
        "elements": [
          {
            "type": "button",
            "text": {"type": "plain_text", "text": "📈 View Full Dashboard"},
            "action_id": "open_dashboard",
            "url": `${process.env.DASHBOARD_URL}/workflows`
          },
          {
            "type": "button",
            "text": {"type": "plain_text", "text": "⚙️ Adjust Alerts"},
            "action_id": "adjust_alert_settings"
          },
          {
            "type": "button",
            "text": {"type": "plain_text", "text": "📋 Export Report"},
            "action_id": "export_daily_report"
          }
        ]
      }
    ];
  }
  
  /**
   * Send weekly workflow summary
   */
  async sendWeeklyDigest(userId, weeklyMetrics, organizationId) {
    try {
      const digestBlocks = this.createWeeklyDigestBlocks(weeklyMetrics);
      
      const response = await this.slackApp.client.chat.postMessage({
        channel: userId,
        blocks: digestBlocks,
        text: '📈 Weekly Workflow Summary'
      });
      
      this.logger.info('Weekly digest sent', {
        user_id: userId,
        organization_id: organizationId,
        message_ts: response.ts
      });
      
      return response;
      
    } catch (error) {
      this.logger.error('Failed to send weekly digest', {
        user_id: userId,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Create weekly digest blocks
   */
  createWeeklyDigestBlocks(metrics) {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    
    return [
      {
        "type": "header",
        "text": {
          "type": "plain_text",
          "text": "📈 Weekly Workflow Summary"
        }
      },
      {
        "type": "context",
        "elements": [{
          "type": "mrkdwn",
          "text": `Week of ${weekStart.toLocaleDateString()} • ${metrics.total_workflows || 0} workflows analyzed`
        }]
      },
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": `*📊 Key Metrics This Week:*\n• Average Cycle Time: ${Math.round(metrics.avg_cycle_time || 0)} days\n• Conversion Rate: ${Math.round((metrics.conversion_rate || 0) * 100)}%\n• Team Efficiency: ${metrics.team_efficiency || 0}/100\n• Revenue Generated: $${(metrics.revenue_generated || 0).toLocaleString()}`
        }
      },
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": `*🎯 Top Performers:*\n${(metrics.top_performers || []).map(p => `• ${p.name}: ${p.metric}`).join('\n') || 'No performance data available'}`
        }
      },
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": `*⚠️ Areas for Improvement:*\n${(metrics.improvement_areas || []).map(area => `• ${area}`).join('\n') || 'All workflows performing well'}`
        }
      },
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": `*🚀 Recommended Actions:*\n${(metrics.recommended_actions || []).map(action => `• ${action}`).join('\n') || 'Continue current practices'}`
        }
      },
      {
        "type": "actions",
        "elements": [
          {
            "type": "button",
            "text": {"type": "plain_text", "text": "📊 Detailed Analytics"},
            "action_id": "view_weekly_analytics",
            "style": "primary"
          },
          {
            "type": "button",
            "text": {"type": "plain_text", "text": "👥 Team Performance"},
            "action_id": "view_team_performance"
          },
          {
            "type": "button",
            "text": {"type": "plain_text", "text": "🎯 Set Goals"},
            "action_id": "set_weekly_goals"
          }
        ]
      }
    ];
  }
  
  /**
   * Setup action handlers for interactive components
   */
  setupActionHandlers() {
    // Deal stagnation actions
    this.slackApp.action('schedule_checkin', this.actionHandlers.handleScheduleCheckin.bind(this.actionHandlers));
    this.slackApp.action('call_rep', this.actionHandlers.handleCallRep.bind(this.actionHandlers));
    this.slackApp.action('view_deal_analysis', this.actionHandlers.handleViewAnalysis.bind(this.actionHandlers));
    this.slackApp.action('mark_handled', this.actionHandlers.handleMarkHandled.bind(this.actionHandlers));
    
    // ROI opportunity actions
    this.slackApp.action('get_implementation_plan', this.actionHandlers.handleGetImplementationPlan.bind(this.actionHandlers));
    this.slackApp.action('view_roi_details', this.actionHandlers.handleViewROIDetails.bind(this.actionHandlers));
    this.slackApp.action('approve_implementation', this.actionHandlers.handleApproveImplementation.bind(this.actionHandlers));
    
    // Dashboard and settings actions
    this.slackApp.action('open_dashboard', this.actionHandlers.handleOpenDashboard.bind(this.actionHandlers));
    this.slackApp.action('adjust_alert_settings', this.actionHandlers.handleAdjustSettings.bind(this.actionHandlers));
    this.slackApp.action('export_daily_report', this.actionHandlers.handleExportReport.bind(this.actionHandlers));
    
    // Analytics actions
    this.slackApp.action('view_weekly_analytics', this.actionHandlers.handleViewAnalytics.bind(this.actionHandlers));
    this.slackApp.action('view_team_performance', this.actionHandlers.handleViewTeamPerformance.bind(this.actionHandlers));
    this.slackApp.action('set_weekly_goals', this.actionHandlers.handleSetGoals.bind(this.actionHandlers));
    
    this.logger.info('Workflow alert action handlers registered');
  }
  
  /**
   * Track alert delivery for analytics
   */
  async trackAlertDelivery(alertType, alertData, deliveryResults) {
    try {
      const deliveryMetrics = {
        alert_type: alertType,
        alert_id: alertData.alert_id || alertData.id,
        timestamp: new Date(),
        channels_reached: deliveryResults.channels_notified.length,
        users_reached: deliveryResults.users_notified.length,
        errors_count: deliveryResults.errors.length,
        delivery_success: deliveryResults.errors.length === 0,
        organization_id: alertData.organization_id
      };
      
      // In production, this would save to database
      this.logger.info('Alert delivery tracked', deliveryMetrics);
      
      // Emit event for other systems to consume
      this.emit('alert_delivered', deliveryMetrics);
      
    } catch (error) {
      this.logger.error('Failed to track alert delivery', {
        alert_type: alertType,
        error: error.message
      });
    }
  }
  
  /**
   * Send push notifications for critical alerts
   */
  async sendPushNotifications(alertData, recipients) {
    // Implementation would depend on push notification service
    // This is a placeholder for the interface
    this.logger.debug('Push notifications would be sent', {
      alert_id: alertData.id,
      recipient_count: recipients.length
    });
  }
  
  /**
   * Create follow-up reminders
   */
  async createFollowupReminders(alertData, recipients) {
    // Implementation would integrate with calendar services
    // This is a placeholder for the interface
    this.logger.debug('Follow-up reminders would be created', {
      alert_id: alertData.id,
      followup_time: alertData.followup_time
    });
  }
  
  /**
   * Get alert delivery statistics
   */
  async getAlertStats(organizationId, timeframe = '7d') {
    // In production, this would query the database
    return {
      total_alerts: 0,
      critical_alerts: 0,
      avg_response_time: 0,
      delivery_success_rate: 1.0,
      most_common_alert_type: 'deal_stagnation',
      timeframe: timeframe
    };
  }
}

module.exports = WorkflowAlertSystem;
