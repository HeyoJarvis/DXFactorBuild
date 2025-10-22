# Code Indexer Integration - Setup Complete ✅

## Overview

The Code Indexer has been successfully integrated into your `extra_feature_desktop` app! This allows you to:

- 📚 **Index GitHub repositories** with semantic search capabilities
- 🔍 **Query codebases** using natural language questions
- 💡 **Get AI-powered answers** about code functionality and architecture
- 📊 **Track indexing progress** with real-time status updates

## What Was Implemented

### 1. ✅ IPC Handlers Created
**File**: `main/ipc/code-indexer-handlers.js`

Provides the following APIs:
- `codeIndexer:indexRepository` - Index a GitHub repository
- `codeIndexer:query` - Ask questions about indexed code
- `codeIndexer:getStatus` - Get indexing status for a repository
- `codeIndexer:checkAvailability` - Check if code indexer is configured
- `codeIndexer:getJobStatus` - Track indexing job progress
- `codeIndexer:listRepositories` - List accessible GitHub repositories

### 2. ✅ Main Process Updated
**File**: `main/index.js`

- Imported `CodeIndexer` service from `@heyjarvis/core`
- Initialized CodeIndexer with error handling
- Added to services object
- Registered IPC handlers

### 3. ✅ Bridge APIs Exposed
**File**: `bridge/preload.js`

Added `window.electronAPI.codeIndexer` with all methods exposed to the renderer.

### 4. ✅ Database Migration Ready
**File**: `migrations/002_code_vector_store.sql`

Creates:
- `code_chunks` table with pgvector support
- `code_indexing_status` table for tracking
- Similarity search functions
- Optimized indexes

### 5. ✅ Environment Variables Verified

All required variables are set in your root `.env`:
- ✅ `GITHUB_APP_ID=2081293`
- ✅ `GITHUB_APP_INSTALLATION_ID=89170981`
- ✅ `GITHUB_APP_PRIVATE_KEY_PATH=/home/sdalal/Downloads/sales-information.2025-10-07.private-key.pem`
- ✅ `OPENAI_API_KEY=sk-proj-...` (for embeddings)
- ✅ `ANTHROPIC_API_KEY=sk-ant-...` (for Claude AI)
- ✅ `SUPABASE_URL=https://ydbujcuddfgiubjjajuq.supabase.co`
- ✅ `SUPABASE_ANON_KEY=eyJh...`

## Next Steps

### Step 1: Run Database Migration

You need to run the SQL migration in your Supabase instance. **Choose one option:**

#### Option A: Minimal Version (Recommended - No Memory Issues) ✅

**Best for Supabase free tier or if you get memory errors**

1. Go to https://app.supabase.com/project/ydbujcuddfgiubjjajuq/sql/new
2. Copy **ALL contents** of `migrations/002_code_vector_store_minimal.sql`
3. Paste into SQL Editor and click **"Run"**

This creates all tables and functions but **skips the vector index** to avoid memory constraints. The code indexer will still work, just slightly slower on large datasets. You can add the index later after indexing some data.

#### Option B: Full Version (May Require Memory)

**Only if you have enough memory (Pro plan or higher)**

1. Go to https://app.supabase.com/project/ydbujcuddfgiubjjajuq/sql/new
2. Copy **ALL contents** of `migrations/002_code_vector_store_idempotent.sql`
3. Paste into SQL Editor and click **"Run"**

This version attempts to create the vector index with automatic fallback if memory is constrained.

#### Adding Vector Index Later (Optional)

After you've indexed some repositories and want to speed up searches:

1. Run `migrations/002b_create_vector_index_later.sql`
2. This creates the index with optimal settings based on your data size

**Common Errors:**
- **"trigger already exists"** → Use the idempotent or minimal version
- **"memory required is 61 MB"** → Use the minimal version (skip index)
- **"relation does not exist"** → Make sure you ran the migration

**To start completely fresh:** Run `CLEANUP_code_vector_store.sql` first, then the minimal version.

### Step 2: Start the Application

```bash
cd /home/sdalal/test/BeachBaby/extra_feature_desktop
npm run dev
```

The app will start with Code Indexer initialized. Check the logs:
```
logs/main.log
```

You should see:
```
✅ Code Indexer initialized
✅ Code Indexer IPC handlers registered
```

### Step 3: Test from Frontend

Use the Code Indexer APIs in your React components:

#### Check Availability
```javascript
const availability = await window.electronAPI.codeIndexer.checkAvailability();
console.log('Code Indexer available:', availability.available);
console.log('Configuration:', availability.configured);
```

#### List Repositories
```javascript
const result = await window.electronAPI.codeIndexer.listRepositories();
console.log('Repositories:', result.repositories);
```

#### Index a Repository
```javascript
const indexResult = await window.electronAPI.codeIndexer.indexRepository({
  owner: 'your-org',
  repo: 'your-repo',
  branch: 'main'
});

if (indexResult.success) {
  console.log('Indexed chunks:', indexResult.result.chunks);
  console.log('Processing time:', indexResult.result.processingTime);
}
```

#### Query the Codebase
```javascript
const answer = await window.electronAPI.codeIndexer.query({
  query: 'How does user authentication work?',
  owner: 'your-org',
  repo: 'your-repo'
});

if (answer.success) {
  console.log('Answer:', answer.data.answer);
  console.log('References:', answer.data.references);
  console.log('Confidence:', answer.data.confidence);
}
```

#### Check Indexing Status
```javascript
const status = await window.electronAPI.codeIndexer.getStatus({
  owner: 'your-org',
  repo: 'your-repo',
  branch: 'main'
});

console.log('Status:', status.status);
```

## Example Usage Flow

```javascript
// 1. Check if available
const { available } = await window.electronAPI.codeIndexer.checkAvailability();
if (!available) {
  console.error('Code Indexer not configured');
  return;
}

// 2. List repositories
const { repositories } = await window.electronAPI.codeIndexer.listRepositories();
console.log(`Found ${repositories.length} repositories`);

// 3. Select a repository and index it
const repo = repositories[0];
const indexResult = await window.electronAPI.codeIndexer.indexRepository({
  owner: repo.owner,
  repo: repo.name,
  branch: repo.default_branch
});

// 4. Ask questions
const answer = await window.electronAPI.codeIndexer.query({
  query: 'What APIs does this service expose?',
  owner: repo.owner,
  repo: repo.name
});

console.log(answer.data.answer);
```

## Architecture

```
GitHub Repository (via GitHub App)
    ↓
Repository File Fetcher (fetch code files)
    ↓
Code Chunker (split into semantic chunks)
    ↓
Embedding Service (OpenAI text-embedding-3-small)
    ↓
Vector Store (Supabase pgvector)
    ↓
Code Query Engine (Claude AI + semantic search)
    ↓
Natural Language Answers
```

## Components

### Core Services (from `@heyjarvis/core`)

1. **CodeIndexer** - Main orchestrator
2. **RepositoryFileFetcher** - Fetches code from GitHub
3. **CodeChunker** - Splits code into semantic chunks
4. **EmbeddingService** - Generates vector embeddings
5. **CodeVectorStore** - Manages pgvector storage
6. **CodeQueryEngine** - Answers questions with AI

All services include:
- ✅ Progress tracking and events
- ✅ Error handling and recovery
- ✅ Structured logging
- ✅ Rate limiting and retries

## What Questions Can You Ask?

The code indexer understands:

✅ **Functionality**: "How does user authentication work?"
✅ **Architecture**: "What's the database schema?"
✅ **APIs**: "What endpoints does this service expose?"
✅ **Patterns**: "How do we handle errors?"
✅ **Features**: "Can we integrate with Stripe?"
✅ **Implementation**: "Where is payment processing implemented?"

❌ **Changes**: "What changed last week?" (Not yet supported)
❌ **Diffs**: "Show me the latest commit" (Not yet supported)

## Logs and Debugging

Monitor these log files:
- `logs/main.log` - Main process and service initialization
- `logs/code-indexer.log` - Indexing operations
- `logs/file-fetcher.log` - GitHub API calls
- `logs/code-chunker.log` - Code parsing
- `logs/embedding-service.log` - OpenAI API calls
- `logs/vector-store.log` - Database operations
- `logs/query-engine.log` - Query processing

## Troubleshooting

### "Code Indexer not available"
- Check that all environment variables are set
- Verify GitHub App credentials are valid
- Ensure OpenAI and Anthropic API keys are active

### "Failed to fetch repository"
- Verify the repository is accessible via your GitHub App
- Check GitHub App installation permissions
- Review file-fetcher.log for API errors

### "Failed to generate embedding"
- Verify OpenAI API key is valid
- Check OpenAI billing/quota
- Review embedding-service.log for details

### "Search failed"
- Ensure database migration was run
- Verify Supabase connection
- Check vector-store.log for SQL errors

## Performance

### Indexing Time (approximate)
- Small repo (<100 files): 1-2 minutes
- Medium repo (100-500 files): 5-10 minutes
- Large repo (500+ files): 15-30 minutes

### Query Time
- Typically 2-5 seconds per query
- Includes semantic search + Claude AI processing

### Costs
- OpenAI embeddings: ~$0.01 per 1000 chunks
- Anthropic queries: ~$0.015 per query (Sonnet)

## Security Notes

- GitHub App authentication is secure and scoped
- Private keys are read from filesystem (not stored in code)
- API keys are environment variables only
- Vector embeddings stored in your Supabase instance

## Support

If you encounter issues:
1. Check logs in `logs/` directory
2. Review environment variables
3. Verify database migration was successful
4. Test GitHub App permissions

---

**Status**: ✅ Ready to use after database migration
**Last Updated**: October 21, 2025

