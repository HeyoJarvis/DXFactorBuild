# Developer Mode Quick Start Guide

## Running in Developer Mode

To start HeyJarvis with all developer features enabled (including JIRA integration):

```bash
npm run dev:desktop:developer
```

## What's Included in Developer Mode

### 1. **JIRA Integration** ✅
- Automatic syncing of assigned JIRA issues
- Creates tasks from JIRA tickets
- Updates tasks when JIRA issues change
- Auto-refresh of OAuth tokens

**Sync Schedule:**
- Initial sync: 10 seconds after startup
- Periodic sync: Every 10 minutes
- Manual sync: Available via UI

### 2. **GitHub Engineering Intelligence** 
- Pull request monitoring
- Code review analytics
- Commit activity tracking
- Issue tracking

### 3. **Developer-Specific Features**
- Engineering Intelligence dashboard
- Code indexing and semantic search
- GitHub Copilot integration
- JIRA command execution via natural language

## Environment Variables Required

Make sure these are set in your `.env` file:

### JIRA (Required for JIRA sync)
```bash
JIRA_CLIENT_ID=your_jira_client_id
JIRA_CLIENT_SECRET=your_jira_client_secret
JIRA_REDIRECT_URI=http://localhost:8890/auth/jira/callback
```

### GitHub (Required for Engineering Intelligence)
```bash
GITHUB_APP_ID=your_github_app_id
GITHUB_APP_INSTALLATION_ID=your_installation_id
GITHUB_APP_PRIVATE_KEY_PATH=/path/to/private-key.pem
```

### Supabase (Required for data storage)
```bash
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Anthropic (Required for AI features)
```bash
ANTHROPIC_API_KEY=your_anthropic_api_key
```

## First Time Setup

1. **Start the app**
   ```bash
   npm run dev:desktop:developer
   ```

2. **Sign in with Slack**
   - Use the Slack OAuth flow
   - This creates your user account

3. **Connect JIRA** (optional)
   - Go to Settings → Integrations
   - Click "Connect JIRA"
   - Follow OAuth flow
   - JIRA sync will start automatically

4. **Connect GitHub** (optional)
   - Go to Settings → Integrations
   - Click "Connect GitHub"
   - Follow OAuth flow

## Console Output

When JIRA sync is working correctly, you'll see:

```
🔄 Running initial JIRA task sync...
✅ Initial JIRA sync complete: 5 created, 2 updated

🔄 Running periodic JIRA task sync...
✅ Periodic JIRA sync complete: 0 created, 3 updated
```

If JIRA is not connected:
```
⚠️ JIRA sync skipped: No user authenticated
⚠️ JIRA sync skipped: JIRA not connected
```

## Troubleshooting

### JIRA Token Refresh Errors

If you see: `Token refresh failed: 400 - client_id may not be blank`

**Solution:** Make sure JIRA credentials are uncommented in `.env`:
```bash
JIRA_CLIENT_ID=TjIg9dz6rmiUs30oS1rsUhsvGCRkfcOY
JIRA_CLIENT_SECRET=ATOATqxbZJkVsPSO59V2G9VI3sQIXPO_ocbOANACDL6C__R4OaOXQilmLMyfY_K82jX2002017BB
JIRA_REDIRECT_URI=http://localhost:8890/auth/jira/callback
```

Then restart the app.

### JIRA Not Syncing

Check that:
1. You're authenticated (signed in with Slack)
2. You've connected JIRA via Settings → Integrations
3. Your role is Developer or Admin
4. Check console for error messages

### GitHub Integration Not Working

Make sure:
1. GitHub App is installed on your repository
2. `GITHUB_APP_PRIVATE_KEY_PATH` points to valid PEM file
3. `GITHUB_APP_INSTALLATION_ID` is correct

## Other Available Scripts

```bash
# Run with Sales role (no JIRA/GitHub)
npm run dev:desktop:sales

# Run with Admin role (all features)
npm run dev:desktop:admin

# Run with default role selection
npm run dev:desktop
```

## Manual JIRA Sync

You can also trigger JIRA sync manually via the UI:
1. Go to Tasks view
2. Click "Sync JIRA" button
3. Wait for sync to complete

## Viewing JIRA Tasks

JIRA tasks are automatically:
- Tagged with `jira-auto` tag
- Linked to original JIRA issue (click to open)
- Updated when JIRA issue changes
- Priority mapped from JIRA priority

## Notes

- The `ROLE_OVERRIDE=developer` environment variable forces developer role
- Without this, you'd need to select role on first login
- JIRA sync only runs for Developer and Admin roles
- Token refresh is automatic - no manual intervention needed

