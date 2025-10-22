# Code Indexer API Fix

## 🐛 Error

```
Error: window.electronAPI.codeIndexer.listRepositories is not a function
```

**Where**: Code Indexer page when loading repositories

## 🔍 Root Cause

**Mismatch** between frontend and backend API naming:

### Frontend (CodeIndexer.jsx)
```javascript
const result = await window.electronAPI.codeIndexer.listRepositories();  // ❌ Wrong
```

### Backend (preload.js)
```javascript
github: {
  listRepositories: () => ipcRenderer.invoke('github:listRepositories')  // ✅ Actual location
}
```

The `listRepositories` function was implemented under `github` namespace, not `codeIndexer` namespace.

## ✅ Fix Applied

**File**: `renderer/src/pages/CodeIndexer.jsx` (line 43)

```javascript
// ❌ Before
const result = await window.electronAPI.codeIndexer.listRepositories();

// ✅ After
const result = await window.electronAPI.github.listRepositories();
```

## 📊 API Structure

### Correct API Structure

```javascript
window.electronAPI = {
  // GitHub operations (repository management)
  github: {
    listRepositories: () => ...  // ✅ List all repos
    getRepository: (params) => ...
  },
  
  // Code Indexer operations (indexing & querying)
  codeIndexer: {
    indexRepository: (params) => ...   // Index a repo
    query: (params) => ...             // Query indexed code
    getStatus: (params) => ...         // Get indexing status
    checkAvailability: () => ...       // Check if configured
    getJobStatus: (params) => ...      // Get job progress
  }
}
```

### Logical Separation

**`github.*`**: Repository-level operations
- List repositories
- Get repository info
- Access control

**`codeIndexer.*`**: Code analysis operations  
- Index codebase
- Query code
- Check indexing status

## ✅ Status

**FIXED** - Code Indexer page will now load repositories correctly

### Next Steps

App will **auto-reload** (Vite HMR). Click on "Code Indexer" tab again and it should work!

---

**Fix Date**: October 21, 2025
**Issue**: Wrong API namespace for listRepositories
**Resolution**: Changed from `codeIndexer.listRepositories` to `github.listRepositories`

