# Desktop App Supabase Integration Setup

## ✅ What Was Done

I've integrated Supabase into your Desktop Electron app so that:
1. **Slack messages** are saved to Supabase
2. **Copilot conversations** are saved to Supabase  
3. **User activity** can be tracked

## 📋 Setup Steps

### Step 1: Install the Desktop Tables in Supabase

1. Go to your Supabase dashboard: https://app.supabase.com/project/ydbujcuddfgiubjjajuq/editor
2. Click on **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy the contents of `data/storage/desktop-tables.sql`
5. Paste into the SQL editor
6. Click **Run** (or press Ctrl/Cmd + Enter)

You should see: `Desktop tables created successfully! ✅`

### Step 2: Verify the Tables Were Created

1. In Supabase, click on **Table Editor** in the left sidebar
2. You should now see these NEW tables:
   - `slack_messages`
   - `copilot_conversations`
   - `user_activity`

### Step 3: Test the Integration

1. **Start the desktop app:**
   ```bash
   cd /home/sdalal/test/BeachBaby
   npx electron . --dev
   ```

2. **Test Slack integration:**
   - If Slack is connected, send a message mentioning `@hj2` in a channel
   - The message should be saved to `slack_messages` table in Supabase

3. **Test Copilot integration:**
   - Type a message in the copilot chat
   - Check the `copilot_conversations` table in Supabase
   - You should see both your message (role: 'user') and AI's response (role: 'assistant')

### Step 4: View Your Data

Go to **Table Editor** → Select `slack_messages` or `copilot_conversations` to see the data flowing in real-time!

## 🔍 What Changed in the Code

### Files Modified:
1. **`desktop/main/slack-service.js`**
   - Now uses `DesktopSupabaseAdapter` to save messages

2. **`desktop/main.js`**
   - Initializes `DesktopSupabaseAdapter`
   - Saves copilot conversations to Supabase

### Files Created:
1. **`desktop/main/supabase-adapter.js`**
   - Desktop-specific Supabase adapter
   - Handles all database operations for the desktop app

2. **`data/storage/desktop-tables.sql`**
   - SQL schema for desktop-specific tables

## 📊 How It Works

### Slack Messages:
When a Slack message is received, it's:
1. Added to in-memory array (for fast access)
2. **Saved to Supabase** asynchronously (doesn't block the UI)

### Copilot Conversations:
When you chat with the copilot, both messages are:
1. Added to in-memory conversation history
2. **Saved to Supabase** asynchronously with metadata

### Benefits:
- ✅ **Persistent storage** - data survives app restarts
- ✅ **Searchable** - query your history from Supabase
- ✅ **Non-blocking** - doesn't slow down the app
- ✅ **Analytics-ready** - can build dashboards from this data

## ⚠️ Important Notes

1. **User Authentication**: Currently using `'desktop-user'` as a placeholder. When you implement proper user auth, update the `userId` in `main.js` line 741.

2. **Service Role Key**: The desktop app uses `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS policies. This is appropriate for a desktop app, but be careful not to expose this key in any client-side code.

3. **Error Handling**: If Supabase save fails, it logs a warning but doesn't crash the app. Messages are still available in memory.

## 🧪 Testing Commands

```bash
# Check if tables exist
# In Supabase SQL editor, run:
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('slack_messages', 'copilot_conversations', 'user_activity');

# View recent slack messages
SELECT * FROM slack_messages ORDER BY timestamp DESC LIMIT 10;

# View recent copilot conversations
SELECT * FROM copilot_conversations ORDER BY timestamp DESC LIMIT 10;
```

## 🎉 You're All Set!

Run the app and start chatting - everything will be saved to Supabase automatically!

