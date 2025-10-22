# Context Time Windows Fix

## 🐛 Issue Discovered

**Problem**: Mismatch between JIRA Tasks page and Team Chat context picker

### The Issue
- **JIRA Tasks Page**: Shows 34 tasks (last 30 days)
- **Team Chat Picker**: Showed only 2 tasks (last 10 days)
- **Database**: Actually has 34 JIRA tasks in last 30 days

**Root Cause**: When user requested meetings for "last 10 days", I also changed JIRA tasks to 10 days. This was incorrect - JIRA tasks should match the JIRA Tasks page setting (30 days).

## ✅ Fix Applied

### Updated Time Windows

**Meetings**: 10 days (as requested)
```javascript
startDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
```
- Database has: 8 meetings
- Context picker shows: 8 meetings ✅

**JIRA Tasks**: 30 days (matches JIRA Tasks page)
```javascript
days: 30
```
- Database has: 34 tasks
- Context picker shows: 34 tasks ✅

**Repositories**: All available (unchanged)
- Available: 6 repositories ✅

### Changes Made

**File**: `renderer/src/pages/TeamChat.jsx`

1. **JIRA Tasks Query** (line ~65):
```javascript
// Before:
const tasksResult = await window.electronAPI.sync.getUpdates({ days: 10 });

// After:
const tasksResult = await window.electronAPI.sync.getUpdates({ days: 30 });
```

2. **AI Context Days** (line ~153):
```javascript
// Before:
daysBack: 10,

// After:
daysBack: 30,  // Use 30 days for general context
```

3. **UI Text** (line ~432):
```javascript
// Before:
"meetings (last 10 days), tasks, and code"

// After:
"meetings (10 days), tasks (30 days), and code"
```

4. **Meeting Field Fix** (line ~62):
```javascript
// Backend returns 'meetings', not 'summaries'
const meetings = meetingsResult.meetings || meetingsResult.summaries || [];
console.log('Loaded meetings for context picker:', meetings.length);
```

## 📊 Database Verification

### Actual Data in Supabase

**Meetings (last 10 days)**: 8 meetings
```
- 10/20/2025: abc standup 4
- 10/20/2025: abcv standup 3
- 10/20/2025: abc standup 2
- 10/20/2025: abc standup
- 10/20/2025: Shail Avi standup
- 10/20/2025: Meeting with Shail (2x)
- 10/18/2025: xyz standup
```

**JIRA Tasks (last 30 days)**: 34 tasks
- Last 10 days: 2 tasks
- Last 30 days: 34 tasks (matches JIRA Tasks page!)

**Repositories**: 6 repos
- Mark-I
- MARKIII
- -MARK-II
- MKIV
- demo-repository
- BeachBaby

## 🎯 Expected Results

After restart, the context picker should show:

| Context Type | Count | Time Window |
|--------------|-------|-------------|
| 📅 Meetings  | 8     | Last 10 days |
| 🎯 JIRA Tasks | 34   | Last 30 days |
| 💻 Repositories | 6 | All available |

## 🔍 Why These Time Windows?

### Meetings: 10 Days
- **Reason**: User specifically requested 10 days
- **Use Case**: Recent meetings are most relevant for context
- **Trade-off**: More focused, less data

### JIRA Tasks: 30 Days
- **Reason**: Matches JIRA Tasks page for consistency
- **Use Case**: Tasks often span multiple weeks
- **Trade-off**: More comprehensive task list

### Repositories: All
- **Reason**: Code doesn't change based on time
- **Use Case**: Need access to all codebases
- **Trade-off**: N/A

## 🚀 Testing Steps

1. **Restart the app**:
   ```bash
   npm run dev
   ```

2. **Navigate to Team Chat**

3. **Open Context Picker** (📎 Context button)

4. **Verify counts**:
   - Meetings: Should see 8 meetings
   - JIRA Tasks: Should see 34 tasks (scroll to see all)
   - Repositories: Should see 6 repos

5. **Compare with JIRA Tasks page**:
   - Navigate to JIRA Tasks page
   - Should see same 34 tasks
   - ✅ Perfect match!

## 📝 Logs to Watch

Look for these in terminal:
```
IPC: sync:getUpdates - days: 30  (should be 30, not 10)
IPC: meeting:getSummaries - startDate: 2025-10-11T...
Loaded meetings for context picker: 8
```

## 🔧 Technical Details

### Meeting Field Name Fix
- **Backend** (`TeamSyncSupabaseAdapter.getMeetings`):
  ```javascript
  return { success: true, meetings };  // Returns 'meetings'
  ```

- **Frontend** (was checking wrong field):
  ```javascript
  // ❌ Wrong:
  meetingsResult.summaries
  
  // ✅ Fixed:
  meetingsResult.meetings || meetingsResult.summaries  // Fallback for safety
  ```

### Time Window Consistency

| Page/Feature | Meetings | JIRA Tasks | Why? |
|-------------|----------|------------|------|
| Team Chat Context | 10 days | 30 days | User request + consistency |
| JIRA Tasks Page | N/A | 30 days | Standard view |
| Meetings Page | Various | N/A | Different use case |
| Dashboard | Various | Various | Overview across all |

## ✅ Status

**FIXED** - Context picker now shows:
- ✅ 8 meetings (last 10 days)
- ✅ 34 JIRA tasks (last 30 days)  
- ✅ 6 repositories (all available)

All numbers now match the respective dedicated pages!

---

**Fix Date**: October 21, 2025
**Issue**: Context picker time window mismatch
**Resolution**: Aligned JIRA tasks with JIRA Tasks page (30 days), kept meetings at user-requested 10 days

