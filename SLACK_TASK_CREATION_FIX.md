# Slack → Task Creation Fix

## 🔍 Issues Found

### Issue 1: Message Not Being Received
Your message "John, can you create documents for the meeting?" was NOT captured by the Slack bot.

**Evidence:** No "💬 MESSAGE RECEIVED!" log in your terminal output.

### Issue 2: No Automatic Task Creation
Even when messages ARE received, the system doesn't automatically create tasks. It only:
- Analyzes the workflow
- Stores workflow intelligence data
- Sends notifications to UI

## ✅ Required Slack App Configuration

### Step 1: Check Event Subscriptions
Go to: https://api.slack.com/apps → Your App → **Event Subscriptions**

**Required Bot Events:**
```
message.channels    - Listen to messages in public channels
message.groups      - Listen to messages in private channels  
message.im          - Listen to direct messages
app_mention         - Listen to @mentions
```

### Step 2: Check OAuth Scopes
Go to: https://api.slack.com/apps → Your App → **OAuth & Permissions**

**Required Bot Token Scopes:**
```
channels:history    - View messages in public channels
channels:read       - View basic channel info
groups:history      - View messages in private channels
groups:read         - View basic private channel info
im:history          - View messages in DMs
im:read             - View basic DM info
chat:write          - Send messages
app_mentions:read   - View @mentions
users:read          - View user information
```

### Step 3: Reinstall App
After adding scopes/events:
1. Go to **Install App**
2. Click **Reinstall to Workspace**
3. Copy new tokens to `.env` file

### Step 4: Invite Bot to Channel
In the Slack channel where you want to test:
```
/invite @hj2
```

## 🔧 Missing Feature: Auto Task Creation

The workflow detection captures messages but doesn't create tasks. Here's what needs to be added:

### Add to `desktop/main.js` in `setupWorkflowDetection()`:

```javascript
// After line 1424, add:

// ✨ NEW: Auto-create tasks from work requests with assignments
if (workRequestAnalysis.isWorkRequest && workRequestAnalysis.confidence > 0.6) {
  try {
    // Extract assignment info from workflow intelligence
    const workflowData = await workflowIntelligence.captureInboundRequest(
      message.user,
      message.channel,
      message.text,
      {
        messageType: message.type,
        timestamp: message.timestamp,
        channelType: message.channelType,
        user_name: message.user  // Add user name if available
      }
    );

    // If there's an assignee, create a task
    if (workflowData.context.assignee || workflowData.context.is_assignment) {
      const taskData = {
        title: extractTaskTitle(message.text),  // Extract from message
        priority: urgencyToPriority(workRequestAnalysis.urgency),
        description: message.text,
        tags: [workRequestAnalysis.workType],
        assignor: workflowData.context.assignor,
        assignee: workflowData.context.assignee,
        mentionedUsers: workflowData.context.mentioned_users,
        parentSessionId: workflowData.id  // Link to the workflow
      };

      const result = await dbAdapter.createTask('desktop-user', taskData);
      
      if (result.success) {
        console.log('✅ Auto-created task from Slack:', result.task.id);
        
        // Notify UI
        if (mainWindow) {
          mainWindow.webContents.send('task:created', result.task);
        }
      }
    }
  } catch (error) {
    console.error('❌ Failed to auto-create task:', error.message);
  }
}

// Helper function to extract task title
function extractTaskTitle(text) {
  // Remove mentions and clean up
  const cleanText = text.replace(/<@[UW][A-Z0-9]+(\|[^>]+)?>/g, '').trim();
  
  // Take first sentence or first 100 chars
  const firstSentence = cleanText.split(/[.!?]/)[0];
  return firstSentence.length > 100 
    ? firstSentence.substring(0, 100) + '...' 
    : firstSentence;
}

// Helper to convert urgency to priority
function urgencyToPriority(urgency) {
  const mapping = {
    'critical': 'urgent',
    'high': 'high',
    'medium': 'medium',
    'low': 'low'
  };
  return mapping[urgency] || 'medium';
}
```

## 🧪 Testing

### Test 1: Check if Bot is Receiving Messages

1. Start the app with debug logging
2. Send a test message in a channel where the bot is invited
3. Look for: `💬 MESSAGE RECEIVED!` in logs

**If you DON'T see it:**
- Check event subscriptions (Step 1 above)
- Reinstall the app (Step 3 above)
- Invite bot to channel (Step 4 above)

### Test 2: Test Assignment Extraction

```bash
# Create a test to verify assignment extraction
node -e "
const WorkflowIntelligenceSystem = require('./core/intelligence/workflow-analyzer');
const workflow = new WorkflowIntelligenceSystem({ logLevel: 'debug' });

const result = workflow.extractAssignmentInfo(
  'John, can you create documents for the meeting?',
  'U123456',
  { user_name: 'Sarah' }
);

console.log('Assignment Info:', JSON.stringify(result, null, 2));
"
```

### Test 3: Send Test Message

In Slack channel where bot is invited:
```
John, can you create documents for the meeting?
```

**Expected:**
1. Log: "💬 MESSAGE RECEIVED!"
2. Log: "🚨 Work request detected!"
3. Log: "✅ Auto-created task from Slack: [task-id]"
4. Task appears in desktop app To Do List

## 🚀 Quick Fix Script

I'll create a script to apply the auto-task-creation feature.

