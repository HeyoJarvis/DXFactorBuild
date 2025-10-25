# Slack Widget Troubleshooting Guide 🔧

## Why Slack Widgets Might Not Work

### 1. **Slack Not Configured** ⚙️

The Slack service needs environment variables to connect:

**Check your `.env` file:**
```bash
SLACK_BOT_TOKEN=xoxb-your-bot-token-here
SLACK_SIGNING_SECRET=your-signing-secret
SLACK_APP_TOKEN=xapp-your-app-token        # For Socket Mode
SLACK_SOCKET_MODE=true                       # Enables real-time messaging
```

**To verify Slack is working:**
1. Open DevTools (`Cmd+Option+I` on Mac)
2. Go to Console
3. Type: `await window.electronAPI.slack.getStatus()`
4. Should show: `{ success: true, connected: true, messageCount: X }`

### 2. **Slack Service Not Initialized** 🚫

**Symptoms:**
- Widget shows: "Slack not initialized"
- Console shows: `⚠️ Slack API not available`

**Fix:**
1. Check if Slack bot token is in `.env`
2. Restart the desktop app
3. Check logs in `desktop2/logs/` for Slack initialization errors

### 3. **No Messages in Cache** 📭

**Symptoms:**
- Widget shows "0 items found"
- Slack status shows `messageCount: 0`

**Why:**
- Slack Service only caches messages it receives **after** the app starts
- If no one has sent messages since app startup, cache is empty

**Fix:**
- Send a test message in Slack (tag the bot or send in a channel it's in)
- Wait a few seconds
- Click refresh (↻) on the widget

### 4. **Socket Mode Not Enabled** 🔌

**Symptoms:**
- App starts but never receives Slack messages
- Logs show "SLACK tokens not set" warning

**Fix:**
```bash
# Add to .env
SLACK_SOCKET_MODE=true
SLACK_APP_TOKEN=xapp-1-...
```

Socket Mode allows real-time message delivery without webhooks.

---

## 🧪 Testing Slack Integration

### Step 1: Check Slack Status
```javascript
// In DevTools Console
const status = await window.electronAPI.slack.getStatus();
console.log(status);
// Expected: { success: true, connected: true, initialized: true, messageCount: X }
```

### Step 2: Check Recent Messages
```javascript
// In DevTools Console
const messages = await window.electronAPI.slack.getRecentMessages(10);
console.log(messages);
// Should show array of messages (even if empty)
```

### Step 3: Check Mentions
```javascript
// In DevTools Console
const mentions = await window.electronAPI.slack.getUserMentions();
console.log(mentions);
// Should show array of @mentions
```

### Step 4: Test Widget
1. Create widget: `/track mentions from slack`
2. Open Console and watch for logs:
   - `🔍 Fetching Slack messages...`
   - `📊 Slack API result:`
   - `📨 Got X Slack messages`
   - `✅ Filtered to Y messages for "mentions"`

---

## 🔍 Debugging Console Logs

When you create a Slack widget, you should see:

```
🔍 Fetching Slack messages...
📊 Slack API result: { success: true, messages: [...] }
📨 Got 15 Slack messages
✅ Filtered to 3 messages for "deployment"
```

**If you see:**
```
❌ Slack fetch failed: Slack not initialized
```
→ Slack service isn't running. Check `.env` and restart app.

**If you see:**
```
⚠️ Slack API not available
```
→ IPC handler not registered. Make sure `chat-handlers.js` is loaded.

---

## 🔧 Manual Fix: Enable Slack

### Option 1: Use Existing Slack Bot
If you already have a Slack bot token:

1. **Get your tokens** from https://api.slack.com/apps
2. **Add to `.env`**:
```bash
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...
SLACK_APP_TOKEN=xapp-...  # For Socket Mode
SLACK_SOCKET_MODE=true
```
3. **Restart app**: `npm run dev:desktop`

### Option 2: Create New Slack App

1. Go to https://api.slack.com/apps
2. Click "Create New App" → "From scratch"
3. Name it "HeyJarvis" and choose your workspace
4. **Add Bot Scopes**:
   - `app_mentions:read` - Read @mentions
   - `channels:history` - Read channel messages
   - `channels:read` - View channels
   - `chat:write` - Send messages
   - `users:read` - Read user info
5. **Enable Socket Mode**:
   - Go to "Socket Mode" in sidebar
   - Toggle ON
   - Generate App-Level Token with `connections:write` scope
6. **Install to Workspace**:
   - Go to "Install App"
   - Click "Install to Workspace"
   - Copy "Bot User OAuth Token" (starts with `xoxb-`)
7. **Copy tokens to `.env`**:
```bash
SLACK_BOT_TOKEN=xoxb-... (from Install App page)
SLACK_SIGNING_SECRET=... (from Basic Information page)
SLACK_APP_TOKEN=xapp-... (from Socket Mode page)
SLACK_SOCKET_MODE=true
```
8. **Restart app**

---

## 📊 Expected Behavior

Once Slack is properly configured:

1. **App starts** → Slack Service initializes
2. **Messages arrive** → Cached in memory (last 100)
3. **Widget created** → Fetches from cache
4. **Widget displays**:
   - Count badge (green)
   - Up to 3 messages
   - Sender names
   - "@ Mention" or "Message" status
5. **Auto-refresh** every 30 seconds
6. **Manual refresh** via ↻ button

---

## 🐛 Common Issues

### Issue: "Slack not initialized"
**Cause**: Missing env variables or initialization failed  
**Fix**: Add tokens to `.env` and restart

### Issue: "0 items found" even with messages
**Cause**: Messages not in cache OR filter too specific  
**Fix**: 
- Send a new message to trigger caching
- Try broader keywords (e.g., just "deployment" not "deployment notification")

### Issue: Widget shows old messages
**Cause**: Cache not updating  
**Fix**: Click refresh button or restart app

### Issue: @mentions not showing
**Cause**: Bot not invited to channels OR wrong filter  
**Fix**:
- Invite bot to channels: `/invite @HeyJarvis`
- Use `/track mentions from slack` (not just "mention")

---

## ✅ Verification Checklist

- [ ] `.env` has all 4 Slack variables
- [ ] `SLACK_SOCKET_MODE=true`
- [ ] App restarted after adding tokens
- [ ] Slack status shows `connected: true`
- [ ] Message cache has items (`messageCount > 0`)
- [ ] Bot invited to channels where messages are sent
- [ ] Console shows debug logs when creating widget
- [ ] Widget shows correct data

---

## 📝 Notes

- Slack cache is **in-memory** - cleared on app restart
- Only messages **after app start** are cached
- Maximum 100 messages in cache
- @mentions are specially tagged with `type: 'mention'`
- Regular messages have `type: 'message'`
- All timestamps are JavaScript `Date` objects

---

## 🆘 Still Not Working?

1. **Check logs**: `desktop2/logs/desktop2-main.log`
2. **Look for**:
   - "Slack Service initialized"
   - "SLACK tokens not set" (means missing `.env`)
   - "Slack initialization failed" (check error message)
3. **Enable debug mode**: Set `LOG_LEVEL=debug` in `.env`
4. **Test in Console**: Run the test commands from Section "Testing Slack Integration"

If Slack status returns `{ success: false, connected: false }`, the service isn't running and you need to configure it.

