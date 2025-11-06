# Widget System V1 - Simple & Real

## Philosophy
- **No configuration** - Widgets just work with real data
- **No slash commands** - Visual picker menu
- **Role-aware** - Show relevant widgets based on user role
- **Real data only** - No mock/placeholder content

## User Experience

### Creating a Widget
1. Click anywhere on dashboard background
2. Widget picker menu appears at click location
3. Select widget type from menu
4. Widget appears with real data immediately

### Widget Picker Menu
```
┌─────────────────────────┐
│ Choose Widget Type      │
├─────────────────────────┤
│ 📝 Quick Note           │
│ ⏰ Today's Meetings     │
│ ✅ My Open Tasks        │
│ 📧 Unread Emails        │
│ 🎯 Active Sprint        │
│ 🐛 My Bugs              │
│ 💬 Slack Mentions       │
│ 🔔 Recent Activity      │
└─────────────────────────┘
```

## V1 Widgets (8 Total)

### 1. 📝 Quick Note
**Purpose:** Simple sticky note for reminders
**Data Source:** None (user input only)
**Size:** Small (200x150px)
**Features:**
- Click to edit
- Auto-save
- Color picker

### 2. ⏰ Today's Meetings
**Purpose:** See upcoming meetings at a glance
**Data Source:** `window.electronAPI.calendar.getUpcoming()`
**Size:** Medium (250x200px)
**Features:**
- Next 3 meetings
- Time + title
- "Join" button if virtual
- Auto-refresh every 5 minutes

### 3. ✅ My Open Tasks
**Purpose:** Quick task overview
**Data Source:** `window.electronAPI.tasks.getAll({ status: 'todo' })`
**Size:** Medium (250x200px)
**Features:**
- Task count badge
- Top 3 tasks
- Click to mark done
- Auto-refresh every 30 seconds

### 4. 📧 Unread Emails
**Purpose:** Email awareness without opening inbox
**Data Source:** `window.electronAPI.inbox.getUnified({ unreadOnly: true })`
**Size:** Medium (250x200px)
**Features:**
- Unread count
- Top 3 senders
- Source badge (Gmail/Outlook)
- Auto-refresh every 2 minutes

### 5. 🎯 Active Sprint (Developer Role)
**Purpose:** Sprint progress tracking
**Data Source:** `window.electronAPI.jira.getCurrentSprint()`
**Size:** Medium (250x200px)
**Features:**
- Sprint name
- Progress bar (points completed/total)
- Days remaining
- Auto-refresh every 5 minutes

### 6. 🐛 My Bugs (Developer Role)
**Purpose:** Bug awareness
**Data Source:** `window.electronAPI.jira.getMyIssues({ type: 'Bug' })`
**Size:** Medium (250x200px)
**Features:**
- Bug count
- P0/P1 highlighted
- Top 3 bugs
- Auto-refresh every 5 minutes

### 7. 💬 Slack Mentions (All Roles)
**Purpose:** Don't miss important Slack messages
**Data Source:** `window.electronAPI.slack.getMentions()`
**Size:** Medium (250x200px)
**Features:**
- Mention count badge
- Last 3 mentions
- Channel name
- Auto-refresh every 30 seconds

### 8. 🔔 Recent Activity (All Roles)
**Purpose:** Unified activity feed
**Data Source:** Combined (Slack + Email + JIRA + Tasks)
**Size:** Large (300x250px)
**Features:**
- Last 5 activities
- Source badges
- Timestamp
- Auto-refresh every 1 minute

## Role-Based Widget Availability

### Sales User
- ✅ Quick Note
- ✅ Today's Meetings
- ✅ My Open Tasks
- ✅ Unread Emails
- ✅ Slack Mentions
- ✅ Recent Activity

### Developer User
- ✅ Quick Note
- ✅ Today's Meetings
- ✅ My Open Tasks
- ✅ Active Sprint
- ✅ My Bugs
- ✅ Slack Mentions
- ✅ Recent Activity

## Technical Implementation

### 1. Widget Picker Component
**File:** `BeachBaby/desktop2/renderer2/src/components/Dashboard/WidgetPicker.jsx`
```jsx
<div className="widget-picker" style={{ left: x, top: y }}>
  <div className="picker-header">Choose Widget Type</div>
  <div className="picker-options">
    {availableWidgets.map(widget => (
      <button onClick={() => onSelect(widget.type)}>
        {widget.icon} {widget.label}
      </button>
    ))}
  </div>
</div>
```

### 2. Widget Data Fetchers
**File:** `BeachBaby/desktop2/renderer2/src/hooks/useWidgetData.js`

Update to handle new widget types:
- `quick-note` - No data fetch
- `todays-meetings` - Calendar API
- `my-tasks` - Tasks API
- `unread-emails` - Inbox API
- `active-sprint` - JIRA API
- `my-bugs` - JIRA API
- `slack-mentions` - Slack API
- `recent-activity` - Combined APIs

### 3. Widget Component Updates
**File:** `BeachBaby/desktop2/renderer2/src/components/Dashboard/Widget.jsx`

Remove slash command parsing, add widget type rendering:
```jsx
switch (widget.type) {
  case 'quick-note':
    return <QuickNoteWidget />;
  case 'todays-meetings':
    return <MeetingsWidget data={data} />;
  case 'my-tasks':
    return <TasksWidget data={data} />;
  // ... etc
}
```

### 4. Dashboard Updates
**File:** `BeachBaby/desktop2/renderer2/src/components/Dashboard/Dashboard.jsx`

Replace direct widget creation with picker:
```jsx
const handleAddWidget = (e) => {
  setPickerPosition({ x: e.clientX, y: e.clientY });
  setShowPicker(true);
};

const handleWidgetTypeSelected = (type) => {
  const newWidget = {
    id: Date.now(),
    x: pickerPosition.x,
    y: pickerPosition.y,
    type: type,
    createdAt: new Date().toISOString()
  };
  // ... save widget
};
```

## Data Refresh Strategy

### Refresh Intervals
- **Meetings:** 5 minutes (calendar doesn't change often)
- **Tasks:** 30 seconds (active work)
- **Emails:** 2 minutes (balance freshness vs API limits)
- **Sprint:** 5 minutes (doesn't change often)
- **Bugs:** 5 minutes (doesn't change often)
- **Slack Mentions:** 30 seconds (real-time feel)
- **Recent Activity:** 1 minute (aggregated feed)

### Manual Refresh
All widgets have a refresh button (↻) for immediate updates

## Error Handling

### No Data Available
Show friendly message:
```
┌─────────────────────┐
│ 📧 Unread Emails    │
├─────────────────────┤
│                     │
│   No emails yet     │
│                     │
│   Connect your      │
│   email account     │
│                     │
└─────────────────────┘
```

### API Error
Show error state with retry:
```
┌─────────────────────┐
│ 🎯 Active Sprint    │
├─────────────────────┤
│                     │
│   ⚠️ Failed to load │
│                     │
│   [Retry]           │
│                     │
└─────────────────────┘
```

### Loading State
Show spinner while fetching:
```
┌─────────────────────┐
│ 💬 Slack Mentions   │
├─────────────────────┤
│                     │
│      ⏳             │
│   Loading...        │
│                     │
└─────────────────────┘
```

## Storage

Widgets stored in localStorage:
```json
{
  "dashboardWidgets": [
    {
      "id": 1699123456789,
      "type": "my-tasks",
      "x": 100,
      "y": 200,
      "createdAt": "2024-11-03T10:30:00Z"
    }
  ]
}
```

No need to store widget data - always fetch fresh on load

## Future Enhancements (V2+)

- Widget resizing
- Widget settings (e.g., filter tasks by priority)
- Widget templates (save configurations)
- Shared widgets (team dashboards)
- Widget marketplace
- Custom widgets (user-defined)

## Success Metrics

- **Adoption:** % of users who create at least 1 widget
- **Engagement:** Average widgets per user
- **Retention:** % of widgets kept after 1 week
- **Value:** Most popular widget types

