# Authentication Setup Guide

## Current Issue: Email Logins Disabled

You're seeing the error "Email logins are disabled" because email authentication is not enabled in your Supabase project.

## Quick Fix: Enable Email Authentication in Supabase

**This takes 2 minutes and will get you up and running immediately:**

### Step 1: Enable Email Provider

1. **Go to Supabase Dashboard**: https://app.supabase.com
2. **Select your project**: `ydbujcuddfgiubjjajuq`
3. **Navigate to**: `Authentication` → `Providers` (left sidebar)
4. **Find "Email" provider** in the list
5. **Toggle it ON** (should turn green)
6. **Click "Save"** at the bottom

### Step 2: Disable Email Confirmation (IMPORTANT!)

**This is required** to avoid the "Please check your email to confirm" error:

1. **In the same Supabase Dashboard**, go to: `Authentication` → `Settings`
2. Scroll down to **"Email Auth"** section
3. Find **"Enable email confirmations"**
4. **Toggle it OFF** (should be gray/disabled)
5. **Click "Save"** at the bottom

![Disable Email Confirmation](https://supabase.com/docs/img/auth-settings.png)

### Step 3: Verify Settings

Your settings should now be:
- ✅ Email provider: **Enabled**
- ✅ Email confirmations: **Disabled**
- ✅ Minimum password length: **6 characters** (default)

## After Enabling Email Auth

1. Restart the Team Sync Intelligence app: `npm run dev`
2. Click **"Create Account"** on the login screen
3. Enter email: `shail@heyjarvis.ai` (or any email)
4. Enter a password (minimum 6 characters)
5. Click **"Sign Up"**
6. You'll be logged in automatically! ✅

## Alternative: OAuth Login (Recommended for Production)

I noticed you have **Slack, Microsoft, and Google OAuth** already configured in your `.env` file. Would you like me to add these as login options?

### Benefits of OAuth Login:

- ✅ **No password to remember** - users log in with existing accounts
- ✅ **More secure** - leverages enterprise SSO
- ✅ **Better UX** - one-click login with Slack/Google/Microsoft
- ✅ **Automatic team sync** - can pull user info from OAuth provider

### OAuth Implementation

If you want OAuth login, I can add:

1. **Slack OAuth** - "Sign in with Slack" button
2. **Microsoft OAuth** - "Sign in with Microsoft" button  
3. **Google OAuth** - "Sign in with Google" button
4. **Email/Password** - Keep as fallback option

The login screen would show all 4 options, letting users choose their preferred method.

---

## Troubleshooting

### Still seeing "Email logins are disabled"?

1. **Clear browser cache** in the Electron app (Ctrl+Shift+R)
2. **Restart the app** completely
3. **Check Supabase logs**: Dashboard → Logs → Auth logs
4. **Verify the toggle is ON**: Go back to Authentication → Providers

### "Invalid login credentials" error?

This means:
- The account doesn't exist yet (click "Create Account")
- OR the password is incorrect (try "Forgot Password")

### Want to reset and start fresh?

1. Go to Supabase Dashboard → Authentication → Users
2. Delete any test users
3. Create a new account from the app

---

## Next Steps

After logging in successfully:

1. **Connect Microsoft Outlook**: Go to Settings → Connect Microsoft
2. **Connect Jira**: Go to Settings → Connect Jira  
3. **Optional - Connect GitHub**: Settings → Connect GitHub
4. **Start syncing**: Dashboard → Sync Now

See `FULL_SYSTEM_GUIDE.md` for complete usage instructions.

