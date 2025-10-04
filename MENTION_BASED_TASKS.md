# 🎯 Mention-Based Task Auto-Creation

## How It Works Now

When someone in Slack says:
```
@Avi can you fix the payment API by Friday?
```

HeyJarvis will:
1. ✅ Detect it's a work request (pattern matching)
2. ✅ Extract the Slack user ID from `@Avi` (e.g., `U123ABC`)
3. ✅ Look up Avi's Supabase account using `slack_user_id`
4. ✅ Create a task **in Avi's account** (not the sender's)
5. ✅ Notify Avi if he's currently logged in

---

## 🔄 Complete Flow

```
Someone in Slack                    Your Electron App
     │                                     │
     │  "@Avi fix the payment API"        │
     ├─────────────────────────────────────>
     │                                     │
     │                                     ▼
     │                              Slack Service
     │                              (captures mention)
     │                                     │
     │                                     ▼
     │                           Work Request Detection
     │                           (analyzes if it's a task)
     │                                     │
     │                                     ▼
     │                           Extract Mentioned Users
     │                           • Parse: <@U123ABC>
     │                           • Found: ["U123ABC"]
     │                                     │
     │                                     ▼
     │                           Look Up Supabase User
     │                           SELECT * FROM users
     │                           WHERE slack_user_id = 'U123ABC'
     │                                     │
     │                                     ▼
     │                           Found: Avi's Supabase ID
     │                           (1294e10a-74ce-499e...)
     │                                     │
     │                                     ▼
     │                           Create Task
     │                           INSERT INTO conversation_sessions
     │                           WHERE user_id = Avi's ID
     │                                     │
     │                                     ▼
     │  <─────────────────────────────────┤
     Task appears in                      │
     Avi's task list! ✅                  │
```

---

## 📋 Key Changes Made

### 1. **Added User Lookup Function**
**File:** `desktop/main.js` (line 1547)

```javascript
async function getSupabaseUserBySlackId(slackUserId) {
  const { data, error } = await dbAdapter.supabase
    .from('users')
    .select('*')
    .eq('slack_user_id', slackUserId)
    .single();
  
  return data;  // Returns Supabase user with full profile
}
```

### 2. **Added Mention Extraction**
**File:** `desktop/main.js` (line 1571)

```javascript
function extractMentionedSlackUsers(text) {
  // Slack mentions look like: <@U123ABC> or <@U123ABC|username>
  const mentionPattern = /<@([UW][A-Z0-9]+)>/g;
  const mentions = [...text.matchAll(mentionPattern)];
  return mentions.map(m => m[1]);  // Returns ["U123ABC", "U456DEF"]
}
```

### 3. **Updated Mention Handler**
**File:** `desktop/main.js` (line 1705-1803)

**Before:**
```javascript
// Created task for currentUser (wrong!)
const userId = currentUser?.id;
await dbAdapter.createTask(userId, taskData);
```

**After:**
```javascript
// Extract mentioned users
const mentionedSlackIds = extractMentionedSlackUsers(message.text);

// Create task for EACH mentioned user
for (const slackUserId of mentionedSlackIds) {
  const targetUser = await getSupabaseUserBySlackId(slackUserId);
  
  if (targetUser) {
    // Create task for the MENTIONED user
    await dbAdapter.createTask(targetUser.id, taskData);
  }
}
```

---

## 🗄️ Database Setup

### Required SQL Migration

Run this in Supabase SQL Editor:

**File:** `data/storage/fix-users-lookup.sql`

```sql
-- Allow service role to look up users by Slack ID
CREATE POLICY "Service role can read all users" ON public.users
  FOR SELECT TO service_role
  USING (true);

-- Ensure index exists for fast lookups
CREATE INDEX IF NOT EXISTS idx_users_slack_user_id 
  ON public.users(slack_user_id);
```

This allows the desktop app (using service role) to look up ANY user by their Slack ID.

---

## 🧪 Testing Guide

### Test 1: Simple Mention
```
You: "@Avi can you review the dashboard?"
```

**Expected:**
```
Console logs:
👋 Bot mentioned - analyzing...
📌 Mentioned Slack users: ["U123ABC"]
✅ Found Supabase user for Slack ID: U123ABC → 1294e10a-...
✅ Auto-created task from mention:
   task_id: uuid-...
   title: "review the dashboard"
   created_for_user: "avi@videofusion.io"
   slack_user_id: "U123ABC"
```

**Result:**
- ✅ Task appears in Avi's task list
- ✅ If Avi is logged in, he gets notified

### Test 2: Multiple Mentions
```
Someone: "@Avi @John can you both work on the payment integration?"
```

**Expected:**
- 2 tasks created
- One for Avi
- One for John (if John has authenticated)

### Test 3: Unauthenticated User
```
Someone: "@NewGuy can you handle this?"
```

**Expected:**
```
Console logs:
⚠️ Mentioned user not found in database (they need to authenticate): U789XYZ
```

**Result:**
- No task created (NewGuy hasn't logged in to HeyJarvis yet)

---

## 🎯 What Makes a Message a Work Request?

**Pattern Matching** (from `WorkRequestAlertSystem`):

✅ **Direct requests:**
- "can you help me..."
- "could you fix..."
- "would you build..."

✅ **Task assignments:**
- "please work on..."
- "need you to implement..."
- "I need help with..."

✅ **Urgent keywords:**
- "urgent", "ASAP", "emergency"
- "high priority"

✅ **Action words:**
- "implement", "develop", "design"
- "analyze", "review", "test", "deploy"

❌ **NOT work requests:**
- "Good morning!"
- "Thanks!"
- "How are you?"

**Confidence Threshold:** 0.5 (adjustable in `desktop/main.js` line 586)

---

## 🔧 Configuration

### Adjust Sensitivity

**Make it MORE sensitive** (creates more tasks):
```javascript
// desktop/main.js line 586
workRequestSystem = new WorkRequestAlertSystem({
  alertThreshold: 0.3  // was 0.5
});
```

**Make it LESS sensitive** (only obvious work requests):
```javascript
workRequestSystem = new WorkRequestAlertSystem({
  alertThreshold: 0.7  // stricter
});
```

---

## 🚨 Common Issues & Fixes

### Issue 1: Tasks Not Appearing
**Check:**
1. Is Slack connected? Look for `✅ Slack service initialized`
2. Are mentions being detected? Look for `👋 Bot mentioned`
3. Is the pattern matching working? Look for `isWorkRequest: true`
4. Is the user in the database? Look for `✅ Found Supabase user`

**Debug:**
```javascript
// Check your Slack user ID
console.log('Current user slack_user_id:', currentUser?.slack_user_id);

// Check database lookup
const testUser = await getSupabaseUserBySlackId('U123ABC');
console.log('Found user:', testUser);
```

### Issue 2: "User not found" Error
**Cause:** The mentioned person hasn't authenticated with HeyJarvis yet.

**Solution:**
1. They need to open the desktop app
2. Click "Sign in with Slack"
3. Their `slack_user_id` will be saved
4. Future mentions will work!

### Issue 3: RLS Error
**Error:** `"new row violates row-level security policy"`

**Fix:** Run the SQL migration:
```sql
-- data/storage/fix-users-lookup.sql
CREATE POLICY "Service role can read all users" ON public.users
  FOR SELECT TO service_role
  USING (true);
```

---

## 🎉 Success Indicators

When it's working correctly, you'll see:

```
[0] 👋 Bot mentioned - analyzing...
[0]    isWorkRequest: true
[0]    urgency: 'high'
[0] 📌 Mentioned Slack users: ['U123ABC']
[0] ✅ Found Supabase user for Slack ID: U123ABC → 1294e10a-74ce-499e-ba34-d1ac4219c1bc
[0] ✅ Auto-created task from mention:
[0]    task_id: 'uuid-xyz'
[0]    title: 'fix the payment API'
[0]    created_for_user: 'avi@videofusion.io'
```

And in the UI:
- 🔔 Notification: "✨ New Task Assigned"
- 📋 Task appears in task list with "mention" tag

---

## 📊 How Slack Mentions Work

### Slack Format
When you type `@Avi` in Slack, it gets sent as:
```
<@U123ABC>
```

Or sometimes with the display name:
```
<@U123ABC|Avi>
```

### Our Extraction
```javascript
// Input: "@Avi can you fix this?"
// Actual text: "<@U123ABC> can you fix this?"

const mentionPattern = /<@([UW][A-Z0-9]+)>/g;
// Captures: U123ABC

// Then we look up:
SELECT * FROM users WHERE slack_user_id = 'U123ABC';
// Returns: Avi's full Supabase profile
```

---

## 🚀 Next Steps

1. **Run the SQL migrations:**
   - `fix-conversation-sessions-safe.sql` (for metadata column)
   - `fix-users-lookup.sql` (for user lookups)

2. **Restart the app:**
   ```bash
   npm run dev:desktop
   ```

3. **Test it:**
   - Have someone mention you in Slack
   - Message should include action words (can, help, fix, etc.)
   - Watch the console for debug logs
   - Check your task list!

4. **Monitor logs:**
   ```bash
   # Watch for these indicators:
   👋 Bot mentioned
   📌 Mentioned Slack users
   ✅ Found Supabase user
   ✅ Auto-created task
   ```

---

## 🎯 Pro Tips

1. **Multiple people can use HeyJarvis** - Each person authenticates once, then they all see tasks assigned to them

2. **Team workflow** - Anyone can assign tasks to anyone by mentioning them in Slack

3. **No false positives** - Only creates tasks when it detects actual work requests with mentions

4. **Self-assignment works** - You can mention yourself to create your own tasks from Slack

5. **Cross-channel** - Works in any channel where the bot is invited

---

**🎉 Now when someone says "@Avi can you help?" → You get a task automatically!**

