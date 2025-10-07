# Task Chat Meeting Scheduling

## Overview
Meeting scheduling via Microsoft Outlook/Teams now works in **both** the main copilot chat and task-specific chats!

## How It Works

### Main Chat
When you ask the AI to schedule a meeting in the main chat:
```
User: "Schedule a meeting with shail@heyjarvis.ai tomorrow at 3pm to discuss the dashboard"
AI: [SCHEDULE_MEETING: attendees=shail@heyjarvis.ai, time=2025-10-08T15:00, subject=Dashboard Discussion]
    I'll create this meeting for you right now...
System: ✅ Meeting Scheduled! Calendar invites sent.
```

### Task Chat
When you ask the AI to schedule a meeting within a task chat:
```
Task: "Dashboard Redesign Project"
User: "Schedule a meeting with the team tomorrow at 3pm to review progress"
AI: [SCHEDULE_MEETING: attendees=team@company.com, time=2025-10-08T15:00, subject=Dashboard Redesign Project - Progress Review]
    I'll create this meeting for you right now...
System: ✅ Meeting Scheduled! The meeting is linked to this task: "Dashboard Redesign Project"
```

## Task Chat Advantages

### Automatic Context Inclusion
When scheduling from a task chat, the system automatically:
1. **Includes task title in the subject** - Makes it clear what the meeting is about
2. **Adds task details to meeting body** - Includes task description for context
3. **References the task in confirmation** - Shows which task the meeting relates to

### Example Meeting Body
```
Meeting scheduled from task: Dashboard Redesign Project

Task Description: Redesign the analytics dashboard with new metrics and improved UX
```

## Technical Details

### AI Marker Format
The AI uses this exact format to trigger meeting creation:
```
[SCHEDULE_MEETING: attendees=email@domain.com, time=YYYY-MM-DDTHH:mm, subject=Meeting Subject]
```

**Multiple attendees:**
```
[SCHEDULE_MEETING: attendees=email1@domain.com;email2@domain.com, time=2025-10-08T15:00, subject=Team Meeting]
```

### Logging
Task chat meetings have separate logging with `[Task Chat]` prefix:
```
🔍 [Task Chat] Checking for meeting marker in AI response...
📝 [Task Chat] AI Response preview: [SCHEDULE_MEETING: attendees=...
🎯 [Task Chat] Meeting marker found: true
🔧 [Task Chat] Microsoft automation available: true
📅 [Task Chat] Meeting scheduling detected in AI response!
📅 [Task Chat] Creating calendar event: {...}
✅ [Task Chat] Calendar event created successfully: evt_12345
```

## Features

### Both Chat Types Support:
- ✅ Single and multiple attendees
- ✅ Custom meeting subjects
- ✅ Automatic Teams meeting link
- ✅ 30-minute default duration
- ✅ Mountain Time timezone
- ✅ Calendar invites sent to all attendees
- ✅ Error handling and fallback messages
- ✅ Detection when AI doesn't use marker format

### Task Chat Specific:
- ✅ Task context in meeting body
- ✅ Task title in meeting subject
- ✅ Task reference in confirmation
- ✅ Separate logging for debugging

## Usage Examples

### Main Chat Examples
```
"Schedule a meeting with john@company.com tomorrow at 2pm"
"Book a call with sarah@company.com and mike@company.com next Monday at 10am to discuss Q4 planning"
"Create a calendar event with the team on Friday at 3pm"
```

### Task Chat Examples
```
"Schedule a kickoff meeting with stakeholders tomorrow at 10am"
"Book a review session with the client next week at 2pm"
"Create a sync meeting with the team on Thursday at 11am"
```

## Troubleshooting

### If Meeting Doesn't Get Created:
1. **Check console logs** - Look for `[Task Chat]` or main chat meeting detection logs
2. **Verify Microsoft authentication** - Ensure you're logged into Microsoft 365
3. **Check AI response** - The AI must include the exact marker format
4. **Look for error messages** - System will show specific error if creation fails

### Common Issues:
- **"Microsoft not authenticated"** - Click the Microsoft button to authenticate
- **"email.split is not a function"** - This bug is now fixed
- **AI doesn't use marker** - System will add a note asking you to try again

## Testing

### Test Main Chat:
```bash
# Restart the app
# In main chat, say:
"Schedule a meeting with shail@heyjarvis.ai tomorrow at 4pm to discuss the dashboard"
```

### Test Task Chat:
```bash
# Restart the app
# Open any task
# In task chat, say:
"Schedule a meeting with the team tomorrow at 3pm to review progress"
```

Both should create actual calendar events with Teams meeting links!
