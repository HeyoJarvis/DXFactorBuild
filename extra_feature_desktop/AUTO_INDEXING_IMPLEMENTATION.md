# Auto-Indexing Implementation

## 🎯 User Requirement

> "When a repo is chosen, I want it to be indexed. I am choosing mark 1 which is indexed."

**Goal**: Automatically index repositories when they're selected in the context picker if they're not already indexed.

## 📊 Current State

### Mark-I Repository
- ✅ **Status**: Completed
- ✅ **Indexed Chunks**: 597
- ✅ **Files**: 436
- ✅ **Duration**: ~71 seconds

### Issue
When querying "Do you have access to github?", the system returns 0 code chunks because:
1. The question is too generic (not code-specific)
2. No relevant code chunks match this query
3. User isn't informed about indexing status

## ✅ Implementation

### Feature: Auto-Indexing on Repository Selection

**File**: `main/ipc/intelligence-handlers.js` (lines 153-231)

#### Flow Diagram

```
User selects repository
        ↓
Check indexing status
        ↓
    ┌───┴───────────────────────────────────┐
    │                                       │
Not indexed                           Indexed
or failed                                  │
    │                                       ↓
    ↓                               Query codebase
Trigger auto-indexing                      │
    │                                       ↓
    ↓                               ┌──────┴──────┐
Return "Indexing..."           Found results   No results
message                              │            │
                                     ↓            ↓
                            Return code      Helpful message
                            chunks           + total chunks
```

### Status Handling

#### 1. **Not Indexed** (status = null, 'pending', or 'failed')
```javascript
if (!status || status.status === 'failed' || status.status === 'pending') {
  // Trigger auto-indexing (non-blocking)
  codeIndexer.indexRepository(repo.owner, repo.name, 'main');
  
  return {
    answer: `The repository ${repo.owner}/${repo.name} is being indexed for 
    the first time. This will take a few minutes. You can ask questions about 
    the code once indexing is complete.`,
    sources: [],
    indexing: true
  };
}
```

**User sees**: "The repository HeyoJarvis/Mark-I is being indexed..."

#### 2. **Currently Indexing** (status = 'in_progress')
```javascript
if (status.status === 'in_progress') {
  const progress = status.progress_percentage || 0;
  
  return {
    answer: `The repository ${repo.owner}/${repo.name} is currently being 
    indexed (${progress}% complete). Please wait a moment and try again.`,
    sources: [],
    indexing: true
  };
}
```

**User sees**: "The repository HeyoJarvis/Mark-I is currently being indexed (45% complete)..."

#### 3. **Indexed - Query Successful** (status = 'completed', chunks found)
```javascript
if (result.chunks && result.chunks.length > 0) {
  return {
    answer: result.answer,  // AI-generated answer
    sources: result.chunks.map(chunk => ({
      type: 'code',
      file: chunk.file_path,
      content: chunk.content,
      repository: `${repo.owner}/${repo.name}`
    }))
  };
}
```

**User sees**: Actual code chunks and AI answer about the code

#### 4. **Indexed - No Relevant Results** (status = 'completed', no chunks found)
```javascript
if (!result.chunks || result.chunks.length === 0) {
  return {
    answer: `No relevant code found in ${repo.owner}/${repo.name} for this 
    question. The repository has ${status.indexed_chunks} code chunks indexed. 
    Try asking a more specific question about the codebase.`,
    sources: [],
    noResults: true
  };
}
```

**User sees**: "No relevant code found in HeyoJarvis/Mark-I for this question. The repository has 597 code chunks indexed. Try asking a more specific question about the codebase."

## 📝 Enhanced User Experience

### Before Fix ❌

**User**: Selects Mark-I, asks "Do you have access to github?"

**Response**: Generic answer about GitHub integration capabilities (0 code chunks shown)

**Problem**: User doesn't know if repo is indexed or why no code is shown

### After Fix ✅

**Scenario 1**: Unindexed Repository

**User**: Selects Brand-New-Repo

**Response**: "The repository HeyoJarvis/Brand-New-Repo is being indexed for the first time. This will take a few minutes..."

**User knows**: Repository is being indexed, wait a bit

---

**Scenario 2**: Indexing in Progress

**User**: Selects repo being indexed

**Response**: "The repository HeyoJarvis/Brand-New-Repo is currently being indexed (67% complete). Please wait a moment..."

**User knows**: Indexing is happening, can see progress

---

**Scenario 3**: Generic Question

**User**: Selects Mark-I (indexed), asks "Do you have access to github?"

**Response**: "No relevant code found in HeyoJarvis/Mark-I for this question. The repository has 597 code chunks indexed. Try asking a more specific question about the codebase."

**User knows**: 
- Repository IS indexed (597 chunks!)
- Question is too generic
- Should ask more specific code questions

---

**Scenario 4**: Specific Code Question

**User**: Selects Mark-I, asks "How does the email service work?"

**Response**: *Shows actual code chunks from email-related files with AI explanation*

**User gets**: Actual code context and answers

## 🔍 Example Queries

### Good Questions (Will Find Code)
- "How does authentication work?"
- "Show me the database models"
- "What API endpoints exist?"
- "How is error handling done?"
- "What's in the configuration?"

### Generic Questions (Might Not Find Code)
- "Hi"
- "Do you have access to github?"
- "What is this?"
- "Tell me about the project"

**For generic questions**: AI will use meeting/JIRA context instead

## 🎯 Benefits

### 1. Automatic Indexing
- ✅ No manual indexing needed
- ✅ Happens in background
- ✅ One-time per repository

### 2. Clear Status Communication
- ✅ User knows if repo is being indexed
- ✅ Progress updates shown
- ✅ Clear messaging when no results found

### 3. Better Query Guidance
- ✅ Tells user how many chunks are indexed
- ✅ Suggests asking more specific questions
- ✅ Shows total indexed content available

### 4. Graceful Degradation
- ✅ If indexing fails, can retry
- ✅ If no chunks found, explains why
- ✅ Never leaves user confused

## 🧪 Testing

### Test 1: Select Unindexed Repository

1. Select a repository that's never been indexed
2. Ask any question
3. **Expected**: "Repository is being indexed..." message
4. Wait ~1-2 minutes
5. Ask again
6. **Expected**: Code results or helpful "no results" message

### Test 2: Select Indexed Repository (Generic Question)

1. Select Mark-I (indexed)
2. Ask "Hi"
3. **Expected**: "No relevant code found... repository has 597 chunks... try specific question"

### Test 3: Select Indexed Repository (Specific Question)

1. Select Mark-I (indexed)
2. Ask "How does the email service work?"
3. **Expected**: Code chunks from email-related files with AI explanation

### Test 4: Monitor Indexing Progress

1. Trigger indexing on new repo
2. Immediately ask question
3. **Expected**: "Currently being indexed (X% complete)"
4. Ask again after a few seconds
5. **Expected**: Progress percentage should increase

## ✅ Status

**IMPLEMENTED** - Auto-indexing with status awareness:

1. ✅ Auto-triggers indexing for unindexed repositories
2. ✅ Shows progress for in-progress indexing
3. ✅ Provides helpful messages when no code found
4. ✅ Shows total indexed chunks to guide user
5. ✅ Non-blocking (indexing happens in background)

### Impact

- **User experience**: Never confused about indexing status
- **Automatic**: No manual indexing required
- **Transparent**: Clear messaging at each step
- **Helpful**: Guides user to ask better questions

---

**Implementation Date**: October 21, 2025
**Feature**: Auto-indexing repositories on selection
**Status**: Complete and tested

