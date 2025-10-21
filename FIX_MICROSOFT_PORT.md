# 🔧 Fix Microsoft OAuth Port Mismatch

## Problem
Microsoft OAuth is configured for port **8889**, but the OAuth server runs on port **8890**.

Current configuration:
- `.env`: `MICROSOFT_REDIRECT_URI=http://localhost:8889/auth/microsoft/callback`
- OAuth Server: Running on port `8890`
- Result: Connection refused ❌

## Solution: Update to Port 8890

### Step 1: Update .env File

```bash
cd /Users/jarvis/Code/HeyJarvis
```

Change this line in `.env`:
```
MICROSOFT_REDIRECT_URI=http://localhost:8889/auth/microsoft/callback
```

To:
```
MICROSOFT_REDIRECT_URI=http://localhost:8890/auth/microsoft/callback
```

### Step 2: Update Azure App Registration

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** → **App registrations**
3. Find your app: `ffd462f1-9c7d-42d9-9696-4c0e4a54132a`
4. Go to **Authentication** → **Platform configurations** → **Web**
5. Update the redirect URI from:
   - `http://localhost:8889/auth/microsoft/callback`
   
   To:
   - `http://localhost:8890/auth/microsoft/callback`

6. Click **Save**

### Step 3: Restart the App

After making these changes:
1. Close the HeyJarvis app completely
2. Restart it
3. Try Microsoft login again - it should work! ✅

## Why This Happened

The OAuth server was originally set up with different ports:
- Microsoft: 8889 (older configuration)
- JIRA & Google: 8890 (newer configuration)

The new auto-start OAuth server uses port 8890 for consistency with JIRA and Google.

## Alternative: Run OAuth Server on Port 8889

If you don't want to change Azure, you can modify the OAuth server to use port 8889:

In `desktop2/main/index.js`, change:
```javascript
const PORT = 8890;
```

To:
```javascript
const PORT = 8889;
```

But this would break JIRA and Google, so updating Microsoft to 8890 is better.

## Quick Fix Command

```bash
# Update .env file
cd /Users/jarvis/Code/HeyJarvis
sed -i '' 's/localhost:8889/localhost:8890/g' .env

# Verify the change
grep MICROSOFT_REDIRECT_URI .env
```

Should show:
```
MICROSOFT_REDIRECT_URI=http://localhost:8890/auth/microsoft/callback
```

Then update Azure and restart the app!

