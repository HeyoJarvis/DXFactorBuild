# 🧪 How To Test Transcript Fetching

## Quick 10-Minute Test

### 1. Schedule a Test Meeting (1 min)
Open Teams and create a quick meeting:
- **Title**: "Transcript Test"
- **Time**: Now or in next 5 minutes
- **Duration**: 5 minutes
- **Type**: Teams meeting (important!)

### 2. Record the Meeting (3 min)
1. Join the meeting
2. Click **"..."** menu → **"Start recording"**
3. **Enable transcription** (should start automatically if enabled in settings)
4. Talk for at least 1-2 minutes (say anything!)
5. Stop recording
6. End meeting

### 3. Wait for Processing (15-30 min)
⏳ Microsoft needs time to:
- Upload recording to OneDrive (~5 min)
- Generate transcript (~15-30 min)

### 4. Test the App (2 min)
```bash
cd /home/sdalal/test/BeachBaby/extra_feature_desktop
node check-existing-meetings.js
```

Look for your "Transcript Test" meeting - it should show a transcript!

---

## Alternative: Manual Test

If you have an existing transcript file (.vtt, .txt, or .docx):

1. Upload it to OneDrive → Recordings folder
2. Name it: `Transcript Test-Transcript.vtt`
3. Run: `node check-existing-meetings.js`
4. The app will find and import it!

---

## What You Should See

✅ **Success Output**:
```
Found transcript file in OneDrive
Transcript downloaded from OneDrive { size: 5000 }
✅ SUCCESS! Transcript fetched
Length: 5000 characters
Preview: WEBVTT

00:00:01.000 --> 00:00:05.000
Hello, this is a test meeting...
```

❌ **No Transcript Yet**:
```
⚠️ No transcript available: Not ready yet
```
→ Wait longer and try again

---

## Automatic Sync

Once working, your app will automatically:
- Check for new transcripts every 15 minutes
- No manual intervention needed!
- Transcripts appear in meetings automatically

---

**Current Status**: Ready to test! Just record a new meeting with transcription enabled.
