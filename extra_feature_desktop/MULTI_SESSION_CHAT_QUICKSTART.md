# Multi-Session Chat Quick Start Guide

## 🚀 Get Started in 3 Steps

### Step 1: Create Your First Session
1. Navigate to the **Team Chat** tab
2. Click the **"➕ New Session"** button
3. Give your session a meaningful name (click to edit)

### Step 2: Pick Your Context
1. Click the **"📎 Context"** button to open the context picker
2. Select relevant items:
   - **📅 Meetings**: Check meetings you want to reference
   - **🎯 JIRA Tasks**: Check tasks related to your question
   - **💻 Repositories**: Check code repositories to query

### Step 3: Start Chatting!
1. Type your question in the message box
2. Press Enter or click Send
3. AI responds with context-aware answers
4. View sources below each AI response

## 💡 Example Use Cases

### Use Case 1: Sprint Retrospective Analysis
```
1. Create session: "Sprint Retrospectives"
2. Select context:
   ✓ Sprint Planning Meeting
   ✓ Sprint Review Meeting
   ✓ Sprint Retro Meeting
3. Ask: "What were the main action items from our last sprint?"
```

### Use Case 2: Feature Implementation
```
1. Create session: "User Authentication Feature"
2. Select context:
   ✓ JIRA: AUTH-123 (Implement OAuth)
   ✓ Repository: company/auth-service
3. Ask: "How should I structure the OAuth implementation based on the task requirements?"
```

### Use Case 3: Bug Investigation
```
1. Create session: "Production Bug #456"
2. Select context:
   ✓ JIRA: BUG-456
   ✓ Repository: company/api-server
   ✓ Recent incident meeting
3. Ask: "What changes were made that might have caused this bug?"
```

## 🎯 Pro Tips

### Tip 1: Organize Sessions by Topic
Create separate sessions for different workstreams:
- 🏃 "Sprint Planning"
- 🐛 "Bug Fixes"
- ✨ "New Features"
- 📊 "Weekly Reviews"

### Tip 2: Be Specific with Context
Instead of selecting all meetings, choose only relevant ones for better AI responses.

### Tip 3: Use Multiple Sessions
Keep different conversations separate:
- Session 1: Discussing Feature A
- Session 2: Investigating Bug B
- Session 3: Planning Sprint C

### Tip 4: Leverage Code Context
When asking code-related questions, always select the relevant repository for accurate, context-aware answers.

### Tip 5: Review Sources
Check the source citations below AI responses to verify information and dig deeper.

## 🔄 Workflow Examples

### Daily Standup Prep
1. Create "Daily Standup - [Date]"
2. Select yesterday's meetings
3. Select current sprint tasks
4. Ask: "Summarize what I worked on yesterday and my focus for today"

### Code Review Prep
1. Create "Code Review - [PR#]"
2. Select related JIRA tasks
3. Select repository
4. Ask: "What are the key changes and potential issues in this PR?"

### Meeting Prep
1. Create "Meeting Prep - [Topic]"
2. Select previous related meetings
3. Select relevant tasks
4. Ask: "What discussion points should I prepare for the upcoming meeting?"

## ⚙️ Session Management

### Creating Sessions
- Click **"➕ New Session"** anytime
- Sessions auto-save to localStorage
- No limit on number of sessions

### Switching Sessions
- Click any session in the sidebar
- Active session is highlighted in purple
- Each session maintains its own context

### Renaming Sessions
- Click on the session name at the top
- Type new name
- Press Enter or click outside to save

### Deleting Sessions
- Hover over session in sidebar
- Click the **🗑️** icon
- Confirm deletion

### Managing Context
- Toggle context picker with **"📎 Context"**
- Check/uncheck items to modify context
- Changes apply immediately
- Context badges show selection count

## 📊 Understanding Responses

### Message Structure
```
[User Icon] Your question

[AI Icon] AI Response
  ↓
[Sources Section]
  📅 Meeting: Sprint Planning
  🎯 JIRA: TASK-123
  💻 Code: src/auth/login.js
  ↓
[Context Summary]
  📊 Context: 2 meetings, 1 JIRA items, 0 GitHub updates
```

### Source Icons
- 📅 = Meeting context
- 🎯 = JIRA task context
- 💻 = GitHub commit context
- 🔀 = GitHub PR context
- 📝 = Code file context

### Context Summary
Shows how many items of each type were used to generate the response.

## ❓ Common Questions

### Q: Can I edit messages after sending?
A: Not yet - this feature is planned for future releases.

### Q: How do I export a conversation?
A: Currently not supported - coming soon!

### Q: How many sessions can I create?
A: Unlimited! But localStorage has limits (~5-10MB typically).

### Q: Do sessions sync across devices?
A: Not yet - sessions are stored locally in browser.

### Q: Can I share sessions with teammates?
A: Not yet - this is a planned feature.

## 🐛 Troubleshooting

### Problem: Context picker is empty
**Solution**: 
- Ensure services are connected in Settings
- Verify you have meetings/tasks/repos to select
- Check console for API errors

### Problem: AI gives generic responses
**Solution**:
- Select more specific context
- Ensure context items are checked (✓)
- Try rephrasing your question

### Problem: Sessions not persisting
**Solution**:
- Check localStorage quota in browser
- Clear other site data if needed
- Check browser console for errors

### Problem: Code queries fail
**Solution**:
- Ensure repository is indexed (Code Indexer tab)
- Verify GitHub connection (Settings)
- Check that OPENAI_API_KEY is set

## 📚 Next Steps

1. ✅ Complete this quick start
2. 📖 Read the full [MULTI_SESSION_CHAT_GUIDE.md](./MULTI_SESSION_CHAT_GUIDE.md)
3. 🧪 Test the system with real questions
4. 💬 Create sessions for your current work
5. 🎯 Experiment with different context combinations

## 🎉 Happy Chatting!

You're now ready to use the multi-session context-aware chat system. Start by creating your first session and exploring the context picker!

