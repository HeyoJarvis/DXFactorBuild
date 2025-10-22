# 🚀 Quick Setup: Power Automate Transcript Flow

## 3-Minute Setup (No Premium Required)

### Step 1: Create the Flow (5 minutes)

1. **Go to Power Automate**: https://make.powerautomate.com

2. **Create New Flow**:
   - Click "+ Create" → "Automated cloud flow"
   - Name: `Teams Transcripts to OneDrive`
   - Skip trigger selection for now → "Create"

3. **Add Recurrence Trigger**:
   - Search for "Recurrence"
   - Interval: `30` minutes
   - Click "New step"

4. **Get Calendar Events**:
   - Search: "Get calendar view of events"
   - Connection: Sign in with your Microsoft 365 account
   - Calendar id: `Calendar`
   - Start time: 
     ```
     @addDays(utcNow(), -1)
     ```
   - End time:
     ```
     @utcNow()
     ```
   - Time zone: `(UTC) Coordinated Universal Time`

5. **Filter Array** (only online meetings):
   - Click "New step" → Search "Filter array"
   - From: `value` (from Get calendar events)
   - Add condition:
     ```
     isOnlineMeeting  is equal to  true
     ```

6. **Apply to Each**:
   - Click "New step" → Search "Apply to each"
   - Select output from: `Body` (from Filter array)

7. **Inside Apply to Each, Add Condition**:
   - Search "Condition"
   - Choose: `onlineMeetingUrl` (from current item)
   - Operator: `is not equal to`
   - Value: (leave empty/null)

8. **If Yes - Create Variable for Meeting ID**:
   - Add action → "Compose"
   - Name: `MeetingID`
   - Inputs:
     ```
     @{split(split(items('Apply_to_each')?['onlineMeetingUrl'], '/')[sub(length(split(items('Apply_to_each')?['onlineMeetingUrl'], '/')), 1)], '?')[0]}
     ```

9. **HTTP - Get Transcripts**:
   - Add action → Search "HTTP"
   - Method: `GET`
   - URI:
     ```
     https://graph.microsoft.com/v1.0/me/onlineMeetings/@{outputs('MeetingID')}/transcripts
     ```
   - Authentication: `Active Directory OAuth`
   - Tenant: `common`
   - Audience: `https://graph.microsoft.com`
   - Client ID: `[Your Azure AD App Client ID]`
   - Secret: `[Your Azure AD App Secret]`

10. **Parse JSON** (transcript list):
    - Add action → "Parse JSON"
    - Content: `Body` (from HTTP)
    - Schema:
      ```json
      {
        "type": "object",
        "properties": {
          "value": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "id": { "type": "string" },
                "createdDateTime": { "type": "string" }
              }
            }
          }
        }
      }
      ```

11. **Condition - Check if transcripts exist**:
    - Add action → "Condition"
    - Expression:
      ```
      @greater(length(body('Parse_JSON')?['value']), 0)
      ```

12. **If Yes - Get Transcript Content**:
    - Add action → "HTTP"
    - Method: `GET`
    - URI:
      ```
      https://graph.microsoft.com/v1.0/me/onlineMeetings/@{outputs('MeetingID')}/transcripts/@{first(body('Parse_JSON')?['value'])?['id']}/content?$format=text/vtt
      ```
    - Same authentication as step 9

13. **Create File in OneDrive**:
    - Add action → Search "Create file"
    - Choose "OneDrive for Business"
    - Folder path: `/Recordings`
    - File name:
      ```
      @{items('Apply_to_each')?['subject']}-Transcript-@{formatDateTime(utcNow(), 'yyyy-MM-dd-HHmm')}.vtt
      ```
    - File content: `Body` (from HTTP Get Transcript Content)

14. **Save the Flow**

---

## ⚡ Even Simpler: Manual Button Flow (2 minutes)

If the above is too complex, use this instant button approach:

### Setup:

1. **Create Instant Flow**:
   - Power Automate → "+ Create" → "Instant cloud flow"
   - Name: `Save Meeting Transcript`
   - Trigger: "Manually trigger a flow"

2. **Add Inputs**:
   - Text input:
     - Name: `MeetingTitle`
     - Description: "Enter meeting title"
   - Text input:
     - Name: `OnlineMeetingID`
     - Description: "Enter online meeting ID"

3. **HTTP - Get Transcripts**:
   ```
   Method: GET
   URI: https://graph.microsoft.com/v1.0/me/onlineMeetings/@{triggerBody()?['OnlineMeetingID']}/transcripts
   Authentication: [Same as above]
   ```

4. **Parse JSON** (same schema as step 10 above)

5. **HTTP - Get Content**:
   ```
   Method: GET
   URI: https://graph.microsoft.com/v1.0/me/onlineMeetings/@{triggerBody()?['OnlineMeetingID']}/transcripts/@{first(body('Parse_JSON')?['value'])?['id']}/content?$format=text/vtt
   Authentication: [Same as above]
   ```

6. **Create OneDrive File**:
   ```
   Folder: /Recordings
   Name: @{triggerBody()?['MeetingTitle']}-Transcript.vtt
   Content: [Body from HTTP]
   ```

7. **Save**

### Usage:
- After a meeting ends, wait 20-30 minutes
- Click "Run" on the flow
- Enter meeting title and ID
- Transcript saved to OneDrive!

---

## 🔑 Azure AD App Setup (Required for HTTP Steps)

### Quick Registration:

1. **Azure Portal**: https://portal.azure.com
2. **Azure Active Directory** → **App registrations** → **New registration**
3. **Settings**:
   - Name: `PowerAutomate-Transcripts`
   - Supported types: `Accounts in this organizational directory only`
   - Redirect URI: (leave blank)
   - Register

4. **API Permissions**:
   - Click "API permissions" → "Add a permission"
   - Microsoft Graph → Delegated permissions
   - Add these:
     - ✅ `OnlineMeetings.Read`
     - ✅ `OnlineMeetings.Read.All`
     - ✅ `Calendars.Read`
     - ✅ `Files.ReadWrite.All`
   - Click "Grant admin consent for [Your org]"

5. **Create Client Secret**:
   - "Certificates & secrets" → "New client secret"
   - Description: `PowerAutomate`
   - Expires: 24 months
   - **Copy the Value** (you won't see it again!)

6. **Copy these for Power Automate**:
   - Overview → Application (client) ID
   - Overview → Directory (tenant) ID
   - Certificates & secrets → Client secret Value

---

## 📱 Mobile App Setup (Easiest!)

For the absolute simplest setup, use the Power Automate mobile app:

### Steps:

1. **Download App**:
   - iOS: App Store → "Power Automate"
   - Android: Play Store → "Power Automate"

2. **Create Button Flow**:
   - Open app → "+" → "Button"
   - Add action: "Create file" (OneDrive)
   - File name: "Transcript"
   - Folder: "/Recordings"
   - Allow manual text input

3. **Usage**:
   - Copy transcript from Teams
   - Tap button on phone
   - Paste transcript
   - Done!

---

## 🧪 Testing Your Flow

### Test Meeting:

1. **Schedule 5-min Teams meeting**
   - Title: "Transcript Test"
   - Now or soon
   - Enable recording

2. **Join and record**:
   - Start meeting
   - Click record button
   - Speak for 2-3 minutes
   - Stop recording
   - End meeting

3. **Wait 20-30 minutes**

4. **Check Power Automate**:
   - My flows → Your flow → Run history
   - Should show "Succeeded"

5. **Check OneDrive**:
   ```
   OneDrive.com → Recordings folder
   Should see: "Transcript Test-Transcript-2025-10-22-1430.vtt"
   ```

6. **Verify in your app**:
   ```bash
   cd /home/sdalal/test/BeachBaby/extra_feature_desktop
   node check-meeting-notes.js
   ```

   Should show:
   ```
   ✅ Found transcript for "Transcript Test"
   ```

---

## ❓ Troubleshooting

### "Forbidden" or "Unauthorized" Error

**Fix**: 
- Check Azure AD app permissions
- Make sure admin consent is granted
- Regenerate client secret if expired

### "Meeting not found" Error

**Fix**:
- Meeting must be a Teams online meeting (not just Outlook)
- Wait at least 20 minutes after meeting ends
- Check if recording was actually enabled

### Transcript Empty or Not Found

**Fix**:
- Transcription must be enabled in Teams settings
- Meeting must have actual speech (not silent)
- Premium Teams license required for transcription

### OneDrive File Not Created

**Fix**:
- Create `/Recordings` folder manually in OneDrive
- Check OneDrive connector permissions
- Make sure you have storage space

---

## 🎯 Next Steps

Once your flow is working:

1. **Enable it for production**:
   - Flow settings → "Turn on"
   - Will run every 30 minutes automatically

2. **Monitor for a few days**:
   - Check run history daily
   - Verify files are being created

3. **Confirm your app reads them**:
   ```bash
   tail -f logs/transcript-service.log
   ```
   
   Should see:
   ```
   INFO: Found transcript file in OneDrive
   INFO: Transcript downloaded successfully
   ```

4. **Enjoy automatic transcripts!** 🎉

---

## 📊 Summary

| Method | Setup Time | Difficulty | Automation |
|--------|------------|------------|------------|
| Automated Flow | 15 min | Medium | Full |
| Button Flow | 5 min | Easy | Manual |
| Mobile App | 2 min | Very Easy | Manual |

**Recommended**: Start with Button Flow to test, then upgrade to Automated Flow for production.

---

**Need help?** Check the main documentation: `POWER_AUTOMATE_TRANSCRIPT_FLOW.md`

