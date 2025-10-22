# 🚀 Quick Manual Setup - Power Automate Flow

## Copy/Paste This Into Power Automate (15 minutes)

Since direct import doesn't work, here's the fastest way to create the flow manually:

---

## Step-by-Step Creation

### 1. Create New Flow

1. Go to: https://make.powerautomate.com
2. Click: **"+ Create"** → **"Automated cloud flow"**
3. Name: `Teams Transcripts to OneDrive`
4. Skip trigger selection → Click **"Create"**

---

### 2. Add Recurrence Trigger

1. Search: **"Recurrence"**
2. Click: **"Recurrence"** (Schedule)
3. Configure:
   - **Interval**: `30`
   - **Frequency**: `Minute`

---

### 3. Get Calendar Events

1. Click: **"+ New step"**
2. Search: **"Get calendar view of events"** (Office 365 Outlook)
3. Configure:
   - **Calendar id**: `Calendar`
   - **Start time**: 
     ```
     @addDays(utcNow(), -1)
     ```
   - **End time**:
     ```
     @utcNow()
     ```
   - **Time zone**: `(UTC) Coordinated Universal Time`

---

### 4. Filter for Online Meetings

1. Click: **"+ New step"**
2. Search: **"Filter array"**
3. Configure:
   - **From**: Click in the field → Select **"value"** from "Get calendar view"
   - Click **"Edit in advanced mode"**
   - Paste:
     ```
     @equals(item()?['isOnlineMeeting'], true)
     ```

---

### 5. Apply to Each Meeting

1. Click: **"+ New step"**
2. Search: **"Apply to each"**
3. Configure:
   - **Select output**: **"Body"** from "Filter array"

---

### 6. Inside "Apply to each" - Compose Meeting ID

1. Click: **"Add an action"** (inside the loop)
2. Search: **"Compose"**
3. Rename to: `ExtractMeetingID`
4. **Inputs**:
   ```
   @split(split(items('Apply_to_each')?['onlineMeetingUrl'], '/')[sub(length(split(items('Apply_to_each')?['onlineMeetingUrl'], '/')), 1)], '?')[0]
   ```

---

### 7. Add Condition - Check Meeting ID Exists

1. Click: **"Add an action"**
2. Search: **"Condition"**
3. Configure:
   - Click **"Edit in advanced mode"**
   - Paste:
     ```
     @not(empty(outputs('ExtractMeetingID')))
     ```

---

### 8. If Yes - HTTP Get Transcripts

**Note**: This requires Azure AD app setup OR use delegated auth

#### Option A: With Azure AD App (Recommended)

1. In the **"If yes"** branch, click **"Add an action"**
2. Search: **"HTTP"**
3. Configure:
   - **Method**: `GET`
   - **URI**:
     ```
     https://graph.microsoft.com/v1.0/me/onlineMeetings/@{outputs('ExtractMeetingID')}/transcripts
     ```
   - **Authentication**: `Active Directory OAuth`
   - **Tenant**: `common`
   - **Audience**: `https://graph.microsoft.com`
   - **Client ID**: `[Your Azure AD App Client ID]`
   - **Credential Type**: `Secret`
   - **Secret**: `[Your Azure AD App Secret]`

#### Option B: Without Premium HTTP (Simplified)

**Skip the HTTP steps and use this simpler approach:**

1. In the **"If yes"** branch, click **"Add an action"**
2. Search: **"Create file"** (OneDrive for Business)
3. Configure:
   - **Folder Path**: `/Recordings`
   - **File Name**:
     ```
     @{items('Apply_to_each')?['subject']}-Meeting-@{formatDateTime(utcNow(), 'yyyy-MM-dd')}.txt
     ```
   - **File Content**:
     ```
     Meeting: @{items('Apply_to_each')?['subject']}
     Start: @{items('Apply_to_each')?['start']?['dateTime']}
     End: @{items('Apply_to_each')?['end']?['dateTime']}
     Online Meeting URL: @{items('Apply_to_each')?['onlineMeetingUrl']}
     
     Note: Transcript will be added when available via Graph API or manual upload.
     ```

**This creates a placeholder that you can update with actual transcripts later.**

---

## 🎯 Recommended: Use the Simple Button Flow Instead

The automated flow with Graph API requires:
- ❌ Azure AD app registration
- ❌ Premium connectors ($15/month)
- ❌ Complex error handling

**Better alternative**: 

### Create This 2-Minute Button Flow:

1. **Create** → **Instant cloud flow**
2. **Trigger**: "Manually trigger a flow"
3. **Add Input**: Text input named `MeetingTitle`
4. **Add Input**: Text input named `TranscriptContent`
5. **Add Action**: "Create file" (OneDrive)
   - Folder: `/Recordings`
   - Name: `@{triggerBody()?['MeetingTitle']}-Transcript.vtt`
   - Content: `@{triggerBody()?['TranscriptContent']}`
6. **Save**

**Usage**: After each meeting → Copy transcript → Run flow → Paste → Done!

---

## 🔑 Azure AD App Setup (If Using HTTP Method)

### Quick Setup:

1. **Go to**: https://portal.azure.com
2. **Navigate**: Azure AD → App registrations → New registration
3. **Name**: `PowerAutomate-Transcripts`
4. **Register**
5. **API Permissions** → Add:
   - `OnlineMeetings.Read`
   - `Calendars.Read`
   - `Files.ReadWrite.All`
6. **Grant admin consent**
7. **Certificates & secrets** → New client secret
8. **Copy**: Client ID, Tenant ID, Secret value

---

## ✅ After Creating the Flow

### Test It:

1. If using button flow:
   - Click "Test" → "Manually"
   - Enter a meeting title and some text
   - Check OneDrive `/Recordings` folder

2. If using automated flow:
   - Wait for next run (30 minutes)
   - Check run history
   - Check OneDrive for files

### Verify with Your App:

```bash
cd /home/sdalal/test/BeachBaby/extra_feature_desktop
node verify-power-automate-transcripts.js
```

---

## 💡 Why This Works Better Than Import

- ✅ No environment-specific GUIDs needed
- ✅ Connections created in your environment
- ✅ You understand each step
- ✅ Easy to troubleshoot
- ✅ Actually faster than import!

---

## 🐛 Common Issues

### "Cannot find connection"
- **Fix**: Sign in to Office 365 and OneDrive connectors

### "Unauthorized" or "Forbidden"
- **Fix**: Check Azure AD app permissions and admin consent

### "No transcripts found"
- **Fix**: Ensure meetings have recording + transcription enabled

### Flow runs but no files created
- **Fix**: Create `/Recordings` folder in OneDrive manually

---

## 📚 For Full Details

See the extracted ZIP package:
- `templates/SETUP_INSTRUCTIONS.md` - Complete setup guide
- `templates/ARCHITECTURE_DIAGRAM.md` - How it all works
- `POWER_AUTOMATE_QUICK_REFERENCE.md` - Quick reference card

---

**Ready to go!** Start with the button flow (2 minutes) or follow this guide for full automation. 🚀

