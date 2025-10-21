# OAuth Redirect URI Fix - 401 Error

## 🚨 Problem

Getting **"Request failed with status code 401"** when trying to authenticate with Microsoft.

## 🎯 Root Cause

The OAuth server is using redirect URI: `http://localhost:8890/auth/microsoft/callback`

But your **Azure Portal App Registration** probably still has the old redirect URI: `http://localhost:8889/auth/microsoft/callback`

## ✅ Solution

### Option 1: Update Azure Portal (Recommended)

1. **Go to Azure Portal**: https://portal.azure.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/~/RegisteredApps

2. **Find your app**: Client ID `ffd462f1-9c7d-42d9-9696-4c0e4a54132a`

3. **Click "Authentication"** (left sidebar)

4. **Update Redirect URIs** to include:
   ```
   http://localhost:8890/auth/microsoft/callback
   ```

5. **Save**

6. **Try logging in again**

### Option 2: Quick Test with Different Port

If you want to test immediately without changing Azure, restart the OAuth server on port 8889:

<function_calls>
<invoke name="search_replace">
<parameter name="file_path">/Users/jarvis/Code/HeyJarvis/oauth/electron-oauth-server.js
