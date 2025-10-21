# 🔧 Azure Redirect URI Update - REQUIRED

## ❌ Current Error
```
Authentication Failed
Request failed with status code 401
```

## 🎯 Root Cause
Azure is still configured for port **8889**, but your app now uses port **8890**.

When Microsoft tries to redirect back to your app:
- Microsoft sends to: `http://localhost:8889/...` (Azure config)
- Your app listens on: `http://localhost:8890/...` (new config)
- Result: **401 Unauthorized** ❌

## ✅ Fix: Update Azure Portal

### Step-by-Step Instructions

1. **Open Azure Portal**
   - Go to: https://portal.azure.com
   - Sign in with your Microsoft account

2. **Navigate to App Registrations**
   - Search for "App registrations" in the top search bar
   - Click on **App registrations**

3. **Find Your HeyJarvis App**
   - Look for app with Client ID: `ffd462f1-9c7d-42d9-9696-4c0e4a54132a`
   - Or search by name if you named it "HeyJarvis"
   - Click on it

4. **Go to Authentication**
   - In the left sidebar, click **Authentication**

5. **Update Redirect URI**
   - Under **Platform configurations**, find **Web**
   - Look for the redirect URIs list
   - Find: `http://localhost:8889/auth/microsoft/callback`
   - Click the **pencil/edit icon** next to it
   - Change `8889` to `8890`
   - New value: `http://localhost:8890/auth/microsoft/callback`

6. **Save Changes**
   - Click **Save** at the top of the page
   - Wait for "Successfully updated" message

7. **Verify**
   - You should see: `http://localhost:8890/auth/microsoft/callback` in the list
   - Status should be green/active

## 🚀 After Updating Azure

1. **Close HeyJarvis app completely**
2. **Restart the app**
3. **Try "Sign in with Microsoft"** again
4. Should work! ✅

## 🔍 How to Verify OAuth Server is Running

Open your browser and go to:
```
http://localhost:8890/health
```

You should see:
```json
{
  "status": "healthy",
  "timestamp": "2025-10-18T..."
}
```

If you get "connection refused", the OAuth server isn't running (restart the app).

## 📋 Current Configuration

Your `.env` file (already updated ✅):
```env
MICROSOFT_CLIENT_ID=ffd462f1-9c7d-42d9-9696-4c0e4a54132a
MICROSOFT_CLIENT_SECRET=Jih8Q~ifVRPlf0qI1-hOxzjpD_9abV2Ox1tJLc-A
MICROSOFT_REDIRECT_URI=http://localhost:8890/auth/microsoft/callback
```

Azure Portal (needs update ❌):
```
Current: http://localhost:8889/auth/microsoft/callback
Needed:  http://localhost:8890/auth/microsoft/callback
```

## 🎯 Quick Checklist

- [x] `.env` file updated to port 8890
- [x] OAuth server starts on port 8890
- [ ] **Azure redirect URI updated to port 8890** ← YOU ARE HERE
- [ ] App restarted after Azure update
- [ ] Microsoft login tested

## 💡 Alternative: Add Both Ports

If you want to keep both configurations, you can ADD the new redirect URI without removing the old one:

In Azure Authentication:
1. Keep: `http://localhost:8889/auth/microsoft/callback`
2. Add: `http://localhost:8890/auth/microsoft/callback`
3. Save

This way both ports work (useful for testing).

## 🆘 Still Not Working?

If you still get 401 after updating Azure:

1. **Wait 2-3 minutes** - Azure changes can take time to propagate
2. **Clear browser cache** - Old OAuth sessions might be cached
3. **Check Azure logs** - Go to Azure Portal → Your App → Monitoring → Sign-in logs
4. **Verify client secret** - Make sure it hasn't expired

## 📞 Need Help?

The error "401 Unauthorized" specifically means:
- ✅ OAuth server is running
- ✅ Microsoft received the request
- ❌ Redirect URI doesn't match Azure configuration

This is 100% a redirect URI mismatch issue.

