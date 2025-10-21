# 🔧 Fix Teams Authentication Timeout

## Problem
Error: `Failed to connect to teams: Error invoking remote method 'microsoft:authenticate': reply was never sent`

## Root Causes Identified

### 1. Port Mismatch ✅ FIXED
- **Issue**: OAuth handler was listening on port 8889, but Azure redirect URI was set to port 8890
- **Fix**: Updated `mission-control-handlers.js` to use port 8890 to match `.env` configuration
- **Status**: ✅ Fixed in code

### 2. Missing Timeout Protection ✅ FIXED
- **Issue**: IPC handler could hang indefinitely if OAuth flow doesn't complete
- **Fix**: Added 2-minute timeout with `Promise.race()` to prevent hanging
- **Status**: ✅ Fixed in code

### 3. Azure App Configuration ⚠️ NEEDS VERIFICATION
- **Issue**: Azure app must support PKCE flow for desktop applications
- **Status**: ⚠️ Needs to be verified in Azure Portal

## Azure Portal Configuration Steps

### Step 1: Verify App Type
1. Go to https://portal.azure.com
2. Navigate to **App registrations**
3. Find your app: `ffd462f1-9c7d-42d9-9696-4c0e4a54132a`
4. Click on **Authentication** in the left menu

### Step 2: Configure Authentication Platform

You have TWO options:

#### Option A: Single Page Application (SPA) - RECOMMENDED for PKCE
1. Under **Platform configurations**, click **+ Add a platform**
2. Select **Single-page application**
3. Add redirect URI: `http://localhost:8890/auth/microsoft/callback`
4. Click **Configure**
5. Under **Implicit grant and hybrid flows**:
   - ❌ Access tokens (unchecked)
   - ❌ ID tokens (unchecked)
6. Click **Save**

#### Option B: Mobile and desktop applications
1. Under **Platform configurations**, click **+ Add a platform**
2. Select **Mobile and desktop applications**
3. Add custom redirect URI: `http://localhost:8890/auth/microsoft/callback`
4. Click **Configure**
5. Click **Save**

### Step 3: Enable Public Client Flow
1. Still in your app registration
2. Click **Authentication** in the left menu
3. Scroll down to **Advanced settings**
4. Under **Allow public client flows**:
   - Set **Enable the following mobile and desktop flows** to **Yes**
5. Click **Save**

### Step 4: Verify API Permissions
Make sure these permissions are granted:

**Microsoft Graph (Delegated)**:
- ✅ User.Read
- ✅ User.ReadBasic.All
- ✅ Mail.Send
- ✅ Mail.ReadWrite
- ✅ Calendars.ReadWrite
- ✅ Chat.ReadWrite
- ✅ ChatMessage.Read
- ✅ ChannelMessage.Send
- ✅ ChannelMessage.Read.All
- ✅ Team.ReadBasic.All
- ✅ Channel.ReadBasic.All
- ✅ OnlineMeetings.ReadWrite
- ✅ Presence.Read
- ✅ offline_access

**Grant Admin Consent:**
1. Click **Grant admin consent for [Your Organization]**
2. Click **Yes** to confirm

### Step 5: Remove Client Secret (Optional)
Since we're using PKCE (public client flow), you don't need a client secret:

1. Go to **Certificates & secrets**
2. You can delete the client secret (it won't be used with PKCE)
3. Or leave it - it won't interfere

## Testing the Fix

### 1. Restart Your App
```bash
# Kill any existing processes
pkill -f "electron"
pkill -f "node.*desktop2"

# Start fresh
npm run dev:desktop
```

### 2. Try Microsoft Authentication
1. Open the app
2. Go to Settings
3. Click **Connect** under Microsoft Teams
4. Browser should open for Microsoft login
5. After login, you should be redirected back
6. Connection should succeed within 2 minutes

### 3. Check Logs
Look for these log messages:

**Success:**
```
✅ Starting Microsoft OAuth flow
✅ OAuth server started on port 8890
✅ Authorization URL generated
✅ Successfully authenticated with Microsoft
✅ Microsoft authenticated successfully
```

**Timeout (if still failing):**
```
❌ Authentication timeout - please try again
```

**Port Conflict:**
```
❌ Port 8890 is already in use
```

## Troubleshooting

### If you get "Port already in use"
```bash
# Find and kill process using port 8890
lsof -ti:8890 | xargs kill -9

# Or use the kill script
./kill-oauth-ports.sh
```

### If authentication still times out
1. Check browser console for errors
2. Verify redirect URI in Azure exactly matches: `http://localhost:8890/auth/microsoft/callback`
3. Make sure you're not behind a corporate firewall blocking localhost redirects
4. Try clearing browser cookies for `login.microsoftonline.com`

### If you get "AADSTS" errors
- **AADSTS700025**: App is configured as public client but using client secret
  - Solution: Follow Option A or B above to configure as SPA or Mobile app
- **AADSTS50011**: Redirect URI mismatch
  - Solution: Verify redirect URI in Azure matches exactly
- **AADSTS65001**: User consent required
  - Solution: Grant admin consent in API permissions

## Code Changes Made

### 1. Fixed Port Mismatch
**File**: `desktop2/main/ipc/mission-control-handlers.js`
```javascript
// Before
port: 8889,
redirectUri: 'http://localhost:8889/auth/microsoft/callback'

// After
port: 8890,
redirectUri: 'http://localhost:8890/auth/microsoft/callback'
```

### 2. Added Timeout Protection
**File**: `desktop2/main/ipc/mission-control-handlers.js`
```javascript
// Add timeout to prevent hanging indefinitely
const authPromise = microsoftOAuthHandler.startAuthFlow();
const timeoutPromise = new Promise((_, reject) => {
  setTimeout(() => reject(new Error('Authentication timeout - please try again')), 120000);
});

const authResult = await Promise.race([authPromise, timeoutPromise]);
```

## Environment Variables
Verify your `.env` file has:
```bash
MICROSOFT_CLIENT_ID=ffd462f1-9c7d-42d9-9696-4c0e4a54132a
MICROSOFT_CLIENT_SECRET=Jih8Q~ifVRPlf0qI1-hOxzjpD_9abV2Ox1tJLc-A
MICROSOFT_REDIRECT_URI=http://localhost:8890/auth/microsoft/callback
```

## Expected Behavior After Fix

1. Click "Connect" for Microsoft Teams
2. Browser opens to Microsoft login page
3. Sign in with your Microsoft account
4. Browser shows "✅ Authentication Successful!"
5. Browser tab closes automatically
6. Settings page shows "✅ Connected" with your email
7. You can now use Microsoft Teams features

## Next Steps

1. ✅ Code changes are complete
2. ⚠️ Configure Azure app (follow steps above)
3. 🧪 Test authentication
4. 🎉 Start using Teams integration!

