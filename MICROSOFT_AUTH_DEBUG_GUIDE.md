# 🔧 Microsoft Authentication Debug Guide

## Problem
**Error:** `Failed to connect to teams: Error invoking remote method 'microsoft:authenticate': reply was never sent`

This error means the IPC handler is not responding, which can happen for several reasons.

## Fixes Applied ✅

### 1. Port Mismatch Fixed
**File:** `desktop2/main/ipc/mission-control-handlers.js`
- Changed OAuth handler port from **8889** to **8890**
- Now matches `MICROSOFT_REDIRECT_URI` in `.env`

### 2. Timeout Protection Added
**File:** `desktop2/main/ipc/mission-control-handlers.js`
- Added 2-minute timeout to prevent indefinite hanging
- Uses `Promise.race()` to race auth promise vs timeout

### 3. Better Error Handling
**File:** `oauth/microsoft-oauth-handler.js`
- Improved server cleanup logic
- Added 500ms delay after closing server to ensure port release
- Better error messages for port conflicts

### 4. Debug Logging Added
**Files:** 
- `desktop2/main/ipc/mission-control-handlers.js`
- `oauth/microsoft-oauth-handler.js`

Added extensive logging to track:
- When IPC handler is called
- OAuth server lifecycle
- Authentication flow progress
- Error conditions

### 5. Diagnostic Tool Created
**File:** `desktop2/renderer2/src/pages/DiagnosticMicrosoft.jsx`

New diagnostic page to test authentication step-by-step.

## How to Use the Diagnostic Tool

### Step 1: Restart the App
```bash
# Kill any existing processes
pkill -f "electron.*desktop2"

# Start fresh
cd /Users/jarvis/Code/HeyJarvis
npm run dev:desktop
```

### Step 2: Open Diagnostic Page
1. In the app, manually navigate to: `/diagnostic-microsoft`
2. Or open DevTools (Cmd+Option+I) and run:
   ```javascript
   window.location.href = '/diagnostic-microsoft'
   ```

### Step 3: Run the Test
1. Click **"🧪 Run Diagnostic Test"**
2. Watch the logs in real-time
3. Browser should open for Microsoft login
4. Complete the OAuth flow
5. Check results

## What to Look For

### Success Scenario ✅
```
[timestamp] 🔍 Starting Microsoft authentication diagnostic...
[timestamp] 1️⃣  Checking if window.electronAPI exists...
[timestamp] ✅ window.electronAPI exists
[timestamp] 2️⃣  Checking if window.electronAPI.microsoft exists...
[timestamp] ✅ window.electronAPI.microsoft exists
[timestamp] 3️⃣  Checking if authenticate method exists...
[timestamp] ✅ authenticate method exists
[timestamp] 4️⃣  Calling window.electronAPI.microsoft.authenticate()...
[timestamp] ⏳ Waiting for response (timeout: 2 minutes)...
[timestamp] ✅ Got response after 5.23s
[timestamp] 🎉 Authentication successful!
[timestamp] Account: your.email@company.com
```

### Failure Scenarios

#### Scenario 1: IPC Handler Not Registered
```
[timestamp] ❌ window.electronAPI.microsoft is undefined!
```
**Solution:** Check that `registerMissionControlHandlers` is being called in `desktop2/main/index.js`

#### Scenario 2: Timeout
```
[timestamp] ⏳ Waiting for response (timeout: 2 minutes)...
[timestamp] ❌ Error after 120.00s: Authentication timeout - please try again
```
**Solution:** Check Azure app configuration (see below)

#### Scenario 3: Port Conflict
```
[timestamp] ❌ Error: Port 8890 is already in use
```
**Solution:** 
```bash
lsof -ti:8890 | xargs kill -9
```

#### Scenario 4: User Not Authenticated
```
[timestamp] ❌ Authentication failed: User not authenticated
```
**Solution:** Sign in to the app first before connecting Teams

## Azure Portal Configuration

The most common cause of timeout is incorrect Azure app configuration.

### Required Configuration

1. **Go to Azure Portal**
   - https://portal.azure.com
   - App registrations → `ffd462f1-9c7d-42d9-9696-4c0e4a54132a`

2. **Authentication Settings**
   - Click **Authentication** in left menu
   - Click **+ Add a platform**
   - Select **Single-page application** (SPA)
   - Add redirect URI: `http://localhost:8890/auth/microsoft/callback`
   - Click **Configure**

3. **Enable Public Client Flows**
   - Still in **Authentication** page
   - Scroll to **Advanced settings**
   - Under **Allow public client flows**:
     - Set to **Yes**
   - Click **Save**

4. **API Permissions**
   - Click **API permissions** in left menu
   - Ensure these are granted:
     - User.Read
     - User.ReadBasic.All
     - Mail.Send
     - Mail.ReadWrite
     - Calendars.ReadWrite
     - Chat.ReadWrite
     - ChatMessage.Read
     - ChannelMessage.Send
     - ChannelMessage.Read.All
     - Team.ReadBasic.All
     - Channel.ReadBasic.All
     - OnlineMeetings.ReadWrite
     - Presence.Read
     - offline_access
   - Click **Grant admin consent**

## Check Main Process Logs

### Option 1: Electron DevTools Console
1. Open app
2. Press `Cmd+Option+I` (macOS) or `Ctrl+Shift+I` (Windows)
3. Go to **Console** tab
4. Look for logs starting with:
   - `🔧 Registering Mission Control handlers...`
   - `🔵 microsoft:authenticate IPC handler called`
   - `Starting Microsoft OAuth flow`

### Option 2: Log Files
```bash
# Main process logs
tail -f ~/Library/Application\ Support/heyjarvis-desktop2/logs/main.log

# OAuth logs
tail -f /Users/jarvis/Code/HeyJarvis/logs/microsoft-oauth.log

# Graph service logs
tail -f /Users/jarvis/Code/HeyJarvis/logs/microsoft-graph.log
```

## Manual Test from DevTools

You can also test directly from the browser DevTools:

```javascript
// Test if API is available
console.log('electronAPI:', window.electronAPI);
console.log('microsoft:', window.electronAPI?.microsoft);
console.log('authenticate:', window.electronAPI?.microsoft?.authenticate);

// Try to authenticate
window.electronAPI.microsoft.authenticate()
  .then(result => console.log('✅ Success:', result))
  .catch(error => console.error('❌ Error:', error));
```

## Common Issues and Solutions

### Issue 1: "Reply was never sent"
**Cause:** IPC handler is hanging or not registered
**Solution:**
1. Check logs for `🔵 microsoft:authenticate IPC handler called`
2. If not present, handler isn't registered
3. Restart app to re-register handlers

### Issue 2: Browser doesn't open
**Cause:** OAuth server failed to start
**Solution:**
1. Check if port 8890 is available
2. Look for `OAuth server started on port 8890` in logs
3. Check for `EADDRINUSE` errors

### Issue 3: Browser opens but redirects to wrong port
**Cause:** Azure redirect URI doesn't match
**Solution:**
1. Verify `.env` has: `MICROSOFT_REDIRECT_URI=http://localhost:8890/auth/microsoft/callback`
2. Verify Azure app has same redirect URI
3. Restart app after changes

### Issue 4: "AADSTS" errors
**Cause:** Azure app misconfiguration
**Solution:** Follow Azure Portal Configuration steps above

## Environment Variables

Verify your `.env` file:

```bash
MICROSOFT_CLIENT_ID=ffd462f1-9c7d-42d9-9696-4c0e4a54132a
MICROSOFT_CLIENT_SECRET=Jih8Q~ifVRPlf0qI1-hOxzjpD_9abV2Ox1tJLc-A
MICROSOFT_REDIRECT_URI=http://localhost:8890/auth/microsoft/callback
```

## Testing Checklist

- [ ] Restart the app completely
- [ ] Navigate to `/diagnostic-microsoft`
- [ ] Run diagnostic test
- [ ] Check if browser opens
- [ ] Complete Microsoft login
- [ ] Verify success message
- [ ] Check main process logs
- [ ] Verify Azure app configuration
- [ ] Test from Settings page

## Next Steps

1. **Run the diagnostic tool** to identify the exact failure point
2. **Check the logs** in Electron DevTools console
3. **Verify Azure configuration** if timeout occurs
4. **Report back** with the diagnostic results

## Files Modified

- ✅ `desktop2/main/ipc/mission-control-handlers.js` - Fixed port, added timeout, added logging
- ✅ `oauth/microsoft-oauth-handler.js` - Improved error handling and cleanup
- ✅ `desktop2/renderer2/src/pages/DiagnosticMicrosoft.jsx` - New diagnostic tool
- ✅ `desktop2/renderer2/src/App.jsx` - Added diagnostic route
- ✅ `FIX_TEAMS_AUTH_TIMEOUT.md` - Comprehensive fix guide
- ✅ `test-microsoft-auth-fix.js` - CLI diagnostic script

## Quick Commands

```bash
# Restart app
pkill -f "electron.*desktop2" && npm run dev:desktop

# Check port usage
lsof -i:8890

# Kill port
lsof -ti:8890 | xargs kill -9

# Watch logs
tail -f ~/Library/Application\ Support/heyjarvis-desktop2/logs/main.log

# Run CLI diagnostic
node test-microsoft-auth-fix.js
```

---

**Need help?** Share the output from the diagnostic tool and the main process logs.

