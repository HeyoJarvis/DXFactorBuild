# Microsoft Teams Scopes Guide

## Current Scopes (In Your Code)

Your `microsoft-graph-service.js` currently has these scopes:
```javascript
scopes: [
  'User.Read',
  'Mail.Send',
  'Mail.ReadWrite',
  'Calendars.ReadWrite',
  'Chat.ReadWrite',        // ✅ Already included!
  'ChannelMessage.Send'
]
```

## Required Scopes for Teams Chat & Messages

### For Reading Teams Messages & Chats

You need to **add these scopes** for comprehensive Teams access:

#### **1. Chat & Messaging Scopes**
```javascript
// Already have:
'Chat.ReadWrite',              // ✅ Read and send 1:1 and group chats

// ADD THESE:
'Chat.Read',                   // Read user's chat messages (alternative to ReadWrite)
'ChatMessage.Read',            // Read all chat messages (requires admin consent)
'ChannelMessage.Read.All',     // Read all channel messages (requires admin consent)
```

#### **2. Teams & Channels Scopes**
```javascript
'Team.ReadBasic.All',          // Read names and descriptions of teams
'Channel.ReadBasic.All',       // Read channel names and descriptions
'TeamsActivity.Read',          // Read user's Teams activity feed
'TeamsActivity.Send',          // Send activity feed notifications
```

#### **3. User & Presence Scopes** (Optional but useful)
```javascript
'Presence.Read',               // Read user presence info
'Presence.Read.All',           // Read all users' presence
```

---

## Complete Recommended Scopes Configuration

Update your `microsoft-graph-service.js` to include all necessary scopes:

```javascript
scopes: options.scopes || [
  // User & Authentication
  'User.Read',
  'User.ReadBasic.All',
  
  // Email
  'Mail.Send',
  'Mail.ReadWrite',
  
  // Calendar
  'Calendars.ReadWrite',
  
  // Teams Chat (1:1 and Group)
  'Chat.ReadWrite',              // Read and send personal/group chats
  'ChatMessage.Read',            // Read chat messages (admin consent)
  
  // Teams Channels
  'ChannelMessage.Send',         // Send channel messages
  'ChannelMessage.Read.All',     // Read channel messages (admin consent)
  
  // Teams Structure
  'Team.ReadBasic.All',          // Read team info
  'Channel.ReadBasic.All',       // Read channel info
  
  // Presence & Activity
  'Presence.Read',               // Read user presence
  'TeamsActivity.Read',          // Read activity feed
  'TeamsActivity.Send',          // Send notifications
  
  // Files (if accessing Teams files)
  'Files.ReadWrite.All',         // Access team files
  
  // Offline Access
  'offline_access'               // Get refresh tokens
]
```

---

## Scope Breakdown by Use Case

### 🎯 **Minimal (Basic Chat Access)**
```javascript
[
  'User.Read',
  'Chat.ReadWrite',              // Personal chats
  'ChannelMessage.Send',         // Send to channels
  'offline_access'
]
```

### 🎯 **Recommended (Full Teams Integration)**
```javascript
[
  'User.Read',
  'Chat.ReadWrite',              // Read/write chats
  'ChatMessage.Read',            // Read all messages (admin)
  'ChannelMessage.Send',         // Send to channels
  'ChannelMessage.Read.All',     // Read from channels (admin)
  'Team.ReadBasic.All',          // List teams
  'Channel.ReadBasic.All',       // List channels
  'offline_access'
]
```

### 🎯 **Complete (Everything You Might Need)**
```javascript
[
  // Core
  'User.Read',
  'User.ReadBasic.All',
  
  // Chat & Messaging
  'Chat.ReadWrite',
  'ChatMessage.Read',
  'ChannelMessage.Send',
  'ChannelMessage.Read.All',
  
  // Teams Structure
  'Team.ReadBasic.All',
  'Channel.ReadBasic.All',
  
  // Calendar & Email
  'Calendars.ReadWrite',
  'Mail.Send',
  'Mail.ReadWrite',
  
  // Presence & Activity
  'Presence.Read',
  'TeamsActivity.Read',
  'TeamsActivity.Send',
  
  // Files
  'Files.ReadWrite.All',
  
  // Offline
  'offline_access'
]
```

---

## Scope Types & Admin Consent

### ✅ **Delegated Scopes** (User Consent - No Admin Required)
- `User.Read`
- `Mail.Send`
- `Chat.ReadWrite`
- `ChannelMessage.Send`
- `Presence.Read`
- `offline_access`

### ⚠️ **Application Scopes** (Require Admin Consent)
- `ChatMessage.Read` - Read all org chat messages
- `ChannelMessage.Read.All` - Read all channel messages
- `Team.ReadBasic.All` - Read all teams
- `Channel.ReadBasic.All` - Read all channels
- `Files.ReadWrite.All` - Access all files
- `Presence.Read.All` - Read all user presence

---

## How to Request Admin Consent

If you need admin-level scopes, your IT admin must approve them:

### Option 1: Admin Consent URL
```
https://login.microsoftonline.com/{tenant-id}/adminconsent?client_id={your-client-id}
```

### Option 2: Azure Portal
1. Go to Azure Portal → Azure Active Directory
2. Navigate to App Registrations → Your App
3. Go to API Permissions
4. Click "Grant admin consent for [Your Org]"

---

## Implementation: Update Your Service

### File: `core/integrations/microsoft-graph-service.js`

Replace lines 33-40 with:

```javascript
scopes: options.scopes || [
  // User & Authentication
  'User.Read',
  'User.ReadBasic.All',
  
  // Email
  'Mail.Send',
  'Mail.ReadWrite',
  
  // Calendar
  'Calendars.ReadWrite',
  
  // Teams Chat (1:1 and Group)
  'Chat.ReadWrite',              // Read and send chats
  'ChatMessage.Read',            // Read messages (needs admin)
  
  // Teams Channels
  'ChannelMessage.Send',         // Send messages
  'ChannelMessage.Read.All',     // Read messages (needs admin)
  
  // Teams Structure
  'Team.ReadBasic.All',          // List teams
  'Channel.ReadBasic.All',       // List channels
  
  // Presence
  'Presence.Read',               // Read presence
  
  // Offline Access
  'offline_access'               // Refresh tokens
],
```

---

## Testing Your Scopes

After updating, test with this code:

```javascript
// List all teams
const teams = await graphClient.api('/me/joinedTeams').get();

// List channels in a team
const channels = await graphClient.api(`/teams/${teamId}/channels`).get();

// Read channel messages
const messages = await graphClient
  .api(`/teams/${teamId}/channels/${channelId}/messages`)
  .get();

// Read user's chats
const chats = await graphClient.api('/me/chats').get();

// Read messages in a chat
const chatMessages = await graphClient
  .api(`/me/chats/${chatId}/messages`)
  .get();
```

---

## Common Issues & Solutions

### Issue: "Insufficient privileges"
**Solution:** You need admin consent for that scope. Request it from your IT admin.

### Issue: "Invalid scope"
**Solution:** Check you're using the correct scope name (e.g., `Chat.ReadWrite` not `Chat.ReadWrite.All`)

### Issue: "AADSTS65001: User consent not granted"
**Solution:** The user must consent to the scopes during OAuth flow

---

## Quick Reference: Scope Permissions Matrix

| Feature | Scope | Admin? | What It Does |
|---------|-------|--------|--------------|
| Read user profile | `User.Read` | ❌ | Basic user info |
| Send/read personal chats | `Chat.ReadWrite` | ❌ | 1:1 and group chats |
| Read all org chats | `ChatMessage.Read` | ✅ | All messages in org |
| Send to channels | `ChannelMessage.Send` | ❌ | Post to channels |
| Read channel messages | `ChannelMessage.Read.All` | ✅ | Read all channels |
| List teams | `Team.ReadBasic.All` | ✅ | See team names |
| List channels | `Channel.ReadBasic.All` | ✅ | See channel names |
| Read presence | `Presence.Read` | ❌ | User availability |
| Send emails | `Mail.Send` | ❌ | Send on behalf of user |
| Schedule meetings | `Calendars.ReadWrite` | ❌ | Create/edit calendar events |

---

## Next Steps

1. **Update your scopes** in `microsoft-graph-service.js`
2. **Re-authenticate** - Clear existing tokens and reconnect
3. **Request admin consent** for organization-wide scopes if needed
4. **Test reading** Teams messages with the Graph API
5. **Build your Teams task detector** using the intelligence layer

Need help implementing Teams message detection? Let me know!

