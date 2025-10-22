# 🔧 JIRA OAuth Setup Guide

## Issue You're Experiencing

Error: "Hmm... We're having trouble logging you in. There seems to be an issue with your identity provider."

**Root Cause**: The redirect URI in your Atlassian OAuth app doesn't match the redirect URI in your application.

## ✅ Solution: Update Your Atlassian OAuth App

### Step 1: Go to Atlassian Developer Console

1. Visit: https://developer.atlassian.com/console/myapps/
2. Log in with your Atlassian account
3. Find your OAuth app (Client ID: `TjIg9dz6...`)

### Step 2: Update the Redirect URI

1. Click on your app
2. Go to **"Settings"** or **"Authorization"** tab
3. Find **"Callback URL"** or **"Redirect URI"** section
4. **Update it to**: `http://localhost:8892/auth/jira/callback`
5. **Save changes**

### Step 3: Verify OAuth Scopes

Make sure your app has these scopes enabled:
- ✅ `read:jira-work` - Read Jira project and issue data
- ✅ `read:jira-user` - Read user information
- ✅ `offline_access` - Get refresh tokens

### Step 4: Get Your Cloud ID (If Needed)

Your JIRA OAuth app needs to know which Atlassian site to connect to:

1. Go to: https://yoursite.atlassian.net/_edge/tenant_info
   - Replace `yoursite` with your actual Atlassian site name
2. Copy the `cloudId` value
3. You may need this later

### Step 5: Test the Connection

1. Close all browser tabs with Atlassian
2. Restart the Team Sync app (or just close the error page)
3. Go to **Settings** → Click **"Connect JIRA"** again
4. You should now see the proper authorization page

## 🔍 Troubleshooting

### If you still see the error:

**Problem: App not found or disabled**
- Make sure your OAuth app is **enabled** in the Atlassian Developer Console
- Check that the app status is "Active"

**Problem: Missing scopes**
- Your app needs the scopes listed above
- Re-authorize if you add new scopes

**Problem: Wrong Atlassian site**
- Make sure you're logging into the correct Atlassian account
- Some companies have multiple Atlassian organizations

**Problem: Callback URL still wrong**
- Double-check the redirect URI is **exactly**: `http://localhost:8892/auth/jira/callback`
- No extra slashes, no https, no different port

### If you don't have a JIRA OAuth app yet:

1. Go to https://developer.atlassian.com/console/myapps/
2. Click **"Create"** → **"OAuth 2.0 integration"**
3. Name it: "Team Sync Intelligence"
4. Set permissions: Jira API
5. Add callback URL: `http://localhost:8892/auth/jira/callback`
6. Add scopes: `read:jira-work`, `read:jira-user`, `offline_access`
7. Click **"Save"**
8. Copy the **Client ID** and **Client Secret** to your `.env` file

## 📝 Current Configuration

Your `.env` is now set to:
```
JIRA_CLIENT_ID=TjIg9dz6rmiUs30oS1rsUhsvGCRkfcOY
JIRA_CLIENT_SECRET=ATOATqxbZJkVsPSO59V2G9VI3sQIXPO_ocbOANACDL6C__R4OaOXQilmLMyfY_K82jX2002017BB
JIRA_REDIRECT_URI=http://localhost:8892/auth/jira/callback
```

Your Atlassian app redirect URI **must match** this exactly.

## 🎯 Next Steps

1. Update the redirect URI in Atlassian Developer Console
2. Restart the Team Sync app: `npm run dev`
3. Try connecting to JIRA again from Settings
4. You should see a proper authorization screen
5. After authorizing, you'll be redirected back to the app

## ✅ Success Indicators

You'll know it's working when:
- Browser opens to: `https://auth.atlassian.com/authorize?...`
- You see a screen asking to authorize "Team Sync Intelligence"
- After clicking "Accept", you're redirected back
- Settings page shows "✓ Connected" for JIRA
- Dashboard shows JIRA issues

