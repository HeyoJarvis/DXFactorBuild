# Azure App Configuration Fix for Desktop Apps

## The Issue
Your HeyJarvis app is a **desktop application**, but it was configured in Azure as a **web application** with a client secret. Desktop apps should use **public client flow** without secrets.

## Required Azure Configuration Changes

### Step 1: Change Platform Type

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** → **App registrations**
3. Select your **HeyJarvis** app
4. Go to **Authentication** in the left sidebar

### Step 2: Remove Web Platform (if exists)

If you see a "Web" platform with redirect URI:
1. Click the **trash icon** to remove it
2. Confirm deletion

### Step 3: Add Mobile and Desktop Platform

1. Click **+ Add a platform**
2. Select **Mobile and desktop applications**
3. In the redirect URIs section:
   - Check the box for: `https://login.microsoftonline.com/common/oauth2/nativeclient` (optional)
   - Add custom redirect URI: `http://localhost:8889/auth/microsoft/callback`
4. Click **Configure**

### Step 4: Enable Public Client Flow

1. Still in **Authentication** section
2. Scroll down to **Advanced settings**
3. Find **Allow public client flows**
4. Toggle it to **Yes**
5. Click **Save** at the top

### Step 5: Remove Client Secret (Optional but Recommended)

Since desktop apps don't use secrets:
1. Go to **Certificates & secrets**
2. You can delete the client secret (it won't be used anymore)
3. Or keep it for reference (it will be ignored)

## Summary of Changes

| Setting | Old Value | New Value |
|---------|-----------|-----------|
| Platform | Web | Mobile and desktop applications |
| Redirect URI | Web redirect | `http://localhost:8889/auth/microsoft/callback` |
| Client Secret | Required | Not used (public client) |
| Allow public client flows | No | **Yes** ✅ |

## After Making Changes

1. **Save** all changes in Azure Portal
2. **Restart HeyJarvis**: `npm run dev:desktop`
3. **Click the Microsoft button** in HeyJarvis
4. **Authenticate** - it should work now!

## Why This Fix is Needed

- **Desktop apps** run on user devices (not secure servers)
- They can't securely store client secrets
- Microsoft requires **public client flow** with **PKCE** for security
- Web apps use confidential client flow with secrets
- We switched from `ConfidentialClientApplication` to `PublicClientApplication` in the code

## Verification

After making changes, you should see:
- ✅ No "client_secret" error
- ✅ PKCE working correctly
- ✅ Browser opens for authentication
- ✅ Successful sign-in
- ✅ Green button in HeyJarvis

---

**Make these changes in Azure Portal, then restart HeyJarvis!**
