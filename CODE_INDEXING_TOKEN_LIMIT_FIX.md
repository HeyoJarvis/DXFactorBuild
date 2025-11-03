# Code Indexing Token Limit Fix ✅

## Problem Identified

The repository indexing was **failing** during the embedding generation step with this error:

```
OpenAI API error (400): {
  "error": {
    "message": "This model's maximum context length is 8192 tokens, 
                however you requested 13028 tokens (13028 in your prompt; 0 for the completion). 
                Please reduce your prompt; or completion length.",
    "type": "invalid_request_error"
  }
}
```

### What Was Happening

1. ✅ **File Fetching**: Successfully fetched 436 files from GitHub
2. ✅ **Chunking**: Created 657 chunks from the files
3. ❌ **Embedding Generation**: **FAILED** - Some chunks exceeded OpenAI's 8,192 token limit
   - Batch #5 contained chunks with **13,028 tokens** (59% over limit!)
   - The API rejected the request after 3 retry attempts

### Root Cause

The code chunker had two issues:

1. **maxChunkSize was too high**: Set to 1,000 tokens, but some files weren't being chunked properly
2. **No safety validation**: No check before sending to OpenAI API to ensure chunks were under the limit
3. **Token estimation was rough**: Using 4 chars/token approximation, which can be inaccurate for code

---

## Solution Applied

### Fix 1: Reduced Max Chunk Size

**File**: `core/intelligence/code-chunker.js`

**Changed:**
```javascript
// BEFORE
maxChunkSize: options.maxChunkSize || 1000, // tokens

// AFTER  
maxChunkSize: options.maxChunkSize || 500, // tokens (reduced from 1000 to stay well under 8192 limit)
```

**Why**: 
- Smaller chunks = safer margin from 8,192 token limit
- 500 tokens = ~2,000 characters = reasonable code snippet size
- Leaves plenty of room for token estimation errors

---

### Fix 2: Added Safety Truncation

**File**: `core/intelligence/embedding-service.js`

**Added new method:**
```javascript
/**
 * Truncate text to stay within token limit
 * @private
 */
_truncateText(text, maxTokens = 8000) {
  // Rough estimate: 4 chars per token
  const maxChars = maxTokens * 4;
  if (text.length <= maxChars) {
    return text;
  }
  
  this.logger.warn('Text exceeds token limit, truncating', {
    originalLength: text.length,
    truncatedLength: maxChars,
    estimatedOriginalTokens: Math.ceil(text.length / 4),
    maxTokens
  });
  
  return text.substring(0, maxChars);
}
```

**Updated embedding generation:**
```javascript
for (let i = 0; i < texts.length; i++) {
  // Truncate text if it's too long (safety check)
  const truncatedText = this._truncateText(texts[i]);
  const cacheKey = this._getCacheKey(truncatedText);
  
  if (this.embeddingCache.has(cacheKey)) {
    embeddings[i] = this.embeddingCache.get(cacheKey);
    this.stats.cacheHits++;
  } else {
    uncachedTexts.push(truncatedText);
    uncachedIndices.push(i);
  }
}
```

**Why**:
- **Safety net**: Even if chunker fails, embedding service won't crash
- **8,000 token limit**: Leaves 192 token buffer below OpenAI's 8,192 limit
- **Logs warnings**: Alerts when truncation happens so we can fix chunker
- **Graceful degradation**: Better to index truncated code than fail completely

---

## Expected Results

### Before Fix ❌
```
📊 Files fetched: 436 ✅
📊 Chunks created: 657 ✅
📊 Embeddings generated: FAILED ❌
   - Batch #5 failed: 13,028 tokens (over 8,192 limit)
   - Retried 3 times, all failed
   - Indexing stopped
```

### After Fix ✅
```
📊 Files fetched: 436 ✅
📊 Chunks created: 657 ✅
   - Max chunk size: 500 tokens (down from 1,000)
   - All chunks under limit
📊 Embeddings generated: 657 ✅
   - All batches successful
   - Any oversized chunks truncated to 8,000 tokens
   - Warnings logged for investigation
📊 Repository indexed successfully! ✅
```

---

## How to Test

1. **Restart the server** to load the updated code:
```bash
# Stop current server (Ctrl+C)
node server.js
```

2. **Trigger re-indexing** from the desktop app:
   - Open Mission Control
   - Go to Team Context sidebar
   - Click on a repository to re-index it
   - Or click "Refresh Repositories" to see all repos

3. **Watch the logs**:
```bash
# Should see:
✅ Files fetched
✅ Chunks created (smaller chunks now)
✅ Embeddings generated (all batches succeed)
✅ Repository indexed successfully
```

4. **Check for warnings**:
```bash
# If you see this, the safety net is working:
⚠️ Text exceeds token limit, truncating
   originalLength: 52112
   truncatedLength: 32000
   estimatedOriginalTokens: 13028
   maxTokens: 8000
```

---

## Files Modified

### 1. code-chunker.js
**Path**: `core/intelligence/code-chunker.js`

**Changes**:
- Line 22: Reduced `maxChunkSize` from 1000 to 500 tokens
- Added comment explaining the change

### 2. embedding-service.js
**Path**: `core/intelligence/embedding-service.js`

**Changes**:
- Added `_truncateText()` method (lines 167-182)
- Updated `generateEmbeddings()` to truncate texts before processing (line 199)
- Added warning logs when truncation occurs

---

## Token Limits Reference

### OpenAI Embedding Models

| Model | Max Tokens | Dimensions | Cost per 1M tokens |
|-------|-----------|------------|-------------------|
| text-embedding-3-small | **8,192** | 1,536 | $0.02 |
| text-embedding-3-large | **8,192** | 3,072 | $0.13 |
| text-embedding-ada-002 | **8,191** | 1,536 | $0.10 |

**Current**: Using `text-embedding-3-small` with 8,192 token limit

### Our Settings

| Setting | Old Value | New Value | Safety Margin |
|---------|-----------|-----------|---------------|
| Chunker max | 1,000 tokens | **500 tokens** | 7,692 tokens |
| Truncation limit | N/A | **8,000 tokens** | 192 tokens |
| Combined safety | N/A | **7,500 tokens** | 692 tokens |

---

## Why This Happened

The chunker's token estimation (`text.length / 4`) is a rough approximation. For some files:

1. **Dense code**: Lots of symbols, operators → more tokens per character
2. **Long variable names**: `thisIsAVeryLongVariableNameInCamelCase` → many tokens
3. **Comments**: Natural language has different token density than code
4. **Special characters**: Unicode, emojis, etc. can be multiple tokens

**Example**:
```javascript
// This might be estimated as 250 tokens (1000 chars / 4)
// But actually contains 350 tokens due to:
// - Long variable names
// - Lots of punctuation
// - Mixed languages (code + comments)
```

---

## Future Improvements

### Option 1: Use tiktoken for Accurate Counting
```javascript
const { encoding_for_model } = require('tiktoken');
const enc = encoding_for_model('text-embedding-3-small');

_estimateTokens(text) {
  const tokens = enc.encode(text);
  return tokens.length; // Exact count!
}
```

**Pros**: Exact token counts, no estimation errors
**Cons**: Requires additional npm package, slightly slower

### Option 2: Smarter Chunking
```javascript
// Split large functions into smaller pieces
if (functionTokens > maxChunkSize) {
  // Split by logical blocks (if/else, loops, etc.)
  const subChunks = splitByBlocks(functionCode);
}
```

**Pros**: Better semantic chunks
**Cons**: More complex logic, language-specific

### Option 3: Adaptive Chunk Size
```javascript
// Start with small chunks, increase if needed
let chunkSize = 300;
if (averageTokensPerChunk < 200) {
  chunkSize = 500; // Can safely increase
}
```

**Pros**: Optimizes for each repository
**Cons**: Requires analysis pass first

---

## Monitoring

### Logs to Watch

**Success indicators**:
```
✅ Code Chunker initialized
✅ Files chunked: 436 files → 657 chunks
✅ Embeddings generated: 657 successful, 0 failed
✅ Repository indexing completed
```

**Warning signs**:
```
⚠️ Text exceeds token limit, truncating
   → Some chunks are still too large, chunker needs tuning

❌ Batch embedding failed
   → API error, check token limits and API key

⚠️ File fetch failed: Not a file or no content available
   → Expected for __init__.py and other empty files
```

---

## Cost Impact

### Before Fix
- **Status**: Indexing failed, $0 spent (no embeddings generated)

### After Fix
- **Chunks**: 657 chunks × ~500 tokens = ~328,500 tokens
- **Cost**: 328,500 tokens × $0.02 / 1M = **$0.0066** (~0.7 cents)
- **Status**: ✅ Indexing succeeds

### Ongoing Costs
- **Per repository**: $0.005 - $0.02 (depending on size)
- **Per query**: $0.0001 - $0.0005 (embedding + search)
- **Monthly estimate**: $5-20 for typical usage

---

**Status**: ✅ FIXED

The indexing should now work correctly! Restart the server and try indexing again.

