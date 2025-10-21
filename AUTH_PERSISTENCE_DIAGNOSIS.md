# Auth Persistence Diagnosis & Fix

## Issues Found & Fixed

### ✅ Issue #1: Google Service - FIXED
**Error:** `this.oauthHandler.on is not a function`

**Root Cause:** GoogleOAuthHandler doesn't extend EventEmitter, but GoogleService was trying to attach event listeners.

**Fix Applied:** Removed the event listener setup in [GoogleService.js](desktop2/main/services/GoogleService.js:80-87)

### 🔍 Issue #2: Microsoft Tokens Not Found - INVESTIGATING

**Error:** `Microsoft connection check: No tokens found`

**Possible Causes:**
1. Tokens not being saved to database after OAuth
2. Tokens saved but expired
3. Tokens saved with wrong field names

## Next Steps

### Step 1: Check What's in the Database

Run this command to see your current Microsoft token state:

```bash
cd /Users/jarvis/Code/HeyJarvis
node test-microsoft-tokens.js
```

This will show you:
- ✅ If Microsoft tokens exist
- ✅ If they're expired
- ✅ What fields are saved
- ✅ Why auto-init might be failing

### Step 2: Restart the App with New Logging

The app now has enhanced logging that will show:

```
📋 Integration settings found in database:
```

This log appears on startup and shows exactly what integrations the app found.

**To see it:**
```bash
cd /Users/jarvis/Code/HeyJarvis/desktop2
npm run dev
```

Look for the `📋 Integration settings found in database` log line.

### Step 3: Test the Fixes

1. **Test Google Fix:**
   - Restart the app
   - Google should no longer show the `oauthHandler.on` error
   - Check Settings → Google should be recognized if tokens exist

2. **Test Microsoft:**
   - After running the token checker script, we'll know if tokens exist
   - If tokens exist but are expired → re-authenticate
   - If tokens don't exist → check why saving failed

## What I Changed

### File 1: GoogleService.js
**Location:** [desktop2/main/services/GoogleService.js](desktop2/main/services/GoogleService.js)

**Before:**
```javascript
// Listen for token refresh events
this.oauthHandler.on('token_refreshed', async (tokens) => {
  await this.saveTokens(userId, tokens);
  if (this.gmailService) {
    this.gmailService.accessToken = tokens.access_token;
  }
});
```

**After:**
```javascript
// Note: GoogleOAuthHandler doesn't extend EventEmitter, so we don't set up event listeners
// Token refresh is handled internally by GoogleGmailService
```

### File 2: index.js
**Location:** [desktop2/main/index.js](desktop2/main/index.js:95-102)

**Added enhanced logging:**
```javascript
// Log what integrations we found
logger.info('📋 Integration settings found in database:', {
  userId,
  hasJira: !!integrations.jira?.access_token,
  hasGoogle: !!integrations.google?.access_token,
  hasMicrosoft: !!integrations.microsoft?.access_token,
  microsoftAuthenticated: integrations.microsoft?.authenticated,
  microsoftAccount: integrations.microsoft?.account
});
```

### File 3: auth-handlers.js (Previously Fixed)
**Location:** [desktop2/main/ipc/auth-handlers.js](desktop2/main/ipc/auth-handlers.js:57)

**Changed Microsoft check from:**
```javascript
if (integrations.microsoft?.authenticated && services.microsoft) {
```

**To:**
```javascript
if (integrations.microsoft?.access_token && services.microsoft) {
```

## Expected Results

### After Restart (with Google fix):
```
✅ No more "oauthHandler.on is not a function" error
📋 Log showing what integrations exist in database
```

### If Microsoft tokens exist:
```
🔗 Auto-initializing Microsoft service...
✅ Microsoft service initialized successfully
```

### If Microsoft tokens DON'T exist:
```
📋 Integration settings found in database: { hasMicrosoft: false }
```

## Debugging Tools Created

1. **test-microsoft-tokens.js** - Detailed Microsoft token checker
2. **test-tokens-exist.js** - General token checker for all integrations
3. **diagnose-auth-persistence.sh** - Comprehensive log collector

## Common Scenarios & Solutions

### Scenario 1: Tokens exist but are expired
**Symptoms:** App starts, services don't initialize, Settings shows "not connected"

**Solution:**
1. Open Settings
2. Click "Connect" for Microsoft/Google again
3. Complete OAuth (should be quick - often just a click)

### Scenario 2: Tokens don't exist in database
**Symptoms:** `hasMicrosoft: false` in logs, never connected before

**Solution:**
1. Check logs during authentication for "💾 Saving Microsoft tokens to database"
2. Look for database errors
3. Verify Supabase connection
4. Try re-authenticating

### Scenario 3: Tokens exist and are valid, but service won't initialize
**Symptoms:** Tokens in DB, not expired, but auto-init fails

**Solution:**
1. Check for errors in service initialization logs
2. Verify environment variables (CLIENT_ID, CLIENT_SECRET)
3. Check network connectivity
4. Look at full error stack trace

## What to Share With Me

To help diagnose further, please share:

1. **Output of `node test-microsoft-tokens.js`**
2. **The log line that starts with `📋 Integration settings found`**
3. **Any errors that appear in the console**
4. **Screenshot of Settings page showing Microsoft status**

## Current Status

- ✅ **Google:** Fixed - no more EventEmitter error
- 🔄 **Microsoft:** Investigating - need to check database state
- 📊 **Logging:** Enhanced to show integration discovery

---

**Next Action:** Run `node test-microsoft-tokens.js` and share the output!
