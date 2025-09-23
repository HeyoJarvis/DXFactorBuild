/**
 * Slack Block Kit components for Workflow Intelligence
 * 
 * Creates rich, interactive message blocks for:
 * 1. Workflow insights
 * 2. Analytics dashboards
 * 3. Automation suggestions
 * 4. Tool recommendations
 */

class WorkflowInsightBlocks {
  /**
   * Create insight summary block
   */
  static createInsightSummary(insights, analytics) {
    const totalSuggestions = insights.reduce((sum, insight) => 
      sum + (insight.actionable_suggestions?.length || 0), 0
    );
    
    const highPrioritySuggestions = insights.reduce((sum, insight) => 
      sum + (insight.actionable_suggestions?.filter(s => s.priority === 'high')?.length || 0), 0
    );

    return [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "🧠 Workflow Intelligence Report"
        }
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*📊 Total Insights*\n${insights.length}`
          },
          {
            type: "mrkdwn",
            text: `*⚡ High Priority*\n${highPrioritySuggestions}`
          },
          {
            type: "mrkdwn",
            text: `*💡 Suggestions*\n${totalSuggestions}`
          },
          {
            type: "mrkdwn",
            text: `*📈 Interactions*\n${analytics?.total_interactions || 0}`
          }
        ]
      },
      {
        type: "divider"
      }
    ];
  }

  /**
   * Create detailed insight card
   */
  static createInsightCard(insight, index = 0) {
    const blocks = [];
    
    // Insight header
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Insight #${index + 1}* | Generated ${this.formatRelativeTime(insight.timestamp)}`
      }
    });

    // Key observations
    if (insight.key_observations?.length > 0) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*🔍 Key Observations*\n${insight.key_observations.map(obs => `• ${obs}`).join('\n')}`
        }
      });
    }

    // Actionable suggestions
    if (insight.actionable_suggestions?.length > 0) {
      insight.actionable_suggestions.slice(0, 3).forEach((suggestion, suggestionIndex) => {
        const priorityEmoji = this.getPriorityEmoji(suggestion.priority);
        const categoryEmoji = this.getCategoryEmoji(suggestion.category);
        
        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `${priorityEmoji} ${categoryEmoji} *${suggestion.suggestion}*\n\n${suggestion.rationale}\n\n*Implementation:* ${suggestion.implementation}\n\n⏱️ *Est. time savings:* ${suggestion.estimated_time_savings || 'Significant'}`
          },
          accessory: {
            type: "button",
            text: {
              type: "plain_text",
              text: "Implement"
            },
            style: suggestion.priority === 'high' ? 'primary' : 'default',
            action_id: `implement_suggestion_${insight.id}_${suggestionIndex}`,
            value: JSON.stringify({
              insight_id: insight.id,
              suggestion_index: suggestionIndex,
              category: suggestion.category
            })
          }
        });
      });
    }

    // Automation opportunities
    if (insight.automation_opportunities?.length > 0) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*🤖 Automation Opportunities*`
        }
      });

      insight.automation_opportunities.slice(0, 2).forEach((opportunity, autoIndex) => {
        const complexityColor = this.getComplexityColor(opportunity.complexity);
        
        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `• *${opportunity.process}*\n  *Trigger:* ${opportunity.trigger}\n  *Tools:* ${opportunity.tools.join(', ')}\n  *Complexity:* ${opportunity.complexity}`
          },
          accessory: {
            type: "button",
            text: {
              type: "plain_text",
              text: "Set Up Automation"
            },
            action_id: `setup_automation_${insight.id}_${autoIndex}`,
            style: opportunity.complexity === 'easy' ? 'primary' : 'default'
          }
        });
      });
    }

    // Action buttons
    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "✅ Mark Complete"
          },
          style: "primary",
          action_id: `complete_insight_${insight.id}`,
          value: insight.id
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "⏰ Remind Me Later"
          },
          action_id: `snooze_insight_${insight.id}`,
          value: insight.id
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "🔇 Dismiss"
          },
          action_id: `dismiss_insight_${insight.id}`,
          value: insight.id
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "📊 View Analytics"
          },
          action_id: `view_analytics_${insight.id}`,
          value: insight.id
        }
      ]
    });

    blocks.push({
      type: "divider"
    });

    return blocks;
  }

  /**
   * Create analytics dashboard blocks
   */
  static createAnalyticsDashboard(analytics) {
    const blocks = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `📊 Workflow Analytics (${analytics.period_days} days)`
        }
      }
    ];

    // Activity overview
    blocks.push({
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*📈 Total Interactions*\n${analytics.total_interactions}`
        },
        {
          type: "mrkdwn",
          text: `*📥 Inbound Requests*\n${analytics.inbound_requests}`
        },
        {
          type: "mrkdwn",
          text: `*📤 Outbound Actions*\n${analytics.outbound_actions}`
        },
        {
          type: "mrkdwn",
          text: `*💡 Active Insights*\n${analytics.active_insights}`
        }
      ]
    });

    // Top intents
    if (analytics.top_intents?.length > 0) {
      const intentText = analytics.top_intents.slice(0, 5).map((intent, index) => 
        `${index + 1}. ${this.formatIntentName(intent.intent)} (${intent.count}x)`
      ).join('\n');

      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*🎯 Most Common Requests*\n${intentText}`
        }
      });
    }

    // Tool usage
    if (analytics.tool_usage?.length > 0) {
      const toolText = analytics.tool_usage.slice(0, 5).map((tool, index) => 
        `${index + 1}. ${tool.tool.charAt(0).toUpperCase() + tool.tool.slice(1)} (${tool.count} mentions)`
      ).join('\n');

      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*🛠️ Tool Mentions*\n${toolText}`
        }
      });
    }

    // Urgency distribution
    const urgencyTotal = analytics.urgency_distribution.high + 
                        analytics.urgency_distribution.medium + 
                        analytics.urgency_distribution.low;

    if (urgencyTotal > 0) {
      blocks.push({
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*🔥 High Urgency*\n${analytics.urgency_distribution.high} (${Math.round(analytics.urgency_distribution.high/urgencyTotal*100)}%)`
          },
          {
            type: "mrkdwn",
            text: `*⚡ Medium Urgency*\n${analytics.urgency_distribution.medium} (${Math.round(analytics.urgency_distribution.medium/urgencyTotal*100)}%)`
          },
          {
            type: "mrkdwn",
            text: `*💡 Low Urgency*\n${analytics.urgency_distribution.low} (${Math.round(analytics.urgency_distribution.low/urgencyTotal*100)}%)`
          },
          {
            type: "mrkdwn",
            text: `*📊 Total Requests*\n${urgencyTotal}`
          }
        ]
      });
    }

    // Time patterns
    if (analytics.time_patterns?.most_active_hours?.length > 0) {
      const timeText = analytics.time_patterns.most_active_hours.slice(0, 3).map(hour => 
        `${this.formatHour(hour.hour)} (${hour.count} interactions)`
      ).join(' • ');

      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*🕒 Peak Activity Hours*\n${timeText}`
        }
      });
    }

    // Action buttons
    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "🔄 Refresh Data"
          },
          action_id: "refresh_analytics",
          style: "primary"
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "📈 Extended Report"
          },
          action_id: "extended_analytics"
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "💾 Export Data"
          },
          action_id: "export_analytics"
        }
      ]
    });

    return blocks;
  }

  /**
   * Create automation suggestion blocks
   */
  static createAutomationSuggestions(automationOpportunities) {
    const blocks = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "🤖 Automation Opportunities"
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `I found ${automationOpportunities.length} processes you could automate to save time:`
        }
      },
      {
        type: "divider"
      }
    ];

    automationOpportunities.forEach((opportunity, index) => {
      const complexityEmoji = this.getComplexityEmoji(opportunity.complexity);
      const estimatedSavings = this.estimateTimeSavings(opportunity);

      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${index + 1}. ${opportunity.process}*\n\n${complexityEmoji} *Complexity:* ${opportunity.complexity}\n🔗 *Required tools:* ${opportunity.tools.join(', ')}\n⚡ *Trigger:* ${opportunity.trigger}\n⏱️ *Est. time savings:* ${estimatedSavings}`
        },
        accessory: {
          type: "button",
          text: {
            type: "plain_text",
            text: opportunity.complexity === 'easy' ? "Quick Setup" : "Learn More"
          },
          style: opportunity.complexity === 'easy' ? 'primary' : 'default',
          action_id: `setup_automation_${index}`,
          value: JSON.stringify(opportunity)
        }
      });
    });

    // Overall automation benefits
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `💡 Automating these processes could save you ${this.calculateTotalSavings(automationOpportunities)} per week`
        }
      ]
    });

    return blocks;
  }

  /**
   * Create tool recommendation blocks
   */
  static createToolRecommendations(recommendations, userPatterns) {
    const blocks = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "🛠️ Personalized Tool Recommendations"
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `Based on your workflow patterns, here are tools that could help you:`
        }
      },
      {
        type: "divider"
      }
    ];

    recommendations.forEach((recommendation, index) => {
      const categoryEmoji = this.getCategoryEmoji(recommendation.category);
      
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `${categoryEmoji} *${recommendation.tool_name}*\n\n*Why it fits:* ${recommendation.rationale}\n*Best for:* ${recommendation.use_cases.join(', ')}\n*Integration:* ${recommendation.integration_complexity}`
        },
        accessory: {
          type: "button",
          text: {
            type: "plain_text",
            text: "Learn More"
          },
          action_id: `learn_tool_${index}`,
          url: recommendation.url || undefined,
          value: JSON.stringify(recommendation)
        }
      });

      // Add integration suggestions if available
      if (recommendation.integrations?.length > 0) {
        blocks.push({
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `🔗 Integrates with: ${recommendation.integrations.join(', ')}`
            }
          ]
        });
      }
    });

    return blocks;
  }

  /**
   * Create quick action buttons
   */
  static createQuickActions(userId, context = {}) {
    return [
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "💡 Get Insights"
            },
            style: "primary",
            action_id: "quick_insights",
            value: userId
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "📊 View Analytics"
            },
            action_id: "quick_analytics",
            value: userId
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "🤖 Find Automations"
            },
            action_id: "quick_automations",
            value: userId
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "🛠️ Tool Suggestions"
            },
            action_id: "quick_tools",
            value: userId
          }
        ]
      }
    ];
  }

  /**
   * Create notification blocks for proactive insights
   */
  static createProactiveNotification(insight, trigger) {
    return [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `🧠 *Workflow Intelligence Alert*\n\nI noticed ${trigger} and have a suggestion that could help:`
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `💡 *${insight.actionable_suggestions[0].suggestion}*\n\n${insight.actionable_suggestions[0].rationale}`
        },
        accessory: {
          type: "button",
          text: {
            type: "plain_text",
            text: "Tell Me More"
          },
          style: "primary",
          action_id: `expand_proactive_${insight.id}`,
          value: insight.id
        }
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "✅ Helpful"
            },
            style: "primary",
            action_id: `helpful_${insight.id}`,
            value: "helpful"
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "⏰ Later"
            },
            action_id: `later_${insight.id}`,
            value: "later"
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "🔇 Not Relevant"
            },
            action_id: `not_relevant_${insight.id}`,
            value: "not_relevant"
          }
        ]
      }
    ];
  }

  /**
   * Create onboarding blocks for new users
   */
  static createOnboardingBlocks() {
    return [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "👋 Welcome to HeyJarvis Workflow Intelligence!"
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "I'm here to learn your workflow patterns and help you become more productive. Here's how I work:"
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*🔍 I observe:*\n• Your messages and requests\n• Tools you mention\n• Patterns in your workflow\n• Time and urgency patterns"
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*💡 I provide:*\n• Personalized workflow insights\n• Automation opportunities\n• Tool recommendations\n• Time-saving suggestions"
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*🚀 Get started:*\nJust use Slack normally! Mention tools, ask questions, and I'll start learning your patterns. After a few interactions, I'll share personalized insights."
        }
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "🎯 Take Quick Survey"
            },
            style: "primary",
            action_id: "onboarding_survey"
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "📚 View Documentation"
            },
            action_id: "view_docs",
            url: "https://your-docs-url.com"
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "⚙️ Preferences"
            },
            action_id: "set_preferences"
          }
        ]
      }
    ];
  }

  // Helper methods

  static getPriorityEmoji(priority) {
    const emojis = {
      'high': '🔥',
      'medium': '⚡',
      'low': '💡'
    };
    return emojis[priority] || '💡';
  }

  static getCategoryEmoji(category) {
    const emojis = {
      'automation': '🤖',
      'tool': '🛠️',
      'workflow': '⚡',
      'integration': '🔗',
      'productivity': '📈',
      'communication': '💬',
      'analytics': '📊'
    };
    return emojis[category] || '📋';
  }

  static getComplexityEmoji(complexity) {
    const emojis = {
      'easy': '🟢',
      'moderate': '🟡',
      'complex': '🔴'
    };
    return emojis[complexity] || '🟡';
  }

  static getComplexityColor(complexity) {
    const colors = {
      'easy': 'good',
      'moderate': 'warning',
      'complex': 'danger'
    };
    return colors[complexity] || 'default';
  }

  static formatRelativeTime(timestamp) {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now - time;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else {
      return `${diffDays}d ago`;
    }
  }

  static formatIntentName(intent) {
    return intent.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  static formatHour(hour) {
    if (hour === 0) return '12:00 AM';
    if (hour < 12) return `${hour}:00 AM`;
    if (hour === 12) return '12:00 PM';
    return `${hour - 12}:00 PM`;
  }

  static estimateTimeSavings(opportunity) {
    const savings = {
      'easy': '30-60 min/week',
      'moderate': '1-3 hours/week',
      'complex': '3-8 hours/week'
    };
    return savings[opportunity.complexity] || '1-2 hours/week';
  }

  static calculateTotalSavings(opportunities) {
    const totalOpportunities = opportunities.length;
    if (totalOpportunities === 0) return '0 hours';
    if (totalOpportunities <= 2) return '1-3 hours';
    if (totalOpportunities <= 5) return '3-8 hours';
    return '8+ hours';
  }
}

module.exports = WorkflowInsightBlocks;
