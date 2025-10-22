# Microsoft Teams Transcript Webhook Setup Guide

## Overview

This implementation uses **Microsoft Graph webhooks** to receive real-time notifications when meeting transcripts and recordings become available. This is the official Microsoft-recommended approach.

## How It Works

```
1. Teams Meeting ends with transcription enabled
2. Microsoft processes the audio → generates transcript (takes 2-10 minutes)
3. Microsoft Graph sends notification to our webhook
4. Our app receives: meetingId + transcriptId
5. We fetch the transcript content via Graph API
6. Transcript saved to database → UI updates automatically
```

## Setup Instructions

### For Local Development (using ngrok)

#### Step 1: Install ngrok
```bash
# Install ngrok
brew install ngrok  # macOS
# OR
wget https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz
tar -xvzf ngrok-v3-stable-linux-amd64.tgz
sudo mv ngrok /usr/local/bin/
```

#### Step 2: Get ngrok auth token
1. Sign up at https://dashboard.ngrok.com/
2. Get your auth token
3. Run: `ngrok config add-authtoken YOUR_TOKEN`

#### Step 3: Start the app
```bash
cd extra_feature_desktop
npm run dev
```

The app will:
- ✅ Start the webhook server on port 3001
- ✅ Display: "Webhook server running on port 3001"
- ⚠️  Show warning: "For local development, you need to expose this webhook URL"

#### Step 4: Expose webhook with ngrok
In a **separate terminal**:
```bash
ngrok http 3001
```

You'll see output like:
```
Forwarding   https://abc123.ngrok.io -> http://localhost:3001
```

Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)

#### Step 5: Update webhook URL
There are two ways to do this:

**Option A: Environment Variable (Recommended)**
1. Create/update `.env` file:
```bash
WEBHOOK_URL=https://abc123.ngrok.io/webhooks
```

2. Restart the app

**Option B: Manual Subscription Update**
1. Get subscription IDs from logs or call:
```bash
curl http://localhost:3001/webhooks/microsoft-graph/status
```

2. Update each subscription with the new URL (requires manual Graph API call)

#### Step 6: Test the webhook
1. Schedule a Teams meeting
2. Enable transcription
3. Hold the meeting and end it
4. Check logs for:
   - "📬 Received webhook notifications"
   - "Processing transcript webhook notification"
   - "Transcript saved from webhook notification"

### For Production Deployment

#### Option 1: Using a Public Server
1. Deploy to a server with a public domain (e.g., `app.yourdomain.com`)
2. Set environment variable:
```bash
WEBHOOK_URL=https://app.yourdomain.com/webhooks
```

3. Ensure port 3001 is accessible (or use a reverse proxy)

#### Option 2: Using Azure Functions / AWS Lambda
1. Deploy the webhook endpoint as a serverless function
2. Update `WEBHOOK_URL` to point to the function URL
3. The function should call back to your app's API to process notifications

## Environment Variables

Add these to your `.env` file:

```bash
# Webhook Configuration
WEBHOOK_PORT=3001                                    # Port for webhook server
WEBHOOK_URL=https://your-ngrok-url.ngrok.io/webhooks  # Public HTTPS URL

# Microsoft Graph (already configured)
# No additional variables needed - uses existing OAuth credentials
```

## Subscription Management

### Subscriptions Are Automatically:
- ✅ Created on app startup
- ✅ Renewed before expiration (every 55 minutes)
- ✅ Re-created if renewal fails

### Subscription Lifespan:
- **Transcript/Recording subscriptions**: Max 1 hour
- **Auto-renewal**: Every 55 minutes
- **On app restart**: New subscriptions created

### Check Active Subscriptions:
```bash
curl http://localhost:3001/webhooks/microsoft-graph/status
```

Response:
```json
{
  "status": "active",
  "subscriptions": [
    {
      "id": "sub-123",
      "type": "transcript",
      "resource": "/communications/onlineMeetings/getAllTranscripts",
      "expiresAt": "2025-10-20T21:00:00Z"
    },
    {
      "id": "sub-456",
      "type": "recording",
      "resource": "/communications/onlineMeetings/getAllRecordings",
      "expiresAt": "2025-10-20T21:00:00Z"
    }
  ]
}
```

## Troubleshooting

### "Failed to create initial subscriptions"

**Possible causes:**
1. Webhook URL not publicly accessible
2. Missing admin consent for permissions
3. Incorrect Microsoft Graph permissions

**Solutions:**
- Ensure ngrok is running and URL is correct
- Verify permissions in Azure Portal
- Check logs for specific error messages

### "404 page not found" when fetching transcripts

**Causes:**
- Transcript not yet available (Teams still processing)
- Wrong meeting ID format
- Permissions issue

**Solutions:**
- Wait 2-10 minutes after meeting ends
- Check `online_meeting_id` in database is correct
- Verify `OnlineMeetingTranscript.Read.All` permission

### Webhook notifications not received

**Debug steps:**
1. Check ngrok is running: `curl https://your-ngrok-url.ngrok.io/health`
2. Check subscriptions exist: `/webhooks/microsoft-graph/status`
3. Verify webhook validation succeeded (in logs)
4. Test with a simple Teams meeting

### ngrok URL keeps changing

**Solution:** Use ngrok static domains (paid feature) or:
1. Update environment variable each time
2. Restart app after updating `WEBHOOK_URL`
3. For production, use a real domain

## How to Test

### Quick Test:
1. Start the app with ngrok running
2. Create a Teams meeting (can be with yourself)
3. Click "Meet Now" in Teams
4. Enable transcription (⚙️ > Recording and transcription > Start transcription)
5. Say a few words
6. End the meeting
7. Wait 2-5 minutes
8. Check your app - transcript should appear automatically!

### Check Logs:
```bash
tail -f extra_feature_desktop/logs/main.log | grep -i transcript
tail -f extra_feature_desktop/logs/graph-webhooks.log
```

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Your App                                 │
│                                                                  │
│  ┌──────────────────┐      ┌──────────────────────────────┐    │
│  │  Electron Main   │      │   Express Server (Port 3001) │    │
│  │   Process        │◄─────┤   - Webhook Routes           │    │
│  │                  │      │   - /webhooks/microsoft-graph│    │
│  │  - Services      │      │   - Validation Handler       │    │
│  │  - IPC Handlers  │      │   - Notification Processor   │    │
│  └──────────────────┘      └──────────▲───────────────────┘    │
│           │                             │                        │
│           │                             │                        │
└───────────┼─────────────────────────────┼────────────────────────┘
            │                             │
            │  ┌──────────────────────────┼──────────────┐
            │  │         ngrok            │              │
            │  │  (Local Development)     │              │
            │  │  https://abc.ngrok.io ───┘              │
            │  └─────────────────────────────────────────┘
            │                             ▲
            │                             │
            ▼                             │
    ┌────────────────────────────────────┴──────────────┐
    │         Microsoft Graph API                       │
    │                                                    │
    │  - POST /subscriptions (create)                   │
    │  - PATCH /subscriptions/{id} (renew)              │
    │  - GET /onlineMeetings/{id}/transcripts           │
    │  - GET /transcripts/{id}/content                  │
    │                                                    │
    │  → Sends notifications when transcripts ready     │
    └───────────────────────────────────────────────────┘
```

## Next Steps

Once setup is complete:
1. ✅ Transcripts will be fetched automatically
2. ✅ No manual sync needed
3. ✅ UI updates in real-time
4. ✅ Works for all past and future meetings

## Support

For issues:
1. Check logs: `logs/main.log` and `logs/graph-webhooks.log`
2. Verify permissions in Azure Portal
3. Test webhook endpoint: `curl https://your-ngrok-url.ngrok.io/health`
4. Check subscription status: `/webhooks/microsoft-graph/status`

---

**Status**: ✅ Ready for testing  
**Last Updated**: October 20, 2025  
**Implementation**: Complete with automatic subscription management

