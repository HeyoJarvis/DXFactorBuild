# Update Microsoft Scopes - Step-by-Step Instructions

## 📍 Current Integration Usage

Based on your codebase, you're actively using:
- ✅ **Calendar**: Creating events, checking availability, scheduling meetings
- ✅ **Email**: Sending emails, reading unread emails for task detection
- ✅ **Teams**: Reading messages, sending to channels, detecting work requests
- ✅ **Teams Meetings**: Creating online meetings with join links
- ✅ **User Profile**: Getting user info

---

## 🎯 Step 1: Edit microsoft-graph-service.js

### File to Edit:
```
/Users/jarvis/Code/HeyJarvis/core/integrations/microsoft-graph-service.js
```

### Find This Section (Lines 33-40):
```javascript
scopes: options.scopes || [
  'User.Read',
  'Mail.Send',
  'Mail.ReadWrite',
  'Calendars.ReadWrite',
  'Chat.ReadWrite',
  'ChannelMessage.Send'
],
```

### Replace With This:
```javascript
scopes: options.scopes || [
  // User & Authentication
  'User.Read',                    // ✅ Already have - Read user profile
  'User.ReadBasic.All',           // 🆕 ADD - Read basic info of all users
  
  // Email (for task detection & sending)
  'Mail.Send',                    // ✅ Already have - Send emails
  'Mail.ReadWrite',               // ✅ Already have - Read/write emails
  
  // Calendar (for meeting scheduling)
  'Calendars.ReadWrite',          // ✅ Already have - Create/edit events
  
  // Teams Chat & Messaging
  'Chat.ReadWrite',               // ✅ Already have - Read/send personal chats
  'ChatMessage.Read',             // 🆕 ADD - Read all chat messages (needs admin)
  
  // Teams Channels
  'ChannelMessage.Send',          // ✅ Already have - Send to channels
  'ChannelMessage.Read.All',      // 🆕 ADD - Read channel messages (needs admin)
  
  // Teams Structure (for listing teams/channels)
  'Team.ReadBasic.All',           // 🆕 ADD - List user's teams
  'Channel.ReadBasic.All',        // 🆕 ADD - List channels in teams
  
  // Online Meetings (for Teams meeting links)
  'OnlineMeetings.ReadWrite',     // 🆕 ADD - Create Teams meetings
  
  // Presence (optional but useful)
  'Presence.Read',                // 🆕 ADD - Read user availability status
  
  // Essential
  'offline_access'                // 🆕 ADD - Get refresh tokens (critical!)
],
```

---

## 🎯 Step 2: Configure Azure App Permissions

### A. Log into Azure Portal
1. Go to: https://portal.azure.com
2. Navigate to: **Azure Active Directory** → **App registrations**
3. Find and click your app: **HeyJarvis** (or whatever you named it)

### B. Update API Permissions
1. Click **API permissions** in the left sidebar
2. Click **Add a permission**
3. Select **Microsoft Graph**
4. Select **Delegated permissions**

### C. Add These New Permissions:

#### Basic Permissions (No Admin Consent Required):
- ✅ `User.ReadBasic.All`
- ✅ `OnlineMeetings.ReadWrite`
- ✅ `Presence.Read`
- ✅ `offline_access`

#### Advanced Permissions (Require Admin Consent):
- ⚠️ `ChatMessage.Read` - Read all org chat messages
- ⚠️ `ChannelMessage.Read.All` - Read all channel messages
- ⚠️ `Team.ReadBasic.All` - List all teams
- ⚠️ `Channel.ReadBasic.All` - List all channels

### D. Grant Admin Consent (If You're Admin)
1. After adding all permissions, click **Grant admin consent for [Your Organization]**
2. Click **Yes** to confirm
3. Wait for green checkmarks to appear next to all permissions

### E. If You're NOT an Admin
Send this URL to your IT admin:
```
https://login.microsoftonline.com/common/adminconsent?client_id=YOUR_CLIENT_ID
```
Replace `YOUR_CLIENT_ID` with your actual client ID from Azure Portal.

---

## 🎯 Step 3: Clear Existing Tokens

After updating scopes, you need to re-authenticate to get new permissions.

### Option A: From Supabase (Recommended)
Run this SQL in Supabase SQL Editor:
```sql
UPDATE users 
SET integration_settings = jsonb_set(
  COALESCE(integration_settings, '{}'::jsonb),
  '{microsoft}',
  NULL
)
WHERE email = 'your-email@example.com';
```
Replace `your-email@example.com` with your actual email.

### Option B: Delete Tokens File (If Stored Locally)
```bash
rm -rf ~/.heyjarvis/tokens/microsoft_*.json
```

---

## 🎯 Step 4: Test the Changes

### A. Restart Your App
```bash
cd /Users/jarvis/Code/HeyJarvis/desktop
npm run dev:developer
```

### B. Re-authenticate with Microsoft
1. Click the **Microsoft** button in your app
2. Complete the OAuth flow
3. Accept all the new permissions when prompted

### C. Verify Scopes Were Granted
The app should log something like:
```
✅ Microsoft authenticated successfully
   Granted scopes: User.Read Mail.Send Calendars.ReadWrite Chat.ReadWrite ...
```

### D. Test Each Feature
Run these commands in the app to verify:

**Test Teams Access:**
```javascript
// Open browser console in your app
await window.electronAPI.microsoft.test({
  action: 'list_teams'
})
```

**Test Calendar:**
```javascript
await window.electronAPI.microsoft.createMeeting({
  subject: 'Test Meeting',
  startTime: '2025-10-14T10:00:00',
  endTime: '2025-10-14T11:00:00'
})
```

**Test Email:**
```javascript
await window.electronAPI.microsoft.sendEmail({
  to: 'test@example.com',
  subject: 'Test Email',
  body: 'This is a test'
})
```

---

## 📋 Complete Updated Scopes List

Here's the final list of what you'll have:

| Scope | Purpose | Admin Required? |
|-------|---------|----------------|
| `User.Read` | Read user profile | ❌ No |
| `User.ReadBasic.All` | Read basic info of all users | ❌ No |
| `Mail.Send` | Send emails on behalf of user | ❌ No |
| `Mail.ReadWrite` | Read user's emails | ❌ No |
| `Calendars.ReadWrite` | Create/edit calendar events | ❌ No |
| `Chat.ReadWrite` | Read/send personal chats | ❌ No |
| `ChatMessage.Read` | Read all org chat messages | ✅ Yes |
| `ChannelMessage.Send` | Send messages to channels | ❌ No |
| `ChannelMessage.Read.All` | Read channel messages | ✅ Yes |
| `Team.ReadBasic.All` | List teams | ✅ Yes |
| `Channel.ReadBasic.All` | List channels | ✅ Yes |
| `OnlineMeetings.ReadWrite` | Create Teams meetings | ❌ No |
| `Presence.Read` | Read user availability | ❌ No |
| `offline_access` | Get refresh tokens | ❌ No |

**Total Scopes: 14**

---

## 🚨 Troubleshooting

### Issue: "Insufficient privileges" Error
**Cause:** Admin consent not granted for organization-wide scopes  
**Solution:** Have your IT admin grant consent in Azure Portal

### Issue: "Invalid scope" Error  
**Cause:** Typo in scope name or scope doesn't exist  
**Solution:** Double-check scope names match exactly (case-sensitive)

### Issue: App Still Using Old Scopes
**Cause:** Cached tokens in database  
**Solution:** Clear tokens from Supabase (Step 3) and re-authenticate

### Issue: Can't Read Teams Messages
**Cause:** Missing admin consent for `ChannelMessage.Read.All`  
**Solution:** Request admin to grant this specific scope

---

## ✅ Verification Checklist

After completing all steps, verify:

- [ ] Updated `microsoft-graph-service.js` with new scopes
- [ ] Added all permissions in Azure Portal
- [ ] Granted admin consent (or requested it)
- [ ] Cleared old tokens from database
- [ ] Restarted the app
- [ ] Re-authenticated with Microsoft
- [ ] Tested Teams access (list teams/channels)
- [ ] Tested calendar (create event)
- [ ] Tested email (send test email)
- [ ] Checked logs for any scope errors

---

## 🎉 You're Done!

Once all checkboxes are complete, your Microsoft integration will have full access to:
- ✅ Read Teams messages for task detection
- ✅ List all teams and channels
- ✅ Create calendar events with Teams meeting links
- ✅ Send emails and read inbox for automation
- ✅ Access user presence and activity

Need help with any step? Let me know!

