# Direct OAuth Setup Guide

**✅ No Supabase Auth needed! We're using your existing OAuth servers directly.**

## 🎯 What Changed

Instead of using Supabase Auth (which was causing the Azure token exchange errors), the Electron app now:

1. **Uses your existing OAuth server** (`oauth/electron-oauth-server.js`) on port `8890`
2. **Polls for auth completion** instead of using Supabase's auth flow
3. **Directly creates/updates users** in Supabase database using the service role key
4. **Stores sessions locally** in Electron secure storage

## 🚀 Quick Start

### 1. Start the OAuth Server

```bash
# Terminal 1 - Start OAuth server
cd /Users/jarvis/Code/HeyJarvis
node oauth/electron-oauth-server.js
```

You should see:
```
🔐 OAuth Server running on port 8890

📍 OAuth URLs:
   Slack:     http://localhost:8890/auth/slack
   Microsoft: http://localhost:8890/auth/microsoft
   Google:    http://localhost:8890/auth/google
   Status:    http://localhost:8890/auth/status
```

### 2. Start the Electron App

```bash
# Terminal 2 - Start Electron app
cd /Users/jarvis/Code/HeyJarvis/desktop2
npm run dev
```

### 3. Test Login

Click **"Sign in with Microsoft Teams"** or **"Sign in with Slack"**

The app will:
1. Open your browser to the OAuth provider
2. You authorize the app
3. OAuth server receives the callback
4. Electron app polls `/auth/status` endpoint
5. User is created/updated in Supabase
6. Session stored locally ✅

## 🔧 How It Works

### OAuth Flow

```
┌─────────────┐
│ Electron App│
└──────┬──────┘
       │
       │ 1. Call signInWithMicrosoft()
       ▼
┌─────────────────────────┐
│ AuthService.js          │
│ - Opens browser         │
│ - Polls /auth/status    │
└──────┬──────────────────┘
       │
       │ 2. Browser opens
       ▼
┌─────────────────────────┐
│ OAuth Server :8890      │
│ - /auth/microsoft       │
│ - Redirects to Azure    │
└──────┬──────────────────┘
       │
       │ 3. User authorizes
       ▼
┌─────────────────────────┐
│ Azure AD                │
│ - User signs in         │
│ - Redirects back        │
└──────┬──────────────────┘
       │
       │ 4. Callback with code
       ▼
┌─────────────────────────┐
│ OAuth Server :8890      │
│ - Exchanges code        │
│ - Gets user data        │
│ - Stores in memory      │
└──────┬──────────────────┘
       │
       │ 5. Electron polls
       ▼
┌─────────────────────────┐
│ AuthService.js          │
│ - Gets user data        │
│ - Creates user in DB    │
│ - Saves session locally │
└─────────────────────────┘
```

### Key Files Modified

1. **`desktop2/main/services/AuthService.js`**
   - Added `signInWithMicrosoft()` - polls OAuth server
   - Added `signInWithGoogle()` - polls OAuth server
   - Modified `signInWithSlack()` - uses OAuth server
   - Added `waitForOAuthCallback()` - polls status endpoint
   - Added `handleDirectAuth()` - creates users directly in Supabase

2. **`oauth/electron-oauth-server.js`** (NEW)
   - Simple Express server on port 8890
   - Handles Slack, Microsoft, Google OAuth
   - Exposes `/auth/status` endpoint for polling
   - Returns user data after successful auth

3. **`desktop2/bridge/preload.js`**
   - Added `signInWithMicrosoft()` to electronAPI
   - Added `signInWithGoogle()` to electronAPI

4. **`desktop2/main/ipc/auth-handlers.js`**
   - Added `auth:signInWithMicrosoft` IPC handler
   - Added `auth:signInWithGoogle` IPC handler

5. **`desktop2/renderer2/src/pages/Login.jsx`**
   - Changed to call `signInWithMicrosoft()` instead of `signInWithTeams()`
   - Removed "Setup Required" badge

## 🎨 Benefits

✅ **No Supabase Auth configuration needed**
✅ **No Azure Tenant ID issues**
✅ **Works on any machine** (just need OAuth credentials in .env)
✅ **Full control** over the auth flow
✅ **Easy to debug** (check OAuth server logs)
✅ **Supports multiple providers** (Slack, Microsoft, Google)

## 🔐 Security

- OAuth server runs locally (localhost:8890)
- User data stored in Supabase with service role key
- Sessions stored in encrypted Electron store
- No tokens exposed to renderer process
- Each provider validates independently

## 🐛 Troubleshooting

### OAuth Server Not Starting
```bash
# Check if port 8890 is in use
lsof -i :8890

# Kill existing process
kill -9 <PID>

# Restart OAuth server
node oauth/electron-oauth-server.js
```

### Login Fails with "Authentication timeout"
- Check OAuth server is running: `curl http://localhost:8890/health`
- Check browser opened OAuth page
- Check .env has correct OAuth credentials
- Check OAuth server logs for errors

### User Not Created in Supabase
- Verify `SUPABASE_SERVICE_ROLE_KEY` in .env
- Check Supabase users table exists
- Check AuthService logs for database errors

## 📝 Environment Variables Required

```bash
# Slack OAuth
SLACK_CLIENT_ID=your_slack_client_id
SLACK_CLIENT_SECRET=your_slack_client_secret

# Microsoft OAuth
MICROSOFT_CLIENT_ID=ffd462f1-9c7d-42d9-9696-4c0e4a54132a
MICROSOFT_CLIENT_SECRET=Jih8Q~ifVRPlf0qI1-hOxzjpD_9abV2Ox1tJLc-A

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Supabase (for storing users)
SUPABASE_URL=https://ydbujcuddfgiubjjajuq.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Encryption (for local session storage)
ENCRYPTION_KEY=5a81bfda1131cbf2e3bd23cdfdecd5119bd29d50b2154308f26ab46c43aff418
```

## 🎉 Success!

You should now be able to:
1. Start OAuth server
2. Start Electron app
3. Click "Sign in with Microsoft Teams"
4. Browser opens → you authorize
5. Electron app logs you in ✅
6. Onboarding flow begins if first time
7. Main app loads 🚀

**No more Supabase Auth configuration needed!** 🎊

