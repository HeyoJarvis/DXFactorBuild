# ✅ Automatic Copilot Transcript Fetching

## 🎯 How It Works (Better Approach)

### Before Meeting:
1. You see **upcoming** Teams meetings
2. Click **"Mark Important"** on the ones you care about
3. Meeting is marked, ready for transcript fetch later

### After Meeting Ends:
1. **Background sync runs** (every 15 minutes)
2. Checks for important meetings that have ended
3. **Automatically fetches Copilot transcripts** for those meetings
4. Generates AI summary with key decisions & action items
5. Meeting appears in "Summaries" tab!

---

## 🔄 Automatic Sync Schedule

**Background sync checks every 15 minutes for:**
- ✅ Meetings marked as "Important"
- ✅ That have **ended** (end_time < now)
- ✅ Are **Teams meetings** (have online meeting URL)
- ✅ **Don't have transcripts yet** (copilot_notes is null)
- ✅ Ended within **last 24 hours**

**Why 24 hours?**
- Copilot transcripts are usually ready within minutes
- But can take up to a few hours for long meetings
- After 24 hours, transcript might not be available

---

## 📋 Workflow Example

### Monday 10:00 AM - Before Meeting
```
You see: "Sprint Planning - Mon, 10:00 AM"
Click: "Mark Important"
Button changes to: "✓ Important"
```

### Monday 11:00 AM - Meeting Happens
```
Meeting takes place, is recorded
Copilot generates transcript
(You don't need to do anything)
```

### Monday 11:15 AM - Background Sync Runs
```
✅ Checks: "Sprint Planning" ended at 11:00 AM
✅ Checks: Marked as important ✓
✅ Checks: Is Teams meeting ✓
✅ Checks: No transcript yet ✓
→ Fetches Copilot transcript
→ Generates AI summary
→ Extracts key decisions & action items
```

### Monday 11:16 AM - Check Summaries Tab
```
✅ "Sprint Planning" appears with:
   - Full transcript
   - AI Summary
   - Key Decisions
   - Action Items
```

---

## ⚙️ Configuration

### Sync Frequency
Background sync runs **every 15 minutes**

To change:
```javascript
// In BackgroundSyncService.js
this.syncInterval = 15 * 60 * 1000; // 15 minutes

// Change to:
this.syncInterval = 5 * 60 * 1000;  // 5 minutes
this.syncInterval = 30 * 60 * 1000; // 30 minutes
```

### Transcript Fetch Window
Currently: **Last 24 hours**

To change:
```javascript
// In BackgroundSyncService.js line ~115
const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

// Change to:
const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
```

---

## 🔍 What Gets Checked

Every 15 minutes, background sync queries:
```sql
SELECT * FROM team_meetings
WHERE user_id = 'your-id'
  AND is_important = true
  AND copilot_notes IS NULL
  AND end_time < NOW()
  AND end_time >= NOW() - INTERVAL '24 hours'
  AND metadata->>'online_meeting_url' IS NOT NULL
```

---

## 📊 What You'll See

### In Logs:
```json
{"message":"Background sync: Checking for meetings needing Copilot transcripts"}
{"message":"Found meetings needing Copilot transcripts","count":2}
{"message":"Fetching Copilot transcript for meeting","title":"Sprint Planning"}
{"message":"Copilot transcript found, generating summary"}
{"message":"Copilot transcript processed successfully"}
```

### In UI:
- **Before transcript ready:** Meeting shows in Upcoming as "✓ Important"
- **After transcript ready:** Meeting appears in Summaries tab with full details

---

## ⏱️ Timeline Expectations

| Event | Time | What Happens |
|-------|------|--------------|
| Mark Important | 10:00 AM | Meeting saved to database |
| Meeting Ends | 11:00 AM | Copilot generates transcript |
| Background Sync 1 | 11:15 AM | ✅ Fetches transcript, generates summary |
| Background Sync 2 | 11:30 AM | Skips (already has transcript) |
| Background Sync 3 | 11:45 AM | Skips (already has transcript) |

---

## 🎯 Advantages Over Immediate Fetch

### ❌ Immediate Fetch (Old Way):
- Transcript not ready yet → Error
- User has to wait during marking → Slow UI
- Wastes time trying to fetch transcript that doesn't exist

### ✅ Background Fetch (New Way):
- Mark important is instant → Fast UI
- Transcript fetched when ready → Higher success rate
- Automatic retry every 15 minutes → More reliable
- Works for past meetings too → Can mark old meetings

---

## 🧪 Testing

### Test 1: Mark Before Meeting
1. Find an **upcoming** Teams meeting (tomorrow)
2. Click "Mark Important"
3. ✅ Button changes to "✓ Important" immediately
4. After meeting happens, wait 15-30 minutes
5. ✅ Check Summaries tab → Transcript should appear

### Test 2: Mark After Meeting
1. Find a **past** Teams meeting (from today)
2. Click "Mark Important"
3. ✅ Button changes to "✓ Important"
4. Wait 15-30 minutes
5. ✅ Check Summaries tab → Transcript should appear

### Test 3: Meeting Without Copilot
1. Mark a non-Teams meeting as important
2. ✅ Still marks as important
3. ✅ No error
4. Background sync skips it (no online_meeting_url)

---

## 🔧 Manual Force Sync (Future Enhancement)

Could add a button to manually trigger transcript fetch:

```javascript
// In MeetingSummary component
<button onClick={() => forceFetchCopilot(meeting.meeting_id)}>
  🔄 Fetch Copilot Now
</button>
```

---

## 📝 Requirements

Same as before:
- ✅ Microsoft 365 Copilot license
- ✅ Meeting recorded in Teams
- ✅ Copilot enabled
- ✅ OAuth permission: `OnlineMeetingTranscript.Read.All`

---

## ✅ Status: **IMPLEMENTED**

**This is a much better approach!**
- Mark meetings as important BEFORE they happen
- Transcripts fetched automatically AFTER they end
- No waiting, no errors, fully automatic!

**Restart the app to enable:**
```bash
cd /home/sdalal/test/BeachBaby/extra_feature_desktop
npm run dev
```

