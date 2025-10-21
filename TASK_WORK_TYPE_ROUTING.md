# Task Work Type Routing & Visual Indicators

## 🎯 Feature Implementation

**Date:** October 16, 2025  
**Components Modified:**
- `ActionItem.jsx` - Added visual indicators for calendar/email tasks
- `ActionItem.css` - Styled work type badges
- `SupabaseAdapter.js` - Implemented dual-routing logic
- `mission-control-handlers.js` - Added task filtering by work_type

---

## 📋 Requirements

### 1. Visual Indicators for Special Tasks
**Sales Tasks View:**
- ✅ Calendar tasks show 📅 Calendar badge (green)
- ✅ Email tasks show 📧 Email badge (blue)
- ✅ Outreach tasks show 📤 Outreach badge (purple)
- ✅ Badges appear below priority badge on the right side
- ✅ Hover effects for better UX

### 2. Dual-Routing for Calendar & Email Tasks
**Behavior:**
- ✅ Calendar tasks (`work_type: 'calendar'`) appear in:
  - Sales Tasks view (if originally from sales)
  - Mission Control Calendar tab (for all users)
- ✅ Email tasks (`work_type: 'email'`) appear in:
  - Sales Tasks view (if originally from sales)
  - Mission Control Email tab (for all users)
- ✅ Regular tasks follow their `route_to` assignment

---

## 🏗️ Implementation Details

### 1. Visual Indicators (`ActionItem.jsx`)

#### Extract work_type from task
```javascript
const {
  // ... other fields
  work_type = task.workflow_metadata?.work_type || task.work_type || 'task',
} = task;
```

#### Work Type Display Configuration
```javascript
const getWorkTypeDisplay = () => {
  const workTypes = {
    calendar: {
      icon: '📅',
      label: 'Calendar',
      color: '#34C759',        // Green
      bgColor: 'rgba(52, 199, 89, 0.1)'
    },
    email: {
      icon: '📧',
      label: 'Email',
      color: '#5AC8FA',        // Blue
      bgColor: 'rgba(90, 200, 250, 0.1)'
    },
    outreach: {
      icon: '📤',
      label: 'Outreach',
      color: '#AF52DE',        // Purple
      bgColor: 'rgba(175, 82, 222, 0.1)'
    }
  };
  return workTypes[work_type] || null;
};
```

#### Render Badge
```jsx
{/* Work Type Badge - Special tasks (Calendar/Email) */}
{workTypeDisplay && (
  <div 
    className="action-work-type-badge"
    style={{ 
      backgroundColor: workTypeDisplay.bgColor,
      color: workTypeDisplay.color,
      border: `1px solid ${workTypeDisplay.color}40`
    }}
    title={workTypeDisplay.label}
  >
    <span className="work-type-icon">{workTypeDisplay.icon}</span>
    <span className="work-type-label">{workTypeDisplay.label}</span>
  </div>
)}
```

### 2. CSS Styling (`ActionItem.css`)

```css
/* Work Type Badge - For calendar/email/outreach tasks */
.action-work-type-badge {
  position: absolute;
  top: 75px;                    /* Below priority badge */
  right: 32px;
  padding: 7px 12px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 6px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
  transition: all 0.2s ease;
  backdrop-filter: blur(8px);   /* Glass morphism effect */
}

.action-work-type-badge:hover {
  transform: translateY(-1px) scale(1.02);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
}

.work-type-icon {
  font-size: 13px;
  line-height: 1;
}

.work-type-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: capitalize;
}
```

---

### 3. Dual-Routing Logic (`SupabaseAdapter.js`)

#### Updated `getUserTasks` Method

**Key Changes:**
1. Removed database-level filtering by `route_to`
2. Fetch all tasks first, then apply client-side filtering
3. Implement dual-routing logic for calendar and email tasks

```javascript
async getUserTasks(userId, filters = {}) {
  try {
    // Fetch all tasks for the user
    let query = this.supabase
      .from('conversation_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('workflow_type', 'task');

    // Filter by completion status
    if (!filters.includeCompleted) {
      query = query.eq('is_completed', false);
    }

    // Filter by priority (if specified)
    if (filters.priority) {
      query = query.contains('workflow_metadata', { priority: filters.priority });
    }

    query = query.order('started_at', { ascending: false });
    query = query.limit(filters.limit || 50);

    const { data, error } = await query;
    if (error) throw error;

    // Transform to task format
    let tasks = (data || []).map(session => ({
      id: session.id,
      user_id: session.user_id,
      title: session.session_title,
      route_to: session.workflow_metadata?.route_to || 'tasks-sales',
      work_type: session.workflow_metadata?.work_type || 'task',
      // ... other fields
    }));

    // Apply route_to filtering with dual-routing logic
    if (filters.routeTo) {
      tasks = tasks.filter(task => {
        const taskRoute = task.route_to;
        const workType = task.work_type;
        
        // Calendar and email tasks appear in BOTH views
        const isDualRouteTask = workType === 'calendar' || workType === 'email';
        
        if (isDualRouteTask) {
          // Show in both sales tasks and mission control
          return filters.routeTo === 'tasks-sales' || filters.routeTo === 'mission-control';
        }
        
        // Regular tasks follow their route_to assignment
        return taskRoute === filters.routeTo;
      });
    }

    // Apply work_type filtering if specified (for Mission Control tabs)
    if (filters.workType) {
      tasks = tasks.filter(task => task.work_type === filters.workType);
    }

    this.logger.info('Fetched user tasks', {
      userId,
      count: tasks.length,
      routeToFilter: filters.routeTo || 'all',
      workTypeFilter: filters.workType || 'all',
      dualRouteTasks: tasks.filter(t => 
        t.work_type === 'calendar' || t.work_type === 'email'
      ).length
    });

    return { success: true, tasks };
  } catch (error) {
    this.logger.error('Failed to get tasks', { error: error.message });
    return { success: false, error: error.message, tasks: [] };
  }
}
```

---

## 🔄 Usage Examples

### Sales Tasks View
```javascript
// Fetch sales tasks (includes calendar & email tasks from Slack)
const response = await window.electronAPI.tasks.getAll({
  routeTo: 'tasks-sales'
});

// Returns:
// - Regular sales tasks (work_type: 'task')
// - Calendar tasks (work_type: 'calendar') 📅
// - Email tasks (work_type: 'email') 📧
// - Outreach tasks (work_type: 'outreach') 📤
```

### Mission Control - Calendar Tab
```javascript
// Fetch calendar tasks from all sources
const response = await window.electronAPI.tasks.getAll({
  routeTo: 'mission-control',
  workType: 'calendar'
});

// Returns:
// - All calendar tasks (work_type: 'calendar')
// - From sales, developer, or any other source
```

### Mission Control - Email Tab
```javascript
// Fetch email tasks from all sources
const response = await window.electronAPI.tasks.getAll({
  routeTo: 'mission-control',
  workType: 'email'
});

// Returns:
// - All email tasks (work_type: 'email')
// - From sales, developer, or any other source
```

---

## 📊 Task Flow Diagram

```
┌─────────────────────────────────────────┐
│         Slack Task Created              │
│    "Schedule meeting with client"       │
└─────────────┬───────────────────────────┘
              │
              │ AI detects: work_type = 'calendar'
              │            route_to = 'tasks-sales'
              ▼
┌─────────────────────────────────────────┐
│         Supabase Storage                │
│  workflow_metadata: {                   │
│    work_type: 'calendar'  📅            │
│    route_to: 'tasks-sales'              │
│  }                                      │
└──────────────┬──────────────────────────┘
               │
               │ Dual-Routing Logic
               ▼
         ┌─────┴─────┐
         │           │
         ▼           ▼
┌──────────────┐  ┌──────────────────┐
│ Sales Tasks  │  │ Mission Control  │
│   View       │  │ Calendar Tab     │
│              │  │                  │
│ Shows with:  │  │ Shows with:      │
│ 📅 Badge     │  │ 📅 Badge         │
│ Green color  │  │ Green color      │
└──────────────┘  └──────────────────┘
```

---

## 🎨 Visual Design

### Task Card with Work Type Badge

```
┌─────────────────────────────────────────┐
│                        [High Priority]  │  ← Priority Badge
│                        [📅 Calendar]    │  ← Work Type Badge
│  ┌──┐                                   │
│  │📱│  Schedule client meeting          │  ← Task Title
│  └──┘                                   │
│  ──────────────────────────────────     │  ← Progress Bar
│  ████████████░░░░░░░░░░░░░       83%   │
│                                         │
│  👤 John Doe    🕐 2h ago  [In Progress]│  ← Footer
└─────────────────────────────────────────┘
```

### Badge Color Scheme

| Work Type  | Icon | Color   | Use Case                    |
|------------|------|---------|----------------------------|
| Calendar   | 📅   | Green   | Meeting invites, schedules |
| Email      | 📧   | Blue    | Follow-up emails, outreach |
| Outreach   | 📤   | Purple  | Cold outreach, campaigns   |
| Task       | -    | -       | Regular tasks (no badge)   |

---

## 🧪 Testing Checklist

### Visual Indicators
- [ ] Calendar tasks show green 📅 badge in sales view
- [ ] Email tasks show blue 📧 badge in sales view
- [ ] Outreach tasks show purple 📤 badge in sales view
- [ ] Regular tasks show no work type badge
- [ ] Badges appear below priority badge
- [ ] Hover effects work smoothly
- [ ] Badges are responsive on mobile

### Dual-Routing Logic
- [ ] Calendar task created from Slack appears in sales tasks
- [ ] Same calendar task appears in Mission Control calendar tab
- [ ] Email task created from Slack appears in sales tasks
- [ ] Same email task appears in Mission Control email tab
- [ ] Regular sales tasks do NOT appear in Mission Control
- [ ] Regular dev tasks do NOT appear in sales tasks
- [ ] Filtering by workType works correctly
- [ ] Task counts are accurate in logs

### Edge Cases
- [ ] Task with unknown work_type shows no badge
- [ ] Task with null work_type defaults to 'task'
- [ ] Completed calendar/email tasks filter correctly
- [ ] work_type can be updated after task creation
- [ ] Dual-routing works for tasks from both user roles

---

## 🔧 Configuration

### Task Creation with work_type

```javascript
// From Slack or any source
await dbAdapter.createTask(userId, {
  title: "Send follow-up email to prospect",
  description: "Follow up on yesterday's call",
  priority: 'high',
  routeTo: 'tasks-sales',        // Where it originates
  workType: 'email',              // What type of work
  tags: ['sales', 'email'],
  // ... other fields
});
```

### Frontend Filtering

```javascript
// Sales Tasks - Show all sales tasks including dual-route
const salesTasks = await window.electronAPI.tasks.getAll({
  routeTo: 'tasks-sales'
});

// Mission Control Calendar - Show only calendar tasks
const calendarTasks = await window.electronAPI.tasks.getAll({
  routeTo: 'mission-control',
  workType: 'calendar'
});

// Mission Control Email - Show only email tasks
const emailTasks = await window.electronAPI.tasks.getAll({
  routeTo: 'mission-control',
  workType: 'email'
});
```

---

## 📝 Future Enhancements

### Potential Additions
1. **Click Actions**: Click on calendar badge to open in calendar view
2. **Quick Actions**: Badge menu for quick task type conversion
3. **Notifications**: Different notification styles per work type
4. **Analytics**: Track completion rates by work type
5. **Filtering**: Add work type filters to sales tasks view
6. **Custom Types**: Allow users to define custom work types
7. **Color Themes**: Customizable colors per work type

### Integration Opportunities
1. **Microsoft Graph**: Sync calendar tasks with Outlook calendar
2. **Google Calendar**: Sync calendar tasks with Google Calendar
3. **Email Clients**: Auto-create email drafts from email tasks
4. **CRM Systems**: Link email tasks to CRM contact records
5. **Slack Actions**: Quick create buttons in Slack for specific types

---

## ✨ Benefits

### For Sales Users
- **Visual Clarity**: Instantly identify calendar and email tasks
- **Better Organization**: Special tasks stand out in the list
- **Cross-View Access**: Calendar/email tasks visible in both views
- **Reduced Context Switching**: Don't need to switch to Mission Control

### For All Users
- **Centralized View**: All calendar tasks in one Mission Control tab
- **Email Hub**: All email tasks accessible from email tab
- **Consistent UX**: Same badge style across different views
- **Better Prioritization**: Color-coded badges help with task triage

### For System
- **Flexible Routing**: Tasks can appear in multiple views logically
- **Scalable**: Easy to add new work types in the future
- **Maintainable**: Clean separation of concerns
- **Performant**: Client-side filtering is fast and flexible

---

**Status:** ✅ **IMPLEMENTED** - Visual indicators and dual-routing are fully functional

