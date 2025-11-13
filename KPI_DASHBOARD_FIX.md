# JIRA KPI Dashboard Fix

## Problem
The JIRA KPI Dashboard in `desktop2/renderer2/src/components/MissionControl/JiraKPIDashboard.jsx` was showing zeros for:
- Completion percentage
- Overdue tasks count
- High-priority tasks count

Even though the user had completed tasks and overdue tasks in JIRA.

## Root Causes

### 1. **Missing `includeCompleted` Filter**
The KPI hook (`useJiraKPIs.js`) was calling `window.electronAPI.tasks.getAll()` without the `includeCompleted: true` flag. This meant the backend was filtering out all completed tasks by default, making it impossible to calculate completion percentages.

**Location**: `desktop2/renderer2/src/hooks/useJiraKPIs.js:38`

### 2. **Task Assignment Filtering**
The `getUserTasks` method in `SupabaseAdapter.js` was applying user assignment filtering (owner/assignee/assignor/mentioned), which could exclude tasks that should be counted in KPIs. For KPI calculations, we need ALL of the user's tasks, not just those they're assigned to.

**Location**: `desktop2/main/services/SupabaseAdapter.js:873-899`

### 3. **Case-Sensitive JIRA Status Checks**
The completion logic in `useJiraKPIs.js` was checking for exact matches like `jiraStatus === 'Done'`, but JIRA might return `'done'`, `'DONE'`, or other variations. This caused completed tasks to not be recognized.

**Location**: `desktop2/renderer2/src/hooks/useJiraKPIs.js:142-145`

### 4. **Inconsistent Completion Logic**
Different parts of the KPI calculation (completion rate, overdue check, high-priority check, story points) were using different logic to determine if a task was completed, leading to inconsistent results.

## Solutions Implemented

### 1. **Added `skipAllFilters` Flag**
Created a new filter flag that bypasses all filtering logic (team, assignment, route, work type) when calculating KPIs. This ensures we get ALL of the user's tasks for accurate metrics.

**Changes**:
- `desktop2/renderer2/src/hooks/useJiraKPIs.js:38-43` - Pass `skipAllFilters: true` and `includeCompleted: true`
- `desktop2/main/services/SupabaseAdapter.js:722-724` - Filter by `user_id` at SQL level when `skipAllFilters` is true
- `desktop2/main/services/SupabaseAdapter.js:806, 873, 910, 937, 966, 1000, 1020` - Skip all filters when `skipAllFilters` is true

### 2. **Unified Completion Logic**
Standardized the completion check across all KPI calculations to use case-insensitive JIRA status matching:

```javascript
const jiraStatusLower = jiraStatus ? jiraStatus.toLowerCase().trim() : '';
const isJiraCompleted = ['done', 'resolved', 'closed', 'completed'].includes(jiraStatusLower);
const isCompleted = t.is_completed || t.status === 'completed' || isJiraCompleted;
```

**Applied to**:
- Completion rate calculation (line 140-163)
- Story points calculation (line 199-208)
- Overdue tasks check (line 216-255)
- Blocked tasks check (line 261-275)
- High-priority tasks check (line 278-303)

### 3. **Enhanced Logging**
Added comprehensive console logging to help debug KPI calculations:
- Task fetching with filters
- JIRA status breakdown
- Completion checks for each task
- Overdue and priority checks

## Testing Checklist

To verify the fix works:

1. **Completion Rate**:
   - [ ] Mark some JIRA tasks as "Done" in JIRA
   - [ ] Sync tasks in the app
   - [ ] Check that completion % shows correct value

2. **Overdue Tasks**:
   - [ ] Create JIRA tasks with due dates in the past
   - [ ] Ensure they're not marked as "Done"
   - [ ] Check that overdue count shows correct value

3. **High-Priority Tasks**:
   - [ ] Create JIRA tasks with "High", "Highest", or "Critical" priority
   - [ ] Ensure they're not completed
   - [ ] Check that high-priority count shows correct value

4. **Story Points**:
   - [ ] Assign story points to JIRA tasks
   - [ ] Complete some of them
   - [ ] Check that sprint completion % is calculated correctly

## Files Modified

1. `desktop2/renderer2/src/hooks/useJiraKPIs.js` - KPI calculation logic
2. `desktop2/main/services/SupabaseAdapter.js` - Task filtering logic

## Console Logs to Check

When the KPI dashboard loads, you should see logs like:
```
🚀 calculateKPIs CALLED with userId: <user_id>
📊 KPI Hook - Fetching tasks for userId: <user_id>
📊 KPI Hook - Raw response: { success: true, tasks: [...] }
📊 KPI Hook - Filtered JIRA tasks: X out of Y
🔍 ALL JIRA STATUSES IN YOUR TASKS: ['In Progress', 'Done', 'To Do', ...]
✅ Completed tasks: X / Y
⚠️ Total overdue tasks found: X
🔥 Total high-priority tasks found: X
```

## Related Files

- `desktop2/main/utils/jira-status-mapper.js` - JIRA status mapping utilities (already correct)
- `desktop2/main/services/JIRAService.js` - JIRA sync service (uses status mapper correctly)
- `desktop2/main/ipc/task-handlers.js` - IPC handler for tasks.getAll

## Notes

- The `skipAllFilters` flag should ONLY be used for KPI calculations, not for regular task views
- The case-insensitive status matching aligns with the existing `jira-status-mapper.js` utility
- All filtering logic now consistently checks for `skipAllFilters` before applying filters

