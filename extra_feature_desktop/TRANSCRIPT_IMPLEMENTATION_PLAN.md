# Microsoft Teams Transcript Implementation Plan

Based on: https://learn.microsoft.com/en-us/microsoftteams/platform/graph-api/meeting-transcripts/overview-transcripts

## Current State Analysis

### ✅ What We Have:
1. Microsoft OAuth integration with scopes:
   - `OnlineMeetingTranscript.Read.All`
   - `OnlineMeetingRecording.Read.All`
   - `OnlineMeetings.ReadWrite`
2. Meeting sync from calendar
3. Background sync service
4. Online meeting IDs stored in database

### ❌ What We're Missing:

#### 1. **Change Notification Subscriptions**
We need to subscribe to Microsoft Graph webhooks to get notified when transcripts are available.

**Required Implementation:**
```javascript
// Subscribe to transcript notifications
POST https://graph.microsoft.com/v1.0/subscriptions
{
  "changeType": "created",
  "notificationUrl": "https://your-app.com/api/notifications",
  "resource": "/communications/onlineMeetings/getAllTranscripts",
  "expirationDateTime": "2025-10-21T18:00:00Z",
  "clientState": "secretClientValue"
}
```

**Subscription Types Available:**
- **Tenant-level**: `/communications/onlineMeetings/getAllTranscripts` (all meetings)
- **User-scoped**: `/users/{userId}/onlineMeetings/getAllTranscripts` (user's meetings)
- **Meeting-specific**: `/communications/onlineMeetings/{meetingId}/transcripts` (one meeting)

#### 2. **Webhook Endpoint to Receive Notifications**
Need to create an endpoint to receive notifications from Microsoft Graph.

**Required:**
- Public HTTPS endpoint (ngrok for dev, real domain for prod)
- Validation handling (Microsoft sends validation token on subscription)
- Notification processing (extract meeting ID and transcript ID)

#### 3. **Transcript Fetching Logic**
Once notified, fetch the transcript using the correct API:

```javascript
// List transcripts for a meeting
GET /communications/onlineMeetings/{meetingId}/transcripts

// Get transcript content (VTT format)
GET /communications/onlineMeetings/{meetingId}/transcripts/{transcriptId}/content?$format=text/vtt
```

#### 4. **Meeting ID Format Issue**
Our current meeting ID format might not work:
- **Calendar Event ID**: `AAMkADAyOWZhN2M2...` (what we have)
- **Online Meeting ID**: `19:meeting_MmFjMzU5NDgtNzJlMy00NzA2LWFlYWYtMTBhNDk1YzFlODky@thread.v2` (what API needs)

We're storing the correct `online_meeting_id`, but the API is returning 404.

## Implementation Steps

### Phase 1: Verify Permissions & Test API Access

1. **Check if our app has admin consent** for the permissions
2. **Test the API directly** with a known meeting that has a transcript
3. **Verify the meeting ID format** is correct

### Phase 2: Implement Change Notification System

1. **Create webhook endpoint** (`/api/webhooks/microsoft-graph`)
2. **Implement subscription creation** on app startup
3. **Handle validation requests** from Microsoft
4. **Process incoming notifications**

### Phase 3: Implement Transcript Fetching

1. **On notification receipt:**
   - Extract meeting ID and transcript ID
   - Fetch transcript content via Graph API
   - Parse VTT format
   - Save to database

2. **Update `AutomatedTranscriptService`:**
   - Remove OneDrive fallback (transcripts aren't in OneDrive)
   - Implement proper Graph API calls
   - Handle VTT parsing

### Phase 4: Handle Subscription Lifecycle

1. **Subscription renewal** (max 1 hour for meetings, 30 days for others)
2. **Handle subscription failures**
3. **Re-subscribe on app restart**

## Why We're Getting 404 Right Now

Based on testing, the 404 error could be due to:

1. **Transcript Not Available Yet**: Teams takes time to process transcripts after meeting ends
2. **Permission Scope Issue**: We might need admin consent for organization-wide permissions
3. **Meeting Type**: The API might only work for certain meeting types (not channel meetings?)
4. **Notification Required**: Transcripts might only be accessible after receiving a notification

## Recommended Approach

### Option A: Change Notifications (Recommended by Microsoft)
**Pros:**
- Real-time updates when transcripts are ready
- Official Microsoft approach
- Works for all meeting types

**Cons:**
- Requires public webhook endpoint (ngrok for dev)
- More complex setup
- Subscription management overhead

### Option B: Polling (Fallback)
**Pros:**
- Simpler implementation
- No webhook infrastructure needed

**Cons:**
- Not real-time
- More API calls (rate limiting risk)
- Inefficient

### Option C: Hybrid Approach (What We Should Do)
1. **Set up change notifications** for real-time updates
2. **Add polling as fallback** for meetings where notification was missed
3. **Keep OneDrive check** as last resort for legacy formats

## Next Steps

1. **Verify admin consent** for our Microsoft app permissions
2. **Create webhook infrastructure:**
   - Add Express endpoint for notifications
   - Implement ngrok for local dev
   - Add real domain for production
3. **Implement subscription creation** in `MicrosoftOAuthService`
4. **Update `AutomatedTranscriptService`** to use Graph API
5. **Test with a new meeting** that has transcription enabled

## Code Structure Changes Needed

### New Files:
1. `main/services/MicrosoftGraphWebhookService.js` - Handle subscriptions and notifications
2. `main/ipc/webhook-handlers.js` - IPC handlers for webhook events
3. `routes/webhooks.js` - Express endpoint for receiving notifications

### Modified Files:
1. `main/services/AutomatedTranscriptService.js` - Use Graph API instead of OneDrive
2. `main/services/MicrosoftOAuthService.js` - Add subscription management
3. `main/index.js` - Initialize webhook service

## Testing Strategy

1. **Create a test meeting** in Teams with transcription enabled
2. **Verify the meeting shows up** in our database
3. **Check if we receive notifications** (webhook logs)
4. **Manually test the Graph API** with the meeting ID
5. **Verify transcript content** is saved correctly

## Permissions Verification

Current scopes in our app:
```javascript
'OnlineMeetingTranscript.Read.All',  // ✅ Correct
'OnlineMeetingRecording.Read.All',   // ✅ Correct
'OnlineMeetings.ReadWrite',          // ✅ Correct
```

**Question:** Do we have **admin consent** for these permissions?
- Without admin consent, organization-wide permissions won't work
- Check in Azure Portal > App registrations > API permissions

## Timeline Estimate

- **Phase 1 (Verification)**: 1-2 hours
- **Phase 2 (Webhook Setup)**: 3-4 hours
- **Phase 3 (Transcript Fetching)**: 2-3 hours
- **Phase 4 (Lifecycle Management)**: 2-3 hours

**Total**: 8-12 hours of development + testing

## References

- [Get meeting transcripts overview](https://learn.microsoft.com/en-us/microsoftteams/platform/graph-api/meeting-transcripts/overview-transcripts)
- [Change notifications for transcripts](https://learn.microsoft.com/en-us/graph/api/resources/webhooks)
- [List transcripts API](https://learn.microsoft.com/en-us/graph/api/onlinemeeting-list-transcripts)
- [Get transcript content API](https://learn.microsoft.com/en-us/graph/api/calltranscript-get-content)

---

**Status**: Planning complete, ready to implement
**Priority**: High (user-requested feature)
**Complexity**: Medium-High (requires webhook infrastructure)

