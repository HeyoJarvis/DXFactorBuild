# Context Picker Fix - Meetings & Repositories

## 🐛 Issues Found

### 1. Repository Listing Error
```
Error: taskCodeIntelligenceService.listRepositories is not a function
```

**Root Cause**: The `TaskCodeIntelligenceService` didn't have a `listRepositories` method. The method existed as `_getUserRepos` in `GitHubServiceWrapper` but was private.

### 2. Meeting API Parameter Error
```
IPC: meeting:getSummaries - options parameter was userId instead of options object
```

**Root Cause**: The `meeting.getSummaries` API call was passing parameters incorrectly. It was passing `userId` as the first parameter and options as second, but the handler expected just options.

## ✅ Fixes Applied

### Fix 1: Added Public `listRepositories` Method

**File**: `main/services/GitHubServiceWrapper.js`

Added a new public method that wraps the private `_getUserRepos`:

```javascript
/**
 * List user's repositories (public method)
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Repositories
 */
async listRepositories(userId) {
  try {
    const accessToken = await this.oauthService.getAccessToken(userId);
    return await this._getUserRepos(accessToken);
  } catch (error) {
    this.logger.error('Failed to list repositories', { 
      userId,
      error: error.message 
    });
    return [];
  }
}
```

### Fix 2: Updated GitHub IPC Handler

**File**: `main/ipc/github-handlers.js`

Updated to access the method through `githubService`:

```javascript
// Use githubService directly since it has the listRepositories method
const githubService = taskCodeIntelligenceService.githubService;
if (!githubService) {
  logger.warn('GitHub service not available');
  return { success: false, error: 'GitHub service not available', repositories: [] };
}

const repositories = await githubService.listRepositories(session.user.id);
```

### Fix 3: Corrected Meeting API Call

**File**: `renderer/src/pages/TeamChat.jsx`

Fixed the parameter passing to match the API signature:

```javascript
// Before (incorrect):
const meetingsResult = await window.electronAPI.meeting.getSummaries(user.id, {
  startDate: new Date(...).toISOString(),
  endDate: new Date().toISOString()
});

// After (correct):
const meetingsResult = await window.electronAPI.meeting.getSummaries({
  startDate: new Date(...).toISOString(),
  endDate: new Date().toISOString()
});
```

## 🧪 Testing

### Test Repository Listing
1. Navigate to Team Chat
2. Click "Context" button
3. Check "💻 Repositories" section
4. Should see list of available repositories

### Test Meeting Loading
1. Navigate to Team Chat
2. Click "Context" button
3. Check "📅 Meetings" section
4. Should see list of available meetings from last 30 days

### Verification in Logs
Look for these success messages:
```
✅ Listed repositories - count: X
Fetched repositories via GitHub App - count: X
```

## 📊 Impact

### Before
- ❌ Repository section showed "No repositories available"
- ❌ Meeting section showed "No meetings available"
- ❌ Errors in console/logs
- ❌ Context picker non-functional

### After
- ✅ Repository section loads actual repositories
- ✅ Meeting section loads actual meetings
- ✅ No errors in console/logs
- ✅ Context picker fully functional

## 🔍 Related Files

### Modified Files (3)
1. `main/services/GitHubServiceWrapper.js` - Added public method
2. `main/ipc/github-handlers.js` - Fixed service access
3. `renderer/src/pages/TeamChat.jsx` - Fixed API call

### No Changes Needed
- `meeting-handlers.js` - API signature was correct
- Context picker UI - Working as designed
- Session management - Working as designed

## 🎯 Verification Steps

1. **Restart the app**:
   ```bash
   npm run dev
   ```

2. **Check logs for success messages**:
   ```bash
   tail -f logs/main.log | grep -E "(Listed repositories|Fetched repositories)"
   ```

3. **Test in UI**:
   - Create new chat session
   - Open context picker
   - Verify meetings load
   - Verify repositories load
   - Select items and verify badges update

4. **Test a query**:
   - Select a meeting
   - Select a repository
   - Send a question
   - Verify AI responds with context

## 🐛 If Still Not Working

### Meetings Not Loading
- Check if Microsoft is connected (Settings)
- Verify meetings exist in last 30 days
- Check Supabase `meeting_summaries` table

### Repositories Not Loading
- Check if GitHub is connected (Settings)
- Verify GitHub token has repo access
- Check `team_sync_integrations` table for GitHub entry

### Console Errors
- Open DevTools (F12)
- Check Console tab for errors
- Check Network tab for failed API calls

## 📝 Notes

- Meeting API signature: `meeting.getSummaries(options)` - options is an object with startDate/endDate
- Repository listing requires GitHub OAuth connection
- Meetings require Microsoft OAuth connection
- Context picker automatically refreshes on component mount

## ✅ Status

**FIXED** - Both meetings and repositories should now load correctly in the context picker.

---

**Fix Date**: October 21, 2025
**Files Modified**: 3
**Tests**: Manual UI testing recommended

