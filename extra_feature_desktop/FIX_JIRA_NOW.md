# 🚨 FIX JIRA OAUTH - DO THIS NOW

## The Problem

Atlassian is rejecting your OAuth request because the redirect URI in your OAuth app **doesn't match** what the code is sending.

## The Solution (5 Minutes)

### Step 1: Open Atlassian Developer Console

**Click this link**: https://developer.atlassian.com/console/myapps/

### Step 2: Find Your App

Look for the app with:
- **Client ID**: `TjIg9dz6rmiUs30oS1rsUhsvGCRkfcOY`
- **Name**: Whatever you named it (probably "Team Sync" or similar)

Click on it.

### Step 3: Go to Authorization Settings

Look for one of these tabs:
- **"Settings"**
- **"Authorization"**
- **"OAuth 2.0"**

Click on it.

### Step 4: Find the Callback URL

You'll see a field labeled one of these:
- **"Callback URL"**
- **"Redirect URI"**
- **"Authorized redirect URIs"**

### Step 5: Update the URL

**Current value** (wrong): `http://localhost:8890/auth/jira/callback`

**Change it to**: `http://localhost:8892/auth/jira/callback`

⚠️ **CRITICAL**: The port must be **8892**, not 8890!

### Step 6: Save

Click **"Save"** or **"Update"** button.

### Step 7: Test Again

1. Close all Atlassian browser tabs
2. Go back to Team Sync app
3. Go to **Settings**
4. Click **"Connect JIRA"**
5. You should now see a proper authorization screen! ✅

---

## 🔍 What If You Can't Find the App?

### Option A: Create a New OAuth App

If you can't find your existing app, create a new one:

1. Go to https://developer.atlassian.com/console/myapps/
2. Click **"Create"** → **"OAuth 2.0 integration"**
3. **App name**: "Team Sync Intelligence"
4. **Callback URL**: `http://localhost:8892/auth/jira/callback`
5. Click **"Create"**
6. Go to **"Permissions"** tab
7. Add **"Jira API"** permission
8. Add these scopes:
   - `read:jira-work`
   - `read:jira-user`
   - `offline_access`
9. Click **"Configure"** and add the scopes
10. Go to **"Settings"** tab
11. Copy the **Client ID** and **Client Secret**
12. Update your `.env` file with the new credentials

### Option B: Check If You Have Multiple Atlassian Accounts

- You might be logged into the wrong Atlassian account
- Try logging out and logging back in
- Check if your company has a different Atlassian organization

---

## ✅ How to Know It's Fixed

**Before fix**: You see an error page with a yellow warning triangle

**After fix**: You see a page saying:
- "Authorize Team Sync Intelligence"
- "This app wants to access your Atlassian account"
- "Allow" button

---

## 🆘 Still Not Working?

If it's still not working after updating the redirect URI, the issue might be:

1. **App is disabled**: Check app status in Developer Console
2. **Missing permissions**: Make sure Jira API permissions are enabled
3. **Wrong Atlassian site**: Make sure you're using the right Atlassian organization
4. **Client ID/Secret wrong**: Double-check credentials in `.env`

---

## 📞 Need Help?

Share a screenshot of:
1. Your Atlassian Developer Console app settings page
2. The error you're seeing

This will help me debug further.

