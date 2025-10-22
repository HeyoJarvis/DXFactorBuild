# Team Sync Intelligence - Complete Testing Guide

## 🎯 Overview

This guide will walk you through testing the Team Sync Intelligence system step-by-step.

## ✅ Prerequisites

1. **Supabase Setup**
   - Tables created via migration: `extra_feature_desktop/migrations/001_team_sync_tables.sql`
   - Email authentication enabled in Supabase (Authentication -> Providers -> Email)
   - Email confirmations disabled (Authentication -> Settings -> Email Auth)

2. **Environment Variables** (`.env` file)
   ```bash
   # Supabase
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   
   # Anthropic (for AI features)
   ANTHROPIC_API_KEY=your_claude_api_key
   
   # Microsoft OAuth
   MICROSOFT_CLIENT_ID=your_microsoft_client_id
   MICROSOFT_CLIENT_SECRET=your_microsoft_client_secret
   
   # JIRA OAuth
   JIRA_CLIENT_ID=your_jira_client_id
   JIRA_CLIENT_SECRET=your_jira_client_secret
   
   # GitHub OAuth (Optional)
   GITHUB_CLIENT_ID=your_github_client_id
   GITHUB_CLIENT_SECRET=your_github_client_secret
   # OR use Personal Access Token
   GITHUB_TOKEN=your_github_token
   ```

3. **Dependencies Installed**
   ```bash
   cd extra_feature_desktop
   npm install
   ```

## 🚀 Starting the Application

```bash
cd extra_feature_desktop
npm run dev
```

This starts both the Vite dev server (renderer) and Electron main process.

## 📋 Test Plan

### Test 1: Authentication

#### 1.1 Sign Up
1. Click "Create Account" on the login screen
2. Enter email: `test@example.com`
3. Enter password: `Test123456!`
4. Click "Create Account"
5. **Expected Result**: 
   - If email confirmations are disabled: Logged in successfully
   - If enabled: Message asking to check email

#### 1.2 Log In
1. Enter email and password
2. Click "Log In"
3. **Expected Result**: Dashboard loads, user avatar shows in sidebar

#### 1.3 Session Persistence
1. Close the app
2. Reopen the app
3. **Expected Result**: Still logged in, no need to re-authenticate

---

### Test 2: Microsoft OAuth Integration

#### 2.1 Connect Microsoft
1. Go to Settings page (click ⚙️ in sidebar)
2. Find "Microsoft Outlook" integration
3. Click "Connect"
4. **Expected Result**:
   - Browser opens with Microsoft login page
   - URL is on localhost:8891
5. Complete Microsoft authentication in browser
6. **Expected Result**:
   - Success page shows: "Microsoft Connected!"
   - Return to app
   - Microsoft shows "✓ Connected" in Settings

#### 2.2 Verify Token Storage
1. Go to Supabase Dashboard
2. Navigate to Table Editor -> `team_sync_integrations`
3. Find your user's row where `service_name = 'microsoft'`
4. **Expected Result**: 
   - `access_token` is populated
   - `refresh_token` is populated
   - `connected_at` has a timestamp

#### 2.3 Disconnect Microsoft
1. In Settings, click "Disconnect" on Microsoft
2. **Expected Result**: 
   - Success message appears
   - Status changes to "✗ Not connected"
   - Row deleted from `team_sync_integrations`

---

### Test 3: JIRA OAuth Integration

#### 3.1 Connect JIRA
1. In Settings, find "JIRA" integration
2. Click "Connect"
3. **Expected Result**: Browser opens to Atlassian login (localhost:8892)
4. Log in to your JIRA account
5. Grant permissions
6. **Expected Result**: 
   - Success page: "JIRA Connected!"
   - Return to app
   - JIRA shows "✓ Connected"

#### 3.2 Verify JIRA Data
1. Check Supabase `team_sync_integrations` table
2. **Expected Result**:
   - Row with `service_name = 'jira'`
   - `cloud_id` and `site_url` populated
   - Tokens stored

---

### Test 4: GitHub Integration

#### 4.1 Connect GitHub (if configured)
1. In Settings, find "GitHub"
2. Click "Connect"
3. **Expected Behaviors**:
   - **If OAuth configured**: Browser opens to GitHub (localhost:8893)
   - **If PAT configured**: Uses token automatically
   - **If not configured**: Error message with instructions
4. Complete authentication
5. **Expected Result**: GitHub shows "✓ Connected"

---

### Test 5: Meeting Intelligence

#### 5.1 Fetch Calendar Events
1. Ensure Microsoft is connected
2. Go to Meetings page
3. **Expected Result**:
   - List of upcoming meetings from Outlook calendar
   - Each meeting shows:
     - Title
     - Date and time
     - Importance score (color-coded)
     - Attendees count

#### 5.2 Meeting Importance Scoring
1. Check meetings with keywords like "standup", "sprint", "planning"
2. **Expected Result**: These meetings have higher importance scores (70+)

#### 5.3 Manual Notes Upload
1. Click on a meeting
2. Find "Upload Notes" option
3. Paste meeting notes
4. Click "Generate Summary"
5. **Expected Result**:
   - AI summary appears
   - Key decisions extracted
   - Action items listed
   - Topics identified

---

### Test 6: Task & Code Intelligence

#### 6.1 Fetch JIRA Updates
1. Ensure JIRA is connected
2. Go to Dashboard
3. Look for "Recent JIRA Updates" section
4. **Expected Result**:
   - List of recently updated JIRA issues
   - Shows issue key, status, assignee
   - Last 7 days of updates

#### 6.2 Fetch GitHub Activity
1. Ensure GitHub is connected
2. Go to Dashboard
3. Look for "Recent GitHub Activity" section
4. **Expected Result**:
   - Recent PRs with status (open/merged)
   - Recent commits
   - JIRA keys extracted from commit messages

#### 6.3 JIRA-GitHub Linking
1. Find a commit or PR that mentions a JIRA key (e.g., "PROJ-123: Fix bug")
2. **Expected Result**: The update shows "Related to: PROJ-123"

---

### Test 7: Team Chat (AI Q&A)

#### 7.1 Ask a Question
1. Go to Team Chat page
2. Type a question: "What did we decide in recent meetings?"
3. Click Send
4. **Expected Result**:
   - Loading indicator appears
   - AI generates response
   - Response cites specific meetings, JIRA issues, or PRs
   - Source links are clickable

#### 7.2 Follow-up Question
1. Ask a follow-up: "What about the backend work?"
2. **Expected Result**: 
   - AI remembers conversation context
   - Provides relevant answer
   - Cites appropriate sources

#### 7.3 Conversation History
1. Scroll up in chat
2. **Expected Result**: Previous messages are visible
3. Refresh the page
4. **Expected Result**: History persists (stored per user)

---

## 🔍 Advanced Testing

### Token Refresh
1. Wait for access token to expire (or modify `token_expiry` in database to past date)
2. Perform an action that requires the service (e.g., fetch meetings)
3. **Expected Result**: Token automatically refreshes, action succeeds

### Error Handling
1. Disconnect from a service
2. Try to fetch data from that service (e.g., go to Meetings without Microsoft)
3. **Expected Result**: Friendly error message, not a crash

### Multiple Users
1. Log out
2. Create a new account
3. Connect integrations
4. **Expected Result**: Each user has separate data, no conflicts

---

## 🐛 Debugging

### Check Logs
```bash
# Main process logs
extra_feature_desktop/logs/main.log

# Individual service logs
extra_feature_desktop/logs/meeting-intelligence.log
extra_feature_desktop/logs/task-code-intelligence.log
extra_feature_desktop/logs/team-context-engine.log
```

### Electron DevTools
- Main window auto-opens DevTools in development mode
- Check Console tab for frontend errors
- Check Network tab for API calls

### Database Inspection
1. Go to Supabase Dashboard
2. Check Tables:
   - `team_sync_integrations` - OAuth tokens
   - `team_meetings` - Meeting data and summaries
   - `team_updates` - JIRA and GitHub updates
   - `team_context_index` - For future semantic search

---

## ✅ Success Criteria

All tests pass if:
- ✅ Users can sign up and log in
- ✅ Microsoft OAuth completes successfully
- ✅ JIRA OAuth completes successfully
- ✅ GitHub integration works (OAuth or PAT)
- ✅ Calendar events are fetched and displayed
- ✅ JIRA issues are fetched and displayed
- ✅ GitHub PRs/commits are fetched
- ✅ AI summaries generate from meeting notes
- ✅ Team Chat answers questions with proper citations
- ✅ Tokens refresh automatically
- ✅ Disconnect functionality works
- ✅ No conflicts with Desktop2

---

## 🔒 Desktop2 Safety Verification

1. Keep Desktop2 running while testing Team Sync
2. Check that Desktop2's integrations still work
3. Verify separate database tables:
   ```sql
   -- Team Sync tables (NEW)
   SELECT * FROM team_sync_integrations;
   SELECT * FROM team_meetings;
   SELECT * FROM team_updates;
   
   -- Desktop2 tables (EXISTING - should be unaffected)
   SELECT * FROM microsoft_tokens;  -- If exists
   SELECT * FROM tasks;  -- If exists
   ```
4. Verify separate OAuth ports:
   - Team Sync: 8891 (Microsoft), 8892 (JIRA), 8893 (GitHub)
   - Desktop2: Uses different ports

**Expected Result**: Both apps run independently without conflicts.

---

## 📞 Need Help?

If you encounter issues:
1. Check the logs (see Debugging section)
2. Verify environment variables are set correctly
3. Check Supabase tables for data
4. Ensure all migrations ran successfully
5. Try disconnecting and reconnecting integrations

Common issues:
- **"Email logins are disabled"**: Enable email auth in Supabase
- **"OAuth not configured"**: Check environment variables
- **"Token expired"**: Should auto-refresh, but may need reconnect
- **"Microsoft not connected"**: Check OAuth flow completed successfully


