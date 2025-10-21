# 🔍 Debug Microsoft Authentication

## Current Configuration

From `.env`:
```
MICROSOFT_CLIENT_ID=ffd462f1-9c7d-42d9-9696-4c0e4a54132a
MICROSOFT_CLIENT_SECRET=Jih8Q~ifVRPlf0qI1-hOxzjpD_9abV2Ox1tJLc-A
MICROSOFT_REDIRECT_URI=http://localhost:8890/auth/microsoft/callback
```

## Common 401 Errors from Microsoft

### 1. Redirect URI Mismatch
**Error:** `AADSTS50011: The redirect URI specified in the request does not match`

**Fix:** 
- Go to Azure Portal → App Registration → Authentication
- Verify redirect URI is EXACTLY: `http://localhost:8890/auth/microsoft/callback`
- No trailing slash, correct port (8890), correct path

### 2. Client Secret Expired
**Error:** `AADSTS7000215: Invalid client secret provided`

**Fix:**
- Go to Azure Portal → App Registration → Certificates & secrets
- Check if secret `Jih8Q~ifVRPlf0qI1-hOxzjpD_9abV2Ox1tJLc-A` is still valid
- If expired, create new secret and update `.env`

### 3. Invalid Client ID
**Error:** `AADSTS700016: Application not found`

**Fix:**
- Verify client ID in Azure Portal matches `.env`
- Should be: `ffd462f1-9c7d-42d9-9696-4c0e4a54132a`

## How to Get Detailed Error

After restarting the app, try Microsoft login again. Check the terminal logs for:

```json
{
  "error": "...",
  "error_description": "...",
  "error_codes": [...]
}
```

## Test OAuth Server Manually

1. **Check if server is running:**
   ```bash
   curl http://localhost:8890/health
   ```
   Should return: `{"status":"healthy","timestamp":"..."}`

2. **Test Microsoft redirect:**
   Open in browser:
   ```
   http://localhost:8890/auth/microsoft
   ```
   Should redirect to Microsoft login page

3. **Check what redirect URI is being sent:**
   Look at the URL Microsoft shows - it should contain:
   ```
   redirect_uri=http%3A%2F%2Flocalhost%3A8890%2Fauth%2Fmicrosoft%2Fcallback
   ```

## Verify Azure Configuration

### Required Settings in Azure Portal:

1. **Authentication → Platform configurations → Web:**
   - Redirect URI: `http://localhost:8890/auth/microsoft/callback`
   - Implicit grant: ❌ (not needed)
   - Access tokens: ❌ (not needed)
   - ID tokens: ✅ (optional but recommended)

2. **API permissions:**
   - Microsoft Graph → Delegated permissions:
     - `openid` ✅
     - `profile` ✅
     - `email` ✅
     - `User.Read` ✅
     - `Calendars.ReadWrite` ✅
     - `Mail.Read` ✅

3. **Certificates & secrets:**
   - Client secret must be active (not expired)
   - Value must match `.env` file

## Quick Test Script

Run this to test the token exchange manually:

```bash
# Get authorization code first by logging in via browser
# Then test token exchange:

curl -X POST https://login.microsoftonline.com/common/oauth2/v2.0/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=ffd462f1-9c7d-42d9-9696-4c0e4a54132a" \
  -d "client_secret=Jih8Q~ifVRPlf0qI1-hOxzjpD_9abV2Ox1tJLc-A" \
  -d "code=YOUR_AUTH_CODE_HERE" \
  -d "redirect_uri=http://localhost:8890/auth/microsoft/callback" \
  -d "grant_type=authorization_code"
```

## What to Check Next

1. **Restart the app** to load the updated logging
2. **Try Microsoft login**
3. **Check terminal logs** for detailed error
4. **Share the error_description** from the logs

The enhanced logging will now show:
- Exact redirect URI being used
- Microsoft's error response
- HTTP status code
- Error description

This will tell us exactly what's wrong!

