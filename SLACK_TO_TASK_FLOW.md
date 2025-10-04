# 🔄 Slack Message → Task Auto-Creation Flow

Complete documentation of how HeyJarvis automatically converts Slack messages into tasks.

---

## 📊 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        SLACK WORKSPACE                           │
│  Someone sends: "@hj2 can you help me fix the payment API?"    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SLACK SERVICE                               │
│  (desktop/main/slack-service.js)                                │
│  • Listens via Slack Bolt Socket Mode                           │
│  • Captures messages & mentions                                 │
│  • Emits events: 'message' and 'mention'                        │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              WORKFLOW DETECTION (desktop/main.js)                │
│  setupWorkflowDetection() listens to SlackService events        │
└────────────────────────────┬────────────────────────────────────┘
                             │
                 ┌───────────┴───────────┐
                 ▼                       ▼
    ┌──────────────────────┐  ┌──────────────────────┐
    │ WorkRequestSystem    │  │ WorkflowIntelligence │
    │ Pattern Matching     │  │ AI Analysis          │
    └──────────┬───────────┘  └──────────┬───────────┘
               │                          │
               ▼                          ▼
    Is it a work request?      Extract assignment info
    • Confidence > 0.4         • Who assigned it?
    • Urgency level            • Who's mentioned?
    • Work type                • Is it an assignment?
               │                          │
               └───────────┬──────────────┘
                           ▼
              ┌────────────────────────┐
              │  AUTO-TASK CREATION    │
              │  Decision Logic        │
              │                        │
              │  IF:                   │
              │  ✓ isWorkRequest       │
              │  ✓ confidence > 0.4    │
              │  ✓ has assignee OR     │
              │    is_assignment       │
              │  THEN:                 │
              │  → Create Task         │
              └────────┬───────────────┘
                       │
                       ▼
          ┌────────────────────────────┐
          │    CREATE TASK IN DB        │
          │  (Supabase Adapter)         │
          │  • Link to current user     │
          │  • Store in conversation_   │
          │    sessions table           │
          │  • Set priority & metadata  │
          └────────┬───────────────────┘
                   │
                   ▼
          ┌────────────────────────────┐
          │   NOTIFY UI                 │
          │  • Send 'task:created'      │
          │  • Update task list         │
          │  • Show notification        │
          └─────────────────────────────┘
```

---

## 🔍 Step-by-Step Breakdown

### **1. Slack Event Capture**
**File:** `desktop/main/slack-service.js`

```javascript
// Listen for app mentions (@hj2 ...)
this.app.event('app_mention', async ({ event }) => {
  const msg = {
    type: 'mention',
    user: event.user,
    channel: event.channel,
    text: event.text,
    timestamp: new Date(event.ts * 1000)
  };
  
  this.emit('mention', msg);  // ← Triggers workflow detection
});

// Listen for regular channel messages
this.app.message(async ({ message }) => {
  const msg = {
    type: 'message',
    user: message.user,
    channel: message.channel,
    text: message.text,
    timestamp: new Date(message.ts * 1000)
  };
  
  this.emit('message', msg);  // ← Triggers workflow detection
});
```

**Output:** Emits `message` or `mention` events with structured message data.

---

### **2. Work Request Analysis**
**File:** `api/notifications/work-request-alerts.js`

The `WorkRequestAlertSystem` uses **pattern matching** (no AI required) to detect work requests:

```javascript
analyzeForWorkRequest(message, context) {
  // Pattern 1: Direct requests
  /can you (please )?(?:help|do|make|create|fix|update)/i
  
  // Pattern 2: Task assignments
  /please (?:help|do|make|create|fix|update)/i
  /need you to (?:help|do|make|create|fix)/i
  
  // Pattern 3: Urgent keywords
  /urgent[ly]?|asap|emergency/i
  
  // Pattern 4: Action words
  /(?:implement|develop|design|analyze|review|test|deploy)/i
  
  // Calculate confidence
  const patternMatches = patterns.filter(p => p.test(message.text));
  const confidence = Math.min(0.3 + (patternMatches.length * 0.2), 0.9);
  
  return {
    isWorkRequest: confidence >= 0.5,  // Threshold check
    confidence: 0.7,
    urgency: 'high',        // urgent, high, medium, low
    workType: 'coding',     // coding, design, analysis, support
    estimatedEffort: 'medium'  // quick, medium, large
  };
}
```

**Pattern Examples:**
- ✅ "Can you help me fix the payment API?" → `confidence: 0.7, urgency: medium`
- ✅ "Please implement the new dashboard ASAP" → `confidence: 0.9, urgency: urgent`
- ✅ "Need you to review this PR" → `confidence: 0.7, urgency: medium`
- ❌ "Good morning!" → `confidence: 0.0` (not a work request)

---

### **3. Assignment Detection**
**File:** `core/intelligence/workflow-analyzer.js`

The `WorkflowIntelligenceSystem` extracts **who assigned** and **who's assigned**:

```javascript
extractAssignmentInfo(message, userId, context) {
  // Look for mentions in message
  const mentionPattern = /<@([UW][A-Z0-9]+)>/g;
  const mentions = [...message.matchAll(mentionPattern)];
  
  // Assignment patterns
  const assignmentPatterns = [
    /can you/i,
    /could you/i,
    /please/i,
    /need you to/i
  ];
  
  const isAssignment = assignmentPatterns.some(p => p.test(message));
  
  return {
    assignor: userId,                    // Who sent the message
    assignee: mentions[0]?.[1] || null,  // First mentioned user (e.g., @john)
    mentionedUsers: mentions.map(m => m[1]),  // All mentioned users
    isAssignment: isAssignment && mentions.length > 0
  };
}
```

**Example:**
```
Message: "@john can you fix the payment API by Friday?"
Result:
  assignor: "U123ABC" (person who sent message)
  assignee: "U456DEF" (john's user ID)
  mentionedUsers: ["U456DEF"]
  isAssignment: true
```

---

### **4. Task Auto-Creation Logic**
**File:** `desktop/main.js` → `setupWorkflowDetection()`

```javascript
slackService.on('message', async (message) => {
  // Step 1: Analyze for work request
  const workRequestAnalysis = workRequestSystem.analyzeForWorkRequest(
    { text: message.text, timestamp: message.timestamp },
    { user: message.user, channel: message.channel }
  );
  
  // Step 2: Extract assignment info
  const workflowData = await workflowIntelligence.captureInboundRequest(
    message.user,
    message.channel,
    message.text,
    { timestamp: message.timestamp }
  );
  
  // Step 3: Decision: Should we auto-create a task?
  const shouldCreateTask = (
    workRequestAnalysis.isWorkRequest &&           // ✓ It's a work request
    workRequestAnalysis.confidence > 0.4 &&        // ✓ High confidence
    (workflowData.context.assignee ||              // ✓ Has assignee OR
     workflowData.context.is_assignment)           // ✓ Is assignment
  );
  
  if (shouldCreateTask) {
    // Step 4: Build task data
    const taskData = {
      title: extractTaskTitle(message.text),        // "fix the payment API"
      priority: urgencyToPriority(workRequestAnalysis.urgency),  // 'urgent', 'high', 'medium', 'low'
      description: message.text,                     // Full message text
      tags: [workRequestAnalysis.workType, 'slack-auto'],  // ['coding', 'slack-auto']
      assignor: workflowData.context.assignor,      // Who assigned it
      assignee: workflowData.context.assignee,      // Who it's assigned to
      mentionedUsers: workflowData.context.mentioned_users,
      parentSessionId: workflowData.id              // Link to conversation
    };
    
    // Step 5: Create task in database
    const userId = currentUser?.id || 'desktop-user';
    const result = await dbAdapter.createTask(userId, taskData);
    
    // Step 6: Notify UI
    if (result.success) {
      mainWindow.webContents.send('task:created', result.task);
      mainWindow.webContents.send('notification', {
        title: '✨ New Task Created',
        body: `${taskData.title}`,
        urgency: taskData.priority
      });
    }
  }
});
```

---

### **5. Task Storage**
**File:** `desktop/main/supabase-adapter.js`

```javascript
async createTask(userId, taskData) {
  const workflowId = `${userId}_task_${Date.now()}`;
  
  const { data, error } = await this.supabase
    .from('conversation_sessions')
    .insert([{
      user_id: userId,                    // ← User-specific!
      workflow_id: workflowId,
      workflow_type: 'task',
      workflow_intent: 'task_management',
      session_title: taskData.title,
      workflow_metadata: {
        priority: taskData.priority,
        description: taskData.description,
        tags: taskData.tags,
        assignor: taskData.assignor,
        assignee: taskData.assignee,
        mentioned_users: taskData.mentionedUsers
      },
      is_active: true,
      is_completed: false
    }])
    .select()
    .single();
  
  return { success: true, task: data };
}
```

**Database Record:**
```json
{
  "id": "uuid-123-456",
  "user_id": "1294e10a-74ce-499e-ba34-d1ac4219c1bc",
  "workflow_type": "task",
  "session_title": "fix the payment API",
  "workflow_metadata": {
    "priority": "high",
    "description": "@john can you fix the payment API by Friday?",
    "tags": ["coding", "slack-auto"],
    "assignor": "U123ABC",
    "assignee": "U456DEF"
  },
  "is_active": true,
  "is_completed": false
}
```

---

## 🎯 Real-World Example

### **Scenario: CEO assigns a task in Slack**

```
👤 CEO (U123ABC): "@john can you help me fix the payment API? It's urgent!"
```

### **Processing Flow:**

1. **Slack Service** captures the message:
   ```javascript
   {
     type: 'message',
     user: 'U123ABC',
     channel: 'C789XYZ',
     text: '@john can you help me fix the payment API? It\'s urgent!'
   }
   ```

2. **WorkRequestSystem** analyzes:
   ```javascript
   {
     isWorkRequest: true,
     confidence: 0.9,  // High! Matches multiple patterns
     urgency: 'urgent',  // "urgent" keyword detected
     workType: 'coding',  // "fix" + "API" keywords
     estimatedEffort: 'medium'
   }
   ```

3. **WorkflowIntelligence** extracts assignment:
   ```javascript
   {
     assignor: 'U123ABC',  // CEO
     assignee: 'U456DEF',  // John
     mentionedUsers: ['U456DEF'],
     isAssignment: true  // "can you" + mention = assignment
   }
   ```

4. **Decision Check:**
   ```javascript
   shouldCreateTask = (
     true &&      // isWorkRequest ✓
     0.9 > 0.4 && // confidence > threshold ✓
     true         // has assignee ✓
   ) = TRUE
   ```

5. **Task Created:**
   ```javascript
   {
     title: "fix the payment API",
     priority: "urgent",
     description: "@john can you help me fix the payment API? It's urgent!",
     tags: ["coding", "slack-auto"],
     assignor: "U123ABC",
     assignee: "U456DEF"
   }
   ```

6. **UI Notification:**
   ```
   ✨ New Task Created
   fix the payment API
   Priority: Urgent
   ```

---

## 📋 Configuration Options

### **Adjust Sensitivity**
**File:** `desktop/main.js`

```javascript
workRequestSystem = new WorkRequestAlertSystem({
  alertThreshold: 0.5,  // ← Lower = more sensitive (0.3 = catch everything)
                        //   Higher = less sensitive (0.8 = only obvious requests)
  adminUserId: 'U09GEFMKGE7'
});
```

### **Task Auto-Creation Threshold**
**File:** `desktop/main.js` (line 1622)

```javascript
if (workRequestAnalysis.isWorkRequest && 
    workRequestAnalysis.confidence > 0.4 &&  // ← Adjust this threshold
    (workflowData.context.assignee || workflowData.context.is_assignment)) {
```

**Threshold Guide:**
- `0.3` = Very sensitive (creates tasks for vague requests)
- `0.4` = Balanced (default)
- `0.6` = Conservative (only clear work requests)
- `0.8` = Very strict (only explicit assignments)

---

## 🔧 Troubleshooting

### **Tasks not being created?**

**Check 1: Is Slack connected?**
```javascript
// In terminal logs, look for:
✅ Slack service initialized
💬 MESSAGE RECEIVED!
```

**Check 2: Is the message matching patterns?**
```javascript
// Add debug logging in main.js:
console.log('Work request analysis:', workRequestAnalysis);
// Should show: { isWorkRequest: true, confidence: 0.7, ... }
```

**Check 3: Is assignment detected?**
```javascript
console.log('Workflow data:', workflowData.context);
// Should show: { assignee: 'U123ABC', is_assignment: true, ... }
```

**Check 4: Is conversation_sessions table working?**
```sql
-- Run in Supabase SQL editor:
SELECT * FROM conversation_sessions WHERE workflow_type = 'task';
```

### **Common Issues:**

1. **No `metadata` column error:**
   - Run `data/storage/fix-conversation-sessions-safe.sql`
   - Restart the app

2. **Tasks created but not showing:**
   - Check user_id: `console.log('Current user:', currentUser?.id)`
   - Verify RLS policies allow user to see their tasks

3. **Too many false positives:**
   - Increase `alertThreshold` to 0.6 or 0.7
   - Increase `confidence` threshold in task creation logic

---

## 🚀 Future Enhancements

### **Planned:**
- [ ] AI-powered task prioritization
- [ ] Smart deadline extraction ("by Friday" → due_date)
- [ ] Multi-assignee support
- [ ] Task dependencies detection
- [ ] Custom pattern training per team

### **Ideas:**
- [ ] Voice message → task conversion
- [ ] Image/screenshot → task with context
- [ ] Email integration (forward email → create task)
- [ ] Calendar integration (meeting notes → action items)

---

## 📚 Related Files

| File | Purpose |
|------|---------|
| `desktop/main/slack-service.js` | Slack event capture |
| `api/notifications/work-request-alerts.js` | Pattern-based work request detection |
| `core/intelligence/workflow-analyzer.js` | AI-powered assignment extraction |
| `desktop/main.js` → `setupWorkflowDetection()` | Orchestrates the entire flow |
| `desktop/main/supabase-adapter.js` → `createTask()` | Database storage |
| `data/storage/conversation_sessions` (table) | Where tasks are stored |

---

**🎉 You now have a complete understanding of the Slack → Task pipeline!**

Want to customize it? Start with these files:
1. `desktop/main.js` (line 1622) - Task creation decision logic
2. `api/notifications/work-request-alerts.js` (line 25) - Pattern matching rules
3. `desktop/main/supabase-adapter.js` (line 541) - Task storage format

