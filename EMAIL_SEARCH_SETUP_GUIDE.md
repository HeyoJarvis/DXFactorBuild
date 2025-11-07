# Email Semantic Search & Synthesis Setup Guide

This guide explains how to set up and use the email semantic search and synthesis feature that allows you to query your emails with natural language and get AI-generated summaries.

## Architecture Overview

```
User Query (Natural Language)
    ↓
[Email Query Engine] (JavaScript)
    ├→ Generate Query Embedding (OpenAI)
    ├→ Semantic Search (Supabase pgvector)
    ├→ Format Email Context
    └→ Generate Answer (Claude AI)
    ↓
AI Summary with Email Citations
```

## Components Created

### 1. Database (Supabase)
- **Migration**: `/extra_feature_desktop/migrations/003_email_vector_store.sql`
- **Tables**:
  - `email_chunks` - Stores emails with vector embeddings
  - `email_indexing_status` - Tracks indexing progress
- **Functions**:
  - `search_email_chunks()` - Semantic search RPC
  - `get_user_email_stats()` - Statistics RPC

### 2. Backend Services
- **Email Vector Store**: `/data/storage/email-vector-store.js`
  - Manages email storage/retrieval in Supabase
  - Handles deduplication
  - Semantic search operations

- **Email Indexer**: `/core/intelligence/email-indexer.js`
  - Indexes emails from Gmail/Outlook/LinkedIn
  - Generates embeddings
  - Batch processing with progress tracking
  - Incremental updates (skips already-indexed emails)

- **Email Query Engine**: `/core/intelligence/email-query-engine.js`
  - Natural language query processing
  - Claude AI for synthesis
  - Multi-email analysis
  - Confidence scoring

### 3. IPC Handlers
- **File**: `/desktop2/main/ipc/email-handlers.js`
- **Handlers**:
  - `email:index` - Index multiple emails
  - `email:index-single` - Index one email in real-time
  - `email:query` - Natural language search
  - `email:stats` - Get statistics
  - `email:reindex` - Re-index all emails
  - `email:find-by-date` - Date range queries
  - `email:indexing-status` - Check indexing status

## Setup Instructions

### Step 1: Run Database Migration

```bash
# Connect to your Supabase project
# Run the migration file:
psql $SUPABASE_DB_URL -f extra_feature_desktop/migrations/003_email_vector_store.sql
```

Or use Supabase Dashboard:
1. Go to SQL Editor
2. Paste contents of `003_email_vector_store.sql`
3. Run the migration

### Step 2: Verify Environment Variables

Ensure these are set in your `.env`:

```bash
# Required for email indexing
OPENAI_API_KEY=sk-...          # For embeddings
ANTHROPIC_API_KEY=sk-ant-...   # For Claude AI synthesis
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=eyJ...
```

### Step 3: Test the System

```javascript
// Test indexing
const result = await window.electronAPI.email.index({
  emails: yourEmails,
  userId: currentUserId,
  provider: 'gmail' // or 'outlook', 'linkedin'
});

console.log(`Indexed: ${result.indexed}, Skipped: ${result.skipped}`);

// Test querying
const answer = await window.electronAPI.email.query({
  query: "Find emails about pricing discussions",
  userId: currentUserId,
  filters: {
    provider: 'gmail',
    category: 'sales',
    dateFrom: '2024-01-01',
    dateTo: '2024-12-31'
  }
});

console.log(answer.answer);
console.log(`Found ${answer.emails.length} relevant emails`);
```

## Frontend Integration

### Step 1: Add IPC API to preload

Add to `/desktop2/main/preload.js`:

```javascript
email: {
  index: (data) => ipcRenderer.invoke('email:index', data),
  indexSingle: (data) => ipcRenderer.invoke('email:index-single', data),
  query: (data) => ipcRenderer.invoke('email:query', data),
  stats: (data) => ipcRenderer.invoke('email:stats', data),
  reindex: (data) => ipcRenderer.invoke('email:reindex', data),
  findByDate: (data) => ipcRenderer.invoke('email:find-by-date', data),
  indexingStatus: (data) => ipcRenderer.invoke('email:indexing-status', data)
}
```

### Step 2: Auto-Index Emails in UniboxCarousel

In your `UniboxCarousel.jsx`, add indexing after emails load:

```javascript
useEffect(() => {
  loadMessages();
}, []);

const loadMessages = async () => {
  try {
    setLoading(true);
    const result = await window.electronAPI.inbox.getUnified({
      maxResults: 500,
      includeSources: ['email', 'linkedin']
    });

    if (result.success && result.messages) {
      setMessages(result.messages);

      // Auto-index emails in background
      indexEmailsInBackground(result.messages);
    }
  } catch (error) {
    console.error('Failed to load messages:', error);
  } finally {
    setLoading(false);
  }
};

const indexEmailsInBackground = async (emails) => {
  try {
    const userId = getCurrentUserId(); // Get from your auth context
    const provider = 'gmail'; // Detect from emails

    const result = await window.electronAPI.email.index({
      emails,
      userId,
      provider
    });

    console.log(`✅ Indexed ${result.indexed} emails, skipped ${result.skipped}`);
  } catch (error) {
    console.error('Failed to index emails:', error);
  }
};
```

### Step 3: Add AI Search UI

Add AI search button and query function:

```javascript
const [aiQuery, setAiQuery] = useState('');
const [aiResult, setAiResult] = useState(null);
const [isQuerying, setIsQuerying] = useState(false);

const handleAISearch = async () => {
  if (!aiQuery.trim()) return;

  setIsQuerying(true);
  try {
    const result = await window.electronAPI.email.query({
      query: aiQuery,
      userId: getCurrentUserId(),
      filters: {
        provider: 'gmail',
        // Add other filters as needed
      }
    });

    setAiResult(result);
  } catch (error) {
    console.error('AI search failed:', error);
  } finally {
    setIsQuerying(false);
  }
};
```

## Usage Examples

### Example 1: Basic Query
```javascript
const result = await window.electronAPI.email.query({
  query: "What did John say about the pricing proposal?",
  userId: "user-123",
  filters: {}
});

// Result:
// {
//   success: true,
//   answer: "Based on the emails from John...",
//   emails: [
//     { from: "John Smith", subject: "RE: Pricing", ... }
//   ],
//   confidence: "high",
//   totalEmails: 3
// }
```

### Example 2: Category Filter
```javascript
const result = await window.electronAPI.email.query({
  query: "Summarize all sales discussions this month",
  userId: "user-123",
  filters: {
    category: 'sales',
    dateFrom: '2024-11-01',
    dateTo: '2024-11-30'
  }
});
```

### Example 3: Provider-Specific Search
```javascript
const result = await window.electronAPI.email.query({
  query: "Find LinkedIn messages about partnerships",
  userId: "user-123",
  filters: {
    provider: 'linkedin',
    tags: ['partnership', 'collaboration']
  }
});
```

## Performance & Caching

### Automatic Caching
- Emails are indexed **once** and stored in Supabase
- Subsequent loads skip already-indexed emails (super fast!)
- No need to re-index on every app launch

### Incremental Indexing
```javascript
// Only new emails are indexed
const result = await window.electronAPI.email.index({
  emails: allEmails,  // Pass all 500 emails
  userId: userId,
  provider: 'gmail'
});

// Output: "Indexed: 10, Skipped: 490"
// Only 10 new emails were indexed, 490 were already in DB
```

### Real-Time Indexing
```javascript
// When a new email arrives
const newEmail = { ... };

await window.electronAPI.email.indexSingle({
  email: newEmail,
  userId: userId,
  provider: 'gmail'
});
```

## Monitoring & Statistics

```javascript
// Get indexing statistics
const stats = await window.electronAPI.email.stats({
  userId: userId
});

console.log(stats);
// {
//   total_emails: 500,
//   indexed_emails: 500,
//   providers: { gmail: 450, outlook: 50 },
//   categories: { sales: 200, support: 150, marketing: 150 },
//   date_range: { earliest: "2024-01-01", latest: "2024-11-06" }
// }
```

## Cost Estimation

### OpenAI Embeddings
- Model: `text-embedding-3-small`
- Cost: ~$0.02 per 1M tokens
- Average email: ~500 tokens
- **500 emails ≈ 250K tokens ≈ $0.005 (half a cent)**

### Claude AI Queries
- Model: `claude-3-haiku-20240307`
- Cost: ~$0.25 per 1M input tokens, ~$1.25 per 1M output tokens
- Average query: ~5K input + 500 output tokens
- **Cost per query: ~$0.002 (2/10ths of a cent)**

### Total Cost Example
- Index 1000 emails: **~$0.01**
- 100 AI queries: **~$0.20**
- **Total: ~$0.21 for complete setup + heavy usage**

## Troubleshooting

### Issue: Emails not indexing
**Check:**
1. Are `OPENAI_API_KEY` and `SUPABASE_URL` set?
2. Is the migration run successfully?
3. Check console for errors

### Issue: Search not finding relevant emails
**Solutions:**
1. Lower search threshold: `searchThreshold: 0.2` (default is 0.3)
2. Increase result limit: `searchLimit: 20` (default is 15)
3. Check if emails are actually indexed: `email:stats`

### Issue: Slow indexing
**Optimization:**
1. Increase batch size: `batchSize: 50` (default is 20)
2. Process in chunks (already done automatically)
3. Index in background after UI loads

## Next Steps

1. **Run the migration** to create database tables
2. **Test with a small batch** of emails first
3. **Monitor the logs** for any errors
4. **Add the UI components** (AI search button, results panel)
5. **Deploy and enjoy** semantic email search!

## Support

For issues or questions:
- Check logs in `/logs/email-vector-store.log` and `/logs/email-query-engine.log`
- Review migration status in Supabase dashboard
- Test individual components with the examples above
