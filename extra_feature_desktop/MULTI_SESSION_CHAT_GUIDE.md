# Multi-Session Context-Aware Chat System

## 🎯 Overview
The enhanced Team Chat now supports multiple chat sessions with context-aware AI conversations. Each session can have its own selected context from meetings, JIRA tasks, and codebase repositories.

## ✨ Key Features

### 1. **Multiple Chat Sessions**
- Create unlimited chat sessions
- Each session maintains its own conversation history
- Sessions are automatically saved to localStorage
- Switch between sessions instantly

### 2. **Context Picker**
Each session can select context from three sources:
- **📅 Meetings**: Select specific meetings to provide context
- **🎯 JIRA Tasks**: Choose relevant JIRA issues and tasks
- **💻 Repositories**: Pick GitHub repositories for code-related questions

### 3. **Context-Aware AI**
- AI queries are filtered based on selected context
- Code queries are routed to the Code Indexer when repositories are selected
- Meeting and task context is fetched directly from the database
- Responses include source citations from the selected context

### 4. **Session Management**
- Rename sessions on the fly
- Delete sessions with confirmation
- Visual indicators for selected context
- Persistent storage across app restarts

## 🎨 User Interface

### Layout
```
┌─────────────────────────────────────────────────────────────┐
│ Header: Title + Context Button + New Session Button        │
├──────────┬──────────────────────────────┬───────────────────┤
│ Sessions │      Chat Messages           │ Context Picker    │
│ Sidebar  │      (Main Area)             │ (Collapsible)     │
│          │                              │                   │
│ • Chat 1 │  👤 User message            │ 📅 Meetings       │
│ • Chat 2 │  🤖 AI response             │ ☑ Meeting 1      │
│ • Chat 3 │                              │ ☐ Meeting 2      │
│          │  [Message Input]            │                   │
│          │                              │ 🎯 JIRA Tasks    │
│          │                              │ ☑ TASK-123       │
│          │                              │ ☐ TASK-456       │
│          │                              │                   │
│          │                              │ 💻 Repositories   │
│          │                              │ ☑ owner/repo     │
└──────────┴──────────────────────────────┴───────────────────┘
```

### Session Sidebar
- Lists all chat sessions
- Shows message count and creation date
- Displays context badges (📅, 🎯, 💻)
- Active session is highlighted
- Delete button on hover

### Context Picker Panel
- Toggles via "📎 Context" button
- Three sections: Meetings, JIRA Tasks, Repositories
- Checkboxes for selecting context items
- Shows count of selected items per category
- Auto-loads available context on mount

### Chat Area
- Clean, modern message bubbles
- User messages on the right (purple gradient)
- AI messages on the left (light background)
- Source citations below AI responses
- Loading indicator while processing
- Welcome screen with context summary

## 🔧 Technical Implementation

### Frontend (TeamChat.jsx)
```javascript
// Session Structure
{
  id: "unique-timestamp",
  name: "Chat 1",
  createdAt: "2025-10-21T...",
  messages: [
    {
      role: "user" | "assistant",
      content: "message text",
      timestamp: "ISO date",
      sources: [...],
      contextUsed: {...}
    }
  ],
  context: {
    meetings: [{id, title, meeting_date}],
    tasks: [{id, title, external_id}],
    repositories: [{owner, name, full_name}]
  }
}
```

### Backend IPC Handlers

#### Intelligence Handlers (intelligence-handlers.js)
- `intelligence:ask` - Enhanced with context filtering
- Accepts `contextFilter` in options:
  ```javascript
  {
    meetingIds: ["id1", "id2"],
    taskIds: ["id1", "id2"],
    repositories: [{owner, name}]
  }
  ```
- Fetches filtered meetings and tasks from Supabase
- Queries Code Indexer for repository context
- Merges all context before sending to AI

#### GitHub Handlers (github-handlers.js)
- `github:listRepositories` - Lists all accessible repos
- `github:getRepository` - Get specific repo details

### Data Flow

1. **User selects context**
   - Frontend updates session context in localStorage
   - Context badges update in UI

2. **User sends message**
   - Message added to session
   - Context IDs extracted from session
   - IPC call to `intelligence:ask` with contextFilter

3. **Backend processes query**
   - Fetches filtered meetings from `meeting_summaries` table
   - Fetches filtered tasks from `team_updates` table
   - Queries Code Indexer for repository context
   - Passes all context to Team Context Engine

4. **AI generates response**
   - AI has access to filtered, relevant context
   - Response includes source citations
   - Frontend displays response with sources

## 📚 API Reference

### Frontend APIs

#### Session Management
```javascript
// Create new session
createNewSession()

// Delete session
deleteSession(sessionId)

// Rename session
renameSession(sessionId, newName)

// Update context
updateSessionContext(sessionId, context)
```

#### Context Loading
```javascript
// Load available meetings
loadAvailableContext() // Loads meetings, tasks, repos

// Toggle context items
toggleMeeting(meeting)
toggleTask(task)
toggleRepo(repo)
```

#### Messaging
```javascript
// Send message
handleSendMessage(message)

// Query code
handleQueryCode(query)
```

### Backend APIs

#### IPC Handlers
```javascript
// Intelligence
intelligence:ask(userId, question, options)
intelligence:clearHistory(sessionId?)
intelligence:getHistory(sessionId?)

// GitHub
github:listRepositories()
github:getRepository({owner, repo})

// Sync (existing)
sync:getUpdates({days: 30})

// Meeting (existing)
meeting:getSummaries({startDate, endDate})
```

## 🎯 Usage Examples

### Example 1: Ask about specific meeting
```javascript
// 1. Create new session
// 2. Open context picker
// 3. Select meeting "Sprint Planning Q4"
// 4. Ask: "What decisions were made in this meeting?"
// AI responds with context from that specific meeting
```

### Example 2: Code + JIRA context
```javascript
// 1. Create session
// 2. Select JIRA task "TASK-123"
// 3. Select repository "company/backend"
// 4. Ask: "How should I implement the feature in TASK-123?"
// AI responds with code context + task requirements
```

### Example 3: Multiple meetings comparison
```javascript
// 1. Create session
// 2. Select multiple meetings
// 3. Ask: "What are the common themes across these meetings?"
// AI analyzes all selected meetings
```

## 🔍 Key Files Modified

### New Files
- `/main/ipc/github-handlers.js` - GitHub IPC handlers
- `/renderer/src/pages/TeamChat.jsx` - Enhanced component
- `/renderer/src/pages/TeamChat.css` - Multi-session styling
- `MULTI_SESSION_CHAT_GUIDE.md` - This file

### Modified Files
- `/main/ipc/intelligence-handlers.js` - Added context filtering
- `/main/index.js` - Registered GitHub handlers
- `/bridge/preload.js` - Added GitHub APIs

## 🧪 Testing

### Manual Testing Steps

1. **Session Creation**
   - [ ] Click "New Session" button
   - [ ] Verify new session appears in sidebar
   - [ ] Verify session is selected automatically

2. **Context Selection**
   - [ ] Click "Context" button
   - [ ] Verify context panel opens
   - [ ] Select meetings, tasks, and repos
   - [ ] Verify context badges appear in header

3. **Chat Functionality**
   - [ ] Send a message
   - [ ] Verify AI responds
   - [ ] Verify sources are cited
   - [ ] Check context summary in response

4. **Multiple Sessions**
   - [ ] Create second session
   - [ ] Switch between sessions
   - [ ] Verify each session maintains its own:
     - Messages
     - Context selection
     - Name

5. **Persistence**
   - [ ] Create sessions and add context
   - [ ] Refresh the app
   - [ ] Verify sessions are restored
   - [ ] Verify context is restored

6. **Session Management**
   - [ ] Rename a session
   - [ ] Delete a session
   - [ ] Verify changes persist

## 💡 Tips for Users

1. **Start with Context**: Always select relevant context before asking questions for better AI responses

2. **Session Organization**: Create separate sessions for different topics:
   - "Sprint Retrospectives"
   - "Feature X Development"
   - "Bug Investigation"

3. **Code Questions**: Select specific repositories when asking code-related questions

4. **Meeting Analysis**: Select multiple related meetings to find patterns or themes

5. **Task Context**: Select JIRA tasks when asking about implementation details

## 🚀 Future Enhancements

Potential improvements:
- [ ] Export chat sessions
- [ ] Share sessions with team members
- [ ] Session templates
- [ ] Advanced filtering in context picker
- [ ] Search within messages
- [ ] Favorite/pin important sessions
- [ ] Session folders/categories
- [ ] Multi-repo code queries
- [ ] Voice input support
- [ ] Rich text formatting in messages

## 🐛 Troubleshooting

### Context not loading
- Check if services are connected (Settings page)
- Verify API tokens are valid
- Check browser console for errors

### Messages not persisting
- Check localStorage quota
- Clear browser cache if full
- Check console for storage errors

### Code queries not working
- Verify repositories are indexed
- Check Code Indexer status
- Ensure OPENAI_API_KEY is set

### AI responses are generic
- Ensure context is selected
- Verify context items are checked
- Try selecting more specific context

## 📞 Support

For issues or questions:
1. Check console logs (`Ctrl+Shift+I`)
2. Verify environment variables
3. Review IPC handler logs
4. Test with minimal context first

