# Team Chat - JIRA & GitHub Integration

## Overview
Updated Team Chat context to use actual JIRA tickets from user's JIRA integration and allow selection of specific GitHub repositories from the code indexer.

## Changes Made

### 1. Tasks Now Show JIRA Tickets

**Before:**
- Queried generic `conversation_sessions` with `workflow_type='task'`
- Showed internal tasks, not JIRA tickets

**After:**
- Uses `JIRAService` to fetch actual JIRA issues
- Shows user's real JIRA tickets with status
- Queries: In Progress, To Do, Code Review, In Review
- Displays JIRA key (e.g., "PROJ-123")

#### Implementation Details

**Backend ([team-chat-handlers.js](desktop2/main/ipc/team-chat-handlers.js:373-422)):**
```javascript
// Get JIRA tickets if enabled
if (contextSettings.include_tasks) {
  // Check if user has JIRA connected
  const userData = await dbAdapter.supabase
    .from('users')
    .select('integration_settings')
    .eq('id', userId)
    .single();

  if (userData?.integration_settings?.jira?.access_token) {
    // Initialize JIRA service
    const jiraService = new JIRAService({ logger, supabaseAdapter: dbAdapter });
    const initResult = await jiraService.initialize(userId);

    if (initResult.connected) {
      // Get user's JIRA issues
      const issuesResult = await jiraService.getMyIssues({
        maxResults: 20,
        status: 'In Progress,To Do,Code Review,In Review'
      });

      if (issuesResult.success) {
        contextDetails.tasks = issuesResult.issues.map(issue => ({
          id: issue.key,
          title: issue.summary,
          external_key: issue.key,
          status: issue.status
        }));
      }
    }
  }
}
```

**What Happens:**
1. Checks if user has JIRA integration configured
2. Initializes JIRA service with user's OAuth tokens
3. Fetches user's assigned JIRA issues
4. Maps to context format with JIRA keys
5. Shows in context panel

### 2. Codebase Shows Selectable Repositories

**Before:**
- Showed count of all code files
- No way to select specific repos

**After:**
- Lists all indexed repositories
- Each repo has a checkbox
- Can select/deselect individual repos
- Only selected repos included in AI context
- Selection persists in database

#### Implementation Details

**Backend ([team-chat-handlers.js](desktop2/main/ipc/team-chat-handlers.js:424-460)):**
```javascript
// Get code repos if enabled
if (contextSettings.include_code) {
  const { data: codeFiles } = await dbAdapter.supabase
    .from('code_embeddings')
    .select('metadata')
    .limit(1000);

  // Group by repository path
  const repoMap = new Map();
  codeFiles.forEach(file => {
    const repoPath = file.metadata?.repository_path || file.metadata?.repository;
    const repoName = file.metadata?.repository_name || repoPath.split('/').pop();

    if (!repoMap.has(repoPath)) {
      repoMap.set(repoPath, {
        path: repoPath,
        name: repoName,
        file_count: 0,
        selected: !contextSettings.selected_repo_paths ||
                  contextSettings.selected_repo_paths.length === 0 ||
                  contextSettings.selected_repo_paths.includes(repoPath)
      });
    }
    repoMap.get(repoPath).file_count++;
  });

  contextDetails.code_repos = Array.from(repoMap.values());

  // Count only selected repos
  const selectedRepos = contextDetails.code_repos.filter(r => r.selected);
  context.code_files_count = selectedRepos.reduce((sum, r) => sum + r.file_count, 0);
}
```

**Frontend ([TeamChat.jsx](desktop2/renderer2/src/pages/TeamChat.jsx:361-382)):**
```jsx
{contextSettings.include_code && contextDetails?.code_repos && (
  <div className="context-items-list">
    {contextDetails.code_repos.map((repo, idx) => (
      <label key={idx} className="context-repo-item">
        <input
          type="checkbox"
          checked={repo.selected}
          onChange={() => handleRepoToggle(repo.path)}
        />
        <div className="context-repo-info">
          <div className="context-detail-title">{repo.name}</div>
          <div className="context-detail-meta">{repo.file_count} files</div>
        </div>
      </label>
    ))}
  </div>
)}
```

**What Happens:**
1. Queries `code_embeddings` table
2. Groups files by repository path
3. Checks each repo's selection state from settings
4. Displays with checkboxes
5. On toggle, updates `selected_repo_paths` array
6. On save, persists to `team_chat_context_settings` table

### 3. Enhanced AI Context

The AI system prompt now includes detailed information:

**JIRA Tickets:**
```
**Active Tasks:**
- Implement user authentication (PROJ-123)
- Fix payment processing bug (PROJ-124)
- Add dark mode support (PROJ-125)
```

**Code Repositories (only selected ones):**
```
**Code Repositories:**
- frontend-app: 245 files indexed
- backend-api: 178 files indexed
```

This allows the AI to:
- Reference specific JIRA tickets by key
- Understand what code repos are relevant
- Give more context-specific answers

## Files Modified

1. **[team-chat-handlers.js](desktop2/main/ipc/team-chat-handlers.js)**
   - Updated `buildTeamContext()` to use JIRAService
   - Added repo selection logic
   - Updated save handler to persist `selected_repo_paths`

2. **[TeamChat.jsx](desktop2/renderer2/src/pages/TeamChat.jsx)**
   - Added `selected_repo_paths` to state
   - Added `handleRepoToggle()` function
   - Updated code section UI with checkboxes

3. **[TeamChat.css](desktop2/renderer2/src/pages/TeamChat.css)**
   - Added `.context-repo-item` styles
   - Added `.context-repo-info` styles
   - Added `.context-empty-message` styles

## Usage

### Tasks (JIRA Tickets)

**Enable/Disable:**
- Toggle "Tasks" checkbox to include/exclude all JIRA tickets
- When enabled, fetches tickets from your JIRA integration
- Shows: Title + JIRA key (e.g., "PROJ-123") + Status

**Requirements:**
- User must have JIRA integration connected
- OAuth tokens must be valid
- User must have tickets assigned to them

### Codebase (GitHub Repositories)

**Select Repositories:**
1. Toggle "Codebase" to enable
2. Expand to see list of repositories
3. Check/uncheck specific repos
4. Click "Save Context Settings"

**Behavior:**
- All repos checked by default (empty `selected_repo_paths`)
- Unchecking a repo removes it from AI context
- Only selected repos included in file count
- Selection persists per user per team

## Testing

### Test JIRA Integration

1. **Verify JIRA connected:**
   ```bash
   # Check Settings > Integrations > JIRA
   # Should show "Connected"
   ```

2. **View JIRA tickets in Team Chat:**
   - Go to Team Chat
   - Check "Tasks" toggle is enabled
   - Should see your JIRA tickets listed
   - Each should show JIRA key (e.g., "PROJ-123")

3. **Test toggle off:**
   - Uncheck "Tasks"
   - Click "Save Context Settings"
   - Send a message
   - AI should not mention JIRA tickets

### Test Repository Selection

1. **Verify repos indexed:**
   ```bash
   # Check Code Indexer page
   # Should show indexed repositories
   ```

2. **Select specific repos:**
   - Go to Team Chat
   - Enable "Codebase" toggle
   - Expand to see repo list
   - Uncheck some repos
   - Check others
   - Click "Save Context Settings"

3. **Verify AI context:**
   - Send message asking about code
   - AI should only reference selected repos
   - Check system prompt includes correct repos

### Test Persistence

1. **Save settings:**
   - Toggle tasks off
   - Select 2 specific repos
   - Click "Save Context Settings"

2. **Reload page:**
   - Refresh browser or restart app
   - Return to Team Chat
   - Select same team

3. **Verify persistence:**
   - Tasks toggle should be off
   - Same 2 repos should be checked
   - Settings loaded from database

## Troubleshooting

### "No tasks shown"

**Cause**: JIRA not connected or no tickets assigned

**Solution**:
1. Check Settings > Integrations > JIRA
2. Click "Connect JIRA" if not connected
3. Verify you have tickets assigned in JIRA

### "No repositories shown"

**Cause**: Code indexer hasn't indexed any repos

**Solution**:
1. Go to Code Indexer page
2. Add repositories to index
3. Wait for indexing to complete
4. Return to Team Chat

### "Save Context Settings" fails

**Cause**: Database table not created

**Solution**:
1. Run the migration SQL:
   ```bash
   # In Supabase SQL Editor
   cat data/storage/team-chat-context-settings.sql
   ```

## Benefits

1. **Real JIRA Data** - See actual tickets, not generic tasks
2. **Fine-Grained Control** - Select exactly which repos to include
3. **Better AI Context** - More specific, relevant information
4. **Integration Leverage** - Uses existing JIRA/GitHub integrations
5. **User Privacy** - Can exclude repos with sensitive code

## Future Enhancements

- [ ] Filter JIRA tickets by project or label
- [ ] Show ticket priority and assignee
- [ ] Link to JIRA ticket in browser
- [ ] Add GitHub integration for repo selection (not just indexer)
- [ ] Filter repos by language or framework
- [ ] Show last commit date for repos

---

**Status**: ✅ Implementation Complete

**Dependencies**:
- JIRAService must be initialized
- Code indexer must have repos indexed
- Database table `team_chat_context_settings` must exist

**Next Action**: Test with real JIRA account and indexed repositories!
