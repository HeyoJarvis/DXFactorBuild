# 🚀 Quick Start - Team Sync Desktop

## Prerequisites ✅

All environment variables are already configured in your root `.env`

## Step 1: Run Database Migration

**Choose one:**

### Option A: Minimal (Recommended - No Memory Issues)
```bash
# 1. Go to: https://app.supabase.com/project/ydbujcuddfgiubjjajuq/sql/new
# 2. Copy ALL contents from: migrations/002_code_vector_store_minimal.sql
# 3. Paste and click "Run"
```

### Option B: Clean Start (If you have existing tables)
```bash
# First clean up:
# Run: migrations/CLEANUP_code_vector_store.sql

# Then create fresh:
# Run: migrations/002_code_vector_store_minimal.sql
```

## Step 2: Test the Setup

```bash
cd /home/sdalal/test/BeachBaby/extra_feature_desktop
node test-code-indexer.js
```

You should see:
```
✅ All environment variables configured!
✅ Code Indexer initialized successfully!
✅ Connected to GitHub! Found X repositories
✅ Connected to Supabase!
✅ Connected to OpenAI!
✅ Connected to Anthropic!
🎉 All Tests Passed!
```

## Step 3: Start the App

```bash
npm run dev
```

## Step 4: Use the UI

### 💬 Team Chat (Multi-Session Context-Aware AI)
1. **Login** to the app
2. Click **💬 Team Chat** in left sidebar
3. Click **➕ New Session** to create your first chat
4. Click **📎 Context** to open the context picker
5. Select context:
   - **📅 Meetings**: Check relevant meetings
   - **🎯 JIRA Tasks**: Check related tasks
   - **💻 Repositories**: Check code repos to query
6. Ask questions like: "What were the action items from yesterday's meeting?"
7. Get context-aware AI responses with source citations! 🎉

**Quick Tips:**
- Create separate sessions for different topics
- Select specific context for better AI responses
- Switch between sessions in the sidebar
- Sessions auto-save and persist

📖 **Detailed Guide**: [MULTI_SESSION_CHAT_QUICKSTART.md](./MULTI_SESSION_CHAT_QUICKSTART.md)

### 📋 JIRA Tasks (View & Manage)
1. Click **📋 JIRA Tasks** in left sidebar
2. Click **Connect JIRA** if not connected
3. View all your JIRA tasks and cards
4. Filter by status (Open, In Progress, Done)
5. Search for specific tasks
6. Click any task to see full details
7. Click **Sync Now** to refresh from JIRA

### 🔍 Code Indexer (Query Code)
1. Click **🔍 Code Indexer** in left sidebar
2. Go to **📚 Repositories** tab
3. Click **📥 Index** on any repository
4. Wait for indexing to complete (1-30 minutes)
5. Go to **💬 Query Code** tab
6. Select the indexed repository
7. Ask a question like: "How does authentication work?"
8. Get instant AI-powered answers! 🎉

## Common Commands

```bash
# Start app in development mode
npm run dev

# Build for production
npm run build

# Run tests
node test-code-indexer.js

# Check logs
tail -f logs/main.log
```

## Troubleshooting

### "Migration error"
→ Use `002_code_vector_store_minimal.sql` (no memory issues)

### "Code Indexer not available"
→ Run `node test-code-indexer.js` to diagnose

### "No repositories found"
→ Check GitHub App has repo access

### UI not loading
→ Check console: `npm run dev` output
→ Check DevTools console in browser

## Quick Tips

- ✅ Index small repos first (faster testing)
- ✅ Check status before querying
- ✅ Use specific questions for better answers
- ✅ Index takes time - be patient!

## Documentation

### Team Chat
- **Quick Start**: `MULTI_SESSION_CHAT_QUICKSTART.md`
- **Full Guide**: `MULTI_SESSION_CHAT_GUIDE.md`

### Code Indexer
- **Setup Guide**: `CODE_INDEXER_SETUP.md`
- **API Reference**: `CODE_INDEXER_API_REFERENCE.md`

### JIRA Tasks
- **User Guide**: `JIRA_TASKS_GUIDE.md`
- **Implementation**: `JIRA_TASKS_IMPLEMENTATION.md`

---

**Ready to go!** 🚀

