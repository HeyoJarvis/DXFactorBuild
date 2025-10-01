/**
 * Command Handlers - Processes Slack slash commands
 * 
 * Features:
 * 1. /jarvis command handling
 * 2. Status and settings commands
 * 3. Help and documentation
 * 4. User preference management
 */

class CommandHandlers {
  constructor() {
    this.commands = {
      status: this.handleStatus.bind(this),
      settings: this.handleSettings.bind(this),
      pause: this.handlePause.bind(this),
      help: this.handleHelp.bind(this),
      mute: this.handleMute.bind(this),
      unmute: this.handleUnmute.bind(this)
    };
  }
  
  /**
   * Main command handler
   */
  async handleCommand(command, client) {
    const args = command.text.trim().split(' ');
    const action = args[0] || 'help';
    const params = args.slice(1);
    
    if (this.commands[action]) {
      return await this.commands[action](command, params, client);
    } else {
      return this.getUnknownCommandResponse(action);
    }
  }
  
  /**
   * Handle status command
   */
  async handleStatus(command, params, client) {
    // In production, would fetch real user stats
    return {
      response_type: 'ephemeral',
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "*📊 Your HeyJarvis Status*"
          }
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: "*Signals Today:*\n12 new"
            },
            {
              type: "mrkdwn", 
              text: "*Notifications:*\n✅ Active"
            },
            {
              type: "mrkdwn",
              text: "*Relevance Score:*\n85%"
            },
            {
              type: "mrkdwn",
              text: "*Time Saved:*\n~2.5 hours"
            }
          ]
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: "📊 Full Dashboard" },
              action_id: "open_dashboard",
              url: `${process.env.DESKTOP_APP_URL || 'http://localhost:3000'}/dashboard`
            }
          ]
        }
      ]
    };
  }
  
  /**
   * Handle settings command
   */
  async handleSettings(command, params, client) {
    return {
      response_type: 'ephemeral',
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "*⚙️ HeyJarvis Settings*"
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "Current preferences:\n• Notifications: ✅ Enabled\n• Digest Mode: Daily at 9 AM\n• Priority Filter: Medium and above\n• Sources: All active"
          }
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: "🔧 Modify Settings" },
              action_id: "open_settings_modal",
              style: "primary"
            },
            {
              type: "button",
              text: { type: "plain_text", text: "🔇 Pause Notifications" },
              action_id: "pause_notifications"
            }
          ]
        }
      ]
    };
  }
  
  /**
   * Handle pause command
   */
  async handlePause(command, params, client) {
    const duration = params[0] || '1h';
    
    return {
      response_type: 'ephemeral',
      text: `🔇 Notifications paused for ${duration}. Use \`/jarvis unpause\` to resume.`
    };
  }
  
  /**
   * Handle mute command
   */
  async handleMute(command, params, client) {
    const keyword = params.join(' ');
    
    if (!keyword) {
      return {
        response_type: 'ephemeral',
        text: '❌ Please specify a keyword to mute. Example: `/jarvis mute competitor-name`'
      };
    }
    
    return {
      response_type: 'ephemeral',
      text: `🔇 Muted keyword: "${keyword}". You won't receive signals containing this term.`
    };
  }
  
  /**
   * Handle unmute command
   */
  async handleUnmute(command, params, client) {
    const keyword = params.join(' ');
    
    if (!keyword) {
      return {
        response_type: 'ephemeral',
        text: '❌ Please specify a keyword to unmute. Example: `/jarvis unmute competitor-name`'
      };
    }
    
    return {
      response_type: 'ephemeral',
      text: `🔊 Unmuted keyword: "${keyword}". You'll now receive signals containing this term.`
    };
  }
  
  /**
   * Handle help command
   */
  async handleHelp(command, params, client) {
    return {
      response_type: 'ephemeral',
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "*🤖 HeyJarvis Commands*"
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "*Available Commands:*\n• `/jarvis status` - Check your signal status\n• `/jarvis settings` - View and modify preferences\n• `/jarvis pause [duration]` - Pause notifications (e.g., 2h, 1d)\n• `/jarvis mute [keyword]` - Mute signals containing keyword\n• `/jarvis unmute [keyword]` - Unmute previously muted keyword\n• `/jarvis help` - Show this help message"
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "*Quick Actions:*\n• React with 👍/👎 to any signal for feedback\n• Use the buttons on signals for quick actions\n• Visit your dashboard for detailed analytics"
          }
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: "📊 Open Dashboard" },
              action_id: "open_dashboard",
              url: `${process.env.DESKTOP_APP_URL || 'http://localhost:3000'}/dashboard`
            },
            {
              type: "button",
              text: { type: "plain_text", text: "📚 Documentation" },
              action_id: "view_docs",
              url: "https://docs.heyjarvis.com"
            }
          ]
        }
      ]
    };
  }
  
  /**
   * Handle unknown command
   */
  getUnknownCommandResponse(action) {
    return {
      response_type: 'ephemeral',
      text: `❌ Unknown command: "${action}". Use \`/jarvis help\` to see available commands.`
    };
  }
}

module.exports = CommandHandlers;
