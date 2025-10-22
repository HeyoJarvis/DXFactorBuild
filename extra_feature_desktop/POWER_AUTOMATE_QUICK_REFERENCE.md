# ⚡ Power Automate Transcripts - Quick Reference Card

## 🎯 One-Page Guide

### What It Does
Automatically saves Teams meeting transcripts to OneDrive so your app can read them.

### How It Works
```
Teams Meeting → Transcript Ready → Power Automate → OneDrive → Your App
   (ends)         (~30 min)         (downloads)     (stores)   (syncs)
```

---

## 📋 Setup Checklist (15 minutes)

1. **Azure AD App** (5 min)
   - [ ] Go to portal.azure.com → Azure AD → App registrations
   - [ ] Create new app: "PowerAutomate-Transcripts"
   - [ ] Add permissions: `OnlineMeetings.Read`, `Calendars.Read`, `Files.ReadWrite.All`
   - [ ] Grant admin consent
   - [ ] Create client secret
   - [ ] Copy: Client ID, Tenant ID, Secret

2. **Power Automate Flow** (10 min)
   - [ ] Go to make.powerautomate.com
   - [ ] Create new automated flow
   - [ ] Add trigger: Recurrence (every 30 minutes)
   - [ ] Get calendar events (last 24 hours)
   - [ ] Filter for online meetings
   - [ ] Get transcripts via HTTP
   - [ ] Save to OneDrive `/Recordings`

3. **Verify** (2 min)
   ```bash
   node verify-power-automate-transcripts.js
   ```

---

## 🔑 Key Configuration Values

### Azure AD App Permissions
```
Microsoft Graph (Delegated):
- OnlineMeetings.Read
- OnlineMeetings.Read.All  
- Calendars.Read
- Files.ReadWrite.All
```

### Power Automate HTTP Action
```
Method: GET
URI: https://graph.microsoft.com/v1.0/me/onlineMeetings/{meetingId}/transcripts/{transcriptId}/content?$format=text/vtt
Authentication: Active Directory OAuth
Tenant: [Your Tenant ID]
Audience: https://graph.microsoft.com
Client ID: [Your Client ID]
Secret: [Your Client Secret]
```

### OneDrive File Creation
```
Folder: /Recordings
Filename: @{meeting_title}-Transcript-@{utcNow()}.vtt
Content: [Body from HTTP response]
```

---

## 🧪 Testing Process

1. **Schedule test meeting**
   - Title: "Power Automate Test"
   - Duration: 5 minutes
   - Enable recording + transcription

2. **Join and record**
   - Start recording
   - Speak for 2-3 minutes
   - End meeting

3. **Wait and verify**
   - Wait 30 minutes (Teams processing)
   - Check Power Automate run history
   - Verify file in OneDrive
   - Run verification script

---

## 🐛 Troubleshooting Quick Fixes

| Problem | Quick Fix |
|---------|-----------|
| **Flow not running** | Check it's turned ON, verify recurrence |
| **Permission errors** | Re-grant admin consent in Azure AD |
| **No transcripts** | Wait 30+ min, verify transcription was enabled |
| **OneDrive error** | Create `/Recordings` folder manually |
| **App not reading** | Run `node force-sync-meetings.js` |

---

## 📊 Status Check Commands

```bash
# Full verification
node verify-power-automate-transcripts.js

# Check app logs
tail -f logs/transcript-service.log

# Manual sync
node force-sync-meetings.js

# Check meetings in DB
node check-meeting-notes.js
```

---

## 🔗 Important Links

- **Power Automate Portal**: https://make.powerautomate.com
- **Azure Portal**: https://portal.azure.com
- **OneDrive**: https://onedrive.live.com
- **Full Documentation**: `./power-automate-templates/SETUP_INSTRUCTIONS.md`
- **Architecture**: `./power-automate-templates/ARCHITECTURE_DIAGRAM.md`

---

## ⏱️ Timeline

| Event | Time |
|-------|------|
| Meeting ends | T+0 |
| Transcript ready | T+30 min |
| Power Automate runs | T+30-60 min |
| File in OneDrive | T+30-60 min |
| App syncs | T+45-75 min |
| Available in database | T+45-75 min |
| Searchable in chat | T+45-75 min |

**Optimization**: Change recurrence to 5 minutes → Available in ~20 minutes

---

## ✅ Success Indicators

When everything is working:

- ✅ Power Automate runs every 30 minutes
- ✅ Run history shows "Succeeded"
- ✅ Files appearing in OneDrive `/Recordings`
- ✅ Verification script passes all checks
- ✅ Transcripts in database (`team_meetings.metadata.transcript`)
- ✅ AI answers questions about meeting content accurately

---

## 💾 File Naming Convention

```
Good:
✅ Weekly Standup-Transcript-2025-10-22.vtt
✅ Client Review-Transcript.vtt
✅ Project-Sync-Transcript-20251022-1430.vtt

Bad:
❌ Meeting.mp4 (video, not transcript)
❌ recording_123.txt (unclear meeting)
```

**Pattern**: `{Meeting Title}-Transcript-{Optional Date}.vtt`

---

## 🚀 Quick Start (Absolute Minimum)

**Don't have time for full setup? Try this:**

1. **Create Button Flow** (2 min):
   - Power Automate → Instant flow
   - Manually trigger
   - Action: Create file in OneDrive
   - Folder: `/Recordings`

2. **After each meeting**:
   - Copy transcript from Teams
   - Run button flow
   - Paste transcript
   - Done!

**No Azure AD app needed!**

---

## 📞 Get Help

1. Check troubleshooting section
2. Review Power Automate run history for errors
3. Run verification script for diagnostics
4. Check full documentation in `/power-automate-templates/`

---

**Print this page and keep it handy! 📄**

