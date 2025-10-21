# 🔧 Slack OAuth Redirect URI Fix

## Error
```
redirect_uri did not match any configured URIs. 
Passed URI: http://localhost:8890/auth/slack/callback
```

## Solution

You need to add the OAuth redirect URI to your Slack app configuration.

### Step 1: Go to Slack App Settings
1. Go to https://api.slack.com/apps
2. Select your Slack app (the one with your `SLACK_CLIENT_ID`)

### Step 2: Add Redirect URL
1. In the left sidebar, click **OAuth & Permissions**
2. Scroll to **Redirect URLs** section
3. Click **Add New Redirect URL**
4. Add: `http://localhost:8890/auth/slack/callback`
5. Click **Add**
6. Click **Save URLs**

### Step 3: Verify Your .env
Make sure your `.env` file has these Slack credentials:
```bash
SLACK_CLIENT_ID=your-client-id
SLACK_CLIENT_SECRET=your-client-secret
SLACK_SIGNING_SECRET=your-signing-secret
```

### Step 4: Restart & Test
1. Make sure the OAuth server is running:
   ```bash
   node oauth/electron-oauth-server.js
   ```
2. Restart your Electron app
3. Try logging in with Slack

---

## Alternative: Use Supabase Redirect

If you want to use Supabase's OAuth redirect instead (for easier deployment), you can:

1. Keep the Supabase redirect URL in Slack: `https://your-project.supabase.co/auth/v1/callback`
2. Modify `AuthService.js` to use Supabase's `signInWithOAuth` instead of direct OAuth

But for local development with the custom OAuth server, you MUST add `http://localhost:8890/auth/slack/callback` to Slack.

---

## Quick Check
After adding the redirect URI, you should see it listed in your Slack app settings under:
**OAuth & Permissions → Redirect URLs**

✅ `http://localhost:8890/auth/slack/callback`

