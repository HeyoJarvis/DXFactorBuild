/**
 * PATCH FILE: Add this method to workflow-analyzer.js after line 310
 * This extracts assignor and assignee information from Slack messages
 */

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

    // Check for assignment keywords
    const assignmentKeywords = [
      /can you|could you|please/i,
      /assign(?:ed)? to/i,
      /for you to|need you to|want you to/i,
      /your task|your responsibility/i,
      /handle|take care of|work on/i,
      /due|deadline|by (tomorrow|today|friday|monday|eod)/i
    ];

    const hasAssignmentKeyword = assignmentKeywords.some(pattern => 
      pattern.test(message)
    );

    // Determine if this is an assignment
    assignmentInfo.isAssignment = hasAssignmentKeyword && 
      (mentionedUserIds.length > 0 || mentionedUsernames.length > 0);

    // Determine primary assignee (first mentioned user or detect from context)
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
        
        // Only set if we don't already have an assignee or to refine existing
        if (!assignmentInfo.assignee || assignmentInfo.assignee.type === 'username') {
          assignmentInfo.assignee = {
            name: potentialAssignee,
            type: 'inferred_from_pattern',
            pattern_matched: pattern.source
          };
          assignmentInfo.isAssignment = true;
        }
        break;
      }
    }

    // Log the extraction for debugging
    this.logger.debug('Extracted assignment info', {
      sender_id: senderId,
      is_assignment: assignmentInfo.isAssignment,
      assignee: assignmentInfo.assignee?.id || assignmentInfo.assignee?.name,
      mentioned_count: assignmentInfo.mentionedUsers.length
    });

    return assignmentInfo;
  }

/**
 * PATCH: Update captureInboundRequest method (line 54)
 * Add this after line 55 (after the try {)
 */

// Extract assignor and assignee information
const assignmentInfo = this.extractAssignmentInfo(message, userId, context);

// Then in the requestData object, add to context:
context: {
  messageType: this.classifyMessageType(message),
  urgency: this.detectUrgency(message),
  intent: await this.extractIntent(message),
  entities: await this.extractEntities(message),
  tools_mentioned: this.extractToolMentions(message),
  sentiment: this.analyzeSentiment(message),
  assignor: assignmentInfo.assignor,              // NEW: Who sent the message
  assignee: assignmentInfo.assignee,              // NEW: Who it's assigned to
  mentioned_users: assignmentInfo.mentionedUsers, // NEW: All mentioned users
  is_assignment: assignmentInfo.isAssignment,     // NEW: Is this a task assignment?
  ...context
}

