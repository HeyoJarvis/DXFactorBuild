# ⚡ GitHub App Quick Start

## TL;DR - 5 Minutes Setup

### 1️⃣ Create GitHub App

Go to: https://github.com/settings/apps/new

**Required Settings:**
- Name: `Team Sync Intelligence`
- Homepage: `http://localhost:5177`
- Callback: `http://localhost:8893/auth/github/callback`
- Webhook: ❌ Uncheck "Active"
- Permissions:
  - ✅ Contents: Read
  - ✅ Pull requests: Read
- Install on: "Only on this account"

Click **"Create GitHub App"**

### 2️⃣ Get Credentials

1. **Copy App ID** (shown at top)
2. **Generate Private Key** (scroll down, click button)
3. **Save the `.pem` file** that downloads

Move it:
```bash
mkdir -p ~/.github-apps/
mv ~/Downloads/*.private-key.pem ~/.github-apps/
```

### 3️⃣ Install the App

1. Left sidebar → **"Install App"**
2. Click **"Install"** on your account
3. Choose **"All repositories"**
4. After install, note the Installation ID in URL:
   ```
   https://github.com/settings/installations/12345678
                                              ^^^^^^^^ This number
   ```

### 4️⃣ Configure `.env`

Add to `/home/sdalal/test/BeachBaby/extra_feature_desktop/.env`:

```bash
GITHUB_APP_ID=123456
GITHUB_APP_INSTALLATION_ID=12345678
GITHUB_APP_PRIVATE_KEY_PATH=/home/yourusername/.github-apps/your-app.private-key.pem
```

### 5️⃣ Connect in App

```bash
npm run dev
```

1. Open app
2. Settings → GitHub → **Connect**
3. ✅ Should see "GitHub App connected successfully!"

---

## ✅ Verify It Works

**Dashboard should show:**
- Recent Pull Requests
- Recent Commits
- No errors!

**Logs should show:**
```
{"message":"Using GitHub App authentication"}
{"message":"Installation access token obtained"}
{"message":"GitHub App connected successfully"}
```

---

## 🔧 Troubleshooting

| Error | Solution |
|-------|----------|
| `ENOENT` | Fix private key path in `.env` (use absolute path) |
| `401` | Wrong App ID or private key |
| `404` | Wrong Installation ID - check https://github.com/settings/installations |
| `403` | Missing permissions - add in GitHub App settings |

---

## 🔄 How It Works

1. **Every API call:** System checks if token expires in < 5 minutes
2. **If expiring:** Auto-generates new JWT → Gets new installation token
3. **Database updated:** New token saved automatically
4. **You see:** Nothing! It just works. 🎉

Token lifecycle: **1 hour** → **Auto-refresh** → **Repeat**

---

## 📖 Full Documentation

See [GITHUB_APP_SETUP.md](./GITHUB_APP_SETUP.md) for detailed setup, security best practices, and troubleshooting.

---

**Ready to use!** 🚀


