# 🎯 Live JIRA Task Card - Real-Time Task Editing in Context

## Overview

The **Live JIRA Task Card** appears at the top of task-based chats, giving you real-time visibility and editing capabilities for JIRA issues without leaving the conversation.

## What It Does

When you open a chat for a JIRA task, a beautiful gradient card appears showing:
- **Live status** and priority
- **Current assignee**
- **Last sync time**
- **Quick action buttons** for common operations

The card **auto-refreshes every 30 seconds** to show the latest state from JIRA!

## Visual Design

```
┌────────────────────────────────────────────────┐
│ 🎨 Beautiful gradient card (purple to blue)   │
│                                                │
│  Fix login bug                       🔄 Sync  │
│  PROJ-123 • Task                               │
│                                                │
│  [To Do] [🟡 Medium] [👤 John Doe]            │
│                                                │
│  [▶️ Start] [✓ Done] [✏️ Edit] [🔗 JIRA]     │
│                                                │
│                         Updated 3:45:23 PM    │
└────────────────────────────────────────────────┘
```

## Features

### 1. Real-Time Status Display
- ✅ Current status with color-coding
- ✅ Priority level with emoji indicators
- ✅ Assignee information
- ✅ Last update timestamp

### 2. Quick Actions
**▶️ Start** - Move to "In Progress"
- One-click status transition
- Perfect for starting work

**✓ Done** - Mark as complete
- Instant completion
- Closes the loop

**✏️ Edit** - Open full editor
- Opens the comprehensive JIRA editor modal
- Edit description, priority, add comments

**🔗 JIRA** - Open in browser
- Deep link to original JIRA issue
- Switch to full JIRA interface

### 3. Live Sync Button
**🔄 Sync** - Manual refresh
- Pull latest data from JIRA
- Instant update
- Shows notification

### 4. Auto-Refresh
- Automatically syncs every **30 seconds**
- Silent background updates
- No interruption to your chat
- Stops when chat closes

## How to Use

### Opening a JIRA Task Chat

```
1. Go to Tasks tab
2. Find a JIRA task (has JIRA badge)
3. Click the 💬 chat button
4. Live card appears at top!
```

### Quick Status Change

```
1. In task chat, see live card
2. Click "Start" button
3. ✅ "PROJ-123 moved to In Progress"
4. Card updates immediately
5. Continue chatting about the task
```

### Monitoring Real-Time Updates

```
Scenario: Teammate updates the issue in JIRA

1. You're in task chat working on PROJ-123
2. Teammate changes priority to "Highest" in JIRA
3. Within 30 seconds, your card updates
4. You see: 🔴 Highest (was 🟡 Medium)
5. No manual refresh needed!
```

### Full Editing Flow

```
1. In task chat, see live card
2. Click "Edit" button
3. Full JIRA editor opens
4. Edit description, add comment, change priority
5. Close editor
6. Live card refreshes with changes
7. Continue task conversation
```

## Technical Details

### Auto-Refresh Logic

```javascript
// Starts when JIRA task chat opens
function startJiraCardAutoRefresh() {
  // Refresh every 30 seconds
  setInterval(async () => {
    if (currentTaskChat && currentTaskChat.externalKey) {
      await updateLiveJiraCard(currentTaskChat);
    }
  }, 30000);
}

// Stops when chat closes
function stopJiraCardAutoRefresh() {
  clearInterval(jiraCardRefreshInterval);
}
```

### Data Fetching

```javascript
// Fetches latest JIRA data
async function updateLiveJiraCard(task) {
  // 1. Fetch all issues from JIRA
  const result = await window.electronAPI.jira.getMyIssues();
  
  // 2. Find specific issue by key
  const jiraIssue = result.issues.find(
    issue => issue.key === task.externalKey
  );
  
  // 3. Update UI with latest data
  updateCardUI(jiraIssue);
}
```

### Status Colors

| Status | Color | Background |
|--------|-------|------------|
| To Do | Gray | `rgba(115, 115, 115, 0.5)` |
| In Progress | Blue | `rgba(0, 122, 255, 0.5)` |
| In Review | Orange | `rgba(255, 149, 0, 0.5)` |
| Done | Green | `rgba(52, 199, 89, 0.5)` |
| Backlog | Gray | `rgba(142, 142, 147, 0.5)` |

### Priority Icons

| Priority | Emoji |
|----------|-------|
| Highest | 🔴 |
| High | 🟠 |
| Medium | 🟡 |
| Low | 🟢 |
| Lowest | 🔵 |

## Integration with Existing Features

### Works With:
- ✅ **Task Chat** - Appears in all JIRA task chats
- ✅ **Full JIRA Editor** - Edit button opens comprehensive modal
- ✅ **Quick Actions** - Start/Done buttons from task list
- ✅ **Auto-Sync** - Syncs with periodic JIRA task sync
- ✅ **Notifications** - All actions show status notifications

### Seamless Flow:
```
Main Task List → Task Chat (with live card) → Full Editor → Back to Chat
         ↓                    ↓                      ↓              ↓
   Quick Actions      Live Updates          Deep Editing    Auto-Refresh
```

## Use Cases

### Use Case 1: Stand-Up Prep
**Scenario:** Preparing for daily stand-up

```
1. Open JIRA task chat for each task
2. See live status on card
3. Update status as you go
4. Add quick comments
5. All synced to JIRA in real-time
```

### Use Case 2: Collaborative Work
**Scenario:** Working with teammate on same issue

```
You: Open task chat, click "Start"
Them: Add comment in JIRA "Working on backend part"
You: Card auto-refreshes, shows latest update
You: Add comment via card "I'll handle frontend"
Them: Sees update in JIRA immediately
```

### Use Case 3: Quick Triage
**Scenario:** Reviewing multiple issues quickly

```
For each JIRA task:
1. Open task chat
2. Review live card status
3. Click Start/Done as needed
4. Close chat
5. Move to next task

Result: All issues updated in JIRA without
switching between apps!
```

### Use Case 4: AI-Assisted Work
**Scenario:** Using AI help while tracking progress

```
1. Open JIRA task chat
2. Ask AI: "How should I approach this bug?"
3. AI suggests approach
4. Click "Start" on live card
5. Ask AI: "Generate test cases"
6. AI provides tests
7. Click "Done" when finished
8. All status updates synced to JIRA
```

## Benefits

### 1. **Context Preservation**
- See task details while chatting
- No mental context switching
- All info in one place

### 2. **Real-Time Visibility**
- Always see latest status
- Know if teammates update
- Avoid stale data

### 3. **Instant Actions**
- One-click status changes
- No navigation required
- Stay in flow state

### 4. **Seamless Integration**
- Works with existing JIRA
- No new tools to learn
- Familiar workflows

## Configuration

### Auto-Refresh Interval

Currently set to **30 seconds**. To change:

```javascript
// In unified.html, line ~4175
jiraCardRefreshInterval = setInterval(async () => {
  // ...
}, 30000); // Change this value (milliseconds)

// Examples:
// 15000  = 15 seconds
// 60000  = 1 minute
// 120000 = 2 minutes
```

### Disable Auto-Refresh

To disable auto-refresh:

```javascript
// Comment out in openTaskChat():
// if (isJiraTask && task.externalKey) {
//   startJiraCardAutoRefresh();
// }
```

## Troubleshooting

### Card Not Showing

**Check:**
1. Is this a JIRA task? (has `jira-auto` tag)
2. Does task have `externalKey`?
3. Is JIRA connected? (green dot on JIRA button)

**Solution:**
```javascript
// Check in console:
console.log(currentTaskChat);
// Should show: externalKey: "PROJ-123"
```

### Card Shows "Loading..."

**Cause:** JIRA API call is slow or failed

**Solution:**
1. Check network connection
2. Verify JIRA authentication
3. Click "Sync" button to retry

### Actions Not Working

**Cause:** JIRA commands failing

**Solution:**
1. Check that status transitions exist in workflow
2. Verify you have permission to edit issue
3. Check console for error messages

### Auto-Refresh Not Working

**Check:**
1. Is interval set? Check `jiraCardRefreshInterval`
2. Does task have `externalKey`?
3. Is JIRA connection active?

**Debug:**
```javascript
// In console:
console.log('Interval active:', jiraCardRefreshInterval !== null);
```

## Performance Considerations

### API Calls
- **On chat open:** 1 JIRA API call
- **Every 30 seconds:** 1 JIRA API call
- **On manual sync:** 1 JIRA API call
- **On action (Start/Done):** 1 JIRA API call

### Optimization
- Card only loads for JIRA tasks
- Stops refreshing when chat closes
- Uses existing `getMyIssues` endpoint
- Caches issue data in memory

### Network Usage
```
Per 30-second refresh:
- GET /rest/api/3/search/jql
- Returns max 100 issues
- Filters to find specific issue
- ~5-10 KB per request

Daily usage (8 hours active):
- 16 refreshes per chat per hour
- 128 refreshes per day (if one chat open)
- ~1 MB total
```

## Future Enhancements

Planned features:
- [ ] **Watchers list** - See who's watching the issue
- [ ] **Time tracking** - Log time directly from card
- [ ] **Subtasks** - Show/create subtasks
- [ ] **Activity feed** - Recent comments/changes
- [ ] **@ Mentions** - Notify teammates
- [ ] **Attachments** - Upload files
- [ ] **Custom fields** - Edit custom JIRA fields
- [ ] **Keyboard shortcuts** - Quick actions via keys
- [ ] **Drag to reorder** - Change priority by dragging
- [ ] **Multi-select** - Bulk actions on multiple issues

## Summary

✅ **Live JIRA card** at top of task chats  
✅ **Real-time updates** every 30 seconds  
✅ **Quick actions** without leaving chat  
✅ **Status & priority** always visible  
✅ **One-click editing** with full modal  
✅ **Auto-sync** with main task list  
✅ **Beautiful design** with gradient background  
✅ **Smart visibility** - only for JIRA tasks  

**Result:** Work on JIRA issues while having context-aware AI conversations! 🚀

