# 🔧 Slack Authentication Fix Guide

## Current Issue
Your Slack bot token is returning `invalid_auth` error, which means:
- The token is expired or invalid
- The Slack app is not installed in your workspace
- The app doesn't have proper permissions

## 🚀 Step-by-Step Fix

### Step 1: Check Your Slack App Status
1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Find your HeyJarvis app (or create a new one if missing)
3. Click on your app to open its settings

### Step 2: Verify App Installation
1. In your Slack app settings, go to **"Install App"** (left sidebar)
2. Check if the app is installed in your workspace
3. If not installed, click **"Install to Workspace"**
4. If already installed, click **"Reinstall to Workspace"** to refresh tokens

### Step 3: Get Fresh Tokens
After installation/reinstallation:

1. **Bot User OAuth Token**:
   - Go to **"OAuth & Permissions"** → **"Bot User OAuth Token"**
   - Copy the token (starts with `xoxb-`)
   - This is your `SLACK_BOT_TOKEN`

2. **App-Level Token**:
   - Go to **"Basic Information"** → **"App-Level Tokens"**
   - If no token exists, click **"Generate Token and Scopes"**
   - Add scope: `connections:write`
   - Copy the token (starts with `xapp-`)
   - This is your `SLACK_APP_TOKEN`

3. **Signing Secret**:
   - Go to **"Basic Information"** → **"App Credentials"**
   - Copy the **"Signing Secret"**
   - This is your `SLACK_SIGNING_SECRET`

### Step 4: Configure Required Scopes
In **"OAuth & Permissions"** → **"Bot Token Scopes"**, ensure you have:

```
channels:history    # Read public channel messages
channels:read       # List channels
chat:write          # Send messages
groups:history      # Read private channel messages
groups:read         # List private channels
im:history          # Read DM messages
im:read             # List DMs
mpim:history        # Read group DM messages
mpim:read           # List group DMs
users:read          # Read user information
app_mentions:read   # Receive mentions
```

### Step 5: Enable Socket Mode
1. Go to **"Socket Mode"** (left sidebar)
2. **Enable Socket Mode**
3. This allows your app to receive events via WebSocket

### Step 6: Update Your .env File
Replace the tokens in your `.env` file with the fresh ones:

```bash
SLACK_BOT_TOKEN=xoxb-your-new-bot-token-here
SLACK_SIGNING_SECRET=your-new-signing-secret-here
SLACK_APP_TOKEN=xapp-your-new-app-token-here
SLACK_SOCKET_MODE=true
```

### Step 7: Test the Connection
Run the validation script:
```bash
node validate-slack-tokens.js
```

If successful, run the direct test:
```bash
npm run test:slack-direct
```

## 🔍 Common Issues & Solutions

### "App not installed" Error
- **Solution**: Install/reinstall the app in your workspace
- Go to **"Install App"** and click **"Install to Workspace"**

### "Invalid scopes" Error
- **Solution**: Add the required bot token scopes listed above
- After adding scopes, reinstall the app

### "Socket mode not enabled" Error
- **Solution**: Enable Socket Mode in your app settings
- Go to **"Socket Mode"** and toggle it on

### "Token mismatch" Error
- **Solution**: Ensure you're copying the right tokens:
  - Bot token starts with `xoxb-`
  - App token starts with `xapp-`
  - Signing secret is a long hex string

## 🎯 Quick Test Commands

After fixing the tokens, test with these commands:

```bash
# Validate tokens
node validate-slack-tokens.js

# Test direct Slack integration
npm run test:slack-direct

# Test simple Slack connection
npm run test:slack-simple
```

## 📱 Expected Success Output

When working correctly, you should see:
```
✅ Bot Token Valid!
   - Bot User ID: U01234567
   - Bot Name: HeyJarvis
   - Team ID: T01234567
   - Team Name: Your Workspace
```

## 🚨 Still Having Issues?

If the problem persists:
1. Create a completely new Slack app
2. Follow the setup steps from scratch
3. Use the new app's tokens

The most common cause is using tokens from an uninstalled or misconfigured app.
