# Start Teams & Outlook Monitoring

## 🚀 Quick Start

After authenticating with Microsoft, run these commands in the DevTools Console to enable automatic task creation:

### Start Both Monitoring Services
```javascript
// Start Teams monitoring (checks every 3 minutes)
await window.electronAPI.microsoft.startTeamsMonitoring()

// Start Email monitoring (checks every 5 minutes)
await window.electronAPI.microsoft.startEmailMonitoring()
```

### Check Status
```javascript
// Get monitoring statistics
await window.electronAPI.microsoft.getMonitoringStats()
```

### Stop Monitoring
```javascript
// Stop Teams monitoring
await window.electronAPI.microsoft.stopTeamsMonitoring()

// Stop Email monitoring
await window.electronAPI.microsoft.stopEmailMonitoring()
```

## 📊 What Happens When Monitoring is Active

### Teams Monitoring (Every 3 minutes)
1. ✅ Polls all your Teams channels and chats
2. ✅ Uses AI to detect work requests
3. ✅ Auto-creates tasks when confidence > 60%
4. ✅ Tracks source (team, channel, chat, sender)
5. ✅ Shows notification in UI
6. ✅ Avoids duplicates

### Email Monitoring (Every 5 minutes)
1. ✅ Polls your Outlook inbox for unread emails
2. ✅ Filters out newsletters, spam, automated emails
3. ✅ Uses AI to detect actionable emails
4. ✅ Auto-creates tasks when confidence > 65%
5. ✅ Tracks source (email subject, sender, conversation ID)
6. ✅ Shows notification in UI
7. ✅ Optionally marks emails as read (disabled by default)

## 🎯 Examples

### Example: Teams Message Detected
```
📋 Message in #product-team channel:
"Hey @john, can you review the dashboard designs by Friday? Need your feedback."

✅ AI detects work request (confidence: 0.85)
✅ Auto-creates task:
   - Title: "Review the dashboard designs"
   - Priority: High (deadline detected)
   - Source: Teams > Product Team > #general
   - Tags: ['review', 'teams-auto', 'teams_channel']
```

### Example: Email Detected
```
📧 Email from sarah@company.com:
Subject: "Q4 Budget Analysis - Need Input"
Body: "Can you please analyze our Q4 spending and send me a report?"

✅ AI detects actionable email (confidence: 0.78)
✅ Auto-creates task:
   - Title: "Analyze Q4 spending and send report"
   - Priority: Medium
   - Source: Email > sarah@company.com
   - Tags: ['analysis', 'email-auto', 'medium']
```

## 🔔 Notifications

When a task is auto-created, you'll see:
- Desktop notification (if enabled)
- Badge counter update
- Task appears in your task list
- Console log with details

## 📈 Monitoring Stats

The stats include:
```json
{
  "teams": {
    "messagesProcessed": 145,
    "tasksCreated": 8,
    "errors": 0,
    "isMonitoring": true,
    "lastPoll": "2025-10-13T00:45:00Z"
  },
  "email": {
    "emailsProcessed": 23,
    "tasksCreated": 3,
    "errors": 0,
    "isMonitoring": true,
    "lastPoll": "2025-10-13T00:46:00Z"
  }
}
```

## ⚙️ Configuration

### Adjust Poll Intervals
Edit `desktop/main.js` around line 1769:

```javascript
// Teams monitoring
pollInterval: 3 * 60 * 1000, // 3 minutes (change to 2 or 5)

// Email monitoring  
pollInterval: 5 * 60 * 1000, // 5 minutes (change to 3 or 10)
```

### Adjust Confidence Thresholds
Edit `desktop/main.js`:

```javascript
// Teams
confidenceThreshold: 0.6, // 60% (lower = more sensitive)

// Email
confidenceThreshold: 0.65, // 65% (lower = more sensitive)
```

### Enable Auto-Mark-As-Read for Emails
Edit `desktop/main.js` around line 1801:

```javascript
autoMarkAsRead: true, // Change from false to true
```

## 🧪 Testing

### Test with Fake Data (Without Waiting)
Open DevTools Console and run:

```javascript
// Manually trigger a poll cycle (won't wait for interval)
// NOTE: This requires exposing the services, which we can add if needed

// Or check current stats
await window.electronAPI.microsoft.getMonitoringStats()
```

### Test with Real Data
1. Send yourself a Teams message with a work request
2. Send yourself an email with an action item
3. Wait 3-5 minutes for next poll cycle
4. Check console logs for detection
5. Check task list for new tasks

## 🚨 Troubleshooting

### "Teams monitoring not initialized"
- Make sure you've authenticated with Microsoft first
- Click the Microsoft 365 button in the UI
- Complete the OAuth flow

### "No user logged in"
- Log in to HeyJarvis first
- The monitoring needs to know which user to create tasks for

### Monitoring not detecting tasks
- Check confidence threshold (might be too high)
- Check console logs for AI analysis results
- Verify Microsoft scopes are granted (especially admin consent for Teams)

### Tasks being created from old messages
- This is normal on first run (processes recent history)
- The service tracks processed message IDs to avoid duplicates
- After first poll, only new messages are processed

## 🎛️ Advanced: Auto-Start on Launch

To automatically start monitoring when app launches, edit `desktop/main.js` and add after user authentication:

```javascript
// After currentUser is set (around line 2200)
if (currentUser && teamsMonitoring && emailMonitoring) {
  teamsMonitoring.startMonitoring(currentUser.id);
  emailMonitoring.startMonitoring(currentUser.id);
  console.log('✅ Auto-started Teams & Email monitoring');
}
```

## 📝 Next Steps

Once monitoring is working:
1. **Add UI controls** - Add start/stop buttons in the UI
2. **Add follow-up workflows** - Reply to emails, schedule meetings from tasks
3. **Add filters** - Skip certain channels or senders
4. **Add webhooks** - Use Microsoft Graph webhooks for real-time updates

---

**Ready?** Just run these two commands after Microsoft authentication:

```javascript
await window.electronAPI.microsoft.startTeamsMonitoring()
await window.electronAPI.microsoft.startEmailMonitoring()
```

Then sit back and let AI find your tasks! 🚀

