# Meeting Timezone Fix - October 20, 2025

## Problem

Meetings were being synced to the database but not showing up in the "Upcoming" meetings list in the frontend.

## Root Cause

Microsoft Graph API returns meeting times without timezone suffix:
- **Microsoft returns**: `2025-10-20T17:50:00` (no timezone)
- **Frontend queries with**: `2025-10-20T18:09:31.779Z` (UTC with Z)

When Supabase compares these:
- Database treats `17:50:00` as `17:50 UTC` (implicit)
- Query `gte('start_time', '18:09Z')` fails because `17:50 < 18:09`
- Meeting appears to be in the past, even though it's actually in the future

## Solution

Added timezone suffix to meeting times before saving to database.

### Fixed in `MeetingIntelligenceService.js` (lines 225-247)

**Before**:
```javascript
const meeting = {
  meeting_id: event.id,
  title: event.subject,
  start_time: event.start?.dateTime,  // ❌ Missing timezone
  end_time: event.end?.dateTime,      // ❌ Missing timezone
  // ...
};
```

**After**:
```javascript
// Convert Microsoft Graph datetime to proper ISO timestamp
// Microsoft returns "2025-10-20T17:50:00" which needs timezone suffix
const start_time = event.start?.dateTime ? 
  (event.start.dateTime.endsWith('Z') ? event.start.dateTime : event.start.dateTime + 'Z') : null;
const end_time = event.end?.dateTime ? 
  (event.end.dateTime.endsWith('Z') ? event.end.dateTime : event.end.dateTime + 'Z') : null;

const meeting = {
  meeting_id: event.id,
  title: event.subject,
  start_time,  // ✅ Now has 'Z' suffix for UTC
  end_time,    // ✅ Now has 'Z' suffix for UTC
  // ...
};
```

## Related Fixes

This fix builds on the earlier schema fix (`MEETING_SYNC_FIX.md`):
1. **Schema Fix**: Removed non-existent `platform` and `meeting_url` columns
2. **Timezone Fix** (this): Added timezone suffix to meeting times

## Testing

1. **Restart the app** to apply changes
2. **Click "Sync Now"** on Meetings page
3. **Verify** meetings appear in "Upcoming" tab
4. **Check database** that times now have 'Z' suffix:

```bash
# Should show times like "2025-10-20T17:50:00Z" (with Z)
```

## Files Modified

1. `/main/services/MeetingIntelligenceService.js` - Lines 225-247

## Technical Notes

- Microsoft Graph API returns times in UTC but without the 'Z' suffix
- The `Prefer: outlook.timezone="UTC"` header ensures times are in UTC
- Adding 'Z' makes it explicit for database comparisons
- Existing meetings without 'Z' will be updated on next sync

