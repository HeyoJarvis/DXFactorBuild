# Task Routing Fix - Desktop2 Implementation Complete

## Summary

Successfully implemented the correct task assignment and routing logic from `desktop` into `desktop2`. The system now properly routes tasks based on:
1. **User role** (sales vs developer)
2. **User assignment** (owner, assignee, assignor, mentioned)
3. **External source** (Slack for sales, JIRA for developers)
4. **Route type** with dual-routing support for calendar/email tasks

---

## Changes Made

### 1. **App.jsx** - Removed localStorage Polling, Connected to AuthService

**File**: `desktop2/renderer2/src/App.jsx`

**Changes**:
- ❌ Removed: `localStorage` polling every 500ms for user role
- ✅ Added: Direct connection to `AuthService.currentUser.user_role`
- ✅ Added: User role extraction in `checkAuthStatus()` and `handleLoginSuccess()`
- ✅ Added: Automatic role detection from authenticated user session

**Before**:
```javascript
const [userRole, setUserRole] = useState('sales'); // Default to sales
function loadUserRole() {
  const savedRole = localStorage.getItem('heyjarvis-role');
  // ... polling logic
}
const interval = setInterval(loadUserRole, 500);
```

**After**:
```javascript
const [userRole, setUserRole] = useState(null);
async function checkAuthStatus() {
  // ...
  const role = result.session.user?.user_role;
  setUserRole(role || 'sales'); // Default to sales if no role set
}
```

---

### 2. **SupabaseAdapter.js** - Enhanced Task Filtering

**File**: `desktop2/main/services/SupabaseAdapter.js:663-814`

**Changes**:
- ✅ Added: User assignment filtering (owner/assignee/assignor/mentioned)
- ✅ Added: External source filtering based on user role
- ✅ Added: Assignment view filtering (my_tasks, assigned_to_me, assigned_by_me)
- ✅ Removed: SQL-level `user_id` filter (now checks assignment fields)
- ✅ Increased: Default limit from 50 to 100 tasks

**New Filtering Logic**:

#### **User Assignment Filter** (Lines 722-736):
Tasks are shown if user is:
- Owner (created the task)
- Assignee (task assigned to them)
- Assignor (they assigned the task to someone)
- Mentioned (mentioned in the task)

#### **External Source Filter** (Lines 755-772):
- **Sales users**: See Slack tasks + manual tasks
- **Developer users**: See JIRA tasks + manual tasks
- **Admin users**: See everything

#### **Assignment View Filter** (Lines 739-752):
- `assigned_to_me`: Tasks where user is assignee
- `assigned_by_me`: Tasks where user is assignor
- `my_tasks`: Tasks where user is owner
- `all`: All tasks user has access to

#### **Dual-Routing** (Lines 775-791):
- Calendar and email tasks appear in BOTH views
- Regular tasks follow their `route_to` assignment

---

### 3. **useSalesTasks.js** - Hook Updated for User Context

**File**: `desktop2/renderer2/src/hooks/useSalesTasks.js`

**Changes**:
- ✅ Added: `user` parameter to hook
- ✅ Added: `assignmentView` parameter for filtering
- ✅ Added: Auto-pass `userRole` and `slackUserId` to backend
- ✅ Enhanced: Logging with user context

**Before**:
```javascript
export function useSalesTasks() {
  const response = await window.electronAPI.tasks.getAll({
    routeTo: 'tasks-sales'
  });
}
```

**After**:
```javascript
export function useSalesTasks(user, assignmentView = 'all') {
  const filters = {
    routeTo: 'tasks-sales',
    userRole: user?.user_role || 'sales',
    slackUserId: user?.slack_user_id
  };
  if (assignmentView !== 'all') {
    filters.assignmentView = assignmentView;
  }
  const response = await window.electronAPI.tasks.getAll(filters);
}
```

---

### 4. **useDeveloperTasks.js** - Hook Updated for User Context

**File**: `desktop2/renderer2/src/hooks/useDeveloperTasks.js`

**Changes**: Same as useSalesTasks.js, but for developer tasks

---

### 5. **task-handlers.js** - Auto-Populate User Context

**File**: `desktop2/main/ipc/task-handlers.js:59-114`

**Changes**:
- ✅ Added: Auto-populate `slackUserId` from `AuthService.currentUser`
- ✅ Added: Auto-populate `userRole` from `AuthService.currentUser`
- ✅ Enhanced: Logging with enriched filter context

**Enhancement**:
```javascript
const enrichedFilters = {
  includeCompleted: false,
  ...filters,
  slackUserId: filters.slackUserId || currentUser?.slack_user_id,
  userRole: filters.userRole || currentUser?.user_role
};
```

This ensures backend always has user context even if frontend doesn't pass it.

---

### 6. **Tasks.jsx** - Pass User Prop to Hook

**File**: `desktop2/renderer2/src/pages/Tasks.jsx`

**Changes**:
- ✅ Added: `user` prop parameter
- ✅ Added: `assignmentView` state for future filtering UI
- ✅ Updated: Hook call to pass user and assignmentView

**Before**:
```javascript
export default function Tasks() {
  const { tasks, loading, ... } = useSalesTasks();
}
```

**After**:
```javascript
export default function Tasks({ user }) {
  const [assignmentView, setAssignmentView] = useState('all');
  const { tasks, loading, ... } = useSalesTasks(user, assignmentView);
}
```

---

## How It Works Now

### **Task Routing Flow**

```
1. User logs in via Slack OAuth
   ↓
2. AuthService stores user with user_role ('sales' or 'developer')
   ↓
3. App.jsx reads user_role from session and sets userRole state
   ↓
4. Route /tasks renders Tasks or TasksDeveloper based on userRole
   ↓
5. Hook calls window.electronAPI.tasks.getAll({
     routeTo: 'tasks-sales',
     userRole: 'sales',
     slackUserId: 'U123456'
   })
   ↓
6. task-handlers.js enriches filters with currentUser context
   ↓
7. SupabaseAdapter.getUserTasks() applies filters:
   - User assignment filter (owner/assignee/assignor/mentioned)
   - External source filter (slack for sales, jira for developers)
   - Route filter (tasks-sales vs mission-control)
   - Dual-routing for calendar/email tasks
   ↓
8. Tasks displayed to user based on their role and assignments
```

---

## Task Assignment Matrix

| User Type | Sees Tasks From | Route | Work Types | Assignment Context |
|-----------|-----------------|-------|------------|-------------------|
| **Sales** | Slack + Manual | tasks-sales | task, calendar, outreach, email | Owner/Assignee/Assignor/Mentioned |
| **Developer** | JIRA + Manual | mission-control | task, calendar, email | Owner/Assignee/Assignor/Mentioned |
| **Admin** | All sources | Both routes | All types | All tasks |

---

## Dual-Routing Rules

**Calendar tasks** and **email tasks** appear in BOTH views:
- Sales users see them in `/tasks` (tasks-sales)
- Developer users see them in `/mission-control` (mission-control)

This ensures cross-functional collaboration on meetings and emails.

---

## Assignment Views (Ready for UI Implementation)

The backend now supports three assignment views via `filters.assignmentView`:

1. **All Tasks** (`assignmentView: 'all'` or undefined)
   - All tasks where user is owner, assignee, assignor, or mentioned

2. **My Tasks** (`assignmentView: 'my_tasks'`)
   - Tasks created by the user (user_id match)

3. **Assigned to Me** (`assignmentView: 'assigned_to_me'`)
   - Tasks where user is the assignee (by Slack ID)

4. **Assigned by Me** (`assignmentView: 'assigned_by_me'`)
   - Tasks where user assigned to someone else (assignor match, excluding self-assigned)

To enable these views in the UI, simply add tabs/buttons that call:
```javascript
setAssignmentView('my_tasks');
setAssignmentView('assigned_to_me');
setAssignmentView('assigned_by_me');
```

---

## External Source Routing

### **Sales Users** see:
- ✅ Tasks from Slack (`external_source: 'slack'`)
- ✅ Manual tasks (`external_source: null` or `'manual'`)
- ❌ JIRA tasks (`external_source: 'jira'`)

### **Developer Users** see:
- ✅ Tasks from JIRA (`external_source: 'jira'`)
- ✅ Manual tasks (`external_source: null` or `'manual'`)
- ❌ Slack tasks (`external_source: 'slack'`)

### **Admin Users** see:
- ✅ All tasks from all sources

---

## Testing Recommendations

### 1. **Test User Role Detection**
- Log in as sales user → Verify `user_role: 'sales'` in console
- Log in as developer user → Verify `user_role: 'developer'` in console
- Check that `/tasks` shows correct page based on role

### 2. **Test Task Assignment Filtering**
- Create task as User A
- Mention User B in task
- Assign task to User C
- Verify:
  - User A sees task (owner)
  - User B sees task (mentioned)
  - User C sees task (assignee)

### 3. **Test External Source Filtering**
- Create Slack task → Sales users see it, devs don't
- Create JIRA task → Devs see it, sales don't
- Create manual task → Both see it

### 4. **Test Dual-Routing**
- Create calendar task → Both sales and devs see it
- Create email task → Both sales and devs see it
- Create regular task → Only target role sees it

### 5. **Test Assignment Views**
- Set `assignmentView: 'my_tasks'` → Only see owned tasks
- Set `assignmentView: 'assigned_to_me'` → Only see tasks assigned to you
- Set `assignmentView: 'assigned_by_me'` → Only see tasks you assigned to others

---

## Migration Notes

### **Breaking Changes**: None
All changes are backward compatible. Existing tasks without assignment fields will still work.

### **Database Fields Used**:
- `workflow_metadata.assignor` - Slack user ID of task creator
- `workflow_metadata.assignee` - Slack user ID of task assignee
- `workflow_metadata.mentioned_users` - Array of Slack user IDs mentioned
- `workflow_metadata.route_to` - 'tasks-sales' or 'mission-control'
- `workflow_metadata.work_type` - 'task', 'calendar', 'outreach', 'email'
- `workflow_metadata.external_source` - 'slack', 'jira', 'manual', or null
- `users.user_role` - 'sales', 'developer', 'admin', or null
- `users.slack_user_id` - User's Slack ID for assignment matching

---

## Benefits Over Desktop v1

1. ✅ **No localStorage polling** - Direct AuthService integration
2. ✅ **Dual-routing** - Calendar/email tasks in both views
3. ✅ **Assignment views** - Filter by ownership/assignment
4. ✅ **Mention tracking** - See tasks where you're mentioned
5. ✅ **External source filtering** - Proper Slack/JIRA separation
6. ✅ **Better logging** - User context in all log statements
7. ✅ **Backend fallback** - Auto-enriches filters with user context

---

## Next Steps (Optional Enhancements)

1. **Add Assignment View Tabs** to Tasks.jsx UI:
   ```jsx
   <Tabs>
     <Tab onClick={() => setAssignmentView('all')}>All Tasks</Tab>
     <Tab onClick={() => setAssignmentView('my_tasks')}>My Tasks</Tab>
     <Tab onClick={() => setAssignmentView('assigned_to_me')}>Assigned to Me</Tab>
     <Tab onClick={() => setAssignmentView('assigned_by_me')}>Delegated</Tab>
   </Tabs>
   ```

2. **Add Role Selector** for users without `user_role`:
   - Show modal on first login if `user_role` is null
   - Let user choose "Sales" or "Developer"
   - Update `users.user_role` in database

3. **Add Task Assignment UI**:
   - Add "Assign to" dropdown in task creation/edit
   - Populate with Slack team members
   - Store assignee Slack ID in `workflow_metadata.assignee`

4. **Add Visual Indicators**:
   - Badge showing task source (Slack/JIRA/Manual)
   - Icon showing assignment type (Owner/Assignee/Mentioned)
   - Color coding for work_type (calendar/outreach/email/task)

---

## Files Modified

1. `desktop2/renderer2/src/App.jsx` - User role detection
2. `desktop2/main/services/SupabaseAdapter.js` - Enhanced filtering
3. `desktop2/renderer2/src/hooks/useSalesTasks.js` - User context
4. `desktop2/renderer2/src/hooks/useDeveloperTasks.js` - User context
5. `desktop2/main/ipc/task-handlers.js` - Auto-enrich filters
6. `desktop2/renderer2/src/pages/Tasks.jsx` - Pass user prop
7. `desktop2/main/ipc/task-chat-handlers.js` - Fixed access control for assigned tasks

---

### 7. **task-chat-handlers.js** - Fixed Task Chat Access Control

**File**: `desktop2/main/ipc/task-chat-handlers.js:227-280`

**Problem**: Task chat was checking `taskSession.user_id !== userId`, which prevented users from accessing chat for tasks that were **assigned to them** but not **owned by them**.

**Changes**:
- ✅ Added: Assignment-based access control (owner/assignee/assignor/mentioned)
- ✅ Added: Slack ID verification for assignment checking
- ✅ Enhanced: Logging with access type information

**Before**:
```javascript
// Verify task belongs to user
if (taskSession.user_id !== userId) {
  return { success: false, error: 'Access denied' };
}
```

**After**:
```javascript
// Get current user's Slack ID for assignment checking
const userSlackId = services.auth?.currentUser?.slack_user_id;

// Verify user has access to task (owner, assignee, assignor, or mentioned)
const isOwner = taskSession.user_id === userId;
const isAssignee = userSlackId && taskSession.workflow_metadata?.assignee === userSlackId;
const isAssignor = userSlackId && taskSession.workflow_metadata?.assignor === userSlackId;
const isMentioned = userSlackId && taskSession.workflow_metadata?.mentioned_users?.includes(userSlackId);

const hasAccess = isOwner || isAssignee || isAssignor || isMentioned;

if (!hasAccess) {
  return { success: false, error: 'Access denied' };
}
```

**Impact**: Task chat now works for ALL tasks the user has access to, not just tasks they own. This includes:
- ✅ Tasks assigned to you
- ✅ Tasks you assigned to others
- ✅ Tasks where you're mentioned
- ✅ Tasks you created

---

## Summary

The task routing logic from `desktop` has been successfully translated to `desktop2` with improvements. The system now:

✅ Detects user role from AuthService (no localStorage)
✅ Filters tasks by user assignment (owner/assignee/assignor/mentioned)
✅ Routes tasks by external source (Slack for sales, JIRA for devs)
✅ Supports dual-routing for calendar and email tasks
✅ Provides assignment view filtering (ready for UI)
✅ Auto-enriches filters with user context in backend
✅ Maintains backward compatibility with existing tasks

The implementation is complete and ready for testing!
