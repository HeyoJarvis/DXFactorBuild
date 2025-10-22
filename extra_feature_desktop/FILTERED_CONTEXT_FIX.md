# Filtered Context Fix

## 🐛 Critical Issue Found

**Problem**: AI was seeing ALL context instead of ONLY selected context

### What Was Wrong

When user selected specific context (e.g., 1 meeting, 2 tasks, 1 repo), the AI was responding with information about ALL meetings and tasks in the database, not just the selected ones.

**Example**:
- **User Selected**: 1 meeting, 2 tasks, 1 repo
- **AI Saw**: 8 meetings, 34 tasks (everything in database!)
- **Result**: Incorrect responses with unselected data

### Root Cause

**File**: `main/services/TeamContextEngine.js`

The `askQuestion` method was **ignoring** the `filteredContext` parameter and always querying the database for ALL data:

```javascript
// ❌ OLD CODE - WRONG!
async askQuestion(userId, question, options = {}) {
  // ALWAYS fetched ALL meetings and updates from database
  const [meetingsResult, updatesResult] = await Promise.all([
    this.supabaseAdapter.supabase
      .from('team_meetings')
      .select('*')
      .eq('user_id', userId)
      .order('start_time', { ascending: false })
      .limit(10),  // Last 10 meetings (ALL of them!)
    this.supabaseAdapter.supabase
      .from('team_updates')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20)  // Last 20 updates (ALL of them!)
  ]);
  
  // Used ALL data, ignored options.filteredContext completely!
  const meetings = meetingsResult.data || [];
  const updates = updatesResult.data || [];
  // ...
}
```

Even though `intelligence-handlers.js` was correctly fetching the filtered context, `TeamContextEngine` was throwing it away!

## ✅ Fix Applied

### Updated Logic

**File**: `main/services/TeamContextEngine.js` (lines 34-80)

Now checks if `filteredContext` is provided and uses ONLY that:

```javascript
// ✅ NEW CODE - CORRECT!
async askQuestion(userId, question, options = {}) {
  let meetings = [];
  let updates = [];

  // 🎯 Use filtered context if provided (ONLY selected items)
  if (options.filteredContext) {
    meetings = options.filteredContext.meetings || [];
    updates = options.filteredContext.tasks || [];
    
    this.logger.info('Using filtered context', {
      meetings: meetings.length,
      tasks: updates.length
    });
  } 
  // Fallback: Query database for ALL context (backward compatibility)
  else {
    const [meetingsResult, updatesResult] = await Promise.all([
      this.supabaseAdapter.supabase
        .from('team_meetings')
        .select('*')
        .eq('user_id', userId)
        .order('start_time', { ascending: false })
        .limit(10),
      this.supabaseAdapter.supabase
        .from('team_updates')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20)
    ]);

    meetings = meetingsResult.data || [];
    updates = updatesResult.data || [];
    
    this.logger.info('Using all context (no filter)', {
      meetings: meetings.length,
      updates: updates.length
    });
  }

  // Generate AI response with filtered context
  const context = this._buildContext(meetings, updates, options.codeContext);
  const answer = await this._generateAnswer(question, context);
  // ...
}
```

### Added Code Context Support

Also updated `_buildContext` to include codebase information:

```javascript
_buildContext(meetings, updates, codeContext = null) {
  let context = 'Team Context:\n\n';
  
  // Meetings
  if (meetings.length > 0) {
    context += 'Recent Meetings:\n';
    meetings.forEach(m => {
      context += `- ${m.title} (${m.start_time})\n`;
      if (m.ai_summary) context += `  Summary: ${m.ai_summary}\n`;
    });
    context += '\n';
  }

  // JIRA/GitHub Updates
  if (updates.length > 0) {
    context += 'Recent Updates:\n';
    updates.forEach(u => {
      context += `- [${u.update_type}] ${u.title}\n`;
    });
    context += '\n';
  }

  // Code context (NEW!)
  if (codeContext && codeContext.answer) {
    context += 'Codebase Information:\n';
    context += codeContext.answer + '\n\n';
    
    if (codeContext.sources && codeContext.sources.length > 0) {
      context += 'Code References:\n';
      codeContext.sources.forEach(source => {
        context += `- ${source.repository}/${source.file}\n`;
      });
      context += '\n';
    }
  }

  return context || 'No team data available yet.';
}
```

## 🎯 How It Works Now

### Context Flow (Fixed)

1. **User selects context** in Team Chat UI:
   - ✅ 1 meeting: "abc standup"
   - ✅ 2 tasks: "nanana", "Bla bla bla I"
   - ✅ 1 repository: "Mark-I"

2. **Frontend sends filter** to backend:
   ```javascript
   contextFilter: {
     meetingIds: ['meeting-id-1'],
     taskIds: ['task-id-1', 'task-id-2'],
     repositories: [{ owner: 'HeyoJarvis', name: 'Mark-I' }]
   }
   ```

3. **Intelligence Handler fetches ONLY selected data**:
   ```javascript
   // Fetches ONLY the 1 selected meeting
   const meetings = await supabaseAdapter.supabase
     .from('meeting_summaries')
     .select('*')
     .in('id', ['meeting-id-1']);  // ✅ ONLY selected!
   
   // Fetches ONLY the 2 selected tasks
   const tasks = await supabaseAdapter.supabase
     .from('team_updates')
     .select('*')
     .in('id', ['task-id-1', 'task-id-2']);  // ✅ ONLY selected!
   ```

4. **TeamContextEngine NOW USES filtered context**:
   ```javascript
   // Before: Ignored filteredContext, queried ALL data ❌
   // After: Uses ONLY the filtered data ✅
   if (options.filteredContext) {
     meetings = options.filteredContext.meetings;  // ✅ ONLY 1 meeting!
     updates = options.filteredContext.tasks;      // ✅ ONLY 2 tasks!
   }
   ```

5. **AI receives ONLY selected context**:
   - ✅ 1 meeting summary
   - ✅ 2 JIRA task descriptions
   - ✅ Relevant code from 1 repository

## 📊 Before vs After

### Before Fix ❌

```
User selects:   1 meeting, 2 tasks, 1 repo
AI receives:    8 meetings, 34 tasks (ALL data!)
AI response:    "I see 8 meetings and 34 tasks..." (WRONG!)
```

### After Fix ✅

```
User selects:   1 meeting, 2 tasks, 1 repo
AI receives:    1 meeting, 2 tasks, code from 1 repo (ONLY selected!)
AI response:    "Based on the abc standup and 2 tasks..." (CORRECT!)
```

## 🧪 Testing

### Test 1: Filtered Context

**Select**: 1 meeting, 2 tasks, 1 repo

**Ask**: "What meetings do I have?"

**Expected**: AI should mention ONLY the 1 selected meeting

**Check logs for**:
```
Using filtered context: { meetings: 1, tasks: 2 }
```

### Test 2: No Context Selected

**Select**: Nothing (use default)

**Ask**: "What meetings do I have?"

**Expected**: AI should see last 10 meetings (fallback behavior)

**Check logs for**:
```
Using all context (no filter): { meetings: 10, updates: 20 }
```

### Test 3: Code Context

**Select**: 1 repo, ask about code

**Expected**: AI should include code information in response

## 🚀 Next Steps

1. **Restart the app**:
   ```bash
   npm run dev
   ```

2. **Test filtered context**:
   - Go to Team Chat
   - Select specific meetings/tasks/repos
   - Ask a question
   - Verify AI mentions ONLY selected items

3. **Check terminal logs**:
   ```
   Using filtered context: { meetings: 1, tasks: 2 }
   ```

4. **Verify AI response**:
   - Should mention ONLY the selected items
   - Should NOT mention unselected data

## 🔍 Log Examples

### Correct (After Fix)

```json
{
  "level": "info",
  "message": "Using filtered context",
  "meetings": 1,
  "tasks": 2,
  "service": "team-context-engine"
}

{
  "level": "info",
  "message": "IPC: intelligence:ask",
  "hasContextFilter": true,
  "meetingIds": 1,
  "taskIds": 2,
  "repositories": 1
}
```

### Incorrect (Before Fix)

```json
{
  "level": "info",
  "message": "IPC: intelligence:ask",
  "hasContextFilter": true,  // ✅ Filter sent
  "meetingIds": 1,
  "taskIds": 2
}

// But then AI saw ALL data anyway ❌
// (No log about using filtered context)
```

## ✅ Status

**FIXED** - AI now receives ONLY the selected context

### Changes Made

1. ✅ `TeamContextEngine.askQuestion` now checks for `filteredContext`
2. ✅ Uses filtered data when provided (ONLY selected items)
3. ✅ Falls back to ALL data if no filter (backward compatibility)
4. ✅ Added code context support
5. ✅ Added logging for debugging

### Impact

- **Multi-session chat**: Now works correctly with context picker
- **Backward compatibility**: Still works without context filter
- **Code integration**: Now includes codebase information
- **Debugging**: Clear logs show what context AI is using

---

**Fix Date**: October 21, 2025
**Issue**: AI was seeing ALL context instead of ONLY selected items
**Resolution**: Modified `TeamContextEngine` to use `filteredContext` when provided

