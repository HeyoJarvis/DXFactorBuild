# Mission Control Routing & Timezone Fixes

## Overview
Fixed two critical issues:
1. **Timezone handling** for calendar event creation
2. **Smart routing** of calendar/outreach items to Mission Control instead of Tasks

---

## Fix #1: Timezone Handling for Event Creation

### Problem
When creating calendar events from the Mission Control UI, times were being stored in UTC instead of the user's local timezone, causing meetings to appear at the wrong time.

### Solution
**File:** `desktop2/renderer2/src/pages/MissionControl.jsx`

```javascript
// Parse the datetime-local input (which is in local time without timezone info)
// and format as ISO string for the API
const startDate = new Date(meetingData.startTime);
const endDate = new Date(meetingData.endTime);

const eventData = {
  subject: meetingData.title,
  startTime: startDate.toISOString(),
  endTime: endDate.toISOString(),
  attendees: meetingData.attendees.split(',').map(email => email.trim()).filter(e => e),
  isOnlineMeeting: meetingData.includeTeamsLink,
  body: meetingData.description || '',
  timeZone: 'America/Denver'
};
```

### How It Works
1. The `datetime-local` input provides times in local browser time
2. We parse them to Date objects and convert to ISO strings
3. The `timeZone: 'America/Denver'` parameter tells Microsoft Graph API to interpret these times in Mountain Time
4. Microsoft Graph API already had the timezone preference header set: `.header('Prefer', 'outlook.timezone="America/Denver"')`

---

## Fix #2: Smart Routing to Mission Control

### Problem
All Slack action items were being routed to Tasks (Sales), but calendar and small outreach items should go to Mission Control for better organization.

### Solution
**File:** `desktop2/main/services/SlackService.js`

### Routing Logic

```javascript
// ROUTING LOGIC:
// Calendar actions with <4 people OR outreach to <5 people → Mission Control
// Everything else → Tasks (Sales)

const calendarKeywords = ['meeting', 'schedule', 'calendar', 'call', 'sync', 'catch up', 'connect with'];
const outreachKeywords = ['follow up', 'reach out', 'email', 'contact', 'send', 'ping'];

const isCalendarAction = calendarKeywords.some(keyword => text.includes(keyword));
const isOutreachAction = outreachKeywords.some(keyword => text.includes(keyword));

const mentions = this.extractMentions(message.text);
const mentionCount = mentions.length;

const shouldRouteToMissionControl = (
  (isCalendarAction && mentionCount < 4) ||
  (isOutreachAction && mentionCount < 5)
);
```

### Examples

#### Routes to Mission Control ✅
- "Schedule a meeting with @john and @sarah" (2 people, calendar)
- "Follow up with @client about the proposal" (1 person, outreach)
- "Need to call @mike about the project" (1 person, calendar)
- "Reach out to @alex, @ben, and @casey" (3 people, outreach)

#### Routes to Tasks (Sales) 📋
- "Schedule a team meeting with @a @b @c @d" (4+ people, calendar)
- "Send email to @1 @2 @3 @4 @5 about partnership" (5+ people, outreach)
- "Can you finish the MVP?" (not calendar/outreach)
- "Please review the code" (not calendar/outreach)

### Task Data Structure

```javascript
const taskData = {
  title: "Schedule a meeting with john and sarah",
  priority: "medium",
  description: "Original Slack message text",
  tags: ['slack-auto', 'mention', 'calendar'],
  assignor: "U123456",
  mentionedUsers: ['U789', 'U101'],
  workType: 'calendar', // or 'outreach' or 'task'
  routeTo: 'mission-control' // or 'tasks-sales'
};
```

---

## Detection Keywords

### Calendar Actions
- meeting
- schedule
- calendar
- call
- sync
- catch up
- connect with

### Outreach Actions
- follow up
- reach out
- email
- contact
- send
- ping

---

## Database Sync Issue

If Slack stopped picking up updates, check:

1. **Slack App Status**
   ```bash
   # Check if Slack service is running
   ps aux | grep slack
   
   # Check logs
   tail -f desktop2/logs/*.log | grep -i slack
   ```

2. **Environment Variables**
   ```bash
   # Verify Slack tokens are set
   echo $SLACK_BOT_TOKEN
   echo $SLACK_SIGNING_SECRET
   echo $SLACK_APP_TOKEN
   ```

3. **Socket Mode**
   - Ensure `SLACK_SOCKET_MODE=true` in `.env`
   - Socket mode should auto-reconnect, but may need manual restart

4. **Restart Desktop2 App**
   ```bash
   cd desktop2
   npm start
   ```

---

## Testing

### Test Timezone Fix
1. Go to Mission Control
2. Click "New Meeting"
3. Schedule a meeting for 9:00 AM tomorrow
4. Verify it shows as 9:00 AM (not 3:00 PM or another time)

### Test Routing Logic
1. Send Slack message: "Schedule a call with @john"
   - **Expected:** Routes to Mission Control
   
2. Send Slack message: "Schedule team standup with @a @b @c @d"
   - **Expected:** Routes to Tasks (Sales)
   
3. Send Slack message: "Follow up with @client"
   - **Expected:** Routes to Mission Control
   
4. Send Slack message: "Send update to @1 @2 @3 @4 @5"
   - **Expected:** Routes to Tasks (Sales)

---

## Next Steps

1. **UI Integration:** Display Mission Control tasks in a separate section
2. **AI Suggestions:** Use these action items to populate AI-suggested meetings
3. **Auto-Scheduling:** For calendar items, offer one-click scheduling
4. **Email Drafting:** For outreach items, auto-generate email drafts

---

## Files Changed

1. `desktop2/renderer2/src/pages/MissionControl.jsx`
   - Fixed timezone handling in `handleCreateMeeting()`

2. `desktop2/main/services/SlackService.js`
   - Enhanced `detectAndCreateTask()` with routing logic
   - Added calendar/outreach keyword detection
   - Added mention counting for routing decisions

3. `core/integrations/microsoft-graph-service.js`
   - Added timezone preference header (already done)

