# 🚨 QUICK FIX: Azure App Configuration

## The Error
```
AADSTS9002327: Tokens issued for the 'Single-Page Application' client-type 
may only be redeemed via cross-origin requests
```

This means Azure thinks your app is a **Single-Page Application (SPA)** but HeyJarvis is a **desktop app**.

---

## 🔧 Fix in 3 Steps (Takes 2 minutes)

### Step 1: Go to Azure Portal Authentication Page

1. Open: https://portal.azure.com
2. Go to: **Azure Active Directory** → **App registrations**
3. Click on your **HeyJarvis** app
4. Click **Authentication** in the left sidebar

---

### Step 2: Remove the SPA Platform

Look for a section that says **"Single-page application"** with your redirect URI.

**DELETE IT:**
1. Find the platform card labeled **"Single-page application"**
2. Click the **trash can icon** 🗑️ on that card
3. Confirm deletion

---

### Step 3: Add Mobile and Desktop Platform

1. Click the **"+ Add a platform"** button
2. Select **"Mobile and desktop applications"** (NOT Single-page application, NOT Web)
3. In the **Custom redirect URIs** section, add:
   ```
   http://localhost:8889/auth/microsoft/callback
   ```
4. Click **"Configure"** button at the bottom

---

### Step 4: Enable Public Client Flows

Still on the **Authentication** page:

1. Scroll down to **"Advanced settings"**
2. Find **"Allow public client flows"**
3. Toggle it to **"Yes"**
4. Click **"Save"** at the top of the page

---

## ✅ Verification

After saving, your Authentication page should show:

```
Platform configurations:
  ✅ Mobile and desktop applications
     - Redirect URIs: http://localhost:8889/auth/microsoft/callback
  
  ❌ Single-page application (should be REMOVED)
  ❌ Web (should be REMOVED)

Advanced settings:
  ✅ Allow public client flows: Yes
```

---

## 🚀 After Making Changes

1. **No need to restart HeyJarvis** - just try authenticating again
2. Click the Microsoft button
3. Sign in
4. It should work now!

---

## 📸 What You Should See in Azure

### BEFORE (Wrong ❌):
```
Platform: Single-page application
Redirect URI: http://localhost:8889/auth/microsoft/callback
```

### AFTER (Correct ✅):
```
Platform: Mobile and desktop applications  
Redirect URI: http://localhost:8889/auth/microsoft/callback
Allow public client flows: Yes
```

---

## Still Having Issues?

If you still see errors after making these changes:
1. Make sure you clicked **"Save"** in Azure Portal
2. Wait 30 seconds for changes to propagate
3. Try authenticating again in HeyJarvis
4. Check that you selected **"Mobile and desktop"** not **"Single-page application"**

---

**The key is: DELETE the SPA platform, ADD the Mobile and desktop platform!**
