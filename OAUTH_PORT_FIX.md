# 🔧 OAuth Port Conflict Fix

## Problem
All OAuth integrations were using the same port (8890), causing conflicts when multiple integrations tried to authenticate simultaneously.

## Solution ✅
Assigned unique ports to each integration:

| Integration | Port | Redirect URI |
|------------|------|--------------|
| **Microsoft Teams** | 8890 | `http://localhost:8890/auth/microsoft/callback` |
| **JIRA** | 8892 | `http://localhost:8892/auth/jira/callback` |
| **Google** | 8893 | `http://localhost:8893/auth/google/callback` |
| **Slack** | 8888 | `http://localhost:8888/auth/callback` |

## Changes Made

### 1. Updated `.env` File ✅
```bash
# Microsoft Teams Integration (Port 8890)
MICROSOFT_REDIRECT_URI=http://localhost:8890/auth/microsoft/callback

# JIRA Integration (Port 8892)
JIRA_REDIRECT_URI=http://localhost:8892/auth/jira/callback

# Google Integration (Port 8893)
GOOGLE_REDIRECT_URI=http://localhost:8893/auth/google/callback
```

### 2. Updated OAuth Handler Initializations ✅

**Files Modified:**
- `desktop2/main/ipc/mission-control-handlers.js` - Microsoft port 8890, Google port 8893
- `desktop2/main/ipc/jira-handlers.js` - JIRA port 8892
- `desktop2/main/services/GoogleService.js` - Google port 8893

## ⚠️ **Action Required: Update OAuth Apps**

You must update the redirect URIs in each provider's developer console:

### Microsoft Azure Portal
1. Go to https://portal.azure.com
2. Navigate to **App registrations**
3. Select your app: `ffd462f1-9c7d-42d9-9696-4c0e4a54132a`
4. Click **Authentication**
5. **Verify** redirect URI is: `http://localhost:8890/auth/microsoft/callback`
6. ✅ Port 8890 (no change needed)

### JIRA Developer Console
1. Go to https://developer.atlassian.com/console/myapps/
2. Select your app
3. Click **Authorization** or **OAuth 2.0**
4. **Update** redirect URI to: `http://localhost:8892/auth/jira/callback`
5. ⚠️ **Changed from port 8890 to 8892**
6. Click **Save**

### Google Cloud Console
1. Go to https://console.cloud.google.com/apis/credentials
2. Select your OAuth 2.0 Client ID
3. Under **Authorized redirect URIs**
4. **Update** to: `http://localhost:8893/auth/google/callback`
5. ⚠️ **Changed from port 8890 to 8893**
6. Click **Save**

## Testing

After updating the redirect URIs, test each integration:

### Test Microsoft (Port 8890)
```bash
# Restart app
npm run dev:desktop

# In app: Settings → Microsoft Teams → Connect
# Should open browser on port 8890
```

### Test JIRA (Port 8892)
```bash
# In app: Settings → JIRA → Connect
# Should open browser on port 8892
```

### Test Google (Port 8893)
```bash
# In app: Settings → Google Workspace → Connect
# Should open browser on port 8893
```

## Benefits

✅ **No more port conflicts** - Each integration has its own port
✅ **Simultaneous authentication** - Can authenticate with multiple services at once
✅ **Better error messages** - Easier to debug which integration is failing
✅ **More reliable** - No race conditions for port access

## Troubleshooting

### "Port already in use" error
```bash
# Kill all OAuth ports
lsof -ti:8890 | xargs kill -9
lsof -ti:8891 | xargs kill -9
lsof -ti:8892 | xargs kill -9
```

### "Redirect URI mismatch" error
- Verify the redirect URI in the provider's console matches exactly
- Check for typos (http vs https, port number, path)
- Wait 1-2 minutes after updating for changes to propagate

### Integration still failing
1. Check logs: `~/Library/Application Support/heyjarvis-desktop2/logs/main.log`
2. Verify `.env` file has correct redirect URIs
3. Restart the app completely
4. Try authentication again

## Port Assignment Strategy

Ports were assigned sequentially:
- **8888**: Slack (auth callback)
- **8890**: Microsoft Teams (most commonly used)
- **8892**: JIRA 
- **8893**: Google

Future integrations should use:
- **8894**: GitHub OAuth (if needed)
- **8895**: HubSpot OAuth (if needed)
- **8896**: Additional integrations

## Files Modified

- ✅ `.env` - Updated redirect URIs with new ports
- ✅ `desktop2/main/ipc/mission-control-handlers.js` - Google port 8892
- ✅ `desktop2/main/ipc/jira-handlers.js` - JIRA port 8891
- ✅ `desktop2/main/services/GoogleService.js` - Google port 8892

## Next Steps

1. ✅ Code changes complete
2. ⚠️ **Update JIRA redirect URI** in Atlassian Developer Console
3. ⚠️ **Update Google redirect URI** in Google Cloud Console
4. ✅ Microsoft redirect URI already correct (port 8890)
5. 🧪 Test all integrations
6. 🎉 Enjoy conflict-free OAuth!

