# JIRA Inline Editing Feature

## Overview
Added comprehensive inline editing capabilities to the task chat, allowing users to edit JIRA fields directly from the HeyJarvis interface without leaving the app.

## Editable Fields

### 1. **Task Title** ✏️
- **Location**: Header of task chat
- **How to Edit**: Click on the title
- **Features**:
  - Inline text input appears
  - Press Enter or click away to save
  - Automatically syncs to JIRA
  - Shows "Saving..." indicator
  - Edit icon appears on hover

### 2. **Description & Acceptance Criteria** 📝
- **Location**: Acceptance Criteria section
- **How to Edit**: Click "Edit" button next to label
- **Features**:
  - Large textarea for editing
  - Supports markdown and plain text
  - Shows ADF JSON for complex JIRA descriptions
  - Save/Cancel buttons
  - Preserves formatting
  - Updates JIRA immediately

### 3. **Linked Repository** 🔗
- **Location**: Subtitle area (below task ID)
- **How to Edit**: Click on repository name
- **Features**:
  - Dropdown with available repositories
  - Pulls from GitHub integrations
  - Auto-saves on selection
  - Shows GitHub icon
  - Only visible for JIRA tasks

## User Experience

### Visual Indicators
```
┌─────────────────────────────────────────┐
│  📋 Introduce Async Team Tracking ✏️    │ ← Hover shows edit icon
│  Epic • SCRUM-37 • 🔗 heyjarvis-repo    │ ← Click repo to change
└─────────────────────────────────────────┘
```

### Editing Flow

**Title Editing:**
1. User hovers over title → Edit icon appears
2. User clicks title → Input field appears
3. User types new title
4. User presses Enter or clicks away → "Saving..." appears
5. JIRA updates → Success!

**Description Editing:**
1. User clicks "Edit" button → Textarea appears
2. User edits content (markdown/plain text)
3. User clicks "Save to JIRA" → Syncing...
4. JIRA updates → View refreshes with new content

**Repository Editing:**
1. User clicks repository name → Dropdown appears
2. User selects from available repos
3. Auto-saves on selection
4. Updates JIRA custom field

## Technical Implementation

### Frontend (`TaskChat.jsx`)

#### State Management
```javascript
const [isEditingTitle, setIsEditingTitle] = useState(false);
const [isEditingDescription, setIsEditingDescription] = useState(false);
const [isEditingRepository, setIsEditingRepository] = useState(false);
const [editedTitle, setEditedTitle] = useState(task.title);
const [editedDescription, setEditedDescription] = useState(task.description);
const [editedRepository, setEditedRepository] = useState(task.repository || '');
const [isSaving, setIsSaving] = useState(false);
const [availableRepositories, setAvailableRepositories] = useState([]);
```

#### Save Functions
```javascript
const saveTitle = async () => {
  const response = await window.electronAPI.jira.updateIssue(task.id, {
    summary: editedTitle
  });
  // Handle success/error
};

const saveDescription = async () => {
  const response = await window.electronAPI.jira.updateIssue(task.id, {
    description: editedDescription
  });
  // Handle success/error
};

const saveRepository = async () => {
  const response = await window.electronAPI.jira.updateIssue(task.id, {
    customFields: { repository: editedRepository }
  });
  // Handle success/error
};
```

### Backend Integration

Uses existing JIRA IPC handlers:
- `window.electronAPI.jira.updateIssue(issueKey, updateData)`
- `window.electronAPI.codeIndexer.listRepositories()`

### CSS Styling

**Editable Indicators:**
```css
.editable {
  cursor: pointer;
  transition: all 0.2s ease;
}

.editable:hover {
  background: rgba(0, 0, 0, 0.03);
  border-radius: 4px;
}

.edit-icon {
  opacity: 0;
  transition: opacity 0.2s ease;
}

.editable:hover .edit-icon {
  opacity: 0.5;
}
```

**Input Styling:**
- Blue borders (#0284c7)
- Focus states with shadows
- Disabled states for saving
- Smooth transitions

## Features & Benefits

### 1. **Seamless Workflow**
- No context switching to JIRA
- Edit directly where you work
- Instant visual feedback
- Real-time sync

### 2. **Smart Validation**
- Only shows for JIRA tasks (`external_source === 'jira'`)
- Prevents empty titles
- Handles errors gracefully
- Reverts on failure

### 3. **Repository Integration**
- Pulls from GitHub connections
- Dropdown of available repos
- Links code to tasks
- Improves traceability

### 4. **User-Friendly**
- Hover to reveal edit options
- Clear visual indicators
- Keyboard shortcuts (Enter to save)
- Cancel/revert options

## Error Handling

### Network Errors
```javascript
try {
  const response = await window.electronAPI.jira.updateIssue(...);
  if (!response.success) {
    alert('Failed to update: ' + response.error);
    setEditedTitle(task.title); // Revert
  }
} catch (error) {
  alert('Failed to update');
  setEditedTitle(task.title); // Revert
}
```

### Validation
- Title cannot be empty
- Description can be empty (clears field)
- Repository can be unset (dropdown has "No repository" option)

### User Feedback
- "Saving..." indicator during updates
- Alert on failure
- Automatic revert on error
- Disabled inputs while saving

## Future Enhancements

### Potential Additions
1. **More Fields**:
   - Priority dropdown
   - Status transitions
   - Assignee picker
   - Labels/tags editor
   - Due date picker

2. **Rich Text Editor**:
   - WYSIWYG for descriptions
   - Markdown preview
   - Table builder
   - Image uploads

3. **Batch Operations**:
   - Edit multiple tasks
   - Bulk updates
   - Template application

4. **Collaboration**:
   - Show who's editing
   - Real-time updates
   - Conflict resolution
   - Change history

5. **Smart Features**:
   - Auto-save drafts
   - Undo/redo
   - Keyboard shortcuts
   - Voice dictation

## Testing Checklist

- [x] Title editing works and syncs to JIRA
- [x] Description editing preserves formatting
- [x] Repository dropdown shows available repos
- [x] Hover states show edit indicators
- [x] Saving indicators appear
- [x] Error handling reverts changes
- [x] Only shows for JIRA tasks
- [x] Keyboard shortcuts work (Enter to save)
- [x] Cancel button reverts changes
- [x] No linting errors

## Files Modified

1. **`desktop2/renderer2/src/components/Tasks/TaskChat.jsx`**
   - Added editing state management
   - Implemented save functions
   - Updated UI with editable fields
   - Added repository loading

2. **`desktop2/renderer2/src/components/Tasks/TaskChat.css`**
   - Added editable field styles
   - Input/textarea styling
   - Button styles (save/cancel)
   - Hover effects and transitions

3. **`desktop2/renderer2/src/pages/TasksDeveloper.jsx`**
   - Fixed description preservation (ADF objects)

4. **`desktop2/renderer2/src/components/common/TabBar.jsx`**
   - Added Architecture tab for developers

## Usage Examples

### Edit Title
```
1. Open task chat
2. Hover over "Introduce Async Team Tracking"
3. See edit icon appear
4. Click on title
5. Type new title: "Implement Async Team Tracking"
6. Press Enter
7. See "Saving..." → Done!
```

### Edit Description
```
1. Scroll to Acceptance Criteria section
2. Click "Edit" button
3. Modify description in textarea
4. Click "Save to JIRA"
5. Wait for sync
6. See updated content rendered
```

### Link Repository
```
1. Look for repository in subtitle
2. Click on repository name (or "Add Repository")
3. Select from dropdown
4. Auto-saves immediately
5. Repository now linked to task
```

## Benefits Summary

✅ **Productivity**: Edit without leaving HeyJarvis
✅ **Accuracy**: Real-time sync with JIRA
✅ **Convenience**: Inline editing with visual feedback
✅ **Integration**: Links code repositories to tasks
✅ **UX**: Intuitive hover states and clear indicators
✅ **Reliability**: Error handling and automatic revert

## Conclusion

The inline editing feature transforms HeyJarvis from a read-only JIRA viewer into a full-featured task management interface. Users can now update titles, descriptions, and repository links directly from the task chat, creating a seamless workflow that keeps them in their development environment.

