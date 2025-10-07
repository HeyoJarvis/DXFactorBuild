# 🚀 Microsoft 365 Integration Guide

Complete guide to setting up and using Microsoft 365 integration in HeyJarvis for automated calendar events, emails, and Teams meetings.

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Setup Instructions](#setup-instructions)
3. [Features](#features)
4. [Usage Examples](#usage-examples)
5. [API Reference](#api-reference)
6. [Troubleshooting](#troubleshooting)

---

## 🎯 Overview

HeyJarvis integrates with Microsoft 365 to provide:

- **📅 Calendar Automation**: Auto-create events from workflows
- **📧 Email Notifications**: Send task assignments via Outlook
- **👥 Teams Integration**: Schedule meetings and send messages
- **🤖 AI-Powered**: Intelligent detection of when to trigger actions
- **⚡ Smart Scheduling**: Find available meeting times automatically

---

## 🔧 Setup Instructions

### Step 1: Create Azure AD Application

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** → **App registrations**
3. Click **New registration**
4. Fill in the details:
   - **Name**: `HeyJarvis`
   - **Supported account types**: `Accounts in any organizational directory and personal Microsoft accounts`
   - **Redirect URI**: `http://localhost:8889/auth/microsoft/callback`
5. Click **Register**

### Step 2: Configure API Permissions

1. In your app, go to **API permissions**
2. Click **Add a permission** → **Microsoft Graph** → **Delegated permissions**
3. Add these permissions:
   - `User.Read`
   - `Mail.Send`
   - `Mail.ReadWrite`
   - `Calendars.ReadWrite`
   - `Chat.ReadWrite`
   - `ChannelMessage.Send`
   - `OnlineMeetings.ReadWrite`
4. Click **Add permissions**
5. Click **Grant admin consent** (if you're an admin)

### Step 3: Create Client Secret

1. Go to **Certificates & secrets**
2. Click **New client secret**
3. Add a description: `HeyJarvis Secret`
4. Choose expiration: `24 months` (recommended)
5. Click **Add**
6. **⚠️ IMPORTANT**: Copy the secret value immediately (you won't see it again!)

### Step 4: Configure Environment Variables

Add these to your `.env` file:

```bash
# Microsoft 365 Configuration
MICROSOFT_CLIENT_ID=your_application_client_id
MICROSOFT_CLIENT_SECRET=your_client_secret_value
MICROSOFT_TENANT_ID=common
MICROSOFT_REDIRECT_URI=http://localhost:8889/auth/microsoft/callback
```

**Where to find these:**
- **Client ID**: Overview page of your Azure app
- **Client Secret**: The value you copied in Step 3
- **Tenant ID**: Use `common` for multi-tenant, or your specific tenant ID

### Step 5: Test Authentication

1. Restart HeyJarvis
2. The Microsoft OAuth handler will initialize automatically
3. You're ready to authenticate!

---

## ✨ Features

### 1. **Automatic Calendar Events**

When a workflow mentions scheduling or meetings, HeyJarvis automatically:
- Creates calendar events
- Invites attendees
- Generates Teams meeting links
- Sets appropriate reminders

**Example Workflow:**
```
"Schedule a meeting with John and Sarah to discuss Q4 roadmap"
```

**Result:**
- ✅ Calendar event created
- ✅ John and Sarah invited
- ✅ Teams meeting link generated
- ✅ Email notifications sent

### 2. **Email Notifications**

Automatically sends emails for:
- Task assignments
- Urgent requests
- Deadline reminders
- Status updates

**Example:**
```
"Assign bug fix to Mike - urgent"
```

**Result:**
- ✅ Email sent to Mike
- ✅ Priority marked as HIGH
- ✅ Task details included

### 3. **Smart Scheduling**

Finds available meeting times by:
- Checking attendee calendars
- Avoiding conflicts
- Suggesting optimal times
- Respecting working hours

### 4. **Teams Integration**

- Post messages to channels
- Create Teams meetings
- Send direct messages
- Share workflow updates

---

## 💡 Usage Examples

### Example 1: Manual Calendar Event

```javascript
// In renderer process
const result = await window.electronAPI.microsoft.createEvent({
  subject: "Product Review Meeting",
  body: "Quarterly product review with stakeholders",
  startTime: "2025-10-15T10:00:00Z",
  endTime: "2025-10-15T11:00:00Z",
  attendees: ["john@company.com", "sarah@company.com"],
  isOnlineMeeting: true
});

console.log("Meeting link:", result.meetingLink);
```

### Example 2: Auto-Execute Workflow Actions

```javascript
// Automatically analyze workflow and execute appropriate actions
const workflow = {
  id: "workflow-123",
  title: "Schedule kickoff meeting for new project",
  description: "Need to align with engineering team on timeline",
  priority: "high",
  workflow_metadata: {
    assignor: "U01EVR49DDX",
    assignee: "U09GJSJLDNW"
  }
};

const userEmails = {
  "U01EVR49DDX": "manager@company.com",
  "U09GJSJLDNW": "engineer@company.com"
};

const result = await window.electronAPI.microsoft.executeWorkflowActions(
  workflow,
  userEmails
);

// Result shows what actions were taken
console.log("Actions executed:", result.actionsExecuted);
// [
//   { type: 'calendar_event', result: {...} },
//   { type: 'email', result: {...} }
// ]
```

### Example 3: Find Available Meeting Times

```javascript
const result = await window.electronAPI.microsoft.findMeetingTimes(
  ["john@company.com", "sarah@company.com"],
  60, // duration in minutes
  {
    startTime: "2025-10-15T00:00:00Z",
    endTime: "2025-10-22T00:00:00Z"
  }
);

console.log("Available times:", result.suggestions);
```

### Example 4: Send Email

```javascript
const result = await window.electronAPI.microsoft.sendEmail({
  to: ["team@company.com"],
  subject: "Weekly Status Update",
  body: "<h1>This week's progress</h1><p>Great work team!</p>",
  isHtml: true,
  importance: "high"
});
```

---

## 📚 API Reference

### IPC Handlers (Renderer → Main)

#### `microsoft:authenticate`
Starts OAuth flow and authenticates user.

```javascript
const result = await window.electronAPI.microsoft.authenticate();
// Returns: { success: true, account: {...}, expiresOn: Date }
```

#### `microsoft:createEvent`
Creates a calendar event.

```javascript
await window.electronAPI.microsoft.createEvent({
  subject: string,
  body: string,
  startTime: ISO8601 string,
  endTime: ISO8601 string,
  attendees: string[],
  isOnlineMeeting: boolean,
  location: string (optional)
});
```

#### `microsoft:sendEmail`
Sends an email.

```javascript
await window.electronAPI.microsoft.sendEmail({
  to: string[],
  cc: string[] (optional),
  bcc: string[] (optional),
  subject: string,
  body: string,
  isHtml: boolean,
  importance: 'normal' | 'high' | 'low'
});
```

#### `microsoft:executeWorkflowActions`
Automatically analyzes workflow and executes appropriate Microsoft actions.

```javascript
await window.electronAPI.microsoft.executeWorkflowActions(
  workflow: Object,
  userEmails: Object
);
```

#### `microsoft:findMeetingTimes`
Finds available meeting times for attendees.

```javascript
await window.electronAPI.microsoft.findMeetingTimes(
  attendees: string[],
  durationMinutes: number,
  options: {
    startTime: ISO8601 string,
    endTime: ISO8601 string,
    maxCandidates: number
  }
);
```

#### `microsoft:getUserProfile`
Gets current user's Microsoft profile.

```javascript
const result = await window.electronAPI.microsoft.getUserProfile();
// Returns: { success: true, user: { displayName, mail, ... } }
```

---

## 🔍 How It Works

### AI-Powered Intent Detection

The system uses Claude Sonnet 4.5 to analyze workflows and determine:

1. **Should a calendar event be created?**
   - Detects keywords: "meeting", "schedule", "call", "sync"
   - Extracts date/time information
   - Identifies attendees

2. **Should an email be sent?**
   - Detects task assignments
   - Identifies urgent items
   - Determines recipients

3. **Should a Teams meeting be scheduled?**
   - Detects collaboration needs
   - Identifies team discussions
   - Suggests meeting format

### Example Analysis

**Input Workflow:**
```
"Schedule a 30-minute sync with engineering team tomorrow at 2 PM to discuss API integration"
```

**AI Analysis:**
```json
{
  "needsCalendarEvent": true,
  "needsEmail": true,
  "needsTeamsMeeting": true,
  "confidence": 0.95,
  "suggestedEventDetails": {
    "subject": "API Integration Sync",
    "startTime": "2025-10-08T14:00:00Z",
    "duration": 30,
    "attendees": ["engineering-team@company.com"],
    "isUrgent": false
  }
}
```

---

## 🛠️ Troubleshooting

### Issue: "Microsoft not authenticated"

**Solution:**
1. Call `window.electronAPI.microsoft.authenticate()` first
2. Complete the OAuth flow in your browser
3. Wait for success message
4. Try your action again

### Issue: "Invalid scope requested"

**Solution:**
1. Check Azure app permissions
2. Ensure all required scopes are added
3. Grant admin consent if needed
4. Restart HeyJarvis

### Issue: "Token expired"

**Solution:**
- Re-authenticate: `window.electronAPI.microsoft.authenticate()`
- Tokens expire after 1 hour by default
- Future versions will implement automatic refresh

### Issue: "Calendar event not created"

**Checklist:**
- ✅ Authenticated with Microsoft
- ✅ Start time is in the future
- ✅ End time is after start time
- ✅ Attendee emails are valid
- ✅ User has calendar permissions

### Issue: "Email not sent"

**Checklist:**
- ✅ Authenticated with Microsoft
- ✅ `Mail.Send` permission granted
- ✅ Recipient emails are valid
- ✅ Subject and body are provided

---

## 🔒 Security Best Practices

1. **Never commit secrets**
   - Keep `.env` in `.gitignore`
   - Use environment variables only

2. **Rotate secrets regularly**
   - Azure secrets should be rotated every 6-12 months
   - Update `.env` when rotating

3. **Limit permissions**
   - Only request permissions you need
   - Review permissions periodically

4. **Use service accounts**
   - For production, use dedicated service accounts
   - Avoid using personal accounts

---

## 📊 Monitoring & Logs

All Microsoft actions are logged to:
- **Console**: Real-time debugging
- **File**: `logs/microsoft-graph.log`
- **Automation**: `logs/microsoft-automation.log`

**Log Levels:**
- `info`: Successful operations
- `warn`: Potential issues
- `error`: Failed operations
- `debug`: Detailed debugging (development only)

---

## 🚀 Future Enhancements

- [ ] Automatic token refresh
- [ ] Batch operations
- [ ] SharePoint integration
- [ ] OneDrive file sharing
- [ ] Planner task sync
- [ ] Advanced scheduling rules
- [ ] Multi-account support

---

## 📞 Support

If you encounter issues:

1. Check the logs: `logs/microsoft-*.log`
2. Verify environment variables
3. Test authentication flow
4. Review Azure app configuration

---

**Last Updated:** October 7, 2025  
**Status:** ✅ Fully Implemented and Tested
