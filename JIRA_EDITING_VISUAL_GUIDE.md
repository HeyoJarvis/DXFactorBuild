# JIRA Editing - Visual Guide

## 🎯 What You Can Edit

### 1. **Task Title** (Top of card)
```
┌─────────────────────────────────────────────┐
│  SCRUM-37  Introduce Async Team Tracking   │ ← Click here to edit
│  EPIC                                        │
└─────────────────────────────────────────────┘
```

**How it works:**
- Click on "Introduce Async Team Tracking"
- Text becomes an input field
- Type your changes
- "Save" and "Cancel" buttons appear below
- Click "Save" to update JIRA

---

### 2. **Repository Link** (Below title)
```
┌─────────────────────────────────────────────┐
│  heyjarvis/backend  feature/scrum-37        │
│  ↑                                          │
│  Click to change repository                 │
└─────────────────────────────────────────────┘
```

**How it works:**
- Click on "heyjarvis/backend"
- Dropdown appears with all your GitHub repos
- Select a new repository
- Saves automatically when you select

---

### 3. **Description/Table** (Main content area)
```
┌─────────────────────────────────────────────┐
│  Description & Acceptance Criteria          │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ Feature          │ Description      │   │ ← Click anywhere
│  ├─────────────────────────────────────┤   │   to edit
│  │ Async Tracking   │ Monitor team...  │   │
│  │ Real-time Updates│ Live dashboard   │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  [Save to JIRA]  [Cancel]                  │
└─────────────────────────────────────────────┘
```

**How it works:**
- Click anywhere in the description/table area
- The entire area becomes editable
- Click into table cells to edit them directly
- Type to add/modify text
- "Save to JIRA" and "Cancel" buttons appear at bottom
- Click "Save to JIRA" to persist changes

---

## 🎨 Visual Feedback

### Hover Effects
When you hover over editable elements:
- **Title**: Light blue background appears
- **Repository**: Light blue background appears
- **Description**: Cursor changes to text cursor

### Edit Mode
When editing:
- **Title**: Input field with blue border and shadow
- **Repository**: Dropdown selector appears
- **Description**: Blue border (2px) with shadow around entire editor

### Table Editing
- Click directly into any table cell
- Type to edit content
- Use Tab to move between cells
- Use Enter to create new lines within cells
- Tables maintain their structure

---

## 🔄 Save Flow

### Title/Repository
```
Click → Edit → Save Button Appears → Click Save → Updates JIRA
```

### Description/Table
```
Click → Entire Area Editable → Edit Table Cells → Save Button Appears → Click Save → Converts to ADF → Updates JIRA
```

---

## 💡 Tips

1. **Title Editing**
   - Keep titles concise and descriptive
   - Changes appear immediately in JIRA

2. **Table Editing**
   - You can edit any cell directly
   - Formatting (bold, italic) is preserved
   - Tables maintain their structure when saved

3. **Repository Selection**
   - Only shows repositories you have access to
   - Repository is linked to JIRA custom field
   - Helps track which repo the task belongs to

---

## 🐛 Troubleshooting

### "I don't see the edit option"
- Make sure the task is from JIRA (`external_source: 'jira'`)
- Check console for debug logs showing `isJiraTask: true`

### "Save button doesn't appear"
- Make sure you actually changed something
- The save button only appears when changes are detected

### "Repository dropdown is empty"
- Check that GitHub integration is connected
- Verify Code Indexer service is running
- Check console for repository loading errors

### "Table doesn't save correctly"
- Make sure you click "Save to JIRA" not just close the editor
- Check console for ADF conversion errors
- Verify JIRA connection is active

---

## 📊 Example Edit Session

1. **Open task** SCRUM-37
2. **Click title** → "Introduce Async Team Tracking"
3. **Change to** → "Implement Async Team Tracking"
4. **Click Save** → Updates JIRA ✅
5. **Click description** → Table becomes editable
6. **Edit cell** → Change "Monitor team..." to "Track team progress..."
7. **Click Save to JIRA** → Converts HTML → ADF → Updates JIRA ✅
8. **Click repository** → "heyjarvis/backend"
9. **Select** → "heyjarvis/frontend"
10. **Auto-saves** → Updates JIRA ✅

---

## 🎯 Expected Behavior

### Before Editing
- Elements look like normal text
- Subtle hover effect shows they're clickable
- No input fields visible

### During Editing
- Input fields/contentEditable areas appear
- Blue borders indicate active editing
- Save/Cancel buttons visible

### After Saving
- Changes persist to JIRA immediately
- UI updates to show new values
- Edit mode closes automatically
- Success feedback (no error alerts)

---

## 🔍 Console Debug Output

You should see:
```javascript
📋 TaskChat received task data: {
  id: 'SCRUM-37',
  external_source: 'jira',
  isJiraTask: true
}

🔧 Editing enabled? {
  titleClickable: true,
  descriptionClickable: true
}

📚 Listing GitHub repositories
✅ Loaded 15 repositories
```

If you see `isJiraTask: false`, the editing won't work!

