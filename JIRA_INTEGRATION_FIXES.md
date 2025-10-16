# JIRA Integration Fixes - October 15, 2025

## Issues Fixed

### 1. JQL Query Syntax Error (400 Bad Request)
**Problem:** JIRA API was returning 400 errors with the message:
```
Error in JQL Query: Expecting either a value, list or function but got 'In'. 
You must surround 'In' in quotation marks to use it as a value.
```

**Root Cause:** Status names with spaces (like "In Progress", "To Do", "Code Review") were not being quoted in the JQL query, causing JIRA's parser to fail.

**Fix Applied:** Updated `desktop2/main/services/JIRAService.js` in the `getMyIssues()` method to automatically quote each status value:

```javascript
// Before (line 160):
const jql = `assignee = currentUser() AND status IN (${status}) ORDER BY priority DESC, updated DESC`;

// After (lines 160-165):
const statusList = status
  .split(',')
  .map(s => `"${s.trim()}"`)
  .join(',');
const jql = `assignee = currentUser() AND status IN (${statusList}) ORDER BY priority DESC, updated DESC`;
```

**Result:** JQL query now properly formats as:
```
status IN ("In Progress","To Do","Code Review")
```

---

### 2. Description Type Error in Frontend
**Problem:** Frontend was throwing `TypeError: issue.description.match is not a function` when transforming JIRA issues.

**Root Cause:** JIRA's API can return `description` as:
- `null` (when no description exists)
- An object (when using ADF - Atlassian Document Format)
- A string (plain text descriptions)

The frontend code assumed it was always a string and called `.match()` directly.

**Fix Applied:** Updated `desktop2/renderer2/src/pages/TasksDeveloper.jsx` in the `transformJIRAIssue()` function to safely handle description:

```javascript
// Before (line 356):
if (issue.description) {
  const asAMatch = issue.description.match(/As a\s+(.+?)[\n\r]/i);
  // ... more .match() calls
}

// After (lines 356-357):
const description = typeof issue.description === 'string' ? issue.description : '';

if (description) {
  const asAMatch = description.match(/As a\s+(.+?)[\n\r]/i);
  // ... more .match() calls using 'description' variable
}
```

Also updated line 398 to use the validated `description` variable:
```javascript
description: description || issue.summary,
```

**Result:** Frontend now safely handles all JIRA description formats without crashing.

---

### 3. Assignee Name Type Error
**Problem:** Frontend was throwing `TypeError: Cannot read properties of undefined (reading 'split')` at line 783 when rendering assignee avatars.

**Root Cause:** The JIRA API returns assignee information with `display_name` (not `name`), and the frontend was trying to access `issue.assignee.name` which was undefined. Additionally, the rendering code didn't handle cases where assignee might be undefined.

**Fix Applied:** Updated `desktop2/renderer2/src/pages/TasksDeveloper.jsx`:

**In `transformJIRAIssue()` function (line 399):**
```javascript
// Before:
assignees: issue.assignee ? [issue.assignee.name] : ['Unassigned'],

// After:
assignees: issue.assignee ? [issue.assignee.display_name || issue.assignee.name || 'Unassigned'] : ['Unassigned'],
```

**In render section (line 783):**
```javascript
// Before:
{assignee.split(' ').map(n => n[0]).join('')}

// After:
{(assignee || 'Unassigned').split(' ').map(n => n[0]).join('')}
```

**Result:** Frontend now correctly extracts assignee names from JIRA data and safely handles undefined values.

---

### 4. Epic Name Showing "Unassigned"
**Problem:** The epic name (top-left of each card) was showing "Unassigned" instead of meaningful project/epic information.

**Root Cause:** 
1. JIRA API was not fetching `labels`, `issuetype`, or `parent` (epic) fields
2. Frontend fallback logic was too simple and defaulted to "Unassigned"

**Fix Applied:**

**In `core/integrations/jira-service.js` (line 471):**
```javascript
// Before:
fields = ['summary', 'status', 'assignee', 'priority', 'created', 'updated', 'description', 'customfield_10016']

// After:
fields = ['summary', 'status', 'assignee', 'priority', 'created', 'updated', 'description', 'labels', 'issuetype', 'parent', 'customfield_10016']
```

**In `core/integrations/jira-service.js` normalization (lines 704-707):**
```javascript
// Added epic field extraction from parent:
epic: fields.parent ? {
  key: fields.parent.key,
  name: fields.parent.fields?.summary || fields.parent.key
} : null,
```

**In `desktop2/renderer2/src/pages/TasksDeveloper.jsx` (line 394):**
```javascript
// Before:
epicName: issue.epic?.name || issue.labels?.join(', ') || 'Unassigned',

// After (cascading fallbacks):
epicName: issue.epic?.name || 
  (issue.labels && issue.labels.length > 0 ? issue.labels.join(', ') : null) || 
  issue.issue_type?.name || 
  issue.key?.split('-')[0] || 
  'General',
```

**Result:** Epic name now shows (in order of preference):
1. Actual epic name if issue is part of an epic
2. Issue labels (comma-separated) if present
3. Issue type (Story, Task, Bug, etc.)
4. Project key (e.g., "SCRUM" from "SCRUM-35")
5. "General" as final fallback

---

## Files Modified

1. **`/Users/jarvis/Code/HeyJarvis/desktop2/main/services/JIRAService.js`**
   - Lines 159-165: Added status quoting logic in `getMyIssues()` method

2. **`/Users/jarvis/Code/HeyJarvis/desktop2/renderer2/src/pages/TasksDeveloper.jsx`**
   - Line 357: Added type checking for description field
   - Line 398: Use validated description variable
   - Line 399: Fixed assignee name extraction to use `display_name` with fallbacks
   - Line 783: Added safety check for undefined assignee in render

---

## Testing

After these fixes, the JIRA integration should:
✅ Successfully query JIRA API without 400 errors
✅ Handle status names with spaces correctly
✅ Transform JIRA issues without type errors
✅ Display real JIRA data instead of mock data
✅ Support all JIRA description formats (null, string, object)

---

## Next Steps

If you encounter issues with JIRA descriptions showing as `[object Object]`, we may need to:
1. Parse ADF (Atlassian Document Format) to extract plain text
2. Or request plain text format from JIRA API using different field parameters

The current fix ensures the app doesn't crash, but ADF descriptions will show as empty strings.

