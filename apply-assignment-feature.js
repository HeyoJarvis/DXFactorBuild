#!/usr/bin/env node

/**
 * Script to apply assignor/assignee feature to the codebase
 * This adds assignment tracking to tasks created from Slack workflows
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Applying assignor/assignee feature...\n');

// 1. Add extractAssignmentInfo method to workflow-analyzer.js
const workflowAnalyzerPath = path.join(__dirname, 'core/intelligence/workflow-analyzer.js');
let workflowAnalyzer = fs.readFileSync(workflowAnalyzerPath, 'utf8');

const extractAssignmentInfoMethod = `
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
    const slackMentions = message.match(/<@([UW][A-Z0-9]+)(?:\\|[^>]+)?>/g) || [];
    const mentionedUserIds = slackMentions.map(mention => {
      const match = mention.match(/<@([UW][A-Z0-9]+)(?:\\|([^>]+))?>/);
      return {
        id: match[1],
        name: match[2] || null
      };
    });

    // Extract @username mentions (fallback for non-Slack format)
    const atMentions = message.match(/@(\\w+)/g) || [];
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
      /can you (?:please )?(.+?),?\\s+handle/i,
      /(?:assign|assigned) to\\s+<?@?(\\w+)>?/i,
      /<?@?(\\w+)>?,?\\s+(?:can|could|please) you/i,
      /(?:for|to)\\s+<?@?(\\w+)>?\\s+to (?:work on|complete|handle|do)/i,
      /hey\\s+<?@?(\\w+)>?,?\\s+(?:can|could)/i,
      /<?@?(\\w+)>?\\s+-\\s+(?:please|can you)/i
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
`;

// Insert the new method after extractTimeframes method (around line 350)
const insertionPoint = workflowAnalyzer.indexOf('  /**\n   * Detect urgency');
if (insertionPoint > 0) {
  workflowAnalyzer = workflowAnalyzer.slice(0, insertionPoint) + extractAssignmentInfoMethod + '\n\n' + workflowAnalyzer.slice(insertionPoint);
  fs.writeFileSync(workflowAnalyzerPath, workflowAnalyzer);
  console.log('✅ Added extractAssignmentInfo method to workflow-analyzer.js');
} else {
  console.log('⚠️  Could not find insertion point in workflow-analyzer.js');
}

// 2. Update captureInboundRequest to use the new method
workflowAnalyzer = fs.readFileSync(workflowAnalyzerPath, 'utf8');

const oldCaptureStart = 'async captureInboundRequest(userId, channelId, message, context = {}) {\n    try {';
const newCaptureStart = `async captureInboundRequest(userId, channelId, message, context = {}) {
    try {
      // Extract assignor and assignee information
      const assignmentInfo = this.extractAssignmentInfo(message, userId, context);
`;

if (workflowAnalyzer.includes(oldCaptureStart) && !workflowAnalyzer.includes('extractAssignmentInfo(message, userId, context)')) {
  workflowAnalyzer = workflowAnalyzer.replace(oldCaptureStart, newCaptureStart);
  
  // Update the context object to include assignment info
  const oldContext = '        context: {\n          messageType: this.classifyMessageType(message),\n          urgency: this.detectUrgency(message),\n          intent: await this.extractIntent(message),\n          entities: await this.extractEntities(message),\n          tools_mentioned: this.extractToolMentions(message),\n          sentiment: this.analyzeSentiment(message),\n          ...context\n        }';
  
  const newContext = `        context: {
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
        }`;
  
  workflowAnalyzer = workflowAnalyzer.replace(oldContext, newContext);
  
  fs.writeFileSync(workflowAnalyzerPath, workflowAnalyzer);
  console.log('✅ Updated captureInboundRequest method');
} else {
  console.log('⚠️  captureInboundRequest already updated or not found');
}

console.log('\n✨ Assignment feature applied successfully!');
console.log('\nNext steps:');
console.log('1. Restart the desktop app to pick up changes');
console.log('2. Test with Slack messages that mention users');
console.log('3. Tasks will now show assignor and assignee information\n');

