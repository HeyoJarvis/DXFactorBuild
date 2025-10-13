# Teams & Outlook Quick Test Guide

## 🚀 Setup (One-time)

1. **Start the app:**
```bash
npm run dev:developer
```

2. **Authenticate:**
- Click the **Microsoft** button in the app
- Sign in and **accept ALL permissions**
- Look for the new scopes we added

3. **Open DevTools:**
- View → Toggle Developer Tools
- Console tab

---

## 📋 Quick Test Commands

### ✅ Step 1: Verify Scopes
```javascript
await window.electronAPI.microsoft.test({ action: "check_scopes" })
```
Should show all 14 scopes including the new ones.

---

### 🔵 Step 2: Test Teams

**List your teams:**
```javascript
const teams = await window.electronAPI.microsoft.test({ action: "list_teams" })
console.log(teams)
```

**List channels** (use a team ID from above):
```javascript
const channels = await window.electronAPI.microsoft.test({ 
  action: "list_channels", 
  teamId: "PUT_TEAM_ID_HERE"
})
console.log(channels)
```

**Read channel messages** (use team ID + channel ID):
```javascript
const messages = await window.electronAPI.microsoft.test({
  action: "read_channel_messages",
  teamId: "PUT_TEAM_ID_HERE",
  channelId: "PUT_CHANNEL_ID_HERE"
})
console.log(messages)
```

---

### 💬 Step 3: Test Chats

**List your chats:**
```javascript
const chats = await window.electronAPI.microsoft.test({ action: "list_chats" })
console.log(chats)
```

**Read chat messages** (use a chat ID from above):
```javascript
const chatMsgs = await window.electronAPI.microsoft.test({
  action: "read_chat_messages",
  chatId: "PUT_CHAT_ID_HERE"
})
console.log(chatMsgs)
```

---

### 📧 Step 4: Test Outlook

**Read unread emails:**
```javascript
const emails = await window.electronAPI.microsoft.test({ action: "read_emails" })
console.log(emails)
```

**Send test email:**
```javascript
await window.electronAPI.microsoft.sendEmail({
  to: "your-email@example.com",
  subject: "Test from HeyJarvis",
  body: "This is a test!"
})
```

---

## 🐛 Troubleshooting

### Error: "Insufficient privileges"
**Cause:** Scope not granted  
**Fix:** 
1. Re-authenticate with Microsoft
2. Make sure admin granted consent in Azure Portal
3. Check you accepted ALL permissions during OAuth

### Error: "Microsoft not authenticated"
**Cause:** Not logged in  
**Fix:** Click the Microsoft button and sign in

### Error: "Access is denied"
**Cause:** User doesn't have Teams/Outlook license  
**Fix:** Contact IT admin to assign licenses

### No Teams/Channels/Messages returned
**Cause:** User not in any Teams or no permissions  
**Fix:** 
1. Join a team in Microsoft Teams
2. Check you have `Team.ReadBasic.All` scope
3. May need admin consent

---

## ✅ Expected Results

### Teams:
- Should see list of teams you're in
- Should see channels within teams
- Should see recent messages with sender names

### Chats:
- Should see your 1:1 and group chats
- Should see messages with timestamps

### Outlook:
- Should see unread emails with subject/sender
- Should successfully send test emails

---

## 📊 What Gets Logged

Check the terminal running your app for:
```
🧪 Testing Microsoft: list_teams
✅ Found 3 teams
```

Errors show like:
```
❌ Microsoft test failed (list_teams): Insufficient privileges...
```

---

## 🎯 Next Steps After Testing

Once tests pass:
1. ✅ Teams integration works → Can read messages for task detection
2. ✅ Outlook works → Can read emails for automation
3. ✅ Ready to implement Teams Task Detector
4. ✅ Ready to implement Email Task Detector

Run the detectors to automatically create tasks from Teams/Email!

