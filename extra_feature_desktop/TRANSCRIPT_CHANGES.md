# Transcript Fetching - Changes Made

## Summary

Updated the system to automatically fetch transcripts for **ALL Teams meetings**, not just important ones. The app now extracts online meeting IDs from Teams URLs and stores them for transcript API access.

---

## Files Changed

### 1. `/main/services/MeetingIntelligenceService.js`

**What Changed:**
- Added automatic extraction of `online_meeting_id` from Teams meeting URLs
- Now stores `platform: 'microsoft'` and `meeting_url` in the database
- Extracts meeting ID from URL-encoded Teams join URLs (format: `19:meeting_XXX@thread.v2`)

**Key Code Addition (lines 166-182):**
```javascript
// Extract online meeting ID from join URL for transcript access
// Format: https://teams.microsoft.com/l/meetup-join/19%3ameeting_XXX%40thread.v2/...
let onlineMeetingId = event.onlineMeeting?.id || null;

if (!onlineMeetingId && onlineMeetingUrl) {
  // Extract from URL encoded format
  let match = onlineMeetingUrl.match(/19%3ameeting_([^%]+)%40thread\.v2/);
  if (match) {
    onlineMeetingId = `19:meeting_${match[1]}@thread.v2`;
  } else {
    // Try non-encoded format
    match = onlineMeetingUrl.match(/19:meeting_([^@]+)@thread\.v2/);
    if (match) {
      onlineMeetingId = `19:meeting_${match[1]}@thread.v2`;
    }
  }
}
```

**What Gets Saved to Database (lines 93-110):**
```javascript
const meetingToSave = {
  user_id: userId,
  meeting_id: meeting.meeting_id,
  title: meeting.title,
  start_time: meeting.start_time,
  end_time: meeting.end_time,
  attendees: meeting.attendees,
  is_important: isImportant,
  platform: meeting.online_meeting_url ? 'microsoft' : null,      // NEW!
  meeting_url: meeting.online_meeting_url,                        // NEW!
  metadata: {
    importance_score: meeting.importance_score,
    online_meeting_url: meeting.online_meeting_url,
    online_meeting_id: meeting.online_meeting_id,                 // NEW! Critical for transcripts
    location: meeting.location,
    organizer: meeting.organizer
  }
};
```

---

### 2. `/main/services/BackgroundSyncService.js`

**What Changed:**
- Changed from fetching transcripts for only "important" meetings to fetching for **ALL** Teams meetings
- Increased retry window from 24 hours to 7 days (transcripts may take time to generate)
- Query now uses `platform = 'microsoft'` instead of checking importance flag
- Simplified retry logic - relies on 15-minute sync cycle instead of aggressive retries

**Old Behavior (lines 128-144):**
```javascript
// Get important meetings that:
// 1. Are marked as important
// 2. Have ended (end_time < now)
// 3. Have an online meeting URL (Teams meetings)
// 4. Don't have Copilot notes yet
// 5. Ended within last 24 hours

const { data: meetings, error } = await this.supabaseAdapter.supabase
  .from('team_meetings')
  .select('meeting_id, title, end_time, metadata')
  .eq('user_id', this.currentUserId)
  .eq('is_important', true)  // ❌ Only important meetings
  .is('copilot_notes', null)
  .lt('end_time', now)
  .gte('end_time', oneDayAgo);  // ❌ Only last 24 hours
```

**New Behavior (lines 137-143):**
```javascript
// Get ALL meetings that:
// 1. Have ended (end_time < now)
// 2. Have an online meeting ID (Teams meetings with transcript capability)
// 3. Don't have transcript yet
// 4. Ended within last 7 days

const { data: meetings, error } = await this.supabaseAdapter.supabase
  .from('team_meetings')
  .select('meeting_id, title, end_time, start_time, metadata, platform')
  .eq('user_id', this.currentUserId)
  .eq('platform', 'microsoft')  // ✅ All Microsoft Teams meetings
  .lt('end_time', now)
  .gte('end_time', sevenDaysAgo);  // ✅ 7 days retry window
```

**Filter Logic (lines 157-163):**
```javascript
// Filter for:
// 1. Teams meetings with online_meeting_id (needed for API access)
// 2. Don't already have transcript
const teamsMeetings = meetings.filter(m =>
  m.metadata?.online_meeting_id &&    // ✅ Must have extracted meeting ID
  !m.metadata?.transcript             // ✅ Don't already have transcript
);
```

---

### 3. `/main/services/AutomatedTranscriptService.js`

**What Changed:**
- Fixed OneDrive search query - removed unsupported `.filter()` call that was causing errors

**Old Code (lines 260-264):**
```javascript
const searchResult = await client
  .api(`/me/drive/root/search(q='${encodeURIComponent(searchQuery)}')`)
  .filter("file ne null")  // ❌ Not supported by search endpoint
  .top(20)
  .get();
```

**New Code (lines 260-263):**
```javascript
const searchResult = await client
  .api(`/me/drive/root/search(q='${encodeURIComponent(searchQuery)}')`)
  .top(20)  // ✅ Removed unsupported filter
  .get();
```

---

## How It Works Now

### Automatic Workflow (Every 15 minutes)

```
1. Sync meetings from Microsoft Calendar
   ↓
2. Extract online_meeting_id from Teams URLs
   ↓
3. Save to database with platform='microsoft'
   ↓
4. Check for ended Teams meetings (within last 7 days)
   ↓
5. Fetch transcripts via Graph API
   ├─→ Try: /communications/onlineMeetings/{id}/transcripts
   └─→ Fallback: Search OneDrive for transcript files
   ↓
6. Save transcript to metadata.transcript
   ↓
7. Generate AI summary if no Copilot notes
```

### What Gets Stored

**For Each Teams Meeting:**
- `platform`: `'microsoft'`
- `meeting_url`: Full Teams join URL
- `metadata.online_meeting_id`: Extracted ID (e.g., `19:meeting_XXX@thread.v2`)
- `metadata.online_meeting_url`: Same as meeting_url
- `metadata.transcript`: Full transcript text (VTT format)
- `metadata.copilot_notes`: Copilot-generated notes (if available)
- `metadata.transcript_metadata`: Source, transcript ID, timestamps

---

## Testing

### Test Scripts Created

1. **`test-transcript-permissions.js`** - Verify Azure permissions and OAuth scopes
2. **`check-existing-meetings.js`** - Scan database for meetings and extract online IDs
3. **`check-onedrive-recordings.js`** - Search OneDrive for recording files
4. **`extract-and-fetch-transcripts.js`** - Extract IDs and attempt transcript fetch
5. **`test-full-transcript-workflow.js`** - End-to-end workflow test

### Current Status

✅ **Permissions**: Configured correctly in Azure AD
- `OnlineMeetingTranscript.Read.All` - Granted with admin consent
- OAuth tokens include the required scope

✅ **Online Meeting ID Extraction**: Working
- Successfully extracts IDs from Teams URLs
- Stores in `metadata.online_meeting_id`

✅ **Background Service**: Updated
- Checks all Teams meetings, not just important ones
- 7-day retry window
- 15-minute sync cycle

⚠️ **Transcript Availability**: Depends on Microsoft
- Meetings must have recording/transcription enabled
- Transcripts generate 5-15 minutes after meeting ends
- Copilot transcripts require Copilot license

---

## Requirements for Transcripts

For transcripts to be available, meetings must have:

1. **Recording Enabled**
   - Auto-record or manually start recording
   - Configure in Teams meeting options

2. **Transcription Enabled**
   - Enable "Transcription" in meeting settings
   - Or enable Copilot (includes auto-transcription)

3. **Sufficient Time**
   - Wait 5-15 minutes after meeting ends
   - System will retry automatically every 15 minutes for 7 days

4. **Microsoft 365 Permissions**
   - `OnlineMeetingTranscript.Read.All` (already configured ✅)
   - Admin consent granted (already done ✅)

---

## What Happens for Meetings Without Transcripts

If a transcript isn't available:
- System logs the attempt
- Will retry on next sync cycle (15 minutes later)
- Continues retrying for 7 days
- No errors shown to user
- Meeting still appears in app with other details

---

## Database Schema Impact

### Columns Used

- `platform` - Set to `'microsoft'` for Teams meetings
- `meeting_url` - Teams join URL
- `metadata` (JSON):
  - `online_meeting_id` - Required for API access
  - `online_meeting_url` - Teams URL
  - `transcript` - Full transcript text
  - `copilot_notes` - AI-generated notes
  - `transcript_metadata` - Fetch details
  - `transcript_fetched_at` - Timestamp

### No Schema Changes Required

All new fields use existing columns (`platform`, `meeting_url`, `metadata`).

---

## Future Improvements

1. **UI Indicator** - Show "Fetching transcript..." status for recent meetings
2. **Manual Refresh** - Allow users to manually trigger transcript fetch
3. **Transcript Viewer** - Dedicated UI to view/search transcripts
4. **History** - Show transcript fetch attempts and status

---

## Summary of Benefits

### Before:
- Only fetched transcripts for "important" meetings
- 24-hour retry window
- Manual online meeting ID extraction needed
- OneDrive search had bugs

### After:
- ✅ Fetches transcripts for **ALL** Teams meetings automatically
- ✅ 7-day retry window (more reliable)
- ✅ Automatic online meeting ID extraction from URLs
- ✅ Fixed OneDrive search
- ✅ Better logging and error handling
- ✅ No user intervention needed

**Result**: Transcripts will be automatically available for any Teams meeting with recording/transcription enabled, accessible through your existing app interface.
