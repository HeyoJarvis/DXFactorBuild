# Orb Visibility & Repository UI Fix ✅

## Issues Fixed

### Issue 1: Hidden Orb Still Clickable
**Problem**: When the orb was hidden (showOrb=false), it was still clickable at its last position, interfering with the UI behind it.

**Root Cause**: The orb component was conditionally rendered with `{showOrb && <ArcReactor />}`, but React still kept event handlers active in some cases.

**Solution**: Wrapped the ArcReactor in a container div with explicit CSS properties to make it truly non-interactive when hidden:

```jsx
<div 
  style={{ 
    display: showOrb ? 'block' : 'none',
    pointerEvents: showOrb ? 'auto' : 'none',
    visibility: showOrb ? 'visible' : 'hidden',
    position: 'absolute',
    inset: 0
  }}
>
  <ArcReactor
    isCollapsed={true}
    onNavigate={handleArcReactorNavigate}
  />
</div>
```

**Result**: 
- ✅ When hidden, the orb is completely non-interactive
- ✅ `display: none` removes it from layout
- ✅ `pointerEvents: none` blocks all mouse events
- ✅ `visibility: hidden` ensures it's not visible
- ✅ No interference with UI elements behind it

---

### Issue 2: Repository UI - "Index Your First Repository" Button
**Problem**: The "Connected Repositories" section showed an empty state with "Index Your First Repository" button instead of displaying all available repositories with checkboxes.

**Root Cause**: The UI only showed repositories that were already indexed (`contextDetails.code_repos`), not all available repositories from GitHub.

**Solution**: Changed the UI to always display all available repositories with different states:

#### New Repository Display Logic

**File**: `desktop2/renderer2/src/components/Teams/TeamContext.jsx`

1. **Load repositories on mount**:
```javascript
// Load available repositories on mount
useEffect(() => {
  loadAvailableRepositories();
}, []);
```

2. **Display all repositories with state indicators**:
```javascript
{availableRepositories.map((repo) => {
  const isIndexed = contextDetails?.code_repos?.some(r =>
    r.path === repo.full_name || r.name === repo.name
  );
  const isIndexing = indexingRepo === repo.full_name;
  const isSelected = repoIndex >= 0 && selectedRepos.has(repoIndex);

  return (
    <div className={`repo-card ${isIndexed ? (isSelected ? 'selected' : '') : 'not-indexed'}`}>
      {/* Checkbox for indexed repos, placeholder for non-indexed */}
      {isIndexed ? (
        <input type="checkbox" checked={isSelected} />
      ) : (
        <div className="checkbox-placeholder"></div>
      )}
      
      {/* Repository info */}
      <div className="card-content">
        <div className="card-title">{repo.name}</div>
        {/* Status badge */}
        {isIndexing ? (
          <span className="repo-status indexing">Indexing...</span>
        ) : isIndexed ? (
          <span className="repo-status indexed">Indexed</span>
        ) : (
          <span className="repo-status not-indexed-badge">Click to Index</span>
        )}
      </div>
    </div>
  );
})}
```

3. **Click behavior**:
   - **Indexed repos**: Click to toggle checkbox (select/deselect for context)
   - **Non-indexed repos**: Click to start indexing

#### New CSS Styles

**File**: `desktop2/renderer2/src/components/Teams/TeamContext.css`

Added styles for different repository states:

```css
/* Indexing state */
.repo-status.indexing {
  background: rgba(0, 122, 255, 0.1);
  color: #007aff;
  border: 1px solid rgba(0, 122, 255, 0.15);
  display: flex;
  align-items: center;
  gap: 6px;
}

/* Not indexed state */
.repo-status.not-indexed-badge {
  background: rgba(255, 149, 0, 0.1);
  color: #ff9500;
  border: 1px solid rgba(255, 149, 0, 0.15);
}

/* Not indexed card styling */
.repo-card.not-indexed {
  opacity: 0.7;
  border-style: dashed;
}

.repo-card.not-indexed:hover {
  opacity: 1;
  border-style: solid;
  background: linear-gradient(135deg, rgba(255, 255, 255, 1) 0%, rgba(255, 245, 235, 0.5) 100%);
  border-color: rgba(255, 149, 0, 0.2);
}

/* Checkbox placeholder for non-indexed repos */
.checkbox-placeholder {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

/* Tiny spinner for indexing state */
.spinner-tiny {
  width: 10px;
  height: 10px;
  border: 2px solid rgba(0, 122, 255, 0.2);
  border-top-color: #007aff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
```

---

## New User Experience

### Connected Repositories Section

**Before**:
```
CONNECTED REPOSITORIES (0)
  [Empty orb icon]
  No repositories indexed yet
  [Index Your First Repository] button
```

**After**:
```
CONNECTED REPOSITORIES (3)
  ☑ BeachBaby                    [Indexed] ✅
     1,234 files • main
  
  ☐ mobile-app                   [Indexed]
     567 files • develop
  
  [ ] another-repo               [Click to Index] 🟠
     owner/another-repo
```

### Repository States

1. **Indexed + Selected** (✅ Green badge + Checked)
   - Has checkbox checked
   - Shows file count and branch
   - Green "Indexed" badge
   - Click to deselect from context

2. **Indexed + Not Selected** (✅ Green badge + Unchecked)
   - Has checkbox unchecked
   - Shows file count and branch
   - Green "Indexed" badge
   - Click to select for context

3. **Indexing** (🔵 Blue badge + Spinner)
   - No checkbox (placeholder space)
   - Shows owner/repo name
   - Blue "Indexing..." badge with spinner
   - Not clickable

4. **Not Indexed** (🟠 Orange badge + Dashed border)
   - No checkbox (placeholder space)
   - Shows owner/repo name
   - Orange "Click to Index" badge
   - Dashed border, slightly transparent
   - Click to start indexing

---

## Files Modified

### 1. App.jsx
**Path**: `desktop2/renderer2/src/App.jsx`

**Changes**:
- Wrapped ArcReactor in a container div with explicit visibility controls
- Added `display`, `pointerEvents`, and `visibility` CSS properties
- Ensures orb is completely non-interactive when hidden

### 2. TeamContext.jsx
**Path**: `desktop2/renderer2/src/components/Teams/TeamContext.jsx`

**Changes**:
- Added `useEffect` to load available repositories on mount
- Replaced conditional rendering logic to always show all repositories
- Added state detection for indexed/indexing/not-indexed repos
- Added checkbox selection logic for indexed repos
- Added click-to-index functionality for non-indexed repos
- Removed "Index Your First Repository" button from empty state

### 3. TeamContext.css
**Path**: `desktop2/renderer2/src/components/Teams/TeamContext.css`

**Changes**:
- Added `.repo-status.indexing` styles (blue badge with spinner)
- Added `.repo-status.not-indexed-badge` styles (orange badge)
- Added `.repo-card.not-indexed` styles (dashed border, transparent)
- Added `.repo-card.not-indexed:hover` styles (solid border, opaque)
- Added `.checkbox-placeholder` styles (spacing for non-indexed repos)
- Added `.spinner-tiny` styles (small spinner for indexing state)

---

## Benefits

### Orb Visibility Fix
✅ **No more ghost clicks** - Hidden orb doesn't interfere with UI
✅ **Clean separation** - Orb only interactive when visible
✅ **Better UX** - Users can't accidentally click hidden orb

### Repository UI Improvements
✅ **See all repositories** - All GitHub repos visible at once
✅ **Clear status indicators** - Easy to see indexed vs. not indexed
✅ **Quick indexing** - Click any repo to index it
✅ **Context selection** - Check/uncheck indexed repos for context
✅ **Visual feedback** - Different colors and styles for each state
✅ **No empty states** - Always shows available repositories

---

## Testing Checklist

### Orb Visibility
- [x] Open Mission Control → Orb disappears
- [x] Click where orb was → No interaction
- [x] Switch to different window → Orb appears
- [x] Click orb → Menu opens correctly
- [x] Close Mission Control → Orb reappears

### Repository UI
- [x] Open Team Context → All repos load automatically
- [x] See indexed repos with checkboxes
- [x] See non-indexed repos with "Click to Index" badge
- [x] Click non-indexed repo → Indexing starts
- [x] During indexing → Blue badge with spinner shows
- [x] After indexing → Green "Indexed" badge shows, checkbox appears
- [x] Check/uncheck indexed repos → Selection state updates
- [x] Selected repos used in team chat context

---

**Status**: ✅ COMPLETE

Both issues have been fixed and tested!

