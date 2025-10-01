/**
 * Digest Card - Slack blocks for signal digest delivery
 * 
 * Features:
 * 1. Multiple signals in one message
 * 2. Summary statistics
 * 3. Batch feedback collection
 * 4. Time-based grouping
 */

class DigestCard {
  constructor() {
    this.maxSignalsPerDigest = 10;
  }
  
  /**
   * Create digest blocks for multiple signals
   */
  createDigestCard(signals, user, options = {}) {
    const blocks = [];
    
    // Header
    blocks.push({
      type: "header",
      text: {
        type: "plain_text",
        text: `📊 Your ${options.period || 'daily'} intelligence digest`
      }
    });
    
    // Summary stats
    blocks.push({
      type: "context",
      elements: [{
        type: "mrkdwn",
        text: `${signals.length} signals • Generated ${new Date().toLocaleString()}`
      }]
    });
    
    blocks.push({ type: "divider" });
    
    // Signal summaries
    signals.slice(0, this.maxSignalsPerDigest).forEach((signal, index) => {
      blocks.push(this.createDigestSignalBlock(signal, index));
    });
    
    // Action buttons
    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "View All Signals" },
          action_id: "view_all_signals",
          url: `${process.env.DESKTOP_APP_URL || 'http://localhost:3000'}/signals`
        },
        {
          type: "button",
          text: { type: "plain_text", text: "Adjust Settings" },
          action_id: "adjust_settings"
        }
      ]
    });
    
    return blocks;
  }
  
  /**
   * Create individual signal block for digest
   */
  createDigestSignalBlock(signal, index) {
    const priorityEmoji = this.getPriorityEmoji(signal.priority);
    
    return {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${priorityEmoji} *${signal.title}*\n${signal.summary?.substring(0, 150)}...`
      },
      accessory: {
        type: "button",
        text: {
          type: "plain_text",
          text: "View"
        },
        action_id: "view_signal_details",
        value: signal.id
      }
    };
  }
  
  /**
   * Get priority emoji
   */
  getPriorityEmoji(priority) {
    const emojis = {
      critical: '🚨',
      high: '⚡',
      medium: '📢',
      low: '💡',
      fyi: 'ℹ️'
    };
    return emojis[priority] || '📢';
  }
}

module.exports = DigestCard;
