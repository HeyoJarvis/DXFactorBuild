# Owner Object vs String Fix

## 🐛 Issue

When querying an already-indexed repository (Mark-I), the system was trying to **re-index it** AND failing with a malformed GitHub API URL:

```
GET /repos/login,HeyoJarvis,id,227484731,avatar_url,https%3A%2F%2F...
```

**Status**: Mark-I is already indexed (597 chunks), so it shouldn't be re-indexing.

## 🔍 Root Cause

### Data Structure Mismatch

When a repository is selected from the context picker, the `owner` field can be:

**From GitHub API** (object):
```javascript
{
  owner: {
    login: "HeyoJarvis",
    id: 227484731,
    avatar_url: "...",
    // ... many more properties
  },
  name: "Mark-I"
}
```

**Expected by indexer** (string):
```javascript
{
  owner: "HeyoJarvis",  // Just the string!
  name: "Mark-I"
}
```

### The Problem

When passing `repo.owner` (an object) to `codeIndexer.indexRepository()`, the GitHub API client tried to use the entire object as the owner name, creating a malformed URL.

## ✅ Fix Applied

**File**: `main/ipc/intelligence-handlers.js` (line 163-165)

### Before ❌
```javascript
const repo = repositories[0];

logger.info('Querying code context', { 
  owner: repo.owner,  // Could be object or string
  repo: repo.name 
});

const status = await codeIndexer.vectorStore.getIndexingStatus(
  repo.owner,  // ❌ Object passed when string expected
  repo.name, 
  'main'
);
```

### After ✅
```javascript
const repo = repositories[0];

// Normalize owner - could be string or object
const ownerName = typeof repo.owner === 'object' ? repo.owner.login : repo.owner;
const repoName = repo.name;

logger.info('Querying code context', { 
  owner: ownerName,  // ✅ Always a string
  repo: repoName 
});

const status = await codeIndexer.vectorStore.getIndexingStatus(
  ownerName,  // ✅ String passed
  repoName, 
  'main'
);
```

### All References Fixed

Updated **everywhere** the owner is used:
1. Status checking (line 168-172)
2. Auto-indexing trigger (line 183)
3. Progress messages (line 200, 210)
4. Query execution (line 218-219)
5. Result messages (line 231, 243)

## 📊 Data Flow

### Frontend → Backend

**Frontend** (TeamChat.jsx - Context Picker):
```javascript
session.context.repositories = [
  {
    owner: { login: "HeyoJarvis", ... },  // Full object from GitHub API
    name: "Mark-I"
  }
]
```

**Backend Receives** (intelligence-handlers.js):
```javascript
contextFilter.repositories = [
  {
    owner: { login: "HeyoJarvis", ... },  // Full object
    name: "Mark-I"
  }
]
```

**Backend Normalizes**:
```javascript
const ownerName = typeof repo.owner === 'object' 
  ? repo.owner.login   // Extract login from object
  : repo.owner;        // Already a string
// ownerName = "HeyoJarvis"
```

## 🎯 Why It Was Re-indexing

When the status check failed (because it was passing an object instead of a string), the function thought the repository was **not indexed** and triggered auto-indexing.

The actual status:
```javascript
// What should have been passed:
getIndexingStatus("HeyoJarvis", "Mark-I", "main")
// Returns: { status: "completed", indexed_chunks: 597, ... }

// What was being passed:
getIndexingStatus({ login: "HeyoJarvis", ... }, "Mark-I", "main")  
// Returns: null (no match found!)
```

Since status was `null`, the code thought it wasn't indexed!

## ✅ Expected Behavior Now

### Scenario 1: Already Indexed Repository (Mark-I)

**User**: Selects Mark-I, asks "is the jira feature setup in the repo?"

**Backend**:
1. Normalizes owner: `{ login: "HeyoJarvis", ... }` → `"HeyoJarvis"`
2. Checks status: ✅ Found (status = "completed", 597 chunks)
3. Queries indexed code for "jira feature"
4. Returns relevant code chunks or "no relevant code found"

**No re-indexing triggered!**

### Scenario 2: Unindexed Repository

**User**: Selects NewRepo, asks question

**Backend**:
1. Normalizes owner: `{ login: "HeyoJarvis", ... }` → `"HeyoJarvis"`
2. Checks status: ❌ Not found (status = null)
3. Triggers indexing with correct string owner
4. Returns "Repository is being indexed..."

**Auto-indexing works correctly**

## 🧪 Testing

### Test 1: Already Indexed Repository

1. Select Mark-I in context picker
2. Ask: "show me the authentication code"
3. **Expected**: 
   - No re-indexing
   - Returns code chunks or "no relevant code"
   - Check logs: Should see "Repository is indexed, query it" (not "triggering auto-indexing")

### Test 2: Check Terminal Logs

Look for:
```
Querying code context: { owner: "HeyoJarvis", repo: "Mark-I" }  // ✅ String!
```

NOT:
```
Querying code context: { owner: { login: "HeyoJarvis", ... } }  // ❌ Object
```

## ✅ Status

**FIXED** - Owner field now properly normalized:

1. ✅ Handles both object and string formats
2. ✅ Always extracts string owner name for API calls
3. ✅ Status check works correctly
4. ✅ No unwanted re-indexing of already-indexed repos
5. ✅ Auto-indexing works for unindexed repos

### Impact

- **Already indexed repos**: No more re-indexing attempts
- **API calls**: No more malformed URLs
- **Performance**: Faster (no unnecessary indexing)
- **Reliability**: Status checks work correctly

---

**Fix Date**: October 21, 2025
**Issue**: Owner object passed instead of owner string
**Resolution**: Added normalization to extract `owner.login` from object

