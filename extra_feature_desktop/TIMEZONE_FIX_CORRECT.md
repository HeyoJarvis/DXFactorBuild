# Correct Timezone Fix - October 20, 2025

## Problem

I incorrectly tried to force all meeting times to UTC, but the user is in MDT (UTC-6:00). This caused meetings to display at the wrong times.

## Root Cause

The code was using `Prefer: outlook.timezone="UTC"` header, which forced Microsoft Graph API to return all times in UTC instead of the user's local timezone. This caused:

1. A 5:50 PM MDT meeting would be converted to 11:50 PM UTC by Microsoft
2. Stored as `2025-10-20T23:50:00` in database
3. Displayed incorrectly in the UI

## Correct Solution

**Remove the UTC forcing** and let Microsoft Graph API return times in the user's local timezone.

### Fixed in `StandaloneMicrosoftService.js` (line 88)

**Before**:
```javascript
const response = await client
  .api('/me/calendarView')
  .query({
    startDateTime,
    endDateTime,
    $top: options.maxResults || 50,
    $orderby: 'start/dateTime'
  })
  .header('Prefer', 'outlook.timezone="UTC"')  // ❌ Forcing UTC
  .select('id,subject,start,end,attendees,...')
  .get();
```

**After**:
```javascript
const response = await client
  .api('/me/calendarView')
  .query({
    startDateTime,
    endDateTime,
    $top: options.maxResults || 50,
    $orderby: 'start/dateTime'
  })
  // ✅ Use user's local timezone (MDT in this case)
  .select('id,subject,start,end,attendees,...')
  .get();
```

### Reverted `MeetingIntelligenceService.js` (lines 226-232)

Removed the code that was adding 'Z' suffix, since times are now in local timezone:

```javascript
const meeting = {
  meeting_id: event.id,
  title: event.subject,
  start_time: event.start?.dateTime,  // ✅ No modification - keep as-is
  end_time: event.end?.dateTime,      // ✅ No modification - keep as-is
  start_timezone: event.start?.timeZone || 'UTC',
  end_timezone: event.end?.timeZone || 'UTC',
  // ...
};
```

## How Microsoft Graph API Works

- **Without timezone header**: Returns times in user's Outlook/Teams timezone
- **With `Prefer: outlook.timezone="UTC"`**: Converts all times to UTC
- **With `Prefer: outlook.timezone="America/Denver"`**: Converts to specific timezone

## What This Means

- Meeting created at 5:50 PM MDT in Teams
- Stored as `2025-10-20T17:50:00` in database (in MDT context)
- Displayed as 5:50 PM in the UI ✅

## Testing

1. Restart the app
2. Create a new meeting in Teams for tomorrow
3. Click "Sync Now"
4. Meeting should appear at the correct time in your timezone

## Files Modified

1. `/main/services/StandaloneMicrosoftService.js` - Line 88 (removed UTC header)
2. `/main/services/MeetingIntelligenceService.js` - Lines 226-232 (reverted timezone suffix)

## Previous Incorrect Fixes

- ❌ `MEETING_TIMEZONE_FIX.md` - Tried to add 'Z' suffix (WRONG)
- ✅ `MEETING_SYNC_FIX.md` - Schema fix (CORRECT)
- ✅ `REALTIME_SYNC_COMPLETE.md` - Real-time updates (CORRECT)

