# Meeting Sync Fix - October 20, 2025

## Problem

Meetings were not appearing in the app even though the background sync was running. The user created a new meeting in Teams but it wasn't showing up in the "Upcoming" meetings list.

## Root Cause

The `MeetingIntelligenceService` was trying to write to database columns that **don't exist**:
- `platform` column
- `meeting_url` column

This caused database insertion failures with the error:
```
"Could not find the 'meeting_url' column of 'team_meetings' in the schema cache"
```

### Database Schema
The actual `team_meetings` table has these columns:
```
id, user_id, meeting_id, title, start_time, end_time, attendees, 
is_important, copilot_notes, manual_notes, ai_summary, key_decisions, 
action_items, topics, metadata, created_at, updated_at
```

## Solution

### 1. Fixed `MeetingIntelligenceService.js` (lines 93-110)
**Before**:
```javascript
const meetingToSave = {
  user_id: userId,
  meeting_id: meeting.meeting_id,
  title: meeting.title,
  start_time: meeting.start_time,
  end_time: meeting.end_time,
  attendees: meeting.attendees,
  is_important: isImportant,
  platform: meeting.online_meeting_url ? 'microsoft' : null,  // ❌ Column doesn't exist
  meeting_url: meeting.online_meeting_url,  // ❌ Column doesn't exist
  metadata: {
    importance_score: meeting.importance_score,
    online_meeting_url: meeting.online_meeting_url,
    online_meeting_id: meeting.online_meeting_id,
    location: meeting.location,
    organizer: meeting.organizer
  }
};
```

**After**:
```javascript
const meetingToSave = {
  user_id: userId,
  meeting_id: meeting.meeting_id,
  title: meeting.title,
  start_time: meeting.start_time,
  end_time: meeting.end_time,
  attendees: meeting.attendees,
  is_important: isImportant,
  metadata: {
    importance_score: meeting.importance_score,
    platform: meeting.online_meeting_url ? 'microsoft' : null,  // ✅ Moved to metadata
    online_meeting_url: meeting.online_meeting_url,
    online_meeting_id: meeting.online_meeting_id,
    location: meeting.location,
    organizer: meeting.organizer
  }
};
```

### 2. Fixed `BackgroundSyncService.js` (lines 166-171)
**Before**:
```javascript
const { data: meetings, error } = await this.meetingIntelligenceService.supabaseAdapter.supabase
  .from('team_meetings')
  .select('meeting_id, title, end_time, start_time, metadata, platform')  // ❌ platform column
  .eq('user_id', this.currentUserId)
  .eq('platform', 'microsoft')  // ❌ Querying non-existent column
  .lt('end_time', now)
  .gte('end_time', sevenDaysAgo);
```

**After**:
```javascript
const { data: meetings, error} = await this.meetingIntelligenceService.supabaseAdapter.supabase
  .from('team_meetings')
  .select('meeting_id, title, end_time, start_time, metadata')  // ✅ Removed platform
  .eq('user_id', this.currentUserId)
  .lt('end_time', now)
  .gte('end_time', sevenDaysAgo);

// Filter in JavaScript instead:
const teamsMeetings = meetings.filter(m =>
  m.metadata?.platform === 'microsoft' &&  // ✅ Check metadata
  m.metadata?.online_meeting_id &&
  !m.metadata?.transcript
);
```

## Testing

### Test 1: Background Sync (Automatic)
1. The background sync runs every 15 minutes automatically
2. Check logs for: `"Saved meetings to database","saved":1` (or higher)
3. Should NOT see: `"Could not find the 'meeting_url' column"` error

### Test 2: Manual Sync
1. Open the app and go to "Meetings" page
2. Click "Sync Now" button
3. Meetings from your Microsoft Calendar should appear in the "Upcoming" tab
4. Click on the "Dashboard" - you should see meeting counts

### Test 3: Verify Database
Run this command to check meetings were saved:
```bash
cd /home/sdalal/test/BeachBaby/extra_feature_desktop
SUPABASE_URL='https://ydbujcuddfgiubjjajuq.supabase.co' \
SUPABASE_ANON_KEY='eyJhbGc...' \
node -e "const { createClient } = require('@supabase/supabase-js'); \
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY); \
  supabase.from('team_meetings').select('*').eq('user_id', 'YOUR_USER_ID').then(({data, error}) => { \
    console.log('Found', data.length, 'meetings'); \
  });"
```

## Additional Notes

### About the Missing Meeting
The newly created Teams meeting still wasn't found because:
1. Either it wasn't successfully saved in Teams
2. Or Microsoft Graph API hasn't synced it yet (can take a few minutes)
3. Or it's in a different calendar than the default one

To troubleshoot:
- Check if the meeting appears in your Outlook/Teams calendar
- Wait 5-10 minutes and click "Sync Now" again
- Verify the meeting is in your default calendar (not a shared/group calendar)

### Background Sync Frequency
- Meetings sync every **15 minutes**
- JIRA/GitHub updates sync with meetings
- Transcripts check after meetings end

## Files Modified
1. `/main/services/MeetingIntelligenceService.js` - Line 93-110
2. `/main/services/BackgroundSyncService.js` - Lines 166-171, 188-192

## Related Issues
- Jira Integration: Previously fixed with token refresh (see `JIRA_TOKEN_REFRESH_FIX.md`)
- Real-time Dashboard Updates: Fixed with event-driven architecture (see `REALTIME_SYNC_COMPLETE.md`)

