# 🎯 Session-Based Conversations - Upgrade Guide

## What Changed?

Your copilot conversations are now organized into **sessions** (conversation buckets)! Instead of storing individual messages separately, they're now grouped together by conversation session.

## 📊 New Structure

### Before (Individual Messages):
```
copilot_conversations
├── message 1 (user: "Hi")
├── message 2 (assistant: "Hello!")
├── message 3 (user: "How are you?")
└── message 4 (assistant: "I'm good!")
```

### After (Session-Based):
```
conversation_sessions
└── Session 1: "Hi, how are you?"
    ├── message 1 (user: "Hi")
    ├── message 2 (assistant: "Hello!")
    ├── message 3 (user: "How are you?")
    └── message 4 (assistant: "I'm good!")
```

## 🚀 How to Upgrade

### Step 1: Run the New SQL Schema

1. Go to Supabase SQL Editor: https://app.supabase.com/project/ydbujcuddfgiubjjajuq/editor
2. Copy the contents of `data/storage/desktop-tables-sessions.sql`
3. Paste and **Run** in SQL Editor

**Important:** This will:
- Drop the old `copilot_conversations` table
- Create new `conversation_sessions` and `conversation_messages` tables
- Keep your `slack_messages` table intact

### Step 2: Restart the Desktop App

```bash
cd /home/sdalal/test/BeachBaby
pkill -f electron
npx electron . --dev
```

### Step 3: Test It!

1. Open the copilot chat
2. Send a message
3. Check Supabase:
   - Go to **Table Editor**
   - Open `conversation_sessions` - you'll see a new session created
   - Open `conversation_messages` - you'll see messages linked to that session

## 🎨 Benefits

### 1. **Better Organization**
All messages in a conversation are grouped together with a shared session ID.

### 2. **Session Metadata**
Each session stores:
- `session_title` - Auto-generated from first message
- `started_at` - When conversation started
- `last_activity_at` - Last message time
- `message_count` - Number of messages
- `is_active` - Whether conversation is ongoing

### 3. **Easy Retrieval**
```sql
-- Get all sessions for a user
SELECT * FROM conversation_sessions WHERE user_id = 'desktop-user';

-- Get all messages in a session
SELECT * FROM conversation_messages WHERE session_id = 'abc-123-def';
```

### 4. **Smart Session Management**
- Active sessions last 24 hours
- New message in 24 hours = continues same session
- After 24 hours = creates new session
- Clear history = closes current session

## 📝 New Tables

### `conversation_sessions`
- `id` - Session UUID
- `user_id` - User identifier
- `session_title` - Auto-generated title
- `started_at` - Session start time
- `last_activity_at` - Last message time
- `message_count` - Total messages (auto-updated)
- `metadata` - JSON with context
- `is_active` - Boolean flag

### `conversation_messages`
- `id` - Message UUID
- `session_id` - Links to session
- `message_text` - Message content
- `role` - 'user' or 'assistant'
- `metadata` - JSON with model, tokens, etc.
- `timestamp` - Message timestamp

## 🔄 How It Works

1. **First message** → Creates new session with auto-generated title
2. **Subsequent messages** → Added to same session (if within 24 hours)
3. **Clear history** → Closes current session, next message creates new one
4. **Auto-updates** → Session's `last_activity_at` and `message_count` update automatically

## 📸 What You'll See in Supabase

### conversation_sessions Table:
```
id: abc-123-def
user_id: desktop-user
session_title: "Hey Hows it going?"
started_at: 2025-10-02 04:05:00
last_activity_at: 2025-10-02 04:06:30
message_count: 4
is_active: true
```

### conversation_messages Table:
```
id: msg-1     session_id: abc-123-def     role: user       message_text: "Hey Hows it going?"
id: msg-2     session_id: abc-123-def     role: assistant  message_text: "Hi there! I'm doing well..."
id: msg-3     session_id: abc-123-def     role: user       message_text: "What can you help with?"
id: msg-4     session_id: abc-123-def     role: assistant  message_text: "I can help with..."
```

All messages with the same `session_id` belong to the same conversation! 🎉

## 🛠️ Developer Notes

- The `update_session_activity()` trigger automatically updates `message_count` and `last_activity_at`
- Sessions older than 24 hours without activity are not reused
- Calling "Clear History" in the UI closes the current session
- Session title is auto-generated from first user message (max 50 chars)

Enjoy your organized conversations! 💬✨

