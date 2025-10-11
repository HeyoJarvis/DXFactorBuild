# Code Indexer Setup Guide

## Overview

The Code Indexer enables sales executives to query GitHub repositories using natural language. It builds a semantic search index of your codebase and provides business-friendly answers to technical questions.

## Architecture

```
GitHub Repository
    ↓
Repository File Fetcher (fetch code files)
    ↓
Code Chunker (split into semantic chunks)
    ↓
Embedding Service (OpenAI embeddings)
    ↓
Vector Store (Supabase pgvector)
    ↓
Code Query Engine (Claude AI + semantic search)
    ↓
Natural Language Answers
```

## Prerequisites

You need the following API keys and services configured:

1. **GitHub App** (for repository access)
2. **OpenAI API Key** (for embeddings)
3. **Anthropic API Key** (for answering questions)
4. **Supabase** (for vector storage)

## Setup Instructions

### 1. Configure Environment Variables

Add these to your `.env` file:

```bash
# GitHub App (already configured)
GITHUB_APP_ID=your_app_id
GITHUB_APP_INSTALLATION_ID=your_installation_id
GITHUB_APP_PRIVATE_KEY_PATH=/path/to/private-key.pem

# OpenAI (Required for embeddings)
OPENAI_API_KEY=your_openai_api_key_here

# Anthropic (already configured)
ANTHROPIC_API_KEY=your_anthropic_key

# Supabase (already configured)
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_key
```

### 2. Run Database Migration

Connect to your Supabase instance and run the migration:

```bash
# Run this SQL in your Supabase SQL Editor
cat data/migrations/create-code-vector-store.sql
```

Or use the Supabase CLI:

```bash
supabase migration new create_code_vector_store
# Copy contents of data/migrations/create-code-vector-store.sql
supabase db push
```

This creates:
- `code_chunks` table with pgvector support
- `code_indexing_status` table for tracking progress
- Similarity search function
- Indexes for fast retrieval

### 3. Verify Setup

Start the desktop app and check the console:

```bash
npm run dev:desktop
```

You should see:
```
✅ Code Indexer initialized (GitHub + OpenAI + Anthropic + Supabase)
```

## Usage

### From Desktop App (IPC)

The desktop app provides these IPC handlers:

```javascript
// Check if indexer is available
const { available, checks } = await ipcRenderer.invoke('codeIndexer:checkAvailability');

// Index a repository
const result = await ipcRenderer.invoke('codeIndexer:indexRepository', {
  owner: 'beachbaby',
  repo: 'HeyJarvis',
  branch: 'main' // optional
});

// Query the codebase
const answer = await ipcRenderer.invoke('codeIndexer:query', {
  owner: 'beachbaby',
  repo: 'HeyJarvis',
  question: 'Do we have SSO authentication?'
});

console.log(answer.answer); // Business-friendly explanation
console.log(answer.sources); // Code references
```

### Programmatic Usage

```javascript
const CodeIndexer = require('./core/intelligence/code-indexer');

const indexer = new CodeIndexer();

// Index a repository
await indexer.indexRepository('owner', 'repo', 'main');

// Query the code
const result = await indexer.query('Do we support OAuth?', {
  owner: 'owner',
  repo: 'repo'
});

console.log(result.answer);
console.log(result.confidence); // high, medium, low
console.log(result.sources); // Array of file paths and code references
```

## API Costs

Estimated costs for indexing:

- **Embedding Generation**: ~$0.02 per 1M tokens (OpenAI text-embedding-3-small)
- **Query Answering**: ~$3 per 1M input tokens (Claude Sonnet)

Typical repository (5,000 lines of code):
- Indexing: ~$0.10 (one-time)
- Query: ~$0.01 per question

## Sample Queries

Perfect for sales executives:

- "Do we have SSO authentication?"
- "What third-party integrations are supported?"
- "Can users customize their dashboard?"
- "How does real-time sync work?"
- "What APIs are available?"
- "Is there role-based access control?"
- "Can we integrate with Slack?"

## Architecture Details

### Components

1. **RepositoryFileFetcher** (`core/intelligence/repository-file-fetcher.js`)
   - Fetches code files from GitHub using GitHub App
   - Filters relevant source files (.js, .ts, .py, etc.)
   - Excludes binaries and build artifacts

2. **CodeChunker** (`core/intelligence/code-chunker.js`)
   - Splits files into semantic chunks (functions, classes)
   - Preserves imports and context
   - Keeps chunks 500-1000 tokens

3. **EmbeddingService** (`core/intelligence/embedding-service.js`)
   - Generates embeddings using OpenAI
   - Batch processing for efficiency
   - Caching to avoid re-computation

4. **CodeVectorStore** (`data/storage/code-vector-store.js`)
   - Stores chunks with embeddings in Supabase
   - Provides semantic similarity search
   - Tracks indexing status

5. **CodeQueryEngine** (`core/intelligence/code-query-engine.js`)
   - Accepts natural language questions
   - Performs semantic search
   - Uses Claude to generate business-friendly answers

6. **CodeIndexer** (`core/intelligence/code-indexer.js`)
   - Main orchestrator
   - Manages workflow and progress tracking
   - Emits events for UI updates

### Events

The indexer emits events for real-time progress:

```javascript
indexer.on('indexing:started', (job) => {
  console.log(`Started: ${job.owner}/${job.repo}`);
});

indexer.on('indexing:progress', (job) => {
  console.log(`Progress: ${job.phase} (${job.progress}%)`);
});

indexer.on('indexing:completed', (job) => {
  console.log(`Completed: ${job.result.chunks} chunks indexed`);
});

indexer.on('indexing:failed', (job) => {
  console.error(`Failed: ${job.error}`);
});
```

## Troubleshooting

### "Code Indexer not configured"

Check that all environment variables are set:
```bash
echo $GITHUB_APP_ID
echo $OPENAI_API_KEY
echo $ANTHROPIC_API_KEY
echo $SUPABASE_URL
```

### "Failed to generate embedding"

- Verify OpenAI API key is valid
- Check rate limits
- Ensure billing is set up on OpenAI account

### "Search failed"

- Verify Supabase connection
- Ensure migration was run successfully
- Check that pgvector extension is enabled

### "No relevant code chunks found"

- Repository may not be indexed yet
- Try indexing: `codeIndexer:indexRepository`
- Check indexing status: `codeIndexer:getStatus`

## Logs

All services write structured logs to:
- `logs/file-fetcher.log`
- `logs/code-chunker.log`
- `logs/embedding-service.log`
- `logs/vector-store.log`
- `logs/query-engine.log`
- `logs/code-indexer.log`

## Next Steps

1. Add UI for indexing management in desktop app
2. Implement incremental indexing (only index changed files)
3. Add support for more programming languages
4. Build analytics dashboard for query patterns
5. Add caching layer for frequent queries

