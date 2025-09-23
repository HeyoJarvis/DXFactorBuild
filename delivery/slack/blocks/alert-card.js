/**
 * Alert Card - Rich interactive Slack blocks for signal delivery
 * 
 * Features:
 * 1. Context-rich signal presentation
 * 2. One-click feedback buttons
 * 3. Action buttons for workflows
 * 4. Priority-based styling
 * 5. Personalized explanations
 */

const { SignalHelpers } = require('@heyjarvis/data');

class AlertCard {
  constructor() {
    this.priorityColors = {
      critical: '#FF0000',  // Red
      high: '#FF8C00',      // Dark Orange  
      medium: '#1E90FF',    // Dodger Blue
      low: '#32CD32',       // Lime Green
      fyi: '#808080'        // Gray
    };
    
    this.priorityEmojis = {
      critical: '🚨',
      high: '⚡',
      medium: '📢',
      low: '💡',
      fyi: 'ℹ️'
    };
    
    this.categoryEmojis = {
      product_launch: '🚀',
      funding: '💰',
      acquisition: '🤝',
      partnership: '🤝',
      leadership_change: '👥',
      market_expansion: '🌍',
      technology_update: '⚙️',
      pricing_change: '💲',
      security_incident: '🔒',
      regulatory_change: '📋',
      competitive_analysis: '📊',
      industry_trend: '📈'
    };
  }
  
  /**
   * Create alert card blocks for a signal
   */
  createAlertCard(signal, user, options = {}) {
    const blocks = [];
    
    // Header with priority and category
    blocks.push(this.createHeaderBlock(signal));
    
    // Main content
    blocks.push(this.createContentBlock(signal, user, options));
    
    // Context and metadata
    if (signal.entities && signal.entities.length > 0) {
      blocks.push(this.createEntitiesBlock(signal));
    }
    
    // Relevance explanation
    if (options.relevance_explanation) {
      blocks.push(this.createExplanationBlock(options.relevance_explanation));
    }
    
    // Action buttons
    blocks.push(this.createActionBlock(signal, user));
    
    // Feedback buttons
    blocks.push(this.createFeedbackBlock(signal));
    
    return blocks;
  }
  
  /**
   * Create header block with priority and category
   */
  createHeaderBlock(signal) {
    const priorityEmoji = this.priorityEmojis[signal.priority] || '📢';
    const categoryEmoji = this.categoryEmojis[signal.category] || '📰';
    const priorityColor = this.priorityColors[signal.priority] || '#1E90FF';
    
    return {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${priorityEmoji} *${signal.title}*`
      },
      accessory: {
        type: 'button',
        text: {
          type: 'plain_text',
          text: `${categoryEmoji} ${this.formatCategory(signal.category)}`
        },
        action_id: 'signal_category_info',
        value: signal.category
      }
    };
  }
  
  /**
   * Create main content block
   */
  createContentBlock(signal, user, options) {
    let contentText = signal.summary || signal.content?.substring(0, 300) + '...' || 'No summary available';
    
    // Add source and trust indicator
    const trustIndicator = this.getTrustIndicator(signal.trust_level);
    const timeAgo = this.getTimeAgo(signal.published_at);
    
    const metadata = `${trustIndicator} • ${timeAgo}`;
    if (signal.source_name) {
      contentText += `\n\n_Source: ${signal.source_name}_`;
    }
    
    return {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${contentText}\n\n${metadata}`
      },
      accessory: {
        type: 'button',
        text: {
          type: 'plain_text',
          text: '🔗 Read Full'
        },
        action_id: 'open_signal_url',
        url: signal.url
      }
    };
  }
  
  /**
   * Create entities block showing mentioned companies, people, etc.
   */
  createEntitiesBlock(signal) {
    const entityGroups = this.groupEntities(signal.entities);
    const fields = [];
    
    // Companies
    if (entityGroups.companies.length > 0) {
      const companyText = entityGroups.companies
        .slice(0, 5) // Limit to 5 companies
        .map(entity => {
          let text = entity.name;
          if (entity.is_competitor) text += ' 🎯';
          if (entity.is_our_product) text += ' 🏠';
          return text;
        })
        .join(', ');
      
      fields.push({
        type: 'mrkdwn',
        text: `*Companies:*\n${companyText}`
      });
    }
    
    // People (executives, etc.)
    if (entityGroups.people.length > 0) {
      const peopleText = entityGroups.people
        .slice(0, 3)
        .map(entity => {
          let text = entity.name;
          if (entity.title) text += ` (${entity.title})`;
          return text;
        })
        .join(', ');
      
      fields.push({
        type: 'mrkdwn',
        text: `*People:*\n${peopleText}`
      });
    }
    
    // Technologies
    if (entityGroups.technologies.length > 0) {
      const techText = entityGroups.technologies
        .slice(0, 4)
        .map(entity => entity.name)
        .join(', ');
      
      fields.push({
        type: 'mrkdwn',
        text: `*Technologies:*\n${techText}`
      });
    }
    
    if (fields.length === 0) return null;
    
    return {
      type: 'section',
      fields: fields.slice(0, 4) // Slack supports max 4 fields
    };
  }
  
  /**
   * Create explanation block for relevance reasoning
   */
  createExplanationBlock(explanation) {
    return {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `🎯 *Why this matters:* ${explanation}`
        }
      ]
    };
  }
  
  /**
   * Create action buttons block
   */
  createActionBlock(signal, user) {
    const elements = [
      {
        type: 'button',
        text: {
          type: 'plain_text',
          text: '🚩 Flag Important'
        },
        action_id: 'signal_action_flag',
        value: signal.id,
        style: 'primary'
      },
      {
        type: 'button',
        text: {
          type: 'plain_text',
          text: '📋 Create Task'
        },
        action_id: 'signal_action_create_task',
        value: signal.id
      },
      {
        type: 'button',
        text: {
          type: 'plain_text',
          text: '📤 Share'
        },
        action_id: 'signal_action_share',
        value: signal.id
      }
    ];
    
    // Add snooze for non-critical signals
    if (signal.priority !== 'critical') {
      elements.push({
        type: 'button',
        text: {
          type: 'plain_text',
          text: '⏰ Snooze'
        },
        action_id: 'signal_action_snooze',
        value: signal.id
      });
    }
    
    return {
      type: 'actions',
      elements: elements.slice(0, 5) // Slack max 5 elements
    };
  }
  
  /**
   * Create feedback buttons block
   */
  createFeedbackBlock(signal) {
    return {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '👍 Helpful',
            emoji: true
          },
          action_id: 'signal_feedback',
          value: JSON.stringify({
            signal_id: signal.id,
            feedback_type: 'explicit_rating',
            feedback_value: true
          }),
          style: 'primary'
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '👎 Not Relevant',
            emoji: true
          },
          action_id: 'signal_feedback',
          value: JSON.stringify({
            signal_id: signal.id,
            feedback_type: 'explicit_rating',
            feedback_value: false
          }),
          style: 'danger'
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '🔇 Mute Source'
          },
          action_id: 'signal_feedback',
          value: JSON.stringify({
            signal_id: signal.id,
            feedback_type: 'mute_source',
            feedback_value: signal.source_id
          })
        }
      ]
    };
  }
  
  /**
   * Create compact alert for digest view
   */
  createCompactAlert(signal, options = {}) {
    const priorityEmoji = this.priorityEmojis[signal.priority] || '📢';
    const categoryEmoji = this.categoryEmojis[signal.category] || '📰';
    const trustIndicator = this.getTrustIndicator(signal.trust_level);
    const timeAgo = this.getTimeAgo(signal.published_at);
    
    // Truncate title and summary for compact view
    const title = signal.title.length > 60 ? signal.title.substring(0, 57) + '...' : signal.title;
    const summary = signal.summary?.substring(0, 100) + '...' || '';
    
    return {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${priorityEmoji} *<${signal.url}|${title}>*\n${summary}\n${categoryEmoji} ${this.formatCategory(signal.category)} • ${trustIndicator} • ${timeAgo}`
      },
      accessory: {
        type: 'button',
        text: {
          type: 'plain_text',
          text: '👍'
        },
        action_id: 'signal_feedback',
        value: JSON.stringify({
          signal_id: signal.id,
          feedback_type: 'explicit_rating',
          feedback_value: true
        })
      }
    };
  }
  
  /**
   * Create critical alert with enhanced styling
   */
  createCriticalAlert(signal, user, options = {}) {
    const blocks = [];
    
    // Critical header with red styling
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `🚨 *CRITICAL ALERT*\n\n*${signal.title}*`
      }
    });
    
    // Divider
    blocks.push({ type: 'divider' });
    
    // Enhanced content with urgency indicators
    const urgencyText = this.getUrgencyText(signal);
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${signal.summary}\n\n⚡ *${urgencyText}*`
      }
    });
    
    // Immediate action buttons
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '🔥 Escalate Now'
          },
          action_id: 'signal_action_escalate',
          value: signal.id,
          style: 'danger'
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '📋 Create Urgent Task'
          },
          action_id: 'signal_action_urgent_task',
          value: signal.id,
          style: 'primary'
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '🔗 View Details'
          },
          action_id: 'open_signal_url',
          url: signal.url
        }
      ]
    });
    
    return blocks;
  }
  
  // Helper methods
  
  groupEntities(entities) {
    const groups = {
      companies: [],
      people: [],
      technologies: [],
      locations: [],
      products: []
    };
    
    for (const entity of entities) {
      if (groups[entity.type + 's']) {
        groups[entity.type + 's'].push(entity);
      }
    }
    
    // Sort by confidence/relevance
    Object.keys(groups).forEach(type => {
      groups[type].sort((a, b) => (b.relevance || b.confidence) - (a.relevance || a.confidence));
    });
    
    return groups;
  }
  
  getTrustIndicator(trustLevel) {
    const indicators = {
      verified: '✅ Verified',
      official: '🏢 Official',
      reliable: '📰 Reliable',
      unverified: '❓ Unverified'
    };
    
    return indicators[trustLevel] || '❓ Unknown';
  }
  
  getTimeAgo(publishedAt) {
    const now = new Date();
    const published = new Date(publishedAt);
    const diffMs = now - published;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else {
      return `${diffDays}d ago`;
    }
  }
  
  formatCategory(category) {
    return category
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
  
  getUrgencyText(signal) {
    const urgencyTexts = {
      critical: 'Immediate attention required',
      high: 'Action needed soon',
      medium: 'Worth monitoring',
      low: 'For your awareness',
      fyi: 'Informational only'
    };
    
    return urgencyTexts[signal.priority] || 'Review when convenient';
  }
  
  /**
   * Update existing message with feedback received
   */
  updateMessageWithFeedback(originalBlocks, feedbackType, feedbackValue) {
    const updatedBlocks = [...originalBlocks];
    
    // Find feedback block and update it
    const feedbackBlockIndex = updatedBlocks.findIndex(block => 
      block.type === 'actions' && 
      block.elements?.some(el => el.action_id === 'signal_feedback')
    );
    
    if (feedbackBlockIndex !== -1) {
      // Add feedback received indicator
      updatedBlocks.splice(feedbackBlockIndex + 1, 0, {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `${feedbackValue ? '✅' : '❌'} Feedback received - thank you!`
          }
        ]
      });
    }
    
    return updatedBlocks;
  }
}

module.exports = AlertCard;
