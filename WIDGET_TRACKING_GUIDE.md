# Widget Tracking Guide 🎯

Complete guide for creating smart widgets that track emails, JIRA updates, Slack messages, and more!

---

## 🚀 Quick Start

### Create a Widget
1. Click anywhere on the dashboard
2. Type one of the commands below
3. Click "Save"
4. Widget automatically fetches and displays real-time data!

---

## 📊 Tracker Widgets (`/track`)

Track specific items from various sources.

### Syntax
```
/track [what you want to track] from [source]
```

### Supported Sources

#### 📧 Emails
```
/track emails from amaal@example.com
/track deployment notifications from emails
/track invoice from inbox
```

**Features:**
- Tracks both Gmail and Outlook
- Filters by subject or sender name/email
- Shows read/unread status
- Displays sender name
- Auto-refreshes every 30 seconds

#### 🎯 JIRA
```
/track sprint velocity from jira
/track bugs from jira tickets
/track critical issues from jira updates
```

**Features:**
- Searches issue summary and description
- Shows issue key (e.g., SCRUM-38)
- Displays current status
- Shows reporter name
- Links to JIRA when clicked (future)

#### 📦 GitHub
```
/track repositories from github
/track react projects from github
```

**Features:**
- Lists repositories matching keyword
- Shows repo name and owner
- Displays last commit info
- Auto-refreshes

#### ✅ Tasks
```
/track action items from tasks
/track urgent from tasks
/track sprint planning from tasks
```

**Features:**
- Searches internal task database
- Shows task title and status
- Displays priority
- Real-time updates

#### 💬 Slack
```
/track mentions from slack
/track deployment from slack messages
/track john smith from slack
/track urgent from slack notifications
```

**Features:**
- Tracks recent Slack messages (last 100)
- Special filter for @mentions
- Shows message text and sender
- Indicates mention vs regular message
- Auto-refreshes every 30 seconds
- Works with Slack Bot integration

**Special Keywords:**
- Use "mentions" or "tags" to filter only @mentions
- Search by username to see all messages from that person
- Search by keyword to find messages containing that word

---

## 🔔 Notifier Widgets (`/notify`)

Get notifications about topics across all sources.

### Syntax
```
/notify [topic you care about]
```

### Examples

#### General Topics
```
/notify me about jira ticket updates
/notify deployments
/notify code reviews
/notify mentions                           ← Shows @mentions from Slack!
/notify if anyone tags me in slack
/notify me if someone emails about invoices
```

### How It Works
- **Aggregates from multiple sources**: Slack, Emails (Gmail/Outlook), JIRA, Tasks
- **Time-based**: Shows items from last 24 hours
- **Smart filtering**: Matches topic in subject, title, sender, or content
- **Multi-source display**: Each item shows its source (Slack/Slack @/Gmail/Outlook/JIRA/Tasks)
- **Pulsing badge**: Red badge pulses when there are new items

### What Gets Tracked

| Source | What's Checked | Time Range |
|--------|---------------|------------|
| **Slack** | Message text, sender, @mentions | Last 24 hours |
| **Email** | Subject, sender name | Last 24 hours |
| **JIRA** | Issue summary, description, status | Last 24 hours |
| **Tasks** | Task title, description | Last 24 hours |

---

## 🎨 Widget Features

### Visual Indicators

**Tracker Widget:**
- 🟢 Green badge: Shows item count
- 📋 Item list: Up to 3 items visible
- ↻ Refresh button: Appears on hover
- 🔄 Auto-refresh: Every 30 seconds

**Notifier Widget:**
- 🔴 Red badge: Pulses when items found
- 🏷️ Source tags: Shows where each item came from
- 📅 Real-time: Updates automatically
- ↻ Manual refresh: Click refresh icon

### Interactions

- **Click widget body**: Edit the tracking command
- **Hover over widget**: See refresh button
- **Click refresh (↻)**: Force immediate update
- **Drag header**: Move widget around dashboard
- **Click X**: Delete widget

---

## 💡 Real-World Examples

### For Product Managers
```
/track sprint retrospective from jira
/track customer feedback from emails
/notify product roadmap
```

### For Developers
```
/track pull requests from github
/track code review from emails
/track mentions from slack              ← See your @mentions!
/notify deployment
/notify urgent bugs from jira
```

### For Engineering Managers
```
/track blockers from jira
/track standup from slack messages      ← Track standup messages!
/track standup from emails
/notify team@company.com
/notify production incidents
/notify mentions                         ← Never miss being tagged!
```

### For Sales/Support
```
/track client inquiries from inbox
/notify support ticket from jira
/track john@client.com from emails
```

---

## 🛠️ Technical Details

### Data Sources

| API | Method | What It Fetches |
|-----|--------|----------------|
| Slack | `slack.getRecentMessages()` | Recent Slack messages (last 100) |
| Slack | `slack.getUserMentions()` | @mentions from Slack |
| Inbox | `inbox.getUnified()` | Emails from Gmail + Outlook |
| JIRA | `jira.getMyIssues()` | User's JIRA issues |
| Tasks | `tasks.getAll()` | Internal task database |
| GitHub | `codeIndexer.listRepositories()` | Code repositories |

### Filtering Logic

**Tracker Widgets:**
- Case-insensitive keyword matching
- Searches in: title, subject, description, sender, reporter
- Returns top 5 items, shows 3 in UI

**Notifier Widgets:**
- Time-based filtering (24 hours)
- Cross-source aggregation
- Sorted by timestamp (newest first)
- Returns top 10 items, shows 3 in UI

### Performance

- **Auto-refresh**: 30 seconds
- **Manual refresh**: Instant
- **Loading state**: Shows spinner during fetch
- **Error handling**: Displays user-friendly error messages
- **Graceful degradation**: Works even if some sources fail

---

## 🔮 Advanced Usage

### Track Specific People
```
/track amaal@company.com from emails
/track john smith from jira
```

The system will match:
- Email addresses
- Display names
- Reporter/assignee fields

### Track Keywords in Context
```
/track deployment emails
/track urgent jira tickets
/track sprint planning tasks
```

### Combine with Notifiers
Create both widgets for different views:
```
/track production issues from jira    ← See specific items
/notify production                    ← Get all notifications
```

---

## 🆘 Troubleshooting

### Widget shows "0 items found"
- ✅ Check if the source is connected (JIRA, Gmail, Outlook)
- ✅ Try a broader keyword
- ✅ Click refresh button
- ✅ Check spelling of email addresses/names

### Widget shows error message
- ❌ Source not connected → Connect via settings
- ❌ Network issue → Check internet connection
- ❌ API limit reached → Wait a few minutes

### Widget not updating
- Click the refresh button (↻) on hover
- Check if auto-refresh is working (every 30s)
- Delete and recreate the widget

---

## 🎯 Best Practices

1. **Be Specific**: Use clear keywords for better filtering
   - ✅ Good: `/track sprint-42 from jira`
   - ❌ Too broad: `/track issues from jira`

2. **Use Multiple Widgets**: Create separate trackers for different needs
   - One for emails from your manager
   - One for JIRA bugs
   - One for deployment notifications

3. **Name Matters**: Use descriptive keywords in your commands
   - The widget will show exactly what you typed
   - Makes it easy to identify widgets at a glance

4. **Refresh Strategically**: Auto-refresh is every 30s
   - Click refresh if you're waiting for something urgent
   - Otherwise, let it update automatically

5. **Organize Your Dashboard**: Drag widgets to logical positions
   - Group related widgets together
   - Keep frequently checked widgets visible

---

## 🚧 Coming Soon

- [x] **Slack Integration**: Track mentions and messages ✅ DONE!
- [ ] **Click-through**: Open source item directly from widget
- [ ] **Custom Time Ranges**: "Last 3 days" or "This week"
- [ ] **Advanced Filters**: Status, priority, assignee
- [ ] **Widget Presets**: Save and share widget configurations
- [ ] **Export Data**: Download tracked items as CSV

---

## 📝 Notes

- All tracking happens locally in your app
- No data is sent to external servers (except source APIs)
- Widgets persist across sessions (saved to localStorage)
- Maximum 3 items shown per widget (to save space)
- Full list available by expanding widget (coming soon)

---

**Need help?** Check the console logs or reach out to the team!

Happy tracking! 🎉

