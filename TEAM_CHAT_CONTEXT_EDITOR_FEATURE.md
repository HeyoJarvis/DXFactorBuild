# Team Chat Context Editor Feature

## Overview
Enhanced the Team Chat feature with an editable context panel that shows detailed lists of meetings, tasks, and codebase items. Users can toggle each context type on/off and save their preferences per team.

## What Was Implemented

### 1. Database Schema

#### [team-chat-context-settings.sql](data/storage/team-chat-context-settings.sql) (NEW)
New table to store user preferences for context sources:

```sql
CREATE TABLE team_chat_context_settings (
  id UUID PRIMARY KEY,
  user_id character varying NOT NULL,
  team_id UUID NOT NULL REFERENCES teams(id),

  -- Toggle switches
  include_meetings BOOLEAN DEFAULT true,
  include_tasks BOOLEAN DEFAULT true,
  include_code BOOLEAN DEFAULT true,

  -- Specific selections
  selected_meeting_ids TEXT[],
  selected_task_ids TEXT[],
  selected_repo_paths TEXT[],

  -- Custom context
  custom_context TEXT,

  created_at TIMESTAMP,
  updated_at TIMESTAMP,

  UNIQUE(user_id, team_id)
);
```

**To apply**: Run this SQL in your Supabase database.

### 2. Frontend Updates

#### [TeamChat.jsx](desktop2/renderer2/src/pages/TeamChat.jsx)
**New State:**
- `contextDetails` - Detailed arrays of meetings, tasks, repos
- `contextSettings` - Toggle states for each context type
- `isSavingContext` - Loading state for save operation

**New Functions:**
- `handleContextToggle(key)` - Toggle context type on/off
- `handleSaveContextSettings()` - Save settings to database
- Enhanced `loadChatHistory()` - Loads details + settings

**New UI:**
- Collapsible sections for each context type
- Checkbox toggles for Meetings, Tasks, Codebase
- Detailed lists showing:
  - **Meetings**: Title + date
  - **Tasks**: Title + JIRA key (if exists)
  - **Repos**: Name + file count
- "Save Context Settings" button
- Badge counts for each section

#### [TeamChat.css](desktop2/renderer2/src/pages/TeamChat.css)
**New Styles:**
- `.context-section` - Container for each context type
- `.context-toggle` - Checkbox + label styling
- `.context-items-list` - Scrollable list of detail items
- `.context-detail-item` - Individual item card
- `.context-save-button` - Gradient save button
- `.context-count` - Badge for item counts

### 3. Backend Updates

#### [team-chat-handlers.js](desktop2/main/ipc/team-chat-handlers.js)

**New Handler:**
```javascript
ipcMain.handle('team-chat:save-context-settings', async (event, teamId, settings) => {
  // Upserts user's context preferences
  await dbAdapter.supabase
    .from('team_chat_context_settings')
    .upsert({
      user_id,
      team_id: teamId,
      include_meetings: settings.include_meetings,
      include_tasks: settings.include_tasks,
      include_code: settings.include_code
    }, { onConflict: 'user_id,team_id' });
});
```

**Enhanced `buildTeamContext()` Function:**
- Loads user's saved settings from database
- Only queries enabled context types
- Returns structured data:
  ```javascript
  {
    context: { meetings_count, tasks_count, code_files_count, summary },
    contextDetails: {
      meetings: [{ id, title, summary, meeting_date }],
      tasks: [{ id, title, external_key }],
      code_repos: [{ name, file_count }]
    },
    contextSettings: { include_meetings, include_tasks, include_code }
  }
  ```

**Enhanced AI System Prompt:**
- Includes detailed lists of meetings with dates/summaries
- Includes tasks with JIRA keys
- Includes repository names and file counts
- More contextual information for better AI responses

#### [preload.js](desktop2/bridge/preload.js)
Added new IPC method:
```javascript
teamChat: {
  loadTeams: () => ...,
  getHistory: (teamId) => ...,
  sendMessage: (teamId, message) => ...,
  saveContextSettings: (teamId, settings) => ... // NEW
}
```

## Features

### Context Panel Features
✅ **Toggle Switches** - Enable/disable meetings, tasks, or code
✅ **Detailed Lists** - See actual items being used as context
✅ **Persistent Settings** - Saved per user per team
✅ **Default Settings** - All enabled by default
✅ **Live Preview** - See counts update when toggling
✅ **Collapsible Sections** - Expand to see item details
✅ **Save Button** - Explicit save action with loading state

### Context Details Shown
- **Meetings**: Title, date, summary preview
- **Tasks**: Title, JIRA key (e.g., "PROJ-123")
- **Code Repos**: Repository name, file count

### AI Context Enhancement
The AI now receives detailed context in its system prompt:
- Individual meeting titles and dates
- Specific task names with JIRA references
- Repository names with file counts

This allows the AI to:
- Reference specific meetings by name
- Mention JIRA tickets
- Discuss particular codebases

## Usage

### For Users

1. **Navigate to Team Chat**
2. **Select a Team**
3. **View Context Panel** (left sidebar)
4. **Toggle Context Types**:
   - Uncheck "Meetings" to exclude meeting notes
   - Uncheck "Tasks" to exclude JIRA tasks
   - Uncheck "Codebase" to exclude code files
5. **Expand Sections** to see detailed lists
6. **Click "Save Context Settings"** to persist changes
7. **Chat with AI** - Context is automatically included

### For Developers

**Load Context Settings:**
```javascript
const { context, contextDetails, contextSettings } = await buildTeamContext(teamId, userId);
```

**Save Context Settings:**
```javascript
await window.electronAPI.teamChat.saveContextSettings(teamId, {
  include_meetings: true,
  include_tasks: false,
  include_code: true
});
```

## Database Migration Required

Run this SQL in your Supabase dashboard:

```bash
# Navigate to data folder
cd /Users/jarvis/Code/HeyJarvis/data/storage

# Copy the SQL content and run in Supabase SQL Editor
cat team-chat-context-settings.sql
```

Or manually execute:
```sql
-- Create the table
CREATE TABLE public.team_chat_context_settings (
  -- See full schema in team-chat-context-settings.sql
);

-- Add RLS policies
ALTER TABLE team_chat_context_settings ENABLE ROW LEVEL SECURITY;
```

## Files Changed

### Modified
1. `/Users/jarvis/Code/HeyJarvis/desktop2/renderer2/src/pages/TeamChat.jsx` - Enhanced UI with toggles
2. `/Users/jarvis/Code/HeyJarvis/desktop2/renderer2/src/pages/TeamChat.css` - New styles for context editor
3. `/Users/jarvis/Code/HeyJarvis/desktop2/main/ipc/team-chat-handlers.js` - New handler + enhanced context builder
4. `/Users/jarvis/Code/HeyJarvis/desktop2/bridge/preload.js` - Added saveContextSettings API

### Created
1. `/Users/jarvis/Code/HeyJarvis/data/storage/team-chat-context-settings.sql` - Database schema

## Testing

1. **Start the app and run the migration:**
```bash
cd /Users/jarvis/Code/HeyJarvis/desktop2
npm run dev
```

2. **Apply database migration** in Supabase SQL Editor

3. **Test the feature:**
   - Navigate to Team Chat tab
   - Select a team
   - View context panel with detailed items
   - Toggle meetings off → click Save → verify AI doesn't mention meetings
   - Toggle tasks off → click Save → verify task list disappears
   - Reload page → verify settings persist

### Expected Behavior

**Initial Load:**
- All three toggles checked by default
- Lists populated with items (if data exists)
- Counts shown in badges

**After Toggling:**
- Unchecked sections collapse
- Counts update to reflect enabled items only
- "Save Context Settings" button clickable

**After Saving:**
- Button shows "Saving..." briefly
- Context reloads with new settings
- AI responses reflect new context

**On Reload:**
- Saved settings persist
- Toggles match last saved state
- AI continues using saved preferences

## Benefits

1. **User Control** - Users decide what context to include
2. **Privacy** - Can exclude sensitive meetings or tasks
3. **Performance** - Fewer database queries when types disabled
4. **Transparency** - Users see exactly what the AI knows
5. **Flexibility** - Different settings per team
6. **Better AI** - More detailed context = better responses

## Future Enhancements

- [ ] Individual item selection (not just type-level toggles)
- [ ] Custom context text field
- [ ] Context preview before sending message
- [ ] Export/import context settings
- [ ] Context usage analytics
- [ ] Auto-refresh when new items added

---

**Status**: ✅ Implementation Complete - Ready for Testing

**Migration Required**: Yes - Run `team-chat-context-settings.sql`

**Next Action**: Apply database migration and test context editing!
