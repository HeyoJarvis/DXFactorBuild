# ✨ JIRA Editing in HeyJarvis - Complete Guide

## Overview

You can now **edit JIRA issues directly** from within HeyJarvis! No need to switch between apps - manage your work right from the desktop interface.

## Features Implemented

### 1. **Quick Actions on Task List**
Every JIRA issue now has quick action buttons:
- **Start** - Move issue to "In Progress"
- **Done** - Mark issue as "Done"
- **🔗** - Open in JIRA (browser)

### 2. **Full Issue Editor Modal**
Click any JIRA issue to open a comprehensive editor with:

#### Status Management
- Quick status transitions (To Do → In Progress → In Review → Done)
- Visual button interface with color-coded states
- Instant updates

#### Priority Changes
- 5 priority levels: Highest, High, Medium, Low, Lowest
- Color-coded priority badges
- One-click priority updates

#### Description Editing
- Full text area for editing issue descriptions
- Updates directly to JIRA
- Preserves formatting

#### Comments
- Add comments to issues without leaving the app
- Comments appear in JIRA immediately
- Perfect for quick updates or questions

#### Assignee Information
- See who's assigned to the issue
- Shows avatar, name, and email

### 3. **Visual Improvements**
- **Color-coded status indicators**
  - Gray (To Do)
  - Blue (In Progress)
  - Orange (In Review)
  - Green (Done)
  
- **Hover effects** - Issues highlight on hover
- **Smooth animations** - Professional transitions
- **Responsive design** - Works at any window size

## How to Use

### Quick Actions

1. **Start Working on an Issue:**
   - Find the issue in your task list
   - Click the **blue "Start" button**
   - Issue moves to "In Progress" immediately

2. **Mark as Done:**
   - Click the **green "Done" button**
   - Issue transitions to "Done" status

3. **Open in JIRA:**
   - Click the **🔗 button**
   - Opens the issue in your browser

### Full Editor

1. **Open the Editor:**
   - Click anywhere on the issue card
   - A modal appears with all editing options

2. **Change Status:**
   - Click any status button (To Do, In Progress, In Review, Done)
   - Issue updates immediately
   - Modal closes automatically
   - Task list refreshes

3. **Update Priority:**
   - Click a priority button (Highest, High, Medium, Low, Lowest)
   - Priority updates in JIRA
   - Task list refreshes with new priority color

4. **Edit Description:**
   - Type in the description text area
   - Click "Update Description"
   - Description saves to JIRA

5. **Add Comments:**
   - Type your comment in the comment box
   - Click "Add Comment"
   - Comment appears in JIRA
   - Text box clears for next comment

### Keyboard Shortcuts

- **ESC** - Close the editor modal
- **Click outside** - Also closes the modal

## Technical Details

### Natural Language Commands
Under the hood, all edits use natural language commands:

```javascript
// Status change
"transition PROJ-123 to In Progress"

// Priority update
"update PROJ-123 set priority to High"

// Description edit
"update PROJ-123 set description to 'New description text'"

// Add comment
"comment on PROJ-123 'This is a comment'"
```

### API Integration
- Uses `jira:executeCommand` IPC handler
- Leverages JIRA natural language parser
- Automatic token refresh
- Error handling with user notifications

### Real-time Updates
- Changes sync immediately to JIRA
- Task list refreshes after updates
- Notifications confirm success/failure

## UI Components

### Task Card (List View)
```
┌─────────────────────────────────────────────┐
│ ○  Fix login bug                            │
│    [High] [In Progress] Task • PROJ-123     │
│    👤 John Doe                               │
│    [Start] [Done] [🔗]                       │
└─────────────────────────────────────────────┘
```

### Editor Modal
```
┌────────────────────────────────────────────┐
│  Fix login bug                       ×     │
│  PROJ-123 • Task                           │
├────────────────────────────────────────────┤
│                                            │
│  Status:                                   │
│  [To Do] [In Progress] [In Review] [Done] │
│                                            │
│  Priority:                                 │
│  [Highest] [High] [Medium] [Low] [Lowest] │
│                                            │
│  Description:                              │
│  ┌──────────────────────────────────────┐ │
│  │ Users can't log in when...          │ │
│  └──────────────────────────────────────┘ │
│  [Update Description]                     │
│                                            │
│  Add Comment:                              │
│  ┌──────────────────────────────────────┐ │
│  │ Write a comment...                   │ │
│  └──────────────────────────────────────┘ │
│  [Add Comment]                            │
│                                            │
│  Assigned to:                              │
│  ● John Doe (john@example.com)            │
│                                            │
│  [Open in JIRA →] [Close]                 │
└────────────────────────────────────────────┘
```

## Examples

### Example 1: Quick Status Change
```
1. See "Fix login bug" in task list
2. Click "Start" button
3. ✅ "PROJ-123 moved to In Progress"
4. Issue now shows blue "In Progress" badge
```

### Example 2: Update Priority and Add Comment
```
1. Click on "Fix login bug" issue card
2. Editor opens
3. Click "Highest" priority button
4. ✅ "Priority updated to Highest"
5. Type comment: "This is blocking production"
6. Click "Add Comment"
7. ✅ "Comment added"
8. Click "Close"
```

### Example 3: Edit Description
```
1. Click issue to open editor
2. Edit text in description field
3. Click "Update Description"
4. ✅ "Description updated"
5. Changes reflected in JIRA immediately
```

## Error Handling

All operations include error handling:

```javascript
// User sees friendly notifications:
✅ "PROJ-123 moved to Done"           // Success
❌ "Failed: Issue not found"          // Error
⚠️  "Description cannot be empty"     // Validation
```

## Limitations

Currently not supported (but can be added):
- ❌ Assignee changes (shows current assignee only)
- ❌ Custom field editing
- ❌ Attachment uploads
- ❌ Subtask creation
- ❌ Time tracking
- ❌ Watchers management

## Future Enhancements

Planned features:
- [ ] Assignee picker/search
- [ ] Label management
- [ ] Sprint assignment
- [ ] Bulk operations (move multiple issues)
- [ ] Issue creation from within HeyJarvis
- [ ] Comment history viewer
- [ ] Activity timeline
- [ ] @ mentions in comments
- [ ] Rich text editor for descriptions
- [ ] Drag-and-drop to change status
- [ ] Keyboard shortcuts for quick actions

## Requirements

- **JIRA Connection**: Must authenticate with JIRA first
- **Developer Role**: JIRA features only available for developers/admins
- **Valid Tokens**: OAuth tokens must be active
- **Network**: Internet connection required for JIRA API calls

## Troubleshooting

### Issue: "Failed to transition issue"
**Solution**: Check that the status exists in your JIRA workflow

### Issue: "Failed to update description"
**Solution**: Ensure description is not empty and contains valid text

### Issue: "Failed to add comment"
**Solution**: Check that comment text is not empty

### Issue: Changes not appearing
**Solution**: 
1. Check console for errors
2. Verify JIRA connection (look for green dot on JIRA button)
3. Try manually syncing (click JIRA button when connected)

### Issue: Modal won't close
**Solution**: 
- Press ESC key
- Click outside the modal
- Refresh the app

## Developer Notes

### Adding New Actions

To add new JIRA actions:

1. **Add natural language command** in `jira-command-parser.js`
2. **Add UI button** in `unified.html`
3. **Call `window.electronAPI.jira.executeCommand()`**
4. **Handle response and refresh UI**

Example:
```javascript
async function customJIRAAction(issueKey) {
  const result = await window.electronAPI.jira.executeCommand({
    command: `your command ${issueKey} here`
  });
  
  if (result.success) {
    showNotification('Success!', 'success');
    await loadTasks(); // Refresh
  }
}
```

### Styling

All styles are inline for simplicity. Key design tokens:
- Primary: `#007AFF` (Blue)
- Success: `#34C759` (Green)
- Warning: `#FF9500` (Orange)
- Danger: `#FF3B30` (Red)
- Gray: `#737373`

## Summary

✅ **Quick actions** on every issue  
✅ **Full editor modal** for detailed changes  
✅ **Status transitions** with one click  
✅ **Priority updates** instantly  
✅ **Description editing** without leaving app  
✅ **Comment addition** for quick notes  
✅ **Visual feedback** with notifications  
✅ **Auto-refresh** to show latest state  

**Result**: Manage your JIRA workflow entirely from HeyJarvis! 🎉

