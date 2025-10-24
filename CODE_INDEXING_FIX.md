# Code Indexing Fix - October 22, 2025

## Problem
Code indexing was not working because the repository name was being stored in the wrong format. The system expected `owner/repo` format (e.g., `facebook/react`) but was only storing the repository name (e.g., `react`).

## Root Cause
In `desktop2/renderer2/src/components/Tasks/TaskChat.jsx`, line 73 was using:
```javascript
setAvailableRepositories(response.repositories.map(repo => repo.name));
```

This only extracted the repository name, not the full `owner/repo` identifier.

## Solution
Changed to use the `full_name` field which contains the complete `owner/repo` format:
```javascript
setAvailableRepositories(response.repositories.map(repo => repo.full_name));
```

## How to Use Code Indexing

### 1. Prerequisites
- GitHub App or Personal Access Token configured in `.env`
- API server running (`npm run dev` from root or start API separately)
- Repositories accessible to your GitHub credentials

### 2. Index a Repository

#### Option A: Via Task Chat (Recommended)
1. Open any JIRA task in the desktop app
2. Click the GitHub icon in the chat input area
3. Select a repository from the list (now shows `owner/repo` format)
4. Type your question about the code
5. The AI will automatically query the indexed code

#### Option B: Via API
```bash
curl -X POST http://localhost:3000/api/engineering/index \
  -H "Content-Type: application/json" \
  -d '{
    "owner": "your-org",
    "repo": "your-repo",
    "branch": "main"
  }'
```

### 3. Query Indexed Code

Once indexed, you can ask questions like:
- "index the codebase" (will start indexing if not already done)
- "what authentication methods are implemented?"
- "show me the user registration flow"
- "where is the payment processing handled?"
- "what features have been built?"

### 4. Check Indexing Status

The system will log indexing progress:
```
🔨 Starting repository indexing
📊 Indexing progress: fetching files
📊 Indexing progress: chunking code
📊 Indexing progress: generating embeddings
✅ Repository indexing completed
```

## Architecture

### Components
1. **Frontend** (`desktop2/renderer2/src/components/Tasks/TaskChat.jsx`)
   - Repository selector UI
   - Sends queries with repository context

2. **IPC Handlers** (`desktop2/main/ipc/task-chat-handlers.js`)
   - Validates repository format (`owner/repo`)
   - Calls Engineering Intelligence API

3. **API Server** (`api/engineering/`)
   - `repos.js` - Lists available repositories
   - `index.js` - Starts indexing jobs
   - `query.js` - Queries indexed code

4. **Core Services** (`core/intelligence/`)
   - `code-indexer.js` - Orchestrates indexing pipeline
   - `repository-file-fetcher.js` - Fetches files from GitHub
   - `code-chunker.js` - Splits code into semantic chunks
   - `embedding-service.js` - Generates OpenAI embeddings
   - `code-query-engine.js` - Semantic search and AI answers

5. **Data Layer** (`data/storage/`)
   - `code-vector-store.js` - Supabase pgvector storage
   - Stores embeddings for semantic search

## Environment Variables Required

```bash
# GitHub Authentication (choose one)
GITHUB_APP_ID=your_app_id
GITHUB_APP_INSTALLATION_ID=your_installation_id
GITHUB_APP_PRIVATE_KEY_PATH=/path/to/private-key.pem
# OR
GITHUB_TOKEN=ghp_your_personal_access_token

# OpenAI (for embeddings and AI answers)
OPENAI_API_KEY=sk-your_openai_key

# Anthropic (for AI chat)
ANTHROPIC_API_KEY=sk-ant-your_anthropic_key

# Supabase (for vector storage)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key

# API Server
API_BASE_URL=http://localhost:3000
```

## Database Setup

Run the migration to create the vector store:
```sql
-- See: data/migrations/create-code-vector-store.sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE code_chunks (...);
```

## Costs

### OpenAI Embeddings
- Model: `text-embedding-3-small` (1536 dimensions)
- Cost: ~$0.02 per 1M tokens
- Average codebase (10K files): ~$5-10 to index

### Supabase Storage
- Vector storage: ~1KB per chunk
- Average codebase: ~100MB-1GB of vectors
- Free tier: 500MB included

### Anthropic Claude
- Model: Sonnet 4.5
- Cost: $3 per 1M input tokens, $15 per 1M output tokens
- Per query: ~$0.01-0.05 depending on context size

## Troubleshooting

### "Invalid repository format" error
- **Cause**: Repository not in `owner/repo` format
- **Fix**: Applied in this update - use `full_name` from API

### "Repository is already being indexed"
- **Cause**: Indexing job already in progress
- **Fix**: Wait for current job to complete (check logs)

### "No repositories found"
- **Cause**: GitHub credentials not configured or no repos accessible
- **Fix**: Check `.env` file and GitHub App/Token permissions

### Indexing fails silently
- **Cause**: API server not running
- **Fix**: Start API server with `npm run dev` or check `http://localhost:3000`

### Code context not appearing in chat
- **Cause**: Repository not indexed yet
- **Fix**: Index the repository first, then query

## Testing

Test the fix:
```bash
# 1. Start the desktop app
cd desktop2 && npm run dev

# 2. Open a JIRA task
# 3. Click GitHub icon
# 4. Verify repositories show as "owner/repo" format
# 5. Select a repository
# 6. Type: "index the codebase"
# 7. Check logs for indexing progress
# 8. Ask: "what features have been built?"
```

## Next Steps

1. ✅ **Fixed**: Repository format issue
2. 🔄 **In Progress**: Automatic indexing on repository connection
3. 📋 **Planned**: Index status UI in settings
4. 📋 **Planned**: Incremental indexing (only new/changed files)
5. 📋 **Planned**: Multi-repository queries

## Related Files

- `desktop2/renderer2/src/components/Tasks/TaskChat.jsx` - **FIXED**
- `desktop2/main/ipc/task-chat-handlers.js` - Validates format
- `api/engineering/repos.js` - Returns `full_name`
- `api/engineering/index.js` - Starts indexing
- `api/engineering/query.js` - Queries code
- `core/intelligence/code-indexer.js` - Indexing pipeline
- `data/storage/code-vector-store.js` - Vector storage

## Support

For issues or questions:
1. Check logs in `desktop2/logs/` and `logs/engineering-api.log`
2. Verify environment variables are set
3. Ensure API server is running
4. Check GitHub App/Token permissions

