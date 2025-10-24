# Arc Reactor Orb - Notification System Implementation Plan 🔔

## Overview
Transform the Arc Reactor orb from a simple launcher into an intelligent notification center that displays:
- 🆕 New task assignments
- 📋 JIRA updates (status changes, comments, priority changes)
- ✅ Task completions
- 📊 Product requirement updates
- 🚀 Sprint/milestone progress

## Current State Analysis

### ✅ What We Already Have

1. **Badge System in Place** (`ArcReactorOrb.jsx` line 171-173)
   ```jsx
   <div className="orb-role-indicator">
     {currentRole === 'developer' ? '👨‍💻' : '💼'}
   </div>
   ```
   - Already positioned (bottom-right of orb)
   - Styled with backdrop blur and border
   - Easy to modify for notifications

2. **Notification Events Exist** (`desktop/main.js` line 1815-1819)
   ```javascript
   mainWindow.webContents.send('notification', {
     type: 'jira_task_synced',
     message: `New JIRA task: ${issue.key} - ${issue.summary}`,
     priority: taskData.priority
   });
   ```
   - Already sending notifications to renderer
   - Includes type, message, and priority
   - Fired during JIRA sync

3. **JIRA Event System** (`JIRAService.js` is EventEmitter)
   - Can emit custom events for updates
   - Already tracking task creation/updates

4. **IPC Communication Ready**
   - Bridge between main process and renderer
   - Can send real-time notifications

## Implementation Difficulty: **EASY** ⭐⭐☆☆☆

### Why It's Easy:
1. ✅ Badge UI already exists - just needs content update
2. ✅ Notification events already being sent
3. ✅ IPC communication working
4. ✅ State management in React already present
5. ⚠️ Only need to: Connect the dots!

## Proposed Design

### Visual Design Options

#### Option 1: Badge with Count (Simplest)
```
     👨‍💻  ← Current role indicator
      ↓
      3   ← Notification count
```
- Show number of unread notifications
- Pulse animation when new notification arrives
- Color-coded by priority (red = urgent, orange = high, blue = normal)

#### Option 2: Status Indicator (Recommended)
```
     🔴  ← Red dot for urgent
     🟠  ← Orange for high priority
     🟢  ← Green for normal updates
     ⚪  ← No notifications
```
- More subtle than count
- Clear visual priority system
- Can still show count next to indicator

#### Option 3: Progress Ring (Advanced)
```
    📊   ← Shows completion percentage
   ┌─┐   
   │ │   ← Ring fills based on task progress
   └─┘
```
- Visual progress indicator
- Great for sprint tracking
- Requires more calculation

### Recommended: **Option 2 with Count**
```jsx
<div className="orb-notification-badge">
  <span className="notification-dot urgent"></span>
  <span className="notification-count">3</span>
</div>
```

## Implementation Steps

### Step 1: Add Notification State to Orb (15 min)
**File**: `desktop2/renderer2/src/components/ArcReactor/ArcReactor.jsx`

```javascript
const [notifications, setNotifications] = useState([]);
const [unreadCount, setUnreadCount] = useState(0);

useEffect(() => {
  // Listen for notifications from main process
  if (window.electronAPI?.onNotification) {
    const cleanup = window.electronAPI.onNotification((notification) => {
      setNotifications(prev => [...prev, notification]);
      setUnreadCount(prev => prev + 1);
      
      console.log('🔔 New notification:', notification);
    });
    return cleanup;
  }
}, []);
```

### Step 2: Update Orb Badge UI (15 min)
**File**: `desktop2/renderer2/src/components/ArcReactor/ArcReactorOrb.jsx`

```jsx
// Replace current role indicator with notification badge
<div className="orb-notification-badge">
  {unreadCount > 0 ? (
    <>
      <span className={`notification-dot ${getPriorityClass(highestPriority)}`}></span>
      <span className="notification-count">{unreadCount}</span>
    </>
  ) : (
    <span className="notification-icon">
      {currentRole === 'developer' ? '👨‍💻' : '💼'}
    </span>
  )}
</div>
```

### Step 3: Add CSS Animations (10 min)
**File**: `desktop2/renderer2/src/components/ArcReactor/ArcReactorOrb.css`

```css
.orb-notification-badge {
  position: absolute;
  bottom: -5px;
  right: -5px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.9);
  backdrop-filter: blur(10px);
  border: 2px solid var(--orb-color);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: bold;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  transition: all 0.3s ease;
}

.notification-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 4px;
  animation: pulse-notification 1.5s ease-in-out infinite;
}

.notification-dot.urgent {
  background: #ff4444;
  box-shadow: 0 0 8px #ff4444;
}

.notification-dot.high {
  background: #ff9500;
  box-shadow: 0 0 8px #ff9500;
}

.notification-dot.normal {
  background: #00d9ff;
  box-shadow: 0 0 8px #00d9ff;
}

.notification-count {
  color: white;
  font-size: 12px;
  font-weight: bold;
}

@keyframes pulse-notification {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.2);
    opacity: 0.8;
  }
}

/* New notification arrival animation */
.orb-notification-badge.new-notification {
  animation: badge-bounce 0.5s ease-out;
}

@keyframes badge-bounce {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.3);
  }
  100% {
    transform: scale(1);
  }
}
```

### Step 4: Add IPC Handler for Notifications (10 min)
**File**: `desktop2/bridge/preload.js`

```javascript
window: {
  // ... existing methods
  onNotification: (callback) => {
    const listener = (event, notification) => callback(notification);
    ipcRenderer.on('notification', listener);
    return () => ipcRenderer.removeListener('notification', listener);
  }
}
```

### Step 5: Enhance Notification Events (20 min)
**File**: `desktop2/main/services/JIRAService.js`

Add notification emission during sync:

```javascript
// In syncTasks() method
if (existingTask) {
  await this.supabaseAdapter.updateTask(existingTask.id, taskData);
  tasksUpdated++;
  
  // Emit update notification if significant change
  if (this._hasSignificantChange(existingTask, issue)) {
    this.emit('task_updated', {
      type: 'jira_update',
      taskKey: issue.key,
      title: issue.summary,
      changes: this._detectChanges(existingTask, issue),
      priority: this.mapJiraPriority(issue.priority?.name)
    });
  }
} else {
  const createResult = await this.supabaseAdapter.createTask(userId, taskData);
  if (createResult.success) {
    tasksCreated++;
    
    // Emit new task notification
    this.emit('task_created', {
      type: 'new_task',
      taskKey: issue.key,
      title: issue.summary,
      priority: this.mapJiraPriority(issue.priority?.name)
    });
  }
}
```

### Step 6: Wire Up Notification Forwarding (15 min)
**File**: `desktop2/main/ipc/jira-handlers.js`

```javascript
// Listen to JIRA service events and forward to renderer
jiraService.on('task_created', (notification) => {
  const mainWindow = services.windows?.main?.getWindow();
  if (mainWindow) {
    mainWindow.webContents.send('notification', {
      ...notification,
      timestamp: Date.now()
    });
    logger.info('Notification sent to renderer:', notification.type);
  }
});

jiraService.on('task_updated', (notification) => {
  const mainWindow = services.windows?.main?.getWindow();
  if (mainWindow) {
    mainWindow.webContents.send('notification', {
      ...notification,
      timestamp: Date.now()
    });
    logger.info('Notification sent to renderer:', notification.type);
  }
});
```

### Step 7: Add Click Handler to View Notifications (20 min)
**File**: `desktop2/renderer2/src/components/ArcReactor/ArcReactor.jsx`

```javascript
const handleOrbClick = () => {
  if (unreadCount > 0) {
    // Show notification panel
    setShowNotifications(true);
  } else {
    // Open menu as before
    setIsMenuOpen(true);
  }
};

const markAllAsRead = () => {
  setNotifications([]);
  setUnreadCount(0);
};
```

## Notification Types & Priorities

### 🔴 Urgent (Red Dot)
- High priority tasks assigned to you
- Blockers added to your tasks
- Deadline approaching (< 1 day)
- Critical bugs assigned

### 🟠 High (Orange Dot)
- Medium/high priority tasks assigned
- Task status changed to "In Progress"
- PR requires your review
- Sprint ending soon

### 🟢 Normal (Green Dot)
- Task commented on
- Task description updated
- New product requirements generated
- Sprint progress milestone reached

### ⚪ Info (White/No Color)
- Task completed
- General updates
- System notifications

## Example Notification Objects

```javascript
// New task
{
  type: 'new_task',
  taskKey: 'PROJ-123',
  title: 'Implement user authentication',
  priority: 'high',
  timestamp: 1234567890,
  source: 'jira'
}

// Status update
{
  type: 'status_change',
  taskKey: 'PROJ-123',
  title: 'Task moved to In Progress',
  changes: {
    status: { from: 'To Do', to: 'In Progress' }
  },
  priority: 'normal',
  timestamp: 1234567890,
  source: 'jira'
}

// Product requirements ready
{
  type: 'requirements_generated',
  taskKey: 'PROJ-123',
  title: 'Product requirements generated',
  priority: 'normal',
  timestamp: 1234567890,
  source: 'ai'
}
```

## Enhanced Features (Optional - Phase 2)

### 1. Notification Panel (30 min)
Show list of notifications when orb is clicked:
```jsx
<div className="notification-panel">
  <div className="notification-header">
    <h3>Notifications</h3>
    <button onClick={markAllAsRead}>Clear All</button>
  </div>
  <div className="notification-list">
    {notifications.map(notif => (
      <NotificationItem key={notif.id} notification={notif} />
    ))}
  </div>
</div>
```

### 2. Sound/Desktop Notifications (15 min)
```javascript
// Play sound on new notification
const playNotificationSound = () => {
  const audio = new Audio('/sounds/notification.mp3');
  audio.play();
};

// Show OS notification
if (window.electronAPI?.showNotification) {
  window.electronAPI.showNotification({
    title: 'New Task Assigned',
    body: notification.title
  });
}
```

### 3. Grouped Notifications (20 min)
```javascript
// Group by type
const groupedNotifications = notifications.reduce((acc, notif) => {
  const key = notif.type;
  if (!acc[key]) acc[key] = [];
  acc[key].push(notif);
  return acc;
}, {});

// Show: "3 new tasks, 2 updates"
```

### 4. Smart Filtering (15 min)
```javascript
// Only show notifications relevant to user's role
const filteredNotifications = notifications.filter(notif => {
  if (currentRole === 'developer') {
    return ['new_task', 'status_change', 'pr_review'].includes(notif.type);
  } else {
    return ['deal_update', 'meeting_scheduled'].includes(notif.type);
  }
});
```

## Total Implementation Time

### Basic Implementation (Phase 1):
- Step 1-6: **~1.5 hours**
- Step 7: **+20 minutes**
- **Total: ~2 hours** for fully working notification badge

### Enhanced Features (Phase 2):
- Notification panel: +30 min
- Sound/OS notifications: +15 min
- Grouping: +20 min
- Filtering: +15 min
- **Total: +1.5 hours** for advanced features

## Testing Checklist

### ✅ Basic Functionality
- [ ] Badge shows count when notifications arrive
- [ ] Badge pulses with new notification
- [ ] Color changes based on priority
- [ ] Count updates correctly
- [ ] Badge clears when clicked

### ✅ JIRA Integration
- [ ] New task creates notification
- [ ] Task update creates notification
- [ ] Priority reflected in badge color
- [ ] Multiple notifications accumulate count

### ✅ Edge Cases
- [ ] Badge doesn't exceed 99 (show "99+")
- [ ] Notifications persist across window switches
- [ ] Notifications cleared when Mission Control opened
- [ ] No duplicate notifications

## Benefits

### For Developers:
✅ Instant awareness of new tasks without opening JIRA
✅ Visual priority indication at a glance
✅ Less context switching
✅ Proactive vs reactive workflow

### For Sales:
✅ Deal updates appear immediately
✅ Never miss a high-priority lead
✅ Product requirement completions visible
✅ Sprint progress tracking

### For Product:
✅ Feature completions tracked
✅ Bug fix notifications
✅ Release progress visibility

## Recommendation

**Start with Phase 1** (Basic notification badge with count and priority color).

This gives you:
1. ✅ Immediate value with minimal effort (~2 hours)
2. ✅ Foundation for future enhancements
3. ✅ User feedback to guide Phase 2 features
4. ✅ Working prototype to demo

Then iterate based on user feedback to add:
- Notification panel
- Grouped notifications
- Smart filtering by role

---

## Summary

### Difficulty: ⭐⭐☆☆☆ (Easy)
### Time: ~2 hours (basic) + 1.5 hours (enhanced)
### Impact: 🚀🚀🚀🚀🚀 (Very High)
### Dependencies: ✅ All in place!

**Ready to implement whenever you want!** 🎉

The hardest part is already done (badge UI, events, IPC). We just need to connect the pieces and add some CSS animations!
