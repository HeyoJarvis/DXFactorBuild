#!/usr/bin/env node

/**
 * Add automatic task creation from Slack messages with assignments
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Adding Slack → Task auto-creation feature...\n');

const mainJsPath = path.join(__dirname, 'desktop/main.js');
let mainJs = fs.readFileSync(mainJsPath, 'utf8');

// Helper functions to add
const helperFunctions = `
// ===== TASK AUTO-CREATION HELPERS =====

/**
 * Extract task title from Slack message
 */
function extractTaskTitle(text) {
  // Remove Slack mentions (<@U123|user> format)
  const cleanText = text.replace(/<@[UW][A-Z0-9]+(\|[^>]+)?>/g, '').trim();
  
  // Remove common prefixes
  const withoutPrefixes = cleanText
    .replace(/^(hey|hi|hello|yo),?\\s+/i, '')
    .replace(/^(can you|could you|please)\\s+/i, '')
    .trim();
  
  // Take first sentence or first 100 chars
  const firstSentence = withoutPrefixes.split(/[.!?]/)[0].trim();
  return firstSentence.length > 100 
    ? firstSentence.substring(0, 97) + '...' 
    : firstSentence || 'Task from Slack';
}

/**
 * Convert urgency to priority
 */
function urgencyToPriority(urgency) {
  const mapping = {
    'critical': 'urgent',
    'high': 'high',
    'medium': 'medium',
    'low': 'low'
  };
  return mapping[urgency] || 'medium';
}
`;

// Check if helpers already exist
if (!mainJs.includes('extractTaskTitle')) {
  // Insert before setupWorkflowDetection function
  const setupWorkflowPoint = mainJs.indexOf('function setupWorkflowDetection()');
  if (setupWorkflowPoint > 0) {
    mainJs = mainJs.slice(0, setupWorkflowPoint) + helperFunctions + '\n' + mainJs.slice(setupWorkflowPoint);
    console.log('✅ Added helper functions');
  }
}

// Add auto-task-creation logic to setupWorkflowDetection
const workflowCaptureBlock = `      // Capture in workflow intelligence system
      if (workflowIntelligence) {
        await workflowIntelligence.captureInboundRequest(
          message.user,
          message.channel,
          message.text,
          {
            messageType: message.type,
            timestamp: message.timestamp,
            channelType: message.channelType
          }
        );
      }`;

const enhancedWorkflowBlock = `      // Capture in workflow intelligence system with assignment tracking
      if (workflowIntelligence) {
        const workflowData = await workflowIntelligence.captureInboundRequest(
          message.user,
          message.channel,
          message.text,
          {
            messageType: message.type,
            timestamp: message.timestamp,
            channelType: message.channelType,
            user_name: message.user,
            slack_user_id: message.user
          }
        );
        
        // ✨ AUTO-CREATE TASK if it's a work request with assignment
        if (workRequestAnalysis.isWorkRequest && 
            workRequestAnalysis.confidence > 0.6 &&
            (workflowData.context.assignee || workflowData.context.is_assignment)) {
          
          try {
            const taskData = {
              title: extractTaskTitle(message.text),
              priority: urgencyToPriority(workRequestAnalysis.urgency),
              description: message.text,
              tags: [workRequestAnalysis.workType, 'slack-auto'],
              assignor: workflowData.context.assignor,
              assignee: workflowData.context.assignee,
              mentionedUsers: workflowData.context.mentioned_users,
              parentSessionId: workflowData.id
            };

            const result = await dbAdapter.createTask('desktop-user', taskData);
            
            if (result.success) {
              console.log('✅ Auto-created task from Slack:', {
                task_id: result.task.id,
                title: taskData.title,
                assignee: taskData.assignee?.name || taskData.assignee?.id || 'unassigned'
              });
              
              // Notify UI
              if (mainWindow) {
                mainWindow.webContents.send('task:created', result.task);
                mainWindow.webContents.send('notification', {
                  type: 'task_created',
                  message: \`New task created: \${taskData.title}\`
                });
              }
            } else {
              console.error('❌ Failed to create task:', result.error);
            }
          } catch (taskError) {
            console.error('❌ Task creation error:', taskError.message);
          }
        }
      }`;

if (mainJs.includes(workflowCaptureBlock) && !mainJs.includes('AUTO-CREATE TASK')) {
  mainJs = mainJs.replace(workflowCaptureBlock, enhancedWorkflowBlock);
  console.log('✅ Added auto-task-creation logic to message handler');
} else if (mainJs.includes('AUTO-CREATE TASK')) {
  console.log('⚠️  Auto-task-creation already exists');
} else {
  console.log('⚠️  Could not find insertion point (workflow capture block)');
}

// Also add to mention handler
const mentionCaptureBlock = `      // Capture mention in workflow intelligence
      if (workflowIntelligence) {
        await workflowIntelligence.captureInboundRequest(
          message.user,
          message.channel,
          message.text,
          {
            messageType: 'mention',
            timestamp: message.timestamp,
            urgent: message.urgent || workRequestAnalysis.urgency === 'high'
          }
        );
      }`;

const enhancedMentionBlock = `      // Capture mention in workflow intelligence with assignment tracking
      if (workflowIntelligence) {
        const workflowData = await workflowIntelligence.captureInboundRequest(
          message.user,
          message.channel,
          message.text,
          {
            messageType: 'mention',
            timestamp: message.timestamp,
            urgent: message.urgent || workRequestAnalysis.urgency === 'high',
            user_name: message.user,
            slack_user_id: message.user
          }
        );
        
        // ✨ AUTO-CREATE TASK from mention if it's a work request with assignment
        if (workRequestAnalysis.isWorkRequest &&
            (workflowData.context.assignee || workflowData.context.is_assignment)) {
          
          try {
            const taskData = {
              title: extractTaskTitle(message.text),
              priority: urgencyToPriority(workRequestAnalysis.urgency || 'medium'),
              description: message.text,
              tags: ['mention', workRequestAnalysis.workType || 'task', 'slack-auto'],
              assignor: workflowData.context.assignor,
              assignee: workflowData.context.assignee,
              mentionedUsers: workflowData.context.mentioned_users,
              parentSessionId: workflowData.id
            };

            const result = await dbAdapter.createTask('desktop-user', taskData);
            
            if (result.success) {
              console.log('✅ Auto-created task from mention:', {
                task_id: result.task.id,
                title: taskData.title
              });
              
              if (mainWindow) {
                mainWindow.webContents.send('task:created', result.task);
              }
            }
          } catch (taskError) {
            console.error('❌ Task creation from mention error:', taskError.message);
          }
        }
      }`;

if (mainJs.includes(mentionCaptureBlock) && !mainJs.includes('AUTO-CREATE TASK from mention')) {
  mainJs = mainJs.replace(mentionCaptureBlock, enhancedMentionBlock);
  console.log('✅ Added auto-task-creation logic to mention handler');
}

// Write updated file
fs.writeFileSync(mainJsPath, mainJs);

console.log('\n✨ Slack → Task auto-creation feature added!');
console.log('\n📋 What happens now:');
console.log('  1. When Slack message is received');
console.log('  2. System analyzes for work request');
console.log('  3. Extracts assignor/assignee info');
console.log('  4. If confidence > 60% and has assignment → AUTO-CREATE TASK');
console.log('  5. Task appears in desktop To Do List');
console.log('\n🧪 Test it:');
console.log('  1. Restart the desktop app');
console.log('  2. Make sure bot is invited to Slack channel: /invite @hj2');
console.log('  3. Send: "John, can you create documents for the meeting?"');
console.log('  4. Check logs for: "✅ Auto-created task from Slack"');
console.log('  5. Check To Do List tab for new task\n');

