# 🚀 GitHub App Setup Guide

## Overview

This guide walks you through setting up GitHub App authentication for Team Sync Intelligence. GitHub Apps are more secure than Personal Access Tokens and recommended for production use.

---

## ✅ What Was Implemented

The following has been added to support GitHub App authentication:

1. **JWT Generation** (`_generateGitHubAppJWT`) - Creates signed JWT tokens using your app's private key
2. **Installation Token Fetching** (`_getInstallationAccessToken`) - Exchanges JWT for installation access tokens
3. **Auto Token Refresh** - Tokens automatically refresh before expiring (every 1 hour)
4. **Complete Integration** - Works seamlessly with existing GitHub services

---

## 📋 Step 1: Create a GitHub App

### 1.1 Go to GitHub App Settings

Visit: https://github.com/settings/apps/new

### 1.2 Fill in App Details

**Basic Information:**
- **GitHub App name**: `Team Sync Intelligence` (or your preferred name)
- **Homepage URL**: `http://localhost:5177`
- **Callback URL**: `http://localhost:8893/auth/github/callback`
- **Setup URL**: Leave empty
- **Webhook**: 
  - ✅ Uncheck "Active" (we don't need webhooks)

**Description:** (Optional)
```
Team Sync Intelligence app for aggregating GitHub activity with JIRA issues and meeting notes.
```

### 1.3 Set Permissions

**Repository permissions:**
- ✅ **Contents**: Read-only (to read commits)
- ✅ **Pull requests**: Read-only (to read PRs)
- ✅ **Metadata**: Read-only (automatically added)

**Account permissions:**
- ✅ **Email addresses**: Read-only

**Organization permissions:**
- None needed

### 1.4 Where can this GitHub App be installed?

- ✅ Select **"Only on this account"** (for personal use)
- OR select **"Any account"** (if sharing with team)

### 1.5 Create the App

Click **"Create GitHub App"** button at the bottom.

---

## 📝 Step 2: Get Your Credentials

After creating the app, you'll be on the app's settings page.

### 2.1 App ID

You'll see **App ID** at the top of the page (e.g., `123456`)

📋 **Copy this number** - you'll need it for your `.env` file.

### 2.2 Generate Private Key

1. Scroll down to **"Private keys"** section
2. Click **"Generate a private key"**
3. A `.pem` file will download (e.g., `team-sync-intelligence.2024-10-18.private-key.pem`)
4. **Save this file securely** - it's your app's secret credential

📁 **Move the file** to a safe location, like:
```bash
mkdir -p ~/.github-apps/
mv ~/Downloads/team-sync-intelligence.*.private-key.pem ~/.github-apps/
```

---

## 🔧 Step 3: Install the App

### 3.1 Install on Your Account

1. In the left sidebar, click **"Install App"**
2. Click **"Install"** next to your account name
3. Choose repository access:
   - **All repositories** (easiest, recommended)
   - OR **Only select repositories** (choose specific repos)
4. Click **"Install"**

### 3.2 Get Installation ID

After installing, you'll be redirected to a URL like:
```
https://github.com/settings/installations/12345678
```

The number at the end (`12345678`) is your **Installation ID**.

📋 **Copy this number** - you'll need it for your `.env` file.

**Alternative way to find Installation ID:**
1. Go to: https://github.com/settings/installations
2. Click **"Configure"** next to your app
3. Look at the URL - the number at the end is your Installation ID

---

## ⚙️ Step 4: Configure Environment Variables

Add these to your `.env` file:

```bash
# GitHub App Configuration
GITHUB_APP_ID=123456
GITHUB_APP_INSTALLATION_ID=12345678
GITHUB_APP_PRIVATE_KEY_PATH=/home/yourusername/.github-apps/team-sync-intelligence.2024-10-18.private-key.pem
```

**Replace with your actual values:**
- `GITHUB_APP_ID` - From Step 2.1
- `GITHUB_APP_INSTALLATION_ID` - From Step 3.2
- `GITHUB_APP_PRIVATE_KEY_PATH` - Path to your downloaded `.pem` file

**⚠️ Important:**
- Use **absolute path** for the private key (not relative)
- Keep the `.pem` file secure (don't commit to git!)
- Make sure the file is readable: `chmod 600 ~/.github-apps/*.pem`

---

## 🚀 Step 5: Connect in the App

### 5.1 Restart the App

```bash
cd /home/sdalal/test/BeachBaby/extra_feature_desktop
npm run dev
```

### 5.2 Connect GitHub

1. Open the app
2. Go to **Settings** tab
3. Find **GitHub** integration
4. Click **"Connect"** or **"Disconnect"** then **"Connect"** if already connected
5. You should see: "✅ GitHub App connected successfully!"

### 5.3 Verify in Logs

Check the logs for:
```json
{"message":"Using GitHub App authentication"}
{"message":"Requesting installation access token","appId":"123456","installationId":"12345678"}
{"message":"Installation access token obtained","expiresAt":"2024-10-18T02:00:00Z"}
{"message":"GitHub App connected successfully"}
```

---

## 🧪 Step 6: Test the Integration

### 6.1 Sync Data

1. Go to **Dashboard** tab
2. Wait for auto-sync or trigger manually
3. You should see:
   - Recent Pull Requests
   - Recent Commits
   - No more "Failed to fetch GitHub repositories" errors!

### 6.2 Check Database

Your `team_sync_integrations` table should now show:
```
service_name: github
access_token: ghs_... (real token, not "github_app")
token_expiry: 2024-10-18 02:00:00 (1 hour from now)
metadata: {"auth_type":"github_app","app_id":"123456","installation_id":"12345678"}
```

---

## 🔄 Token Lifecycle

### Automatic Token Refresh

The system automatically handles token refresh:

1. **Token Lifespan**: 1 hour
2. **Refresh Trigger**: When token expires in < 5 minutes
3. **Refresh Process**:
   - Generate new JWT from private key
   - Request new installation token from GitHub
   - Update database with new token
4. **Transparent**: Happens automatically during API calls

### What You See in Logs

```json
{"message":"GitHub App token expired or expiring soon, refreshing..."}
{"message":"Requesting installation access token"}
{"message":"Installation access token obtained","expiresAt":"2024-10-18T03:00:00Z"}
{"message":"GitHub App token refreshed"}
```

---

## 🔒 Security Best Practices

### Protect Your Private Key

✅ **DO:**
- Store outside of project directory
- Set restrictive permissions: `chmod 600 private-key.pem`
- Add to `.gitignore` if you must keep in project
- Use environment variables for paths
- Back up securely

❌ **DON'T:**
- Commit to git
- Share publicly
- Store in cloud storage
- Email or message

### Rotate Credentials

If your private key is compromised:

1. Go to GitHub App settings
2. Click **"Revoke"** on the old key
3. Generate a new private key
4. Update `.env` with new file path
5. Reconnect in the app

---

## 🐛 Troubleshooting

### Error: "Failed to generate JWT: ENOENT"

**Cause:** Private key file not found

**Fix:**
1. Check the path in `GITHUB_APP_PRIVATE_KEY_PATH`
2. Use absolute path: `/home/username/.github-apps/file.pem`
3. Verify file exists: `ls -la /path/to/file.pem`

### Error: "Failed to get installation access token: 401"

**Cause:** Invalid credentials

**Fix:**
1. Verify `GITHUB_APP_ID` is correct
2. Verify private key is for this app (not a different app)
3. Check private key format (should start with `-----BEGIN RSA PRIVATE KEY-----`)

### Error: "Failed to get installation access token: 404"

**Cause:** Invalid installation ID or app not installed

**Fix:**
1. Verify `GITHUB_APP_INSTALLATION_ID` is correct
2. Go to https://github.com/settings/installations
3. Ensure your app is installed
4. Get the correct installation ID from the URL

### Error: "Failed to fetch GitHub repositories: 403"

**Cause:** Missing permissions

**Fix:**
1. Go to GitHub App settings
2. Check **Repository permissions**:
   - Contents: Read
   - Pull requests: Read
   - Metadata: Read
3. Save permissions
4. May need to reinstall the app

### Token Not Refreshing

**Check:**
1. Logs show refresh attempts
2. Private key path is accessible
3. File permissions allow reading

**Force refresh:**
1. Disconnect GitHub in Settings
2. Connect again
3. New token will be generated

---

## 📊 Comparison: GitHub App vs Personal Access Token

| Feature | GitHub App | Personal Access Token |
|---------|------------|---------------------|
| **Security** | ✅ Higher (scoped, audited) | ⚠️ Lower (full access) |
| **Token Lifetime** | 1 hour (auto-refresh) | Never expires |
| **Setup Complexity** | More steps | 1 step |
| **Production Ready** | ✅ Yes | ⚠️ Not recommended |
| **Audit Logs** | ✅ Detailed | Basic |
| **Rate Limits** | Higher (5000/hour) | Lower (5000/hour per user) |
| **Organization Use** | ✅ Recommended | ❌ Not recommended |

---

## ✅ Checklist

Before using GitHub App in production:

- [ ] GitHub App created
- [ ] Private key downloaded and secured
- [ ] App installed on your account/org
- [ ] Environment variables set correctly
- [ ] App connects successfully
- [ ] Data syncs without errors
- [ ] Token refresh works automatically
- [ ] Private key backed up securely
- [ ] `.gitignore` includes private key path

---

## 📞 Support

**If you encounter issues:**

1. Check logs in `logs/main.log`
2. Verify all environment variables
3. Test GitHub App credentials:
   ```bash
   # Test app ID and installation
   curl -i -H "Authorization: Bearer YOUR_JWT" \
     https://api.github.com/app/installations/YOUR_INSTALLATION_ID
   ```
4. Review GitHub App settings and permissions

**Common GitHub App endpoints:**
- App info: `GET /app`
- Installation info: `GET /app/installations/{installation_id}`
- Create token: `POST /app/installations/{installation_id}/access_tokens`

---

**Last Updated:** 2024-10-18  
**Version:** 1.0  
**Status:** ✅ Production Ready


