# Google Calendar Timezone & Loading Fix

## Problems
1. **Timezone Issue**: Google Calendar events were appearing at wrong times (UTC offset issue)
2. **Calendar Not Loading**: Events weren't displaying in Mission Control

## Root Causes

### 1. Missing getUpcomingEvents Method
The `GoogleGmailService` didn't have a `getUpcomingEvents` method, so API calls were failing silently.

### 2. UTC Default Timezone
- Event creation defaulted to `timeZone: 'UTC'`
- Event fetching didn't specify timezone preference
- Times were being converted incorrectly

## Solutions

### 1. Added getUpcomingEvents Method
**File:** `core/integrations/google-gmail-service.js`

```javascript
async getUpcomingEvents(startDateTime, endDateTime, maxResults = 50) {
  try {
    await this._ensureAuthenticated();

    const response = await this.calendar.events.list({
      calendarId: 'primary',
      timeMin: startDateTime,
      timeMax: endDateTime,
      maxResults: maxResults,
      singleEvents: true,
      orderBy: 'startTime',
      timeZone: 'America/Denver' // Request times in Mountain Time
    });

    return response.data.items || [];
  } catch (error) {
    this.logger.error('Failed to get calendar events', { error: error.message });
    throw error;
  }
}
```

### 2. Fixed Timezone Defaults

**Event Creation:**
```javascript
start: {
  dateTime: eventData.startTime,
  timeZone: eventData.timeZone || 'America/Denver'  // Changed from 'UTC'
},
end: {
  dateTime: eventData.endTime,
  timeZone: eventData.timeZone || 'America/Denver'  // Changed from 'UTC'
}
```

**Event Fetching:**
```javascript
timeZone: 'America/Denver' // Added to API request
```

### 3. Improved Frontend Parsing
**File:** `desktop2/renderer2/src/pages/MissionControl.jsx`

Updated Google event transformation to properly handle timezones and display relative dates:

```javascript
const transformedEvents = result.events.map(event => {
  // Parse the datetime with proper timezone handling
  const startDate = new Date(event.start.dateTime || event.start.date);
  const endDate = new Date(event.end.dateTime || event.end.date);
  
  // Format the date and time
  const eventDate = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const eventTime = startDate.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });
  
  // Display relative dates
  const today = new Date();
  const isToday = startDate.toDateString() === today.toDateString();
  const isTomorrow = startDate.toDateString() === new Date(today.getTime() + 86400000).toDateString();
  
  let displayTime = eventTime;
  if (!isToday) {
    if (isTomorrow) {
      displayTime = `Tomorrow, ${eventTime}`;
    } else {
      displayTime = `${eventDate}, ${eventTime}`;
    }
  }
  
  return {
    id: event.id,
    title: event.summary,
    time: displayTime,
    rawDate: startDate,
    duration: calculateDuration(event.start.dateTime, event.end.dateTime),
    attendees: event.attendees?.map(a => a.displayName || a.email) || [],
    type: 'meeting',
    status: 'confirmed',
    location: event.hangoutLink ? 'Google Meet' : (event.location || 'Not specified'),
    color: '#4285f4',
    source: 'google',
    meetingLink: event.hangoutLink || event.conferenceData?.entryPoints?.[0]?.uri
  };
});
```

## How Google Calendar API Works

### Event Datetime Formats

Google Calendar supports two datetime formats:

1. **Date-Time (with timezone):**
   ```json
   {
     "start": {
       "dateTime": "2025-10-16T09:00:00-06:00",
       "timeZone": "America/Denver"
     }
   }
   ```

2. **All-Day (date only):**
   ```json
   {
     "start": {
       "date": "2025-10-16"
     }
   }
   ```

### Timezone Behavior

- **Without timeZone parameter**: Returns events in UTC
- **With timeZone parameter**: Returns events in specified timezone
- The `timeZone` in request doesn't change event times, just how they're returned
- Event creation respects the timezone in the event object

## Testing

### 1. Verify Events Load
```javascript
// In browser console
const result = await window.electronAPI.google.getUpcomingEvents({
  timeMin: new Date().toISOString(),
  timeMax: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
});
console.log('Google events:', result);
```

### 2. Create Test Event
```javascript
const event = await window.electronAPI.google.createEvent({
  subject: 'Test Event',
  startTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour from now
  endTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
  attendees: ['test@example.com'],
  isOnlineMeeting: true,
  timeZone: 'America/Denver'
});
console.log('Created event:', event);
```

### 3. Check Event Display
1. Navigate to Mission Control
2. Click "Connect Google"
3. Authorize the app
4. Events should appear with correct times
5. Check console for "Google event sample" log

## Files Changed

1. **`core/integrations/google-gmail-service.js`**
   - Added `getUpcomingEvents()` method
   - Changed timezone default from 'UTC' to 'America/Denver' for event creation

2. **`desktop2/renderer2/src/pages/MissionControl.jsx`**
   - Enhanced Google event transformation with proper timezone handling
   - Added relative date display (Today, Tomorrow, Oct 16)
   - Added debug logging for first event

3. **`desktop2/main/ipc/mission-control-handlers.js`**
   - Already updated to use gmailService directly (from previous fix)

## Comparison: Google vs Microsoft

| Feature | Microsoft Graph | Google Calendar |
|---------|----------------|-----------------|
| **Timezone Preference** | Header: `Prefer: outlook.timezone="..."` | Parameter: `timeZone: "..."` |
| **Default Timezone** | UTC | UTC |
| **Event DateTime** | `start.dateTime` + `start.timeZone` | `start.dateTime` or `start.date` |
| **Meeting Link** | `onlineMeeting.joinUrl` | `hangoutLink` or `conferenceData` |
| **Attendees** | `emailAddress.name` / `address` | `displayName` / `email` |
| **Color** | Blue (#0078d4) | Blue (#4285f4) |

## Common Issues & Solutions

### Issue: Events showing wrong time
**Solution:** Check that timezone is set to 'America/Denver' in both:
- Event creation: `event.start.timeZone`
- Event fetching: `calendar.events.list({ timeZone: ... })`

### Issue: All-day events not displaying
**Solution:** Use `event.start.date` for all-day events:
```javascript
const startDate = new Date(event.start.dateTime || event.start.date);
```

### Issue: Events not loading
**Solution:** Check:
1. Is gmailService authenticated? `googleService.isInitialized`
2. Are scopes correct? Need `https://www.googleapis.com/auth/calendar`
3. Check browser console for errors
4. Check logs: `tail -f desktop2/logs/google-gmail.log`

## Next Steps

1. ✅ Google OAuth working
2. ✅ Google Calendar events loading
3. ✅ Timezone handling fixed
4. 🔲 Test event creation with correct timezone
5. 🔲 Implement calendar sync between Microsoft and Google
6. 🔲 Add conflict detection for overlapping meetings

---

## Quick Commands

### Force Refresh Google Events
```javascript
// Browser console
await window.electronAPI.google.getUpcomingEvents({
  timeMin: new Date().toISOString(),
  timeMax: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
});
```

### Check Google Connection
```javascript
const status = await window.electronAPI.google.checkConnection();
console.log('Google connected:', status.connected);
```

### View Logs
```bash
tail -f desktop2/logs/google-gmail.log
tail -f desktop2/logs/google-oauth.log
```

