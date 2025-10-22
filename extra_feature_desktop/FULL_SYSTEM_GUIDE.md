# Team Sync Intelligence - Full Working System Guide

## ✅ What's Been Implemented

This is now a **fully functional system** with:
- ✅ Real Supabase authentication (no mock data)
- ✅ User signup and login
- ✅ Session management
- ✅ Microsoft Outlook integration (when connected)
- ✅ JIRA integration (when connected)
- ✅ GitHub integration (optional)
- ✅ AI-powered meeting summaries
- ✅ Team intelligence Q&A
- ✅ All database tables created and working

## 🚀 Getting Started

### Step 1: Start the Application

```bash
cd /home/sdalal/test/BeachBaby/extra_feature_desktop
npm run dev
```

The app will open showing the **Login Screen**.

### Step 2: Create Your Account

1. **Enter your email and password**
2. **Click "Create Account"**
3. The system will:
   - Create a Supabase Auth account
   - Create your user profile in the database
   - Log you in automatically
   - Store your session locally

### Step 3: Connect Integrations

After logging in, you'll see the Dashboard. To make the system useful, you need to connect your integrations:

#### Connect Microsoft Outlook (for meetings)

1. Go to the **desktop2** app (the existing HeyJarvis app)
2. Navigate to Settings
3. Connect Microsoft Outlook via OAuth
4. This stores your Microsoft tokens in Supabase

Now when you restart Team Sync Intelligence:
- It will automatically load your Microsoft calendar
- You can fetch upcoming meetings
- You can mark meetings as important
- You can add notes and generate AI summaries

#### Connect JIRA (for task tracking)

1. Go to the **desktop2** app
2. Navigate to Settings  
3. Connect JIRA via OAuth
4. This stores your JIRA tokens in Supabase

Now in Team Sync Intelligence:
- Fetch your JIRA issues
- See task updates in the dashboard
- Link JIRA tickets to meetings

#### Connect GitHub (optional for code activity)

GitHub is configured via environment variables (not OAuth):
1. Add to `.env`:
   ```env
   GITHUB_APP_ID=your_app_id
   GITHUB_APP_INSTALLATION_ID=your_installation_id
   GITHUB_APP_PRIVATE_KEY_PATH=/path/to/key.pem
   ```
2. Restart the app

## 📖 Using the System

### Dashboard

**What You See:**
- Stats cards showing meeting count, JIRA updates, GitHub activity
- Recent meeting summaries
- Recent updates feed (JIRA + GitHub)

**Actions:**
- Click "Sync Now" to fetch latest data from all integrations

### Meetings Page

**Upcoming Meetings Tab:**
1. View all meetings from your Outlook calendar
2. Each meeting shows an AI importance score (0-100)
3. Click "Mark Important" for meetings you want to track
4. Click "Add Notes" to upload meeting transcripts or type notes
5. AI automatically generates:
   - Summary (2-3 sentence overview)
   - Key Decisions (bullet points)
   - Action Items (with owners)
   - Topics Discussed (tags)

**Summaries Tab:**
- View all meetings with AI-generated summaries
- Click any meeting to see full details
- See key decisions, action items, and topics

### Team Chat

**Ask questions about your team's work:**
- "What did we decide in the last sprint planning?"
- "What's the latest on the design system?"
- "Show me recent JIRA updates"
- "What PRs were merged this week?"

**How it works:**
1. Type your question
2. AI searches through meetings, JIRA, and GitHub
3. Builds context from relevant data (last 30 days)
4. Returns answer with source citations
5. Shows which data sources were used

### Settings

**Profile:**
- View your user info
- See your email

**Integrations:**
- Check connection status for Microsoft, JIRA, GitHub
- Note: OAuth flows are handled in the desktop2 app for now

**Meeting Detection:**
- Configure auto-detection settings
- Set minimum importance score threshold

**Sync Settings:**
- Enable/disable auto-sync
- Configure how many days of history to sync

## 🔒 How Authentication Works

### Initial Login/Signup
1. You create an account with email/password
2. Supabase Auth creates your account
3. A user profile is created in the `users` table
4. Session is stored locally with electron-store
5. Services are initialized with your user ID

### Session Persistence
- Your session is stored locally
- When you restart the app, it checks for existing session
- If valid, you're logged in automatically
- Services reconnect using your stored integration tokens

### Logout
- Clears Supabase session
- Deletes local session storage
- Returns to login screen

## 🔗 Integration Token Storage

Integration tokens are stored in Supabase `users.integration_settings`:

```json
{
  "microsoft": {
    "access_token": "...",
    "refresh_token": "...",
    "token_expiry": "..."
  },
  "jira": {
    "access_token": "...",
    "refresh_token": "...",
    "cloud_id": "...",
    "site_url": "..."
  }
}
```

When you log in to Team Sync Intelligence:
1. It fetches your user record from Supabase
2. Reads your integration tokens
3. Initializes Microsoft and JIRA services
4. Services auto-refresh tokens as needed

## 📊 Data Flow

### Meeting Intelligence
```
1. Fetch calendar events (Microsoft Graph API)
2. Calculate importance scores (AI algorithm)
3. User marks important meetings
4. User uploads notes or uses Copilot
5. AI generates summary (Claude API)
6. Store in team_meetings table
7. Display in UI with full details
```

### Task & Code Intelligence
```
1. Fetch JIRA issues (JIRA API)
2. Fetch GitHub PRs/commits (GitHub API)
3. Link commits to JIRA (regex matching)
4. Store in team_updates table
5. Display in dashboard feed
```

### Q&A Chat
```
1. User asks question
2. Search team_meetings for relevant meetings
3. Search team_updates for relevant tasks/code
4. Build context from top results
5. Send to Claude with context
6. Return answer with source citations
```

## 🎯 Real-World Usage Example

### Scenario: Catch up on what happened this week

1. **Login** to Team Sync Intelligence
2. **Dashboard** shows:
   - 12 meetings this week
   - 5 marked as important
   - 24 JIRA updates
   - 18 GitHub PRs merged

3. **Go to Meetings** → Summaries:
   - "Sprint Planning" - 3 key decisions, 8 action items
   - "Architecture Review" - Decision to use React Query
   - "Standup" - 5 blockers identified

4. **Go to Team Chat**:
   - Ask: "What's blocking the login feature?"
   - AI responds with context from standup notes + JIRA
   - Shows sources: "Sprint Planning (Oct 14)" + "JIRA-123"

5. **Result**: Caught up in 5 minutes instead of reading through Slack/emails for an hour

## 🛠️ Troubleshooting

### "Microsoft not connected" error
- You need to connect Microsoft in the desktop2 app first
- This stores your OAuth tokens in Supabase
- Then Team Sync Intelligence can access them

### "JIRA not connected" error
- Same as Microsoft - connect in desktop2 app first

### Can't see any meetings
- Make sure you've connected Microsoft Outlook
- Click "Sync Now" in Dashboard
- Check that you have meetings in your calendar

### AI summary not generating
- Make sure `ANTHROPIC_API_KEY` is set in `.env`
- Check that you've uploaded notes for the meeting
- Look at logs for detailed error messages

### Login fails
- Verify Supabase URL and keys in `.env`
- Check that database tables are created
- Try creating a new account

## 🔐 Security Notes

- **Passwords**: Handled by Supabase Auth (hashed, secure)
- **Sessions**: Stored locally, cleared on logout
- **Tokens**: Encrypted at rest in Supabase
- **API Keys**: Stored in `.env`, never committed to git
- **RLS**: Row-level security ensures users only see their data

## 📈 Next Steps

Once you're comfortable with the system:

1. **Connect all your integrations** in desktop2
2. **Import past meetings** by marking them and adding notes
3. **Start asking questions** in Team Chat
4. **Share with your team** - everyone gets their own account
5. **Configure sync settings** for your workflow

## 🎓 Tips for Best Results

### For Meeting Summaries
- Upload detailed notes (the more context, the better)
- Mark meetings consistently
- Review and edit AI summaries as needed

### For Team Chat
- Ask specific questions
- Mention time ranges ("last week", "this sprint")
- Reference specific topics or projects
- Check source citations to verify information

### For Dashboard
- Sync regularly (or enable auto-sync)
- Review stats to identify trends
- Use filters to focus on what matters

---

**You now have a fully working system!** 🎉

No mock data, no placeholders - everything is real and connected to your actual tools and data.



