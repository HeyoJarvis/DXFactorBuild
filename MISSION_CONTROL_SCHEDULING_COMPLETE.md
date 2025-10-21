# Mission Control Scheduling Suggestions - Implementation Complete

## Summary

Successfully integrated task-based scheduling suggestions into Mission Control. Calendar and email tasks detected from Slack/JIRA now automatically populate as AI suggestions in Mission Control.

---

## What Was Implemented

### **Mission Control Now Shows:**

1. **AI-Suggested Meetings** (Calendar Tab)
   - Auto-populated from tasks with `work_type: 'calendar'`
   - Shows task title, description, priority, suggested time
   - Displays mentioned attendees from Slack
   - Source tracking (Slack/JIRA/Manual)

2. **AI-Drafted Emails** (Email Tab)
   - Auto-populated from tasks with `work_type: 'email'` or `work_type: 'outreach'`
   - Shows email subject (task title), preview (description)
   - Displays recipient (assignee)
   - Context labels (From Slack/From JIRA/Manual)

---

## Changes Made

### **File**: `desktop2/renderer2/src/pages/MissionControl.jsx`

**Added**:
- ✅ Import `useDeveloperTasks` hook
- ✅ Accept `user` prop parameter
- ✅ Load tasks with `route_to: 'mission-control'`
- ✅ Filter tasks by `work_type` for suggestions
- ✅ Map task data to Mission Control UI format

**Before**:
```javascript
export default function MissionControl() {
  // AI-suggested meetings (detected from action items)
  // TODO: Implement AI detection from Slack/Teams/JIRA activity
  const suggestedMeetings = [];

  // Drafted emails
  // TODO: Implement AI-generated email drafts
  const draftedEmails = [];
}
```

**After**:
```javascript
export default function MissionControl({ user }) {
  // Load tasks with developer routing (mission-control)
  const { tasks: allTasks, loading: tasksLoading } = useDeveloperTasks(user, 'all');

  // Filter tasks for AI-suggested meetings (calendar tasks)
  const suggestedMeetings = allTasks
    .filter(task => task.work_type === 'calendar' && task.status !== 'completed')
    .map(task => ({
      id: task.id,
      title: task.title,
      reason: task.description || 'Detected from Slack activity',
      priority: task.priority || 'medium',
      suggestedTime: task.due_date ? new Date(task.due_date).toLocaleString() : 'ASAP',
      attendees: task.mentioned_users?.map(id => `@${id.split('_')[1] || id}`).slice(0, 3) || [],
      source: task.external_source || 'slack',
      taskData: task
    }));

  // Filter tasks for drafted emails (email/outreach tasks)
  const draftedEmails = allTasks
    .filter(task => (task.work_type === 'email' || task.work_type === 'outreach') && task.status !== 'completed')
    .map(task => ({
      id: task.id,
      subject: task.title,
      preview: task.description || 'AI-detected email task',
      priority: task.priority || 'medium',
      to: task.assignee ? `@${task.assignee.split('_')[1] || task.assignee}` : 'Team',
      context: task.external_source === 'slack' ? 'From Slack' : task.external_source === 'jira' ? 'From JIRA' : 'Manual',
      source: task.external_source || 'slack',
      taskData: task
    }));
}
```

---

## How It Works

### **Task Flow to Mission Control**

```
1. User posts in Slack: "@sarah can you schedule a sync with the team?"
   ↓
2. SlackService detects task with calendar keywords
   ↓
3. Creates task with:
   - work_type: 'calendar'
   - route_to: 'mission-control' (because < 4 mentions)
   - mentioned_users: ['sarah']
   - assignee: 'sarah'
   ↓
4. Task appears in:
   - Developer Tasks page (if user is developer role)
   - Mission Control > Calendar > AI Suggestions
   - Sales Tasks page (dual-routing for calendar tasks)
   ↓
5. Mission Control displays as scheduling suggestion:
   - Title: "Schedule a sync with the team"
   - Suggested Time: ASAP
   - Attendees: @sarah
   - Source: From Slack
```

### **Email Task Flow**

```
1. User posts in Slack: "@mike can you reach out to the client about the proposal?"
   ↓
2. SlackService detects task with outreach keywords
   ↓
3. Creates task with:
   - work_type: 'outreach'
   - route_to: 'tasks-sales' (because > 5 mentions default)
   - OR 'mission-control' (if < 5 mentions)
   - assignee: 'mike'
   ↓
4. If routed to mission-control, appears in:
   - Mission Control > Email > AI Drafts
   - Developer Tasks page
   ↓
5. Mission Control displays as email draft:
   - Subject: "Reach out to the client about the proposal"
   - To: @mike
   - Context: From Slack
```

---

## Dual-Routing Behavior

**Calendar Tasks** appear in BOTH views:
- ✅ Mission Control (developer/admin users)
- ✅ Sales Tasks (sales users)
- This ensures cross-functional visibility

**Email/Outreach Tasks** appear in BOTH views:
- ✅ Mission Control (developer/admin users)
- ✅ Sales Tasks (sales users)
- Enables collaboration on customer communications

---

## Task Detection Criteria

### **Calendar Tasks** (`work_type: 'calendar'`)
Detected when Slack message contains:
- `schedule`, `meeting`, `call`, `sync`, `demo`, `1:1`, `standup`, `kickoff`, `review`, `retrospective`, `planning`

**AND** has fewer than 4 mentions → Routes to Mission Control

### **Email/Outreach Tasks** (`work_type: 'email'` or `'outreach'`)
Detected when Slack message contains:
- `email`, `reach out`, `follow up`, `send`, `contact`, `message`, `reply`, `respond`, `ping`, `touch base`, `check in`

**AND** has fewer than 5 mentions → Routes to Mission Control

---

## Mission Control UI Integration

### **Calendar Tab - AI Suggestions Section**

Shows calendar tasks with:
- **Title**: Task title
- **Reason**: Task description or "Detected from Slack activity"
- **Priority**: Visual indicator (urgent/high/medium/low)
- **Suggested Time**: Due date or "ASAP"
- **Attendees**: List of mentioned users
- **Schedule Button**: (Ready for future calendar integration)

### **Email Tab - AI Drafts Section**

Shows email/outreach tasks with:
- **Subject Line**: Task title
- **Preview**: Task description
- **To**: Assignee
- **Context Tag**: Source (From Slack/From JIRA/Manual)
- **AI Generated Tag**: Visual indicator
- **Sender**: AI Assistant avatar

---

## Benefits

1. ✅ **Auto-Discovery**: Tasks detected from Slack appear as suggestions
2. ✅ **Cross-Functional Visibility**: Calendar/email tasks visible to both teams
3. ✅ **Real-Time Updates**: Hook-based, auto-refreshes when tasks change
4. ✅ **Context Preservation**: Shows source, attendees, priority
5. ✅ **Role-Based Routing**: Developers see JIRA-related tasks, Sales see Slack
6. ✅ **Smart Filtering**: Only shows incomplete tasks

---

## Task Data Structure

Tasks in Mission Control have full context:

```javascript
{
  id: 'uuid',
  title: 'Schedule sync with team',
  description: 'Detected from Slack',
  work_type: 'calendar',
  route_to: 'mission-control',
  external_source: 'slack',
  priority: 'medium',
  status: 'todo',
  assignee: 'U123456',
  assignor: 'U789012',
  mentioned_users: ['U123456', 'U789012'],
  due_date: '2025-01-15T10:00:00Z',
  created_at: '2025-01-10T14:30:00Z'
}
```

---

## Testing Recommendations

### 1. **Test Calendar Task Detection**
```
In Slack: "@sarah can you schedule a meeting with john and mike?"
Expected:
- ✅ Task created with work_type: 'calendar'
- ✅ Appears in Mission Control > Calendar > AI Suggestions
- ✅ Shows: "Schedule a meeting with john and mike"
- ✅ Attendees: @sarah, @john, @mike
```

### 2. **Test Email Task Detection**
```
In Slack: "@mike can you follow up with the client?"
Expected:
- ✅ Task created with work_type: 'outreach'
- ✅ Appears in Mission Control > Email > AI Drafts
- ✅ Shows: "Follow up with the client"
- ✅ To: @mike
```

### 3. **Test Dual-Routing**
```
Create calendar task as sales user
Expected:
- ✅ Task appears in Sales Tasks page
- ✅ Task ALSO appears in Mission Control (if < 4 mentions)
```

### 4. **Test Task Completion**
```
Mark calendar task as completed
Expected:
- ❌ Task disappears from AI Suggestions (filtered out)
```

### 5. **Test Empty State**
```
No calendar/email tasks exist
Expected:
- ✅ Shows: "AI will suggest meetings based on your Slack, Teams, and JIRA activity"
- ✅ Shows: "No AI-generated drafts yet"
```

---

## Future Enhancements (Optional)

1. **Schedule Button Action**:
   - Click "Schedule" → Opens calendar integration
   - Pre-fills meeting title, attendees from task
   - Creates calendar event in Outlook/Google

2. **Draft Email Action**:
   - Click draft → Opens email composer
   - Pre-fills recipient, subject from task
   - AI generates email body from task context

3. **Task Chat Integration**:
   - Click suggestion → Opens task chat
   - Allows AI conversation about scheduling
   - Can refine meeting details before scheduling

4. **Priority Sorting**:
   - Sort suggestions by priority
   - Urgent tasks at top
   - Visual priority indicators

5. **Time Conflict Detection**:
   - Check existing calendar events
   - Suggest alternative times
   - Show availability status

---

## Files Modified

1. `desktop2/renderer2/src/pages/MissionControl.jsx` - Added task-based suggestions

---

## Related Documentation

- [TASK_ROUTING_FIX_COMPLETE.md](TASK_ROUTING_FIX_COMPLETE.md) - Task routing implementation
- [SlackService.js](desktop2/main/services/SlackService.js) - Task detection logic
- [SupabaseAdapter.js](desktop2/main/services/SupabaseAdapter.js) - Task filtering

---

## Summary

Mission Control now intelligently surfaces calendar and email tasks as AI suggestions. Tasks detected from Slack/JIRA automatically populate the scheduling suggestions and email drafts, providing real-time visibility into action items that require calendar or email follow-up.

The implementation uses the existing task routing infrastructure with dual-routing support, ensuring tasks appear in the right places based on work type and user role.

✅ Calendar tasks → AI Suggestions in Mission Control
✅ Email/outreach tasks → AI Drafts in Mission Control
✅ Dual-routing for cross-functional visibility
✅ Real-time updates via hooks
✅ Full task context preservation
