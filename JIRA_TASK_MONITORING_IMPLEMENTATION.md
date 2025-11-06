# JIRA Task Monitoring Implementation

## ✅ Feature Complete

Successfully implemented a JIRA task monitoring system that allows sales/functional users to monitor developer JIRA tasks from Mission Control.

## 🎯 What Was Built

### **Concept**
Instead of a toggle view, sales users can now **select specific developer JIRA tasks** from Mission Control's Team Mode and click a "Monitor" button to add them to their own task list for tracking.

### **1. Frontend Hook Updates** (`useSalesTasks.js`)

Added new monitoring functionality to the sales tasks hook:

- **`monitorTask(developerTask)`** - Creates a linked copy of a developer's JIRA task for the sales user
  - Adds `[Monitoring]` prefix to title
  - Copies all JIRA metadata (key, status, story points, sprint, etc.)
  - Adds `monitored: true` flag to workflow_metadata
  - Stores reference to original task ID

- **`unmonitorTask(taskId)`** - Removes a monitored task from the sales user's list

- **`jiraView` state** - Toggle between regular tasks and JIRA-linked tasks (kept for future use)

- **`jiraConnected` state** - Tracks JIRA connection status

### **2. Mission Control Integration** (`MissionControl.jsx`)

Updated Mission Control to support task monitoring:

- Extracts `monitorTask` and `unmonitorTask` from `useSalesTasks` hook
- Passes `monitorTask` function to `TeamContext` component
- Passes `user` object to `TeamContext` for role checking

### **3. Team Context Component** (`TeamContext.jsx`)

Enhanced team context to show monitor buttons on JIRA tasks:

- Added `user` and `onMonitorTask` props
- Added `monitoringTasks` state to track which tasks are being monitored
- Added `handleMonitorTask()` function with error handling
- Updated task card rendering to show "Monitor" button for:
  - JIRA tasks only (`source === 'jira'` and has `external_key`)
  - Sales users only (`user.role === 'sales'` or `user.user_role === 'sales'`)
  - When `onMonitorTask` handler is provided

**Monitor Button States:**
- **Default**: Blue gradient button with eye icon + "Monitor" text
- **Monitoring**: Green gradient button with checkmark icon + "Monitoring" text (disabled)
- **After Click**: Button stays in "Monitoring" state to indicate task is being watched

### **4. Visual Indicators** (`ActionItem.jsx` + CSS)

Added visual feedback for monitored tasks in the sales user's task list:

**ActionItem Component:**
- Detects monitored tasks via `workflow_metadata.monitored === true`
- Adds `monitored` class to task card
- Shows floating "Monitoring" badge in top-right corner with eye icon

**Styling:**
- **Monitored Badge**: Green gradient badge with pulsing animation
- **Task Card**: Green left border (4px) with subtle green background tint
- **Hover Effect**: Enhanced green border on hover

### **5. CSS Styling**

**TeamContext.css:**
```css
.monitor-task-btn - Blue gradient button with hover effects
.monitor-task-btn.monitored - Green gradient for monitored state
.task-card.monitored - Green border-left indicator
```

**ActionItem.css:**
```css
.action-item-clean.monitored - Green left border + gradient background
.monitored-badge - Floating badge with pulse animation
@keyframes pulse-monitoring - Subtle pulsing effect
```

## 🔄 User Flow

### For Sales Users:

1. **Navigate to Mission Control** → Switch to **Team Mode**
2. **Select a team/unit** to view team members' tasks
3. **Find JIRA tasks** in the Team Context panel (left side)
4. **Click "Monitor"** button on any JIRA task
5. **Task is copied** to their personal task list with:
   - `[Monitoring]` prefix in title
   - All JIRA metadata preserved
   - Green "Monitoring" badge visible
   - Green left border indicator

6. **View monitored tasks** in:
   - Personal Mode task list (Mission Control)
   - Tasks page (standalone)
   - Both show the green monitoring badge

7. **Stop monitoring**: Delete the monitored task from their list

### For Developers:

- No changes to their workflow
- Their JIRA tasks remain unchanged
- Sales users monitoring their tasks doesn't affect them

## 📊 Data Structure

### Monitored Task Format:
```javascript
{
  title: "[Monitoring] Build dashboard for client X",
  description: "Monitoring PROJ-456",
  priority: "high",
  routeTo: "tasks-sales",
  workType: "task",
  externalId: "jira_12345",
  externalKey: "PROJ-456",
  externalUrl: "https://your-domain.atlassian.net/browse/PROJ-456",
  externalSource: "jira",
  jira_status: "In Progress",
  jira_issue_type: "Story",
  jira_priority: "High",
  story_points: 8,
  sprint: "Sprint 48",
  labels: ["monitored"],
  workflow_metadata: {
    monitored: true,
    originalTaskId: "abc-123",
    monitoredAt: "2025-11-03T10:30:00Z"
  }
}
```

## 🎨 UI/UX Features

### Visual Hierarchy:
1. **Monitor Button** - Clear call-to-action in team context
2. **Monitoring Badge** - Immediate feedback after clicking
3. **Green Indicators** - Consistent color coding for monitored tasks
4. **Pulsing Animation** - Subtle attention-grabbing effect

### Accessibility:
- Descriptive button text ("Monitor" / "Monitoring")
- Tooltip titles on buttons
- Disabled state for already-monitored tasks
- SVG icons with proper stroke widths

### Responsive Design:
- Buttons scale with card size
- Badge positioned absolutely to avoid layout shifts
- Hover effects provide clear feedback

## 🔮 Future Enhancements

### Potential Additions:
1. **Auto-sync**: Automatically update monitored tasks when JIRA status changes
2. **Notifications**: Alert sales users when monitored task status changes
3. **Bulk Monitor**: Select multiple tasks to monitor at once
4. **Monitor Groups**: Create groups of related tasks to monitor together
5. **Activity Feed**: Show history of status changes for monitored tasks
6. **Client Updates**: One-click button to send client update about monitored task progress

### Backend Requirements (Not Yet Implemented):
- **JIRA getIssue handler**: Fetch individual JIRA issue details (TODO #6)
- **Webhook support**: Listen for JIRA updates to sync monitored tasks
- **Database indexes**: Optimize queries for monitored tasks

## 📝 Notes

- **No backend changes required** for basic functionality - uses existing task creation/deletion
- **Monitored tasks are copies**, not references - they won't auto-update (yet)
- **Sales users can monitor any JIRA task** they see in team context
- **Developers' tasks remain unchanged** - monitoring is non-invasive

## 🚀 Benefits

1. **Transparency**: Sales can track dev progress without interrupting developers
2. **Client Communication**: Easy to see when to send client updates
3. **Unified View**: Don't need to switch to JIRA for basic status checks
4. **Flexible**: Can monitor any JIRA task from any team member
5. **Non-Intrusive**: Developers aren't notified when their tasks are monitored


