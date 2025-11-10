# Fix Confluence Authentication (401 Unauthorized)

## 🐛 Problem

When trying to fetch Confluence page content, you're getting:

```json
{"error":"{\"code\":401,\"message\":\"Unauthorized; scope does not match\"}","status":401}
```

## 🔍 Root Cause

Your existing JIRA OAuth token was created **before** the Confluence read scopes were added to the application. The token needs to be refreshed to include the new scopes.

## ✅ Solution: Re-authenticate with JIRA

### **Step 1: Disconnect JIRA**

In the HeyJarvis app:
1. Go to Settings → Integrations
2. Find JIRA
3. Click "Disconnect" or "Sign Out"

### **Step 2: Reconnect JIRA**

1. Click "Connect JIRA"
2. You'll be redirected to Atlassian OAuth
3. **Important:** You should see a permission screen that includes:
   - ✅ Read JIRA work data
   - ✅ Write JIRA work data
   - ✅ **Read Confluence content** ← NEW!
   - ✅ **Read Confluence spaces** ← NEW!
4. Click "Accept" to authorize

### **Step 3: Verify Scopes**

After reconnecting, the system will have access to:

```javascript
scopes: [
  'read:jira-work',
  'write:jira-work',
  'read:jira-user',
  'read:space:confluence',        // ← Needed for Confluence
  'read:content:confluence',      // ← Needed for Confluence
  'read:space-details:confluence',// ← Needed for Confluence
  'read:content.metadata:confluence',
  'write:content:confluence',
  'write:page:confluence',
  'write:space:confluence',
  'offline_access'
]
```

### **Step 4: Test Again**

1. Generate a Feature Report for a JIRA ticket with a Confluence link
2. Check the logs - you should see:
   ```json
   {"message":"Fetching page","pageId":"3375681","service":"confluence-service"}
   {"message":"Confluence page fetched","title":"Product Requirements","contentLength":1234}
   {"message":"AI summary generated","summaryLength":245}
   ```

---

## 🔍 Alternative: Check Current Token Scopes

If you want to verify what scopes your current token has:

1. Go to: https://id.atlassian.com/manage-profile/security/api-tokens
2. Find your HeyJarvis app
3. Check the permissions listed

---

## 🚨 If Re-authentication Doesn't Work

### **Option 1: Clear Cached Tokens**

The app might be using cached tokens. Clear them:

```bash
# Stop the app
# Delete token cache (location depends on your setup)
rm -rf ~/.heyjarvis/tokens  # Or wherever tokens are stored

# Restart and reconnect
npm run dev
```

### **Option 2: Check Atlassian App Configuration**

Your Atlassian OAuth app might not have Confluence scopes enabled:

1. Go to: https://developer.atlassian.com/console/myapps/
2. Find your HeyJarvis app
3. Go to "Permissions"
4. Ensure these are checked:
   - ✅ Confluence API
   - ✅ Read content
   - ✅ Read spaces

### **Option 3: Use a Different Confluence API**

If OAuth continues to fail, you can use Confluence API tokens instead:

1. Generate a Confluence API token: https://id.atlassian.com/manage-profile/security/api-tokens
2. Add to `.env`:
   ```bash
   CONFLUENCE_API_TOKEN=your_token_here
   CONFLUENCE_EMAIL=your_email@company.com
   ```
3. Update `confluence-service.js` to use basic auth as fallback

---

## 📊 Expected Behavior After Fix

Once authentication is fixed, you should see:

### **In Logs:**
```json
{"message":"Fetching Confluence page content","url":"https://..."}
{"message":"Fetching page","pageId":"3375681"}
{"message":"Confluence page fetched","title":"Product Requirements","contentLength":2456}
{"message":"Summarizing Confluence page with AI","contentLength":2456}
{"message":"AI summary generated","summaryLength":245}
{"message":"Confluence content fetched and summarized","total":1,"withContent":1}
```

### **In Report:**
```
📚 SUPPORTING DOCUMENTATION

1. 📎 Product Requirements Document ✨
   https://heyjarvis-team.atlassian.net/wiki/pages/resumedraft.action?draftId=3375681

   Summary:
   This document outlines the requirements for integrating JIRA with the
   HeyJarvis platform. Key features include OAuth authentication, real-time
   sync, and automated task creation. Success metrics focus on reducing
   context switching by 50% and achieving 80% user adoption within the first
   week.
```

Note the **✨** indicator showing content was fetched and summarized!

---

## 🎯 Quick Test

After re-authenticating, run this test:

1. Open a JIRA ticket with a Confluence link in the description
2. Generate a Feature Report
3. Check for:
   - ✅ Link extracted (📎 icon)
   - ✅ Content fetched (no 401 error in logs)
   - ✅ AI summary generated (✨ icon)
   - ✅ Summary displayed in report

---

## 💡 Pro Tip

To avoid this issue in the future:
- Always request all necessary scopes upfront
- Test with a fresh OAuth flow after adding new scopes
- Document required scopes in your app's README

