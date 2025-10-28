# Indexed Repositories Display Fix

## Problem
The desktop2 app's "CONNECTED REPOSITORIES" section was showing "0" repositories even though BeachBaby was successfully indexed with 1,832 code chunks.

## Root Cause
The app was showing repositories **linked to teams** (from `team_repositories` table), not **indexed repositories** (from `code_chunks` table). BeachBaby was indexed but not linked to any team.

## Solution Implemented

### 1. Backend: New IPC Handler
**File**: `desktop2/main/ipc/code-indexer-handlers.js`

Added `codeIndexer:listIndexedRepositories` handler that:
- Queries the `code_chunks` table in Supabase
- Groups chunks by repository (owner/name)
- Returns list of indexed repositories with chunk counts

```javascript
ipcMain.handle('codeIndexer:listIndexedRepositories', async (event) => {
  // Query code_chunks table
  // Group by repository
  // Return formatted list with chunk counts
});
```

### 2. Bridge: Expose New API
**File**: `desktop2/bridge/preload.js`

Added `listIndexedRepositories` method to the codeIndexer API:
```javascript
codeIndexer: {
  listRepositories: (params) => ...,  // GitHub repos
  listIndexedRepositories: () => ...,  // NEW: Indexed repos from DB
  ...
}
```

### 3. Frontend: Use Indexed Repos
**File**: `desktop2/renderer2/src/components/Teams/TeamContext.jsx`

Updated `loadAvailableRepositories()` to:
- Call `listIndexedRepositories()` instead of `listRepositories()`
- Show repositories that are already indexed in the database
- Display chunk counts in the description

Updated UI text:
- "Loading indexed repositories..." (instead of "Loading repositories from GitHub...")
- "No repositories connected to this team yet" (instead of "No repositories indexed yet")
- "Connect Indexed Repository" button (instead of "Index Your First Repository")

## How It Works Now

### Before:
1. User clicks "Index Your First Repository"
2. Modal shows **all GitHub repositories** (via GitHub API)
3. User indexes a repo → stored in `code_chunks` table
4. But repo not shown in "CONNECTED REPOSITORIES" (not in `team_repositories`)

### After:
1. User clicks "Connect Indexed Repository"
2. Modal shows **indexed repositories** (from `code_chunks` table)
3. User sees BeachBaby with "1832 code chunks indexed"
4. User can connect it to the current team

## Verification

### Check Indexed Repositories
```bash
node -e "
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const { data } = await supabase
    .from('code_chunks')
    .select('repository_owner, repository_name')
    .limit(10000);
  
  const repos = new Map();
  data.forEach(d => {
    const key = \`\${d.repository_owner}/\${d.repository_name}\`;
    repos.set(key, (repos.get(key) || 0) + 1);
  });
  
  console.log('Indexed repositories:');
  for (const [repo, count] of repos.entries()) {
    console.log(\`  - \${repo}: \${count} chunks\`);
  }
})();
"
```

Expected output:
```
Indexed repositories:
  - HeyoJarvis/-MARK-II: 99 chunks
  - HeyoJarvis/BeachBaby: 1832 chunks
```

## Files Modified
1. `desktop2/main/ipc/code-indexer-handlers.js` - Added listIndexedRepositories handler
2. `desktop2/bridge/preload.js` - Exposed listIndexedRepositories API
3. `desktop2/renderer2/src/components/Teams/TeamContext.jsx` - Updated to use indexed repos

## Bug Fix
**Issue**: Initial implementation used `services.supabase` but the service is actually named `services.dbAdapter`
**Fix**: Changed line 217 from `this.services?.supabase` to `this.services?.dbAdapter`

## Testing
1. ✅ Start desktop2 app
2. ✅ Go to Team Chat
3. ✅ Click "Connect Indexed Repository" button
4. ✅ Should see "HeyoJarvis/BeachBaby" with "1832 code chunks indexed"
5. ✅ Click to connect it to the team
6. ✅ Repository should appear in "CONNECTED REPOSITORIES" section

## Next Steps
- Restart the desktop2 app to load the new code
- The indexed BeachBaby repository should now be visible and connectable to teams

