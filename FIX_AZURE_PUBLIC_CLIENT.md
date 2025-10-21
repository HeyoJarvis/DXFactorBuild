# 🔧 Fix Azure Public Client Error

## Error
```
AADSTS700025: Client is public so neither 'client_assertion' nor 'client_secret' should be presented.
```

## Root Cause
Your Azure app is configured as a **Public Client** (mobile/desktop app), but we're trying to use it as a **Confidential Client** (web app) with a client secret.

## Solution: Reconfigure Azure App as Web Application

### Step 1: Go to Azure Portal

1. Open https://portal.azure.com
2. Search for "App registrations"
3. Find your app: `ffd462f1-9c7d-42d9-9696-4c0e4a54132a`

### Step 2: Remove Mobile/Desktop Platform (if exists)

1. Click **Authentication** in the left menu
2. Under **Platform configurations**, look for **Mobile and desktop applications**
3. If it exists, click the **trash/delete icon** to remove it
4. Click **Save**

### Step 3: Add Web Platform

1. Still in **Authentication** page
2. Click **+ Add a platform**
3. Select **Web** (not Mobile and desktop applications)
4. In the **Redirect URIs** field, enter:
   ```
   http://localhost:8890/auth/microsoft/callback
   ```
5. Under **Implicit grant and hybrid flows**:
   - ❌ Access tokens (not needed)
   - ✅ ID tokens (check this)
6. Click **Configure**

### Step 4: Verify Client Secret Exists

1. Click **Certificates & secrets** in the left menu
2. Under **Client secrets** tab
3. You should see a secret (might be expired)
4. If no secret or expired:
   - Click **+ New client secret**
   - Description: `HeyJarvis Desktop App`
   - Expires: 24 months (or your preference)
   - Click **Add**
   - **IMPORTANT:** Copy the **Value** immediately (you can't see it again!)
   - Update your `.env` file with the new secret

### Step 5: Verify Authentication Settings

In **Authentication** page, you should now see:

**Platform configurations:**
- ✅ **Web**
  - Redirect URI: `http://localhost:8890/auth/microsoft/callback`
  - ID tokens: ✅ Checked

- ❌ **Mobile and desktop applications** (should NOT exist)

### Step 6: Save and Test

1. Click **Save** at the top
2. Wait 1-2 minutes for changes to propagate
3. **Restart your HeyJarvis app**
4. Try Microsoft login again - should work! ✅

## Why This Happened

Azure has two types of applications:

### Public Client (Mobile/Desktop)
- ❌ Cannot use client secrets (not secure on user devices)
- Uses PKCE flow instead
- Your app was configured this way

### Confidential Client (Web/Server)
- ✅ Can use client secrets (secure on server)
- Runs on a trusted server
- What we need for the OAuth server

Since our OAuth server runs on localhost (acting as a server), we need the **Web/Confidential** configuration.

## Alternative: Use PKCE Flow (No Client Secret)

If you want to keep it as a public client, we'd need to modify the OAuth flow to use PKCE instead of client_secret. But the easier fix is to just make it a web app.

## Verify Configuration

After making changes, your Azure app should have:

1. **Overview:**
   - Application (client) ID: `ffd462f1-9c7d-42d9-9696-4c0e4a54132a`
   - Application type: **Web app / API** (not Native)

2. **Authentication:**
   - Platform: **Web**
   - Redirect URI: `http://localhost:8890/auth/microsoft/callback`

3. **Certificates & secrets:**
   - Active client secret exists

## Test After Fix

```bash
# Restart app
# Try Microsoft login
# Should see in logs:
✅ Token exchange successful
✅ Microsoft auth successful
```

No more `AADSTS700025` error!

