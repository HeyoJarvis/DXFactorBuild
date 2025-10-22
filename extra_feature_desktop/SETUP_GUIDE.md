# Team Sync Intelligence - Quick Setup Guide

This guide will help you get Team Sync Intelligence up and running in 10 minutes.

## Step 1: Database Setup (5 minutes)

1. **Open Supabase Dashboard**
   - Go to https://app.supabase.com
   - Select your project

2. **Run Migration**
   - Click on "SQL Editor" in the sidebar
   - Click "New Query"
   - Copy the entire contents of `migrations/001_team_sync_tables.sql`
   - Paste and click "Run"
   - You should see "Success" message

3. **Verify Tables**
   - Click on "Table Editor"
   - You should see three new tables:
     - `team_meetings`
     - `team_updates`
     - `team_context_index`

## Step 2: Environment Variables (2 minutes)

The app uses the shared `.env` file in the project root (`/home/sdalal/test/BeachBaby/.env`).

**Required variables** (should already be set):
```env
ANTHROPIC_API_KEY=your_key_here
SUPABASE_URL=your_url_here
SUPABASE_SERVICE_ROLE_KEY=your_key_here
```

**Optional integrations** (set only if you want to use them):
```env
# Microsoft Outlook (for calendar/meetings)
MICROSOFT_CLIENT_ID=...
MICROSOFT_CLIENT_SECRET=...

# JIRA (for task tracking)
JIRA_CLIENT_ID=...
JIRA_CLIENT_SECRET=...

# GitHub (for code activity) - OPTIONAL
GITHUB_APP_ID=...
GITHUB_APP_INSTALLATION_ID=...
GITHUB_APP_PRIVATE_KEY_PATH=/path/to/key.pem
```

**Note**: The app will work without GitHub configured. GitHub integration is optional.

## Step 3: Install Dependencies (1 minute)

```bash
cd /home/sdalal/test/BeachBaby/extra_feature_desktop
npm install
```

## Step 4: Run the App (1 minute)

```bash
npm run dev
```

This will:
1. Start Vite dev server on port 5174
2. Open Electron window automatically
3. Connect to Supabase database

## Step 5: Connect Integrations (1 minute)

1. In the app, go to **Settings** page
2. Click **Connect** for each integration you want to use:
   - **Microsoft Outlook**: For calendar and meetings
   - **JIRA**: For task tracking
   - **GitHub**: For code activity

## Quick Test

### Test Meetings
1. Go to **Meetings** page
2. Click "Upcoming" tab
3. You should see meetings from your calendar
4. Try marking one as "Important"
5. Click "Add Notes" and paste some text
6. Click "Save & Generate Summary"
7. Go to "Summaries" tab to view the AI-generated summary

### Test Team Chat
1. Go to **Team Chat** page
2. Try a suggested question like "What's the latest on the design system?"
3. The AI will search through your data and provide an answer

### Test Dashboard
1. Go to **Dashboard** page
2. Click "Sync Now" to fetch latest data
3. View stats cards and recent activity

## Troubleshooting

### "ANTHROPIC_API_KEY not configured"
- Check that `ANTHROPIC_API_KEY` is set in `/home/sdalal/test/BeachBaby/.env`
- Restart the app after updating `.env`

### "Microsoft not connected"
- Make sure you've set `MICROSOFT_CLIENT_ID` and `MICROSOFT_CLIENT_SECRET`
- Click "Connect" in Settings page
- Complete OAuth flow in browser

### "Database connection failed"
- Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env`
- Check that migrations were run successfully
- Ensure Supabase project is active

### App won't start
```bash
# Clear cache and reinstall
rm -rf node_modules
npm install
npm run dev
```

### Port 5174 already in use
```bash
# Kill process on port 5174
lsof -ti:5174 | xargs kill -9
npm run dev
```

## Next Steps

Once setup is complete:

1. **Review README.md** for detailed usage guide
2. **Configure settings** in Settings page
3. **Sync your data** using "Sync Now" button
4. **Start asking questions** in Team Chat

## Getting Help

If you encounter issues:
1. Check logs in `extra_feature_desktop/logs/`
2. Review database in Supabase dashboard
3. Verify environment variables
4. Check browser console (Ctrl+Shift+I in Electron)

## Success Indicators

You'll know setup is successful when:
- ✅ App window opens without errors
- ✅ Dashboard loads with stats cards
- ✅ Settings page shows integration status
- ✅ You can fetch upcoming meetings
- ✅ AI chat responds to questions

**Estimated Total Setup Time: 10 minutes**

Enjoy using Team Sync Intelligence! 🚀

