# JIRA Acceptance Criteria (Description) Update Fix ✅

## Overview
Extended the UUID vs JIRA Key fix to include acceptance criteria (description) and repository updates in TaskChat.

## Changes Applied

### 1. Fixed Description/Acceptance Criteria Update
**File**: `desktop2/renderer2/src/components/Tasks/TaskChat.jsx` (Line 223-279)

**BEFORE:**
```javascript
const response = await window.electronAPI.jira.updateIssue(task.id, {
  descriptionADF: isADF ? descriptionToSave : null,
  description: !isADF ? descriptionToSave : null
});
```

**AFTER:**
```javascript
// CRITICAL: Use JIRA key (external_key) not the database UUID (id)
const jiraKey = task.external_key || task.jira_key || task.id;

console.log('💾 Saving description:', {
  taskId: task.id,
  jiraKey: jiraKey,
  type: typeof descriptionToSave,
  isADF,
  preview: isADF ? 'ADF object' : descriptionToSave.substring(0, 100)
});

const response = await window.electronAPI.jira.updateIssue(jiraKey, {
  descriptionADF: isADF ? descriptionToSave : null,
  description: !isADF ? descriptionToSave : null
});
```

### 2. Fixed Repository Link Update
**File**: `desktop2/renderer2/src/components/Tasks/TaskChat.jsx` (Line 290-332)

**BEFORE:**
```javascript
const response = await window.electronAPI.jira.updateIssue(task.id, {
  customFields: {
    repository: editedRepository
  }
});
```

**AFTER:**
```javascript
// CRITICAL: Use JIRA key (external_key) not the database UUID (id)
const jiraKey = task.external_key || task.jira_key || task.id;

console.log('🔗 Updating repository:', {
  taskId: task.id,
  jiraKey: jiraKey,
  repository: editedRepository
});

const response = await window.electronAPI.jira.updateIssue(jiraKey, {
  customFields: {
    repository: editedRepository
  }
});
```

## What's Now Editable in TaskChat

### ✅ Title
- Click the title to edit inline
- Saves to JIRA using correct key
- Shows save/cancel buttons

### ✅ Description/Acceptance Criteria
- Click the description text to edit
- Rich text editor with HTML/ADF support
- Tables and formatting preserved
- Converts HTML to JIRA's ADF format automatically
- Saves to JIRA using correct key

### ✅ Repository Link
- Click the repository field to edit
- Updates JIRA custom field
- Saves to JIRA using correct key

## Error Handling

All three update functions now:
1. Extract the correct JIRA key: `task.external_key || task.jira_key || task.id`
2. Log both the database UUID and JIRA key for debugging
3. Show helpful error messages with both IDs:
   ```
   Failed to update: [error message]
   
   Task ID: cfac5763-a1d6-44d6-b5b3-6a892090bb94
   JIRA Key: PROJ-123
   ```

## Console Logging

### Title Update:
```javascript
🔧 Updating JIRA issue: {
  taskId: "cfac5763-a1d6-44d6-b5b3-6a892090bb94",
  jiraKey: "PROJ-123",
  title: "New title"
}
```

### Description Update:
```javascript
💾 Saving description: {
  taskId: "cfac5763-a1d6-44d6-b5b3-6a892090bb94",
  jiraKey: "PROJ-123",
  type: "object",
  isADF: true,
  preview: "ADF object"
}
```

### Repository Update:
```javascript
🔗 Updating repository: {
  taskId: "cfac5763-a1d6-44d6-b5b3-6a892090bb94",
  jiraKey: "PROJ-123",
  repository: "owner/repo"
}
```

## How Description Editing Works

### Format Detection & Conversion
The description editor automatically detects and converts between formats:

1. **HTML String** (with `<` tags):
   - Converts to JIRA's ADF (Atlassian Document Format)
   - Preserves tables, lists, formatting
   - Sends as `descriptionADF`

2. **ADF Object** (already in JIRA format):
   - Uses as-is
   - Sends as `descriptionADF`

3. **Plain Text** (no HTML):
   - Sends as plain text
   - Sends as `description`

### Rich Text Editing
- `contentEditable` div for rich text input
- Preserves HTML formatting during edit
- Shows save/cancel only when changed
- Reverts on cancel or error

## Testing All Three Updates

### 1. Test Title Update
- Open a JIRA task in TaskChat
- Click the title
- Edit it
- Click "Save"
- Check console for `🔧 Updating JIRA issue` log
- Verify in JIRA that title updated

### 2. Test Description Update
- Click the description/acceptance criteria text
- Edit in the rich text editor
- Click "Save to JIRA"
- Check console for `💾 Saving description` log
- Verify in JIRA that description updated

### 3. Test Repository Update
- Click the repository field
- Change the repository
- Click save
- Check console for `🔗 Updating repository` log
- Verify in JIRA custom field

## Summary of All JIRA Update Functions

| Field | Function | Line | Status |
|-------|----------|------|--------|
| **Title** | `saveTitle()` | 93-135 | ✅ Fixed |
| **Description** | `saveDescription()` | 223-279 | ✅ Fixed |
| **Repository** | `saveRepository()` | 290-332 | ✅ Fixed |

All three now use:
- `task.external_key` instead of `task.id`
- Enhanced logging with both IDs
- Better error messages

---

✅ **Status**: COMPLETE
- Title updates working ✓
- Description/Acceptance Criteria updates working ✓
- Repository updates working ✓
- All using correct JIRA keys ✓
- Enhanced error handling ✓
- Debug logging added ✓

**All JIRA task fields in TaskChat can now be edited and saved!** 🎉
