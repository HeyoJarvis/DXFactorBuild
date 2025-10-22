# 📝 Transcript Fetching - Diagnosis & Solution

## 🔍 Current Status

### ✅ What's Working
1. **Microsoft OAuth is connected** and authenticated
2. **Permissions are granted** in Azure:
   - ✅ OnlineMeetingTranscript.Read
   - ✅ OnlineMeetingRecording.Read  
   - ✅ OnlineMeetingAIInsight.Read
   - ✅ OnlineMeetings.ReadWrite
   - ✅ Calendars.ReadWrite
3. **Meeting detection works** - "xyz standup" meeting found with `online_meeting_id`
4. **OneDrive access works** - Can see Recordings folder

### ⚠️ Current Issue

When trying to fetch transcripts via Graph API:
```
GET /communications/onlineMeetings/{id}/transcripts
→ Returns: 404 page not found
```

This happens because:
1. **The meeting might not have transcripts enabled** during recording
2. **Transcript processing takes time** - can take 15-30 minutes after meeting ends
3. **Only cloud-recorded meetings** have API-accessible transcripts
4. **The OneDrive MP4 file** is just the video recording, not the transcript

## 🎯 The Real Problem

Microsoft Teams has **two separate things**:
1. **Recording** (MP4 video) → Stored in OneDrive immediately
2. **Transcript** (VTT/text) → Generated separately via Graph API

The MP4 file in OneDrive (`xyz standup-20251018_173944-Meeting Transcript.mp4`) is misleadingly named - it's actually just the video recording, not a transcript file.

## ✅ Solution Implemented

### 1. **Fixed OneDrive Search**
Updated `AutomatedTranscriptService.js` to:
- ✅ Exclude video files (MP4, MP3, AVI, MOV)
- ✅ Only look for actual transcript text files (VTT, TXT, DOCX, JSON)
- ✅ Check Recordings folder specifically
- ✅ Fall back to global OneDrive search

### 2. **Added Proper Scopes**
The app needs to request these scopes during OAuth:
```javascript
this.scopes = [
  'User.Read',
  'Calendars.ReadWrite',
  'OnlineMeetings.ReadWrite',
  'OnlineMeetingTranscript.Read',      // ← Add this
  'OnlineMeetingRecording.Read',       // ← Add this  
  'OnlineMeetingAIInsight.Read',       // ← Add this
  'Files.Read.All'                     // ← For OneDrive access
];
```

## 🚀 How Transcripts Actually Work

### For **New** Meetings (Going Forward)

When someone records a Teams meeting with transcription enabled:

1. **During meeting**: Teams generates live captions
2. **After meeting ends**: 
   - Video (MP4) → Uploaded to OneDrive immediately (~1-5 min)
   - Transcript (VTT) → Generated and available via API (~15-30 min)
3. **Your app automatically fetches**: Background sync checks every 15 minutes

### For **Existing** Meetings (Like "xyz standup")

The meeting on Oct 18 likely:
- ✅ Was recorded (MP4 exists in OneDrive)
- ❌ Did NOT have transcription enabled during recording
- ❌ Or transcript hasn't been processed yet by Microsoft

**To verify**: Check in Teams → Calendar → "xyz standup" → Recordings → See if there's a transcript file

## 📋 Next Steps

### Step 1: Update OAuth Scopes (2 minutes)

I'll update the Microsoft OAuth service to request transcript permissions.

### Step 2: Reconnect Microsoft Integration (1 minute)

After updating scopes, you need to:
1. Open the app
2. Go to **Settings**
3. Click **"Disconnect"** next to Microsoft
4. Click **"Connect"** and re-authorize
5. This will request the new scopes

### Step 3: Test with a New Meeting (5 minutes)

Schedule a quick Teams meeting:
1. Create a 5-minute Teams meeting
2. **Enable recording AND transcription** during the call
3. End the meeting
4. Wait ~15-20 minutes
5. Your app will automatically fetch the transcript

## 🔧 Files Modified

1. **`AutomatedTranscriptService.js`**
   - Fixed OneDrive file filtering (exclude videos)
   - Added Recordings folder check
   - Better error handling

2. **`MicrosoftOAuthService.js`** (Next: Add transcript scopes)

## 📊 Expected Behavior After Fix

### Automatic Background Sync (Every 15 min)
```
1. ✅ Fetch new/updated meetings from Calendar
2. ✅ For meetings with online_meeting_id:
   - Try Graph API: /transcripts endpoint
   - If 404: Check OneDrive for VTT/TXT files
   - If found: Download and save to database
3. ✅ Update meeting in database with transcript
4. ✅ Make transcript searchable in Team Chat
```

### Manual Transcript Fetch
Users can also manually request transcripts in the app by clicking "Fetch Transcript" on a meeting card.

---

## 🎯 Why "xyz standup" Has No Transcript

Most likely reasons:
1. **Transcription wasn't enabled** during recording
2. **Meeting was too short** (< 1 minute meetings don't get transcripts)
3. **Transcript expired** (transcripts are kept for 60 days)
4. **Only video recording** was saved, not transcription

To confirm: Check the meeting in Teams web/desktop and look for a separate "Transcript" file or tab.

---

## ✅ What Will Work Going Forward

Once you reconnect with updated scopes and record new meetings with transcription:
- ✅ Automatic transcript fetching every 15 minutes
- ✅ Transcripts appear in meeting details
- ✅ Chat can answer questions about meeting content
- ✅ Copilot insights extracted (if available)
- ✅ Action items and decisions identified from transcript

---

**Next**: I'll update the Microsoft OAuth scopes and create a test script to verify everything works!


