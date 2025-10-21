# 🔐 Microsoft Teams/Azure AD Authentication Setup

## Overview

Microsoft Teams authentication works through **Azure AD (Microsoft Entra ID)**. Supabase calls this the **"Azure" provider**.

**Current Status:**
- ✅ Code is implemented and ready
- ⚠️ Needs Azure provider configuration in Supabase
- ✅ You already have Azure App credentials in `.env`

---

## 📋 Setup Steps

### Step 1: Enable Azure Provider in Supabase

1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/ydbujcuddfgiubjjajuq
2. Navigate to **Authentication** → **Providers**
3. Scroll down and find **Azure**
4. Click to enable it

### Step 2: Configure Azure Provider

In the Azure provider settings, enter:

```
Azure Application (client) ID:
ffd462f1-9c7d-42d9-9696-4c0e4a54132a

Azure Application (client) Secret:
MMv8Q~h6XiI5w1Jtp3SDsGeOmeq~s3vBg1j65b49

Azure Tenant:
common
```

**Note:** `common` allows any Microsoft account (personal or work/school). Use a specific tenant ID to restrict to your organization.

### Step 3: Update Azure App Registration

1. Go to Azure Portal: https://portal.azure.com
2. Navigate to **Azure Active Directory** → **App registrations**
3. Find your app (Client ID: `ffd462f1-9c7d-42d9-9696-4c0e4a54132a`)
4. Go to **Authentication** → **Platform configurations** → **Web**
5. Add this redirect URI:

```
https://ydbujcuddfgiubjjajuq.supabase.co/auth/v1/callback
```

6. **Save**

### Step 4: Test the Integration

1. In your HeyJarvis app, click **Logout** (in Settings)
2. On the login screen, click **Sign in with Microsoft Teams**
3. You'll be redirected to Microsoft login
4. Sign in with your Microsoft account
5. Grant permissions
6. You'll be redirected back to HeyJarvis!

---

## 🔧 Troubleshooting

### Error: "Provider not enabled"

**Cause:** Azure provider not enabled in Supabase

**Fix:** Complete Step 1 & 2 above

### Error: "Redirect URI mismatch"

**Cause:** Supabase redirect URL not added to Azure App

**Fix:** Complete Step 3 above

### Error: "Invalid client secret"

**Cause:** Wrong client secret in Supabase

**Fix:** Double-check the secret in `.env` matches what's in Azure Portal and Supabase

---

## 🎯 What Users Will See

### Login Flow:
1. Click "Sign in with Microsoft Teams"
2. → Microsoft login page (login.microsoftonline.com)
3. → Enter email/password or use SSO
4. → Grant permissions to HeyJarvis
5. → Redirected back to HeyJarvis
6. → Onboarding flow (role selection, integrations)

### User Identity Stored:
```sql
users table:
- microsoft_user_id: User's Azure AD object ID
- microsoft_tenant_id: Their tenant ID
- microsoft_email: Their Microsoft email
- primary_auth_provider: 'microsoft'
```

---

## 🔐 Security Notes

### Tenant Configuration

**`common` (current setting):**
- ✅ Allows any Microsoft account
- ✅ Works for personal and work accounts
- ⚠️ Less secure for enterprise

**Specific Tenant ID (recommended for production):**
- ✅ Only allows users from your organization
- ✅ More secure
- ✅ Better for enterprise deployment

To use a specific tenant:
1. Get your Azure AD Tenant ID from Azure Portal
2. Replace `common` with your tenant ID in Supabase configuration

### Permissions/Scopes

The Azure provider will request these default scopes:
- `openid` - User identity
- `profile` - Basic profile info
- `email` - Email address

These are the minimum needed for authentication.

---

## 📊 Testing Checklist

After setup, test:

- [ ] Click "Sign in with Microsoft Teams"
- [ ] Microsoft login page opens
- [ ] Can login with Microsoft account
- [ ] Redirected back to HeyJarvis
- [ ] User data saved in database
- [ ] `microsoft_user_id` populated
- [ ] `microsoft_email` populated
- [ ] Onboarding flow works
- [ ] Can logout and login again

---

## 🚀 Alternative: Remove Teams Login

If you don't want to set up Azure AD right now, you can remove the Teams button:

**Option 1: Hide it completely**
```jsx
// In desktop2/renderer2/src/pages/Login.jsx
// Comment out or delete the teams-button section
```

**Option 2: Keep it disabled (current)**
- The button shows "Setup Required" badge
- Users see it but know it needs configuration

---

## 💡 Quick Summary

**What is it?**
- Microsoft Teams uses Azure AD for authentication
- Same login as Office 365, Outlook, Teams, etc.
- Single Sign-On (SSO) for enterprise users

**Why use it?**
- Enterprise customers expect it
- Seamless integration with M365 ecosystem
- SSO reduces friction

**What's needed?**
- 5 minutes to configure in Supabase
- Add redirect URL in Azure Portal
- That's it!

---

**Ready to enable? Follow the steps above!** 🎉

Or keep using Slack-only auth for now - that's working perfectly! ✅

