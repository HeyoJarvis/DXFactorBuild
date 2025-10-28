# Indexed Repositories - Final Implementation

## ✅ Correct Requirements

1. **Section Title**: "INDEXED REPOSITORIES" (shows count of all indexed repos)
2. **Display**: Show ALL indexed repositories from database with checkboxes
3. **Selection**: User can select/deselect repos to include in team chat context
4. **Bottom Button**: "Index More Repositories" → Opens modal to index NEW repos from GitHub

## Implementation

### UI Structure

```
INDEXED REPOSITORIES (2)
├── [✓] HeyoJarvis/BeachBaby
│   └── 1832 code chunks • Indexed
├── [ ] HeyoJarvis/-MARK-II  
│   └── 99 code chunks • Indexed
└── [Index More Repositories] button
```

### Key Changes

#### 1. New State Variables
```javascript
const [indexedRepositories, setIndexedRepositories] = useState([]);
const [selectedIndexedRepos, setSelectedIndexedRepos] = useState(new Set());
```

#### 2. Load Indexed Repos on Team Change
```javascript
useEffect(() => {
  if (selectedTeam) {
    loadTeamContext(selectedTeam.id);
    loadIndexedRepositories(); // NEW: Load all indexed repos
  }
}, [selectedTeam]);
```

#### 3. Two Separate Functions
- `loadIndexedRepositories()` - Loads ALL indexed repos from database (for display)
- `loadGitHubRepositories()` - Loads GitHub repos for indexing NEW ones (for modal)

#### 4. Selection Logic
- Checkboxes allow selecting which indexed repos to include in team context
- Selected repos are used when chatting with the team
- Selection state persists across team switches

### Modal Behavior

**"Index More Repositories" button** opens modal showing:
- All GitHub repositories you have access to
- Repos already indexed show "✓ Already Indexed" badge
- Repos not indexed show "Index Repository" button
- After indexing, repo appears in main "INDEXED REPOSITORIES" section

### Files Modified
- `desktop2/renderer2/src/components/Teams/TeamContext.jsx`

### Changes Made
1. Added `indexedRepositories` and `selectedIndexedRepos` state
2. Added `loadIndexedRepositories()` function
3. Renamed `loadAvailableRepositories()` to `loadGitHubRepositories()`
4. Added `toggleIndexedRepoSelection()` function
5. Renamed button from "Connect Indexed Repository" to "Index More Repositories"
6. Changed section title from "Connected Repositories" to "Indexed Repositories"
7. Updated modal title to "Index New Repository"
8. Modal now checks `indexedRepositories` to show "Already Indexed" badge

## Testing

1. ✅ Restart desktop2 app
2. ✅ Go to Team Chat
3. ✅ See "INDEXED REPOSITORIES (2)" section
4. ✅ See BeachBaby and -MARK-II with checkboxes
5. ✅ Click checkboxes to select/deselect
6. ✅ Click "Index More Repositories"
7. ✅ See GitHub repos with "Already Indexed" badges for BeachBaby and -MARK-II
8. ✅ Can index new repos

## User Flow

### Viewing Indexed Repos
1. User opens Team Chat
2. Sees "INDEXED REPOSITORIES" section with all indexed repos
3. Can check/uncheck repos to include in chat context

### Indexing New Repos
1. User clicks "Index More Repositories"
2. Modal shows all GitHub repos
3. Already indexed repos show "✓ Already Indexed"
4. User clicks "Index Repository" on a new repo
5. Repo gets indexed (takes ~2 minutes)
6. New repo appears in "INDEXED REPOSITORIES" section
7. User can check it to include in team context

## Summary

**Before**: Confusing mix of "connected" vs "indexed" repos, unclear what each button did

**After**: Clear separation:
- **INDEXED REPOSITORIES section** = All repos that have been indexed (with checkboxes for selection)
- **Index More Repositories button** = Add new repos from GitHub to the indexed list

